import { expect, test, type Page, type Route } from '@playwright/test';

import type { ColegaDaLista, PaginaDeColegas, PerfilDaComunidade } from '../src/api/comunidadeTipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, erroApi, json, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * Lista de colegas (aba "Colegas" da Comunidade) e o perfil do colega no estilo Steam, com a API simulada no formato real de
 * `GET /aluno/comunidade/perfis?pagina=&tamanho=`, `GET /aluno/comunidade/perfis/{id}` e `.../{id}/foto` (V070). Só dados
 * fictícios; a foto é um degradê gerado no navegador.
 */
const CAPTURAS = process.env.CAPTURAS_DIR;
const TEMAS = [['claro', 'CLARO', 'PADRAO'], ['escuro', 'ESCURO', 'PADRAO'], ['areia', 'AREIA', 'PADRAO'], ['contraste', 'CLARO', 'ALTO']] as const;

/** Dia de Brasília (UTC−3 fixo, como o app) de `n` dias atrás. */
const diaAtras = (n: number) => new Date(Date.now() - 3 * 3600e3 - n * 864e5).toISOString().slice(0, 10);

const colega = (i: number, extra: Partial<ColegaDaLista> = {}): ColegaDaLista => ({
  autorId: `c${i}`, nome: `Colega Fictício ${String(i).padStart(2, '0')}`, apelido: null, nivel: 1 + (i % 4), temFoto: false, ...extra,
});
const COLEGAS = [colega(1, { nome: 'Ana Fictícia', apelido: 'Aninha', nivel: 3, temFoto: true }), ...Array.from({ length: 31 }, (_, i) => colega(i + 2))];

const VISIVEL: PerfilDaComunidade = {
  autorId: 'c1', nome: 'Ana Fictícia', apelido: 'Aninha', ehVoce: false, reservado: false, treinosConcluidos: 42, nivel: 3,
  conquistas: [
    { tipo: 'PRIMEIRO_TREINO', titulo: 'Primeiro treino', descricao: 'Concluiu o primeiro treino.', icone: 'trophy-first' },
    { tipo: 'DEZ_TREINOS', titulo: 'Dez treinos', descricao: 'Concluiu dez treinos.', icone: 'medal-10' },
    { tipo: 'SEMANA_COMPLETA', titulo: 'Semana completa', descricao: 'Fez todos os treinos da semana.', icone: 'calendar-week' },
  ],
  destaques: [
    { tipo: 'DEZ_TREINOS', titulo: 'Dez treinos', icone: 'medal-10' },
    { tipo: 'SEMANA_COMPLETA', titulo: 'Semana completa', icone: 'calendar-week' },
  ],
  cor: 'LARANJA', moldura: 'DUPLA', temFoto: true,
  atividade: {
    diasTreinadosUltimos30: [20, 18, 15, 13, 11, 8, 6, 4, 2, 1, 0].map(diaAtras),
    ultimasConquistas: [{ tipo: 'SEMANA_COMPLETA', titulo: 'Semana completa', icone: 'calendar-week', data: diaAtras(3) }],
  },
  recordes: [{ exercicio: 'Supino reto', carga: 60 }, { exercicio: 'Agachamento livre', carga: 100 }],
};
const RESERVADO: PerfilDaComunidade = { autorId: 'c2', nome: 'Colega Fictício 02', apelido: null, ehVoce: false, reservado: true };

/** Degradê JPEG gerado no próprio navegador, sem pessoa nenhuma. */
async function jpegFicticio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const degrade = ctx.createLinearGradient(0, 0, 128, 128);
    degrade.addColorStop(0, '#d9b38c');
    degrade.addColorStop(1, '#5a7d9a');
    ctx.fillStyle = degrade;
    ctx.fillRect(0, 0, 128, 128);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

