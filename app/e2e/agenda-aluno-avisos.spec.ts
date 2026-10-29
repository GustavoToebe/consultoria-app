import { expect, test, type Page } from '@playwright/test';

import type { AvisoDeCompromisso, CompromissoDoAluno } from '../src/api/agendaTipos';
import { erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';
import { fixarHoje, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';

/**
 * Avisos de compromisso no Início do aluno (agenda-calendario D12): compromisso novo, remarcado ou cancelado vira um item
 * em "Suas pendências" com o ponto na aba Início; tocar marca como visto (POST) e leva ao cartão "Seus compromissos". Sem
 * rede o Início abre sem aviso e sem ponto. O relógio fica em segunda-feira, 19/10/2026, 12:00 de Brasília. Só dados
 * fictícios.
 */

const NOVO: AvisoDeCompromisso = { id: 'av000000-0000-4000-8000-000000000001', tipo: 'NOVO', inicio: '2026-11-05T12:00:00Z', responsavelNome: 'Treinadora Teste' };
const REMARCADO: AvisoDeCompromisso = { id: 'av000000-0000-4000-8000-000000000002', tipo: 'REMARCADO', inicio: '2026-11-06T17:30:00Z', responsavelNome: 'Treinadora Teste' };
const CANCELADO: AvisoDeCompromisso = { id: 'av000000-0000-4000-8000-000000000003', tipo: 'CANCELADO', inicio: '2026-11-09T13:00:00Z', responsavelNome: null };

const TEXTO_NOVO = 'Novo compromisso: 05/11 às 09:00 com Treinadora Teste';
const TEXTO_REMARCADO = 'Compromisso remarcado: agora 06/11 às 14:30 com Treinadora Teste';
const TEXTO_CANCELADO = 'Compromisso cancelado: 09/11 às 10:00 com a equipe';

function compromisso(id: string, inicioUtc: string, situacao: CompromissoDoAluno['situacao'] = 'AGENDADO'): CompromissoDoAluno {
  const inicio = new Date(inicioUtc);
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const brasilia = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString();
  return {
    id, inicio: inicio.toISOString(), fim: fim.toISOString(), data: brasilia(inicio).slice(0, 10), hora: brasilia(inicio).slice(11, 16),
    horaFim: brasilia(fim).slice(11, 16), duracaoMinutos: 60, local: 'Sala 2', situacao, responsavelNome: 'Treinadora Teste',
  };
}
const COMPROMISSOS = [compromisso('k1', NOVO.inicio), compromisso('k2', REMARCADO.inicio), compromisso('k3', CANCELADO.inicio, 'CANCELADO')];

/** Início do aluno com os avisos dados; o servidor falso tira o aviso da lista no POST de "visto". */
async function abrirInicio(page: Page, avisos: AvisoDeCompromisso[], extra: RespostasApi = {}) {
  await fixarHoje(page);
  const estado = { pendentes: [...avisos] };
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    'GET /aluno/dieta': { corpo: { dieta: null } },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/foto-perfil': erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /aluno/compromissos': { corpo: COMPROMISSOS },
    'GET /aluno/avisos-de-compromisso': (_p, route) => json(route, estado.pendentes),
    'POST /aluno/avisos-de-compromisso/{id}/visto': (p, route) => {
      estado.pendentes = estado.pendentes.filter((a) => p.caminho !== `/aluno/avisos-de-compromisso/${a.id}/visto`);
      return route.fulfill({ status: 204 });
    },
    ...extra,
  });
  await page.goto('/aluno');
  return { ...api, estado };
}

