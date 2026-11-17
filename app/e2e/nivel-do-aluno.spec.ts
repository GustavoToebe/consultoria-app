import { expect, test, type Page, type Route } from '@playwright/test';

import type { ColegaDaLista, PerfilDaComunidade, PosicaoNoRanking } from '../src/api/comunidadeTipos';
import { dietaFalsa, fixarHoje, RANKING_SEM_TREINO, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';
import { ALUNO, erroApi, json, sessao, simularApi, type PedidoFalso, type RespostasApi } from './api-falsa';

/**
 * "Seu nível" no Início do aluno (plano `xp-e-niveis`, passo 3): o nível, a barra até o próximo e o que falta, do
 * `GET /aluno/comunidade/ranking`, só com o retorno ligado. A sigla XP nunca aparece; o colega só vê "Nível N". Relógio em
 * segunda, 19/10/2026 (o treino de hoje é o A). Só dados fictícios.
 */
const CAPTURAS = process.env.CAPTURAS_DIR;
const TEMAS = [['claro', 'CLARO'], ['areia', 'AREIA'], ['escuro', 'ESCURO']] as const;

const NIVEL_3: PosicaoNoRanking = { posicao: 2, treinosConcluidos: 21, pontuacao: 210, participantes: 9, nivel: 3, xp: 260, xpNoNivel: 60, faltam: 40 };

async function tema(page: Page, t: string) {
  await page.addInitScript(([id, tm]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: 'PADRAO' })), [ALUNO.id, t]);
}
async function capturar(page: Page, nome: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nome}.png`, fullPage: true });
}

/** Início com o plano A/B/C, a dieta e o retorno ligado (ou não); `ranking` é a resposta da rota do nível. */
async function abrirInicio(page: Page, ranking: RespostasApi[string], { retorno = true }: { retorno?: boolean } = {}) {
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: retorno })),
    'GET /aluno/dieta': { corpo: dietaFalsa(6, null) },
    'GET /aluno/atualizacao': erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    'GET /aluno/comunidade/ranking': ranking,
  });
  await page.goto('/aluno');
  return api;
}

const pedidosDoRanking = (pedidos: PedidoFalso[]) => pedidos.filter((p) => p.caminho === '/aluno/comunidade/ranking').length;

for (const largura of [390, 1280]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const [nome, t] of TEMAS) {
      test(`tema ${nome}: nível 3 com a barra e o que falta, sem a sigla XP e sem tirar o Hoje da primeira tela`, async ({ page }) => {
        await tema(page, t);
        const api = await abrirInicio(page, { corpo: NIVEL_3 });
        const cartao = page.getByRole('heading', { name: 'Seu nível', level: 2 });
        await expect(cartao).toBeVisible();
        await expect(page.getByText('Nível 3', { exact: true })).toBeVisible();
        await expect(page.getByText('Faltam 40 para o nível 4', { exact: true })).toBeVisible();

        // A barra é um progressbar com nome e valor em texto; o máximo é o tamanho do nível (60 + 40), nunca o XP total.
        const barra = page.getByRole('progressbar', { name: 'Progresso até o nível 4' });
        await expect(barra).toHaveAttribute('aria-valuenow', '60');
        await expect(barra).toHaveAttribute('aria-valuemax', '100');
        await expect(barra).toHaveAttribute('aria-valuetext', 'Nível 3. Faltam 40 para o nível 4.');

        await expect(page.getByText(/\bXP\b/i)).toHaveCount(0);
        await expect(page.getByText('260')).toHaveCount(0);
        // O cartão vem depois do Hoje: o botão do treino continua na primeira tela.
        await expect(page.getByRole('button', { name: /^Ver meu treino/ })).toBeInViewport();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        expect(api.errosDaPagina).toEqual([]);
        expect(api.naoTratadas).toEqual([]);
        await cartao.scrollIntoViewIfNeeded();
        await capturar(page, `nivel-inicio-${nome}-${largura}`);
      });
    }

    test('sem treino ainda: nível 1, barra vazia e "Faltam 100"', async ({ page }) => {
      await abrirInicio(page, { corpo: RANKING_SEM_TREINO });
      await expect(page.getByText('Nível 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Faltam 100 para o nível 2', { exact: true })).toBeVisible();
      await expect(page.getByRole('progressbar', { name: 'Progresso até o nível 2' })).toHaveAttribute('aria-valuenow', '0');
      await capturar(page, `nivel-inicio-nivel-1-${largura}`);
    });

    test('no fim do nível, "Falta 1" no singular', async ({ page }) => {
      await abrirInicio(page, { corpo: { ...NIVEL_3, xp: 299, xpNoNivel: 99, faltam: 1 } });
      await expect(page.getByText('Falta 1 para o nível 4', { exact: true })).toBeVisible();
    });

    test('carregando mostra o esqueleto; erro da API mostra a mensagem com "Tentar de novo", que lê de novo', async ({ page }) => {
      let liberar: () => void = () => undefined;
      const espera = new Promise<void>((r) => { liberar = r; });
      // Um sinal, não a contagem de pedidos: se o foco ler duas vezes ao montar, as duas continuam no erro.
      let falhar = true;
      await abrirInicio(page, async (_p: PedidoFalso, route: Route) => {
        if (!falhar) return json(route, NIVEL_3);
        await espera;
        return json(route, erroApi(500, 'Erro interno.').corpo, 500);
      });
      await expect(page.getByRole('progressbar', { name: 'Carregando seu nível' })).toBeVisible();
      liberar();
      await expect(page.getByRole('heading', { name: 'Seu nível' })).toBeVisible();
      const tentar = page.getByRole('button', { name: 'Tentar de novo' });
      await expect(tentar).toBeVisible();
      await capturar(page, `nivel-inicio-erro-${largura}`);
      falhar = false;
      await tentar.click();
      await expect(page.getByText('Nível 3', { exact: true })).toBeVisible();
      await expect(tentar).toHaveCount(0);
    });

    test('sem internet fica o último nível lido, com o aviso', async ({ page }) => {
      await abrirInicio(page, { corpo: NIVEL_3 });
      await expect(page.getByText('Nível 3', { exact: true })).toBeVisible();
      await page.context().setOffline(true);
      await expect(page.getByText('Sem conexão: mostrando o último nível lido.')).toBeVisible();
      await expect(page.getByText('Faltam 40 para o nível 4', { exact: true })).toBeVisible();
      await capturar(page, `nivel-inicio-offline-${largura}`);
      await page.context().setOffline(false);
    });

    test('com o retorno desligado o cartão não existe e o nível nem é pedido', async ({ page }) => {
      const api = await abrirInicio(page, { corpo: NIVEL_3 }, { retorno: false });
      await expect(page.getByRole('heading', { name: 'Sua semana' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Seu nível' })).toHaveCount(0);
      expect(pedidosDoRanking(api.pedidos)).toBe(0);
    });

    test('colega: a lista e o perfil mostram só "Nível N", sem barra nem o que falta', async ({ page }) => {
      const colega: ColegaDaLista = { autorId: 'c1', nome: 'Ana Fictícia', apelido: null, nivel: 4, temFoto: false };
      const perfil = (id: string): PerfilDaComunidade => ({
        autorId: id, nome: id === ALUNO.id ? 'Aluno Fictício' : 'Ana Fictícia', apelido: null, ehVoce: id === ALUNO.id, reservado: false,
        treinosConcluidos: 30, nivel: 4, conquistas: [], destaques: [], temFoto: false,
        atividade: { diasTreinadosUltimos30: [], ultimasConquistas: [] }, recordes: [],
      });
      await fixarHoje(page);
      await simularApi(page, {
        ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
        ...(await sessao(page, ALUNO, { retornoHabilitado: true })),
        'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
        'GET /aluno/comunidade/ranking': { corpo: NIVEL_3 },
        'GET /aluno/comunidade/configuracao': { corpo: { alunosPublicam: true, podeAnexarFoto: false } },
        'GET /aluno/comunidade/mural': { corpo: { content: [], totalElements: 0 } },
        'GET /aluno/comunidade/aulas': { corpo: [] },
        'GET /aluno/comunidade/conquistas': { corpo: [] },
        'GET /aluno/comunidade/perfis': { corpo: { itens: [colega], total: 1 } },
        'GET /aluno/comunidade/perfis/{id}': (p: PedidoFalso, route: Route) => json(route, perfil(p.caminho.split('/').at(-1)!)),
      });
      await page.goto('/aluno/comunidade?aba=colegas');
      await expect(page.getByText('Nível 4', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ver perfil de Ana Fictícia' }).click();
      const folha = page.getByRole('dialog', { name: 'Perfil na Comunidade' });
      await expect(folha.getByText('Nível 4', { exact: true })).toBeVisible();
      await expect(folha.getByRole('heading', { name: 'Seu nível' })).toHaveCount(0);
      await expect(folha.getByText(/\bXP\b|Faltam|Falta 1/i)).toHaveCount(0);
      await capturar(page, `nivel-perfil-colega-${largura}`);
    });
  });
}