/** A API dos colegas: lista paginada como a do servidor e um perfil por id; `perfil` decide a resposta de cada um. */
async function abrirColegas(page: Page, o: { lista?: ColegaDaLista[]; perfil?: (id: string, route: Route) => Promise<void> } = {}) {
  const lista = o.lista ?? COLEGAS;
  const jpeg = await jpegFicticio(page);
  const rotas: RespostasApi = {
    'GET /aluno/comunidade/mural': { corpo: { content: [], totalElements: 0 } },
    'GET /aluno/comunidade/aulas': { corpo: [] },
    'GET /aluno/comunidade/conquistas': { corpo: [] },
    'GET /aluno/comunidade/ranking': { corpo: { posicao: 1, treinosConcluidos: 0, pontuacao: 0, participantes: 1 } },
    'GET /aluno/comunidade/perfis': (p: PedidoFalso, route: Route) => {
      const n = Number(p.busca.get('pagina') ?? 0);
      const tamanho = Number(p.busca.get('tamanho') ?? 30);
      const corpo: PaginaDeColegas = { itens: lista.slice(n * tamanho, (n + 1) * tamanho), total: lista.length };
      return json(route, corpo);
    },
    'GET /aluno/comunidade/perfis/{id}': (p: PedidoFalso, route: Route) => {
      const id = p.caminho.split('/').at(-1)!;
      if (o.perfil) return o.perfil(id, route);
      if (id === 'c1') return json(route, VISIVEL);
      if (id === 'c2') return json(route, RESERVADO);
      // Os demais: visíveis, sem foto, novatos.
      return json(route, { autorId: id, nome: `Colega ${id}`, apelido: null, ehVoce: false, reservado: false, treinosConcluidos: 1, nivel: 1, conquistas: [], destaques: [], temFoto: false, atividade: { diasTreinadosUltimos30: [], ultimasConquistas: [] }, recordes: [] });
    },
    'GET /aluno/comunidade/perfis/{id}/foto': (p: PedidoFalso, route: Route) => (p.caminho === '/aluno/comunidade/perfis/c1/foto'
      ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg })
      : json(route, erroApi(404, 'Perfil não encontrado.', 'NAO_ENCONTRADO').corpo, 404)),
  };
  const api = await simularApi(page, { ...(await sessaoDeAluno(page)), ...rotas });
  await page.goto('/aluno/comunidade?aba=colegas');
  return api;
}

async function tema(page: Page, t: string, contraste: string) {
  await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [ALUNO.id, t, contraste]);
}
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}
/** A folha rola por dentro: a janela cresce para a captura pegar o perfil inteiro e volta depois. */
async function capturarFolha(page: Page, nome: string) {
  if (!CAPTURAS) return;
  const antes = page.viewportSize()!;
  await page.setViewportSize({ width: antes.width, height: 2200 });
  await page.screenshot({ path: `${CAPTURAS}/${nome}.png` });
  await page.setViewportSize(antes);
}

