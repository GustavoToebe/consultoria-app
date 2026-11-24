import { expect, test, type Page } from '@playwright/test';

import type { PainelTreinador } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Nulo e cobertura no Início do treinador (`docs/planos/nulo-e-cobertura.md`, D6 e D9, 13/11): contagem de atualização nula
 * por falta de permissão diz "Sem permissão" (neutro, sem número, sem link); o "Tudo em dia" só vale com todas as fontes
 * consultadas com sucesso, e as outras saídas dizem "sem acesso" ou "não foi possível conferir tudo". Dados fictícios;
 * relógio em 19/10/2026. Com `CAPTURAS=<pasta>` o teste grava as imagens (claro e escuro, 1280 e 390).
 */

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 3,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [],
  pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0, alunosSemRegistroTotal: 0, alunosSemAcesso: 0, alunosInativos: 0,
  sessoesConcluidas7Dias: 0,
};
const CONTAGENS_ZERO = { porSituacao: { NOVA: 0, EM_CONTATO: 0, EM_NEGOCIACAO: 0 }, abertas: 0, todas: 0, retornosAtrasados: 0, retornosHoje: 0 };
/** Quem lê as quatro fontes do resumo: o perfil padrão do teste não tem as permissões de atualização, treino e registro. */
const PERMISSOES_DO_RESUMO = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'REGISTRO_LER', 'TREINO_LER'];
const EM_DIA = 'Tudo em dia por aqui. Nada pede sua atenção agora.';

const TEMAS = ['CLARO', 'ESCURO'] as const;
const LARGURAS = [1280, 390] as const;

async function abrir(page: Page, o: { permissoes: string[]; painel?: PainelTreinador; extra?: RespostasApi; tema?: (typeof TEMAS)[number]; largura?: number }) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 1000 });
  await fixarHoje(page);
  if (o.tema) await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, o.tema] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes, perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
    'GET /painel': { corpo: o.painel ?? PAINEL },
    'GET /inscricoes/contagens': { corpo: CONTAGENS_ZERO },
    ...o.extra,
  });
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  return api;
}