/** Caminhos dos POST de "visto" (o refresh da sessão também é POST e fica de fora). */
const postsDeVisto = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.metodo === 'POST' && p.caminho.includes('/avisos-de-compromisso/')).map((p) => p.caminho);
const abaInicioComPonto = (page: Page) => page.getByRole('link', { name: 'Início, pendência', exact: true });
const abaInicioSemPonto = (page: Page) => page.getByRole('link', { name: 'Início', exact: true });
const itemDoAviso = (page: Page, texto: string) => page.getByRole('button', { name: new RegExp(`^${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) });

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('mostra o aviso novo, remarcado e cancelado com o texto exato, o ponto e a contagem; tocar marca visto e tira o aviso e o ponto', async ({ page }) => {
      const { pedidos, errosDaPagina, naoTratadas } = await abrirInicio(page, [NOVO, REMARCADO, CANCELADO]);

      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toBeVisible();
      await expect(page.getByLabel('3 pendências')).toBeVisible();
      await expect(page.getByText(TEXTO_NOVO, { exact: true })).toBeVisible();
      await expect(page.getByText(TEXTO_REMARCADO, { exact: true })).toBeVisible();
      await expect(page.getByText(TEXTO_CANCELADO, { exact: true })).toBeVisible();
      await expect(itemDoAviso(page, TEXTO_NOVO)).toContainText('Novo');
      await expect(itemDoAviso(page, TEXTO_REMARCADO)).toContainText('Remarcado');
      await expect(itemDoAviso(page, TEXTO_CANCELADO)).toContainText('Cancelado');
      await expect(itemDoAviso(page, TEXTO_NOVO)).toContainText('Toque para ver seus compromissos.');
      await expect(abaInicioComPonto(page)).toBeVisible();
      // Só avisa: nada de botão de confirmar presença.
      await expect(page.getByRole('button', { name: /confirmar presença/i })).toHaveCount(0);

      // Tocar marca visto (POST) e leva ao cartão "Seus compromissos", no mesmo Início.
      await itemDoAviso(page, TEXTO_NOVO).click();
      await expect(page.getByText(TEXTO_NOVO, { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('2 pendências')).toBeVisible();
      await expect(abaInicioComPonto(page)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Seus compromissos' })).toBeInViewport();
      expect(postsDeVisto(pedidos)).toEqual([`/aluno/avisos-de-compromisso/${NOVO.id}/visto`]);

      await itemDoAviso(page, TEXTO_REMARCADO).click();
      await expect(page.getByLabel('1 pendência')).toBeVisible();
      await expect(abaInicioComPonto(page)).toBeVisible();
      await itemDoAviso(page, TEXTO_CANCELADO).click();

      // Sem aviso, some o bloco e o ponto; os três POST foram, um por aviso.
      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toHaveCount(0);
      await expect(abaInicioSemPonto(page)).toBeVisible();
      await expect(abaInicioComPonto(page)).toHaveCount(0);
      expect(postsDeVisto(pedidos)).toEqual([NOVO, REMARCADO, CANCELADO].map((a) => `/aluno/avisos-de-compromisso/${a.id}/visto`));
      // O cartão com os compromissos continua lá, com a situação de cada um.
      await expect(page.getByRole('heading', { name: 'Seus compromissos' })).toBeVisible();

      // O aviso visto não volta depois de o Início recarregar (o servidor já não o devolve).
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toHaveCount(0);
      await expect(abaInicioComPonto(page)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
      expect(naoTratadas).toEqual([]);
    });

    test('sem aviso não há pendência nem ponto', async ({ page }) => {
      const { errosDaPagina } = await abrirInicio(page, []);
      await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toHaveCount(0);
      await expect(abaInicioSemPonto(page)).toBeVisible();
      await expect(abaInicioComPonto(page)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });

    test('falha de rede ao marcar visto não trava: o toque leva ao cartão e o aviso continua até o servidor confirmar', async ({ page }) => {
      const { errosDaPagina } = await abrirInicio(page, [NOVO], {
        'POST /aluno/avisos-de-compromisso/{id}/visto': (_p, route) => route.abort('internetdisconnected'),
      });
      await expect(page.getByText(TEXTO_NOVO, { exact: true })).toBeVisible();
      await itemDoAviso(page, TEXTO_NOVO).click();
      await expect(page.getByRole('heading', { name: 'Seus compromissos' })).toBeVisible();
      // Sem a confirmação, no servidor ele segue não visto: volta à lista e o ponto continua.
      await expect(page.getByText(TEXTO_NOVO, { exact: true })).toBeVisible();
      await expect(abaInicioComPonto(page)).toBeVisible();
      expect(errosDaPagina).toEqual([]);
    });

    test('sem rede o Início abre, sem aviso, sem ponto e sem o cartão de compromissos', async ({ page }) => {
      const semRede = (_p: unknown, route: { abort: (motivo?: string) => Promise<void> }) => route.abort('internetdisconnected');
      const { errosDaPagina } = await abrirInicio(page, [NOVO], {
        'GET /aluno/avisos-de-compromisso': semRede,
        'GET /aluno/compromissos': semRede,
      });
      await expect(page.getByRole('heading', { name: 'Hoje', level: 2 })).toBeVisible();
      await expect(page.getByText('TREINO A')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Suas pendências' })).toHaveCount(0);
      await expect(page.getByText(TEXTO_NOVO, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Seus compromissos' })).toHaveCount(0);
      await expect(abaInicioSemPonto(page)).toBeVisible();
      await expect(abaInicioComPonto(page)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });
  });
}