const pedidosDe = (pedidos: PedidoFalso[], prefixo: string) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho.startsWith(prefixo)).map((p) => p.caminho);

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const [nome, t, contraste] of TEMAS) {
      test(`tema ${nome}: lista com "Ver mais" e o perfil visível com foto, destaques, atividade, insígnias e recordes`, async ({ page }) => {
        await tema(page, t, contraste);
        const api = await abrirColegas(page);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page.getByRole('tab', { name: 'Colegas' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText('Ana Fictícia', { exact: true })).toBeVisible();
        await expect(page.getByText('«Aninha»')).toBeVisible();
        await expect(page.getByText('Colega Fictício 30', { exact: true })).toBeVisible();
        await expect(page.getByText('Colega Fictício 31', { exact: true })).toHaveCount(0);
        // O total nunca aparece escrito.
        await expect(page.getByText(/\b32\b/)).toHaveCount(0);
        const verPerfil = page.getByRole('button', { name: 'Ver perfil de Ana Fictícia' });
        expect((await verPerfil.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await capturar(page, `colegas-lista-${nome}-${largura}`);

        await page.getByRole('button', { name: 'Ver mais colegas' }).click();
        await expect(page.getByText('Colega Fictício 32', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ver mais colegas' })).toHaveCount(0);
        expect(api.pedidos.filter((p) => p.caminho === '/aluno/comunidade/perfis').map((p) => p.busca.toString())).toEqual(['pagina=0&tamanho=30', 'pagina=1&tamanho=30']);

        await verPerfil.focus();
        await page.keyboard.press('Enter');
        const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
        await expect(folha.getByText('Nível 3', { exact: true })).toBeVisible();
        await expect(folha.getByText('42 treinos concluídos')).toBeVisible();
        await expect(folha.locator('img')).toHaveCount(1);
        await expect(folha.getByRole('heading', { name: 'Destaques' })).toBeVisible();
        await expect(folha.getByText('Treinou em 11 dias dos últimos 30', { exact: false })).toBeVisible();
        await expect(folha.getByTestId('dia-treinado')).toHaveCount(11);
        await expect(folha.getByTestId('dia-sem-treino')).toHaveCount(19);
        await expect(folha.getByRole('heading', { name: 'Insígnias' })).toBeVisible();
        await expect(folha.getByText('Concluiu dez treinos.')).toBeVisible();
        await expect(folha.getByText('60 kg')).toBeVisible();
        await expect(folha.getByText('100 kg')).toBeVisible();
        // Nunca o horário de uma conquista.
        await expect(folha.getByText(/\d{1,2}:\d{2}/)).toHaveCount(0);
        await capturarFolha(page, `colegas-perfil-${nome}-${largura}`);
        // A foto vem uma vez para a linha da lista e outra para a folha (sem cache: `no-store`); os outros colegas não têm foto.
        expect(pedidosDe(api.pedidos, '/aluno/comunidade/perfis/')).toEqual(['/aluno/comunidade/perfis/c1/foto', '/aluno/comunidade/perfis/c1', '/aluno/comunidade/perfis/c1/foto']);
        expect(api.naoTratadas).toEqual([]);
        expect(api.errosDaPagina).toEqual([]);
      });
    }

    test('reservado mostra só nome e aviso; sem foto não busca a foto', async ({ page }) => {
      const api = await abrirColegas(page);
      await page.getByRole('button', { name: 'Ver perfil de Colega Fictício 02' }).click();
      const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await expect(folha.getByText('Este aluno reservou o perfil.')).toBeVisible();
      await expect(folha.getByText(/^Nível/)).toHaveCount(0);
      await expect(folha.getByRole('heading', { name: 'Insígnias' })).toHaveCount(0);
      await expect(folha.getByRole('heading', { name: 'Recordes de carga' })).toHaveCount(0);
      await expect(folha.locator('img')).toHaveCount(0);
      await capturarFolha(page, `colegas-reservado-${largura}`);
      await page.keyboard.press('Escape');

      // Visível e sem foto: perfil inteiro com as iniciais, nenhum pedido de foto.
      await page.getByRole('button', { name: 'Ver perfil de Colega Fictício 03' }).click();
      await expect(folha.getByText('Nível 1', { exact: true })).toBeVisible();
      await expect(folha.locator('img')).toHaveCount(0);
      await expect(folha.getByText('Nenhum recorde de carga ainda.')).toBeVisible();
      await capturarFolha(page, `colegas-sem-foto-${largura}`);
      // Só a linha da Ana (que tem foto) pediu foto; reservado e sem foto, nenhuma.
      expect(pedidosDe(api.pedidos, '/aluno/comunidade/perfis/').filter((c) => c.endsWith('/foto'))).toEqual(['/aluno/comunidade/perfis/c1/foto']);
      expect(api.errosDaPagina).toEqual([]);
    });

    test('404 é "Perfil não encontrado." sem tentar de novo; 429 tem o texto fixo e "Tentar de novo" lê de novo', async ({ page }) => {
      let resposta: '404' | '429' | 'ok' = '404';
      const api = await abrirColegas(page, {
        perfil: (id, route) => {
          if (resposta === 'ok') return json(route, { ...VISIVEL, autorId: id, temFoto: false });
          const e = resposta === '404' ? erroApi(404, 'Perfil não encontrado.', 'NAO_ENCONTRADO') : erroApi(429, 'Muitas requisições.', 'LIMITE');
          return json(route, e.corpo, e.status);
        },
      });
      const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await page.getByRole('button', { name: 'Ver perfil de Colega Fictício 05' }).click();
      await expect(folha.getByText('Perfil não encontrado.')).toBeVisible();
      await expect(folha.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
      await capturarFolha(page, `colegas-404-${largura}`);
      await page.keyboard.press('Escape');

      resposta = '429';
      await page.getByRole('button', { name: 'Ver perfil de Colega Fictício 06' }).click();
      await expect(folha.getByText('Muitos perfis abertos em pouco tempo. Espere alguns minutos e tente de novo.')).toBeVisible();
      await capturarFolha(page, `colegas-429-${largura}`);
      resposta = 'ok';
      await folha.getByRole('button', { name: 'Tentar de novo' }).click();
      await expect(folha.getByText('Nível 3', { exact: true })).toBeVisible();
      expect(api.errosDaPagina).toEqual([]);
    });

    test('lista vazia tem o texto próprio', async ({ page }) => {
      const api = await abrirColegas(page, { lista: [] });
      await expect(page.getByText('Ainda não há colegas com perfil visível.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver mais colegas' })).toHaveCount(0);
      await capturar(page, `colegas-vazia-${largura}`);
      expect(api.naoTratadas).toEqual([]);
    });

    test('sem internet a folha diz isso e não mostra o perfil lido; na volta lê de novo', async ({ page }) => {
      const api = await abrirColegas(page);
      await page.getByRole('button', { name: 'Ver perfil de Ana Fictícia' }).click();
      const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await expect(folha.getByText('Nível 3', { exact: true })).toBeVisible();
      await page.context().setOffline(true);
      await expect(folha.getByText('Sem conexão. O perfil aparece quando o aparelho voltar a ter internet.')).toBeVisible();
      await expect(folha.getByText('Nível 3', { exact: true })).toHaveCount(0);
      await expect(folha.getByText('Ana Fictícia', { exact: true })).toHaveCount(0);
      await capturarFolha(page, `colegas-offline-${largura}`);
      await page.context().setOffline(false);
      // O Chromium emulado não avisa o NetInfo quando a rede volta; o navegador de verdade avisa.
      await page.evaluate(() => (navigator as Navigator & { connection?: EventTarget }).connection?.dispatchEvent(new Event('change')));
      await expect(folha.getByText('Nível 3', { exact: true })).toBeVisible();
      expect(pedidosDe(api.pedidos, '/aluno/comunidade/perfis/c1').filter((c) => !c.endsWith('/foto'))).toHaveLength(2);
      expect(api.errosDaPagina).toEqual([]);
    });
  });
}