/** A caixa do "Próximo passo" (título, texto, aviso e botão). */
const passo = (page: Page) => page.getByTestId('proximo-passo');
const capturar = async (page: Page, nome: string) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${nome}.png`, fullPage: true });
};
const falha = (_p: unknown, route: Parameters<typeof json>[0]) => json(route, erroApi(500, 'Falha.').corpo, 500);

for (const tema of TEMAS) for (const largura of LARGURAS) {
  const sufixo = `${tema.toLowerCase()}-${largura}`;

  test(`contagens de atualização nulas: "Sem permissão", sem número nem link e sem "Não carregou" (${sufixo})`, async ({ page }) => {
    const nulas = { ...PAINEL, atualizacoesParaRevisar: null, atualizacoesAtrasadas: null, atualizacoesAvisaramAtraso: null, atualizacoesProximas: null };
    const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_DO_RESUMO, painel: nulas, tema, largura });
    await expect(page.getByLabel('Atualizações para revisar: sem permissão')).toBeVisible();
    await expect(page.getByLabel('Atualizações atrasadas: sem permissão')).toBeVisible();
    await expect(page.getByLabel('Atualizações nos próximos 7 dias: sem permissão')).toBeVisible();
    await expect(page.getByText('Sem permissão', { exact: true })).toHaveCount(3);
    // Neutro: nada de link para a lista (daria 403), de número nem de "Não carregou".
    await expect(page.getByRole('link', { name: /^Atualizações (para revisar|atrasadas|nos próximos)/ })).toHaveCount(0);
    await expect(page.getByText('Não carregou', { exact: true })).toHaveCount(0);
    await capturar(page, `sem-permissao-${sufixo}`);
    expect(errosDaPagina).toEqual([]);
  });

  test(`"Tudo em dia": todas as fontes consultadas e sem pendência (${sufixo})`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_DO_RESUMO, tema, largura });
    await expect(passo(page).getByText(EM_DIA)).toBeVisible();
    await expect(page.getByText('Não foi possível conferir tudo.')).toHaveCount(0);
    await capturar(page, `resumo-em-dia-${sufixo}`);
    expect(errosDaPagina).toEqual([]);
  });

  test(`só PAINEL_VER: "Você não tem acesso aos dados deste resumo", nunca "em dia" (${sufixo})`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, { permissoes: ['PAINEL_VER'], tema, largura });
    await expect(passo(page).getByText('Você não tem acesso aos dados deste resumo.')).toBeVisible();
    await expect(page.getByText('Nada pede sua atenção agora')).toHaveCount(0);
    await expect(passo(page).getByRole('button')).toHaveCount(0);
    expect(pedidos.some((p) => p.caminho.startsWith('/inscricoes'))).toBe(false);
    await capturar(page, `resumo-sem-acesso-${sufixo}`);
    expect(errosDaPagina).toEqual([]);
  });

  test(`uma fonte falhando: "Não foi possível conferir tudo", e "Tentar de novo" refaz a consulta (${sufixo})`, async ({ page }) => {
    let falhar = true;
    const { pedidos, errosDaPagina } = await abrir(page, {
      permissoes: PERMISSOES_DO_RESUMO, tema, largura,
      extra: { 'GET /inscricoes/contagens': (p, route) => (falhar ? falha(p, route) : json(route, CONTAGENS_ZERO)) },
    });
    await expect(passo(page).getByText(/^Não foi possível conferir tudo\./)).toBeVisible();
    await expect(page.getByText('Nada pede sua atenção agora')).toHaveCount(0);
    await capturar(page, `resumo-parcial-${sufixo}`);
    falhar = false;
    const antes = pedidos.filter((p) => p.caminho === '/inscricoes/contagens').length;
    await passo(page).getByRole('button', { name: 'Tentar de novo' }).click();
    await expect.poll(() => pedidos.filter((p) => p.caminho === '/inscricoes/contagens').length).toBeGreaterThan(antes);
    await expect(passo(page).getByText(EM_DIA)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('falta de acesso a parte das fontes: não afirma "em dia" e diz que não conferiu tudo, sem "Tentar de novo"', async ({ page }) => {
  // Perfil com Início e interessados, mas sem atualização, treino e registro.
  const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_TREINADOR });
  await expect(passo(page).getByText(/^Não foi possível conferir tudo\./)).toBeVisible();
  await expect(passo(page).getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
  await expect(page.getByText('Nada pede sua atenção agora')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('contagem de interessados sem a etapa "Novos" não conta como consultada: não afirma "em dia"', async ({ page }) => {
  const semNovos = { ...CONTAGENS_ZERO, porSituacao: {} };
  const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_DO_RESUMO, extra: { 'GET /inscricoes/contagens': { corpo: semNovos } } });
  await expect(passo(page).getByText(/^Não foi possível conferir tudo\./)).toBeVisible();
  await expect(page.getByText('Nada pede sua atenção agora')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('pendência numa fonte consultada continua aparecendo, com o aviso quando outra fonte falhou', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, {
    permissoes: PERMISSOES_DO_RESUMO, painel: { ...PAINEL, atualizacoesAtrasadas: 2 },
    extra: { 'GET /inscricoes/contagens': falha },
  });
  await expect(passo(page).getByText('2 atualizações estão atrasadas.')).toBeVisible();
  await expect(passo(page).getByText('Não foi possível conferir tudo.')).toBeVisible();
  await expect(passo(page).getByRole('button', { name: 'Ver atrasadas' })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

/**
 * Próximo passo pintado (24/11): sem a faixa lateral, as quatro bordas iguais, a bolinha antes do rótulo, o raio e o recuo
 * dos blocos de baixo (o texto começa na mesma coluna do título do primeiro bloco) e o botão à direita, centrado na altura.
 */
for (const largura of [390, 1280, 1920] as const) {
  test(`Próximo passo pintado: bordas iguais, bolinha, raio e recuo dos blocos, "Ver alunos" à direita e centrado (${largura})`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_DO_RESUMO, painel: { ...PAINEL, alunosSemRegistroTotal: 4 }, largura });
    await expect(passo(page).getByText('4 alunos estão sem registro há 7 dias.')).toBeVisible();
    await expect(passo(page).getByTestId('proximo-passo-ponto')).toBeVisible();
    await expect(async () => {
      const m = await page.evaluate(() => {
        const caixa = document.querySelector('[data-testid="proximo-passo"]')!;
        const estilo = getComputedStyle(caixa);
        const lados = ['Top', 'Right', 'Bottom', 'Left'].map((l) => `${estilo.getPropertyValue(`border-${l.toLowerCase()}-width`)} ${estilo.getPropertyValue(`border-${l.toLowerCase()}-color`)}`);
        const r = (e: Element) => e.getBoundingClientRect();
        const bloco = document.querySelector('[data-testid="cartao"]')!;
        const tituloDoBloco = bloco.querySelector('[role="heading"][aria-level="2"]')!;
        const botao = [...caixa.querySelectorAll('[role="button"]')].find((b) => b.textContent === 'Ver alunos')!;
        const texto = [...caixa.querySelectorAll('div')].find((d) => d.textContent === '4 alunos estão sem registro há 7 dias.' && !d.children.length)!;
        return {
          lados, raio: estilo.borderTopLeftRadius, raioDoBloco: getComputedStyle(bloco).borderTopLeftRadius,
          recuo: estilo.paddingLeft, recuoDireito: estilo.paddingRight, borda: parseFloat(estilo.borderRightWidth),
          caixa: r(caixa).toJSON(), ponto: r(caixa.querySelector('[data-testid="proximo-passo-ponto"]')!).toJSON(),
          texto: r(texto).toJSON(), titulo: r(tituloDoBloco).toJSON(), botao: r(botao).toJSON(),
        };
      });
      expect(new Set(m.lados).size).toBe(1);
      expect(m.raio).toBe(m.raioDoBloco);
      expect(m.recuo).toBe(m.recuoDireito);
      // A bolinha e o texto começam na mesma coluna do título do bloco de baixo.
      expect(Math.abs(m.ponto.x - m.titulo.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.texto.x - m.titulo.x)).toBeLessThanOrEqual(1);
      // "Ver alunos" encostado no recuo direito e centrado na altura da caixa.
      const direita = m.caixa.x + m.caixa.width - m.borda - parseFloat(m.recuoDireito);
      expect(Math.abs(m.botao.x + m.botao.width - direita)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.botao.y + m.botao.height / 2 - (m.caixa.y + m.caixa.height / 2))).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 10_000 });
    expect(errosDaPagina).toEqual([]);
  });
}

test('Próximo passo em dia: neutro, sem bolinha', async ({ page }) => {
  const { errosDaPagina } = await abrir(page, { permissoes: PERMISSOES_DO_RESUMO });
  await expect(passo(page).getByText(EM_DIA)).toBeVisible();
  await expect(passo(page).getByTestId('proximo-passo-ponto')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('enquanto uma fonte carrega, o resumo não afirma "em dia" nem "não conferiu"', async ({ page }) => {
  let soltar: () => void = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  const { errosDaPagina } = await abrir(page, {
    permissoes: PERMISSOES_DO_RESUMO,
    extra: { 'GET /inscricoes/contagens': async (_p, route) => { await espera; await json(route, CONTAGENS_ZERO); } },
  });
  await expect(page.getByText('Próximo passo', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nada pede sua atenção agora')).toHaveCount(0);
  await expect(page.getByText('Não foi possível conferir tudo.')).toHaveCount(0);
  soltar();
  await expect(passo(page).getByText(EM_DIA)).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
