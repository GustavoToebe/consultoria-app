import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, PastaResumo } from '../src/api/tipos';
import { CLARO, coresDeDestaque } from '../src/tema/tokens';
import { ALUNO, erroApi, PERMISSOES_TREINADOR as BASE, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * ficha: resumo em cartões (24/11, `docs/planos/ficha-resumo-em-cartoes.md`): no "Próximo passo" da aba Resumo, Atualização,
 * Treinos registrados e Último registro são três cartões de indicador filhos da mesma `GradeDeIndicadores` (mesma altura,
 * nunca um sozinho): Treinos pintado na cor da categoria (azul), Atualização na situação do selo (âmbar, vermelho, verde)
 * ou, sem situação, na categoria (ciano), e Último registro neutro, em fonte normal. "Sem atualização pendente" no lugar
 * do "—"; sem dado, o cartão fica neutro com o motivo. Dados fictícios.
 */
const PERMISSOES = [...BASE, 'REGISTRO_LER', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER'];
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-0000000000a1';
const diaLocal = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE');

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};
const NENHUMA: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
};
const ENVIADA: Atualizacao = { ...NENHUMA, id: 'b0000000-0000-4000-8000-0000000000b1', pastaId: PASTA_ID, dataAtualizacao: diaLocal(0), fase: 'ENVIADA' };
const ATRASADA: Atualizacao = { ...ENVIADA, fase: 'ATRASADA', diasDeAtraso: 3, dataAtualizacao: diaLocal(-3) };
const PROXIMA: Atualizacao = { ...ENVIADA, fase: 'AVISO', diasParaData: 5, dataAtualizacao: diaLocal(5) };

const VIGENTE: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Hipertrofia fictícia', inicio: diaLocal(0), fim: diaLocal(20), concluidaEm: null };
const TREINO = {
  data: diaLocal(0),
  sessoes: [{ sessaoUid: 's1', sessao: 'Treino A', planoVersaoId: 'v1', exercicios: [{ exercicioUid: 'e1', exercicioId: null, nome: 'Exercício fictício',
    series: [{ id: 'x1', serieUid: 'su1', tipo: 'WS', trabalho: true, carga: null, unidade: null, repeticoes: null, concluida: true, observacao: null }] }] }],
};

async function abrir(page: Page, o: { largura: number; atualizacao: Atualizacao | 'erro'; preferencias?: object; execucoes?: unknown[] }) {
  await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)), [TREINADOR.id, { tema: 'CLARO', ...o.preferencias }] as const);
  await page.setViewportSize({ width: o.largura, height: 900 });
  const respostas: RespostasApi = {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [VIGENTE] },
    [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: { corpo: { pasta: VIGENTE } },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: [] } },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: o.execucoes ?? [TREINO] },
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: o.atualizacao === 'erro' ? erroApi(500, 'Falha fictícia.') : { corpo: o.atualizacao },
  };
  await simularApi(page, respostas);
  await page.goto(`/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByRole('heading', { name: 'Próximo passo', exact: true })).toBeVisible();
}

const cartao = (page: Page, rotulo: string) => page.getByLabel(new RegExp(`^${rotulo}: `));
const ponto = (c: Locator) => c.locator('[aria-hidden="true"]').first();
const fundoDe = (c: Locator) => c.evaluate((e) => getComputedStyle(e).backgroundImage);
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const corDoPonto = (c: Locator) => ponto(c).evaluate((e) => getComputedStyle(e).backgroundColor);
const borda = (c: Locator) => c.evaluate((e) => getComputedStyle(e).borderTopColor);
const DESTAQUES = coresDeDestaque(CLARO, 'claro');

for (const largura of [390, 1280]) {
  test(`${largura}px: com atualização para revisar, os três cartões na mesma grade e mesma altura; treino azul, atualização âmbar e último neutro`, async ({ page }) => {
    await abrir(page, { largura, atualizacao: ENVIADA });
    const atualizacao = cartao(page, 'Atualização');
    const treinos = cartao(page, 'Treinos registrados');
    const ultimo = cartao(page, 'Último registro');
    await expect(atualizacao).toHaveAccessibleName('Atualização: Para revisar');
    await expect(treinos).toHaveAccessibleName('Treinos registrados: 1. nesta semana');
    // Pasta que começa hoje: o escopo é a semana ("desde dd/mm" só quando a pasta começou antes dela, coberto no teste de domínio).
    await expect(ultimo).toHaveAccessibleName(/^Último registro: Hoje\. (nesta semana|desde \d\d\/\d\d)$/);

    // Mesma grade (pais da célula com o mesmo avô), mesma largura e altura; em 1280, na mesma linha.
    const caixas = await Promise.all([atualizacao, treinos, ultimo].map(async (c) => (await c.boundingBox())!));
    for (const c of caixas) expect(Math.abs(c.width - caixas[0].width)).toBeLessThanOrEqual(1);
    const mesmaGrade = await page.evaluate(() => {
      const cartoes = ['Atualização', 'Treinos registrados', 'Último registro'].map((r) => document.querySelector(`[aria-label^="${r}: "]`));
      const grade = cartoes[0]?.parentElement?.parentElement;
      return !!grade && cartoes.every((c) => c?.parentElement?.parentElement === grade) && grade.children.length === 3;
    });
    expect(mesmaGrade).toBe(true);
    if (largura === 1280) {
      // Lado a lado: mesma linha e mesma altura. Em 390 é uma coluna, cada um com a própria altura.
      for (const c of caixas) {
        expect(Math.abs(c.y - caixas[0].y)).toBeLessThanOrEqual(1);
        expect(Math.abs(c.height - caixas[0].height)).toBeLessThanOrEqual(1);
      }
    } else {
      for (const c of caixas) expect(Math.abs(c.x - caixas[0].x)).toBeLessThanOrEqual(1);
    }

    // Atualização: situação (âmbar) pinta o cartão; treino: categoria (azul); último: neutro.
    expect(await corDoPonto(atualizacao)).toBe(rgb(CLARO.atencao));
    expect(await fundoDe(atualizacao)).toBe('none'); // liso nas claras (26/11)
    expect(await corDoPonto(treinos)).toBe(rgb(DESTAQUES.azul.cor));
    expect(await fundoDe(treinos)).toBe('none');
    expect(await borda(treinos)).toBe(rgb(CLARO.divisor)); // borda neutra: a cor fica no ponto e no valor
    expect(await fundoDe(ultimo)).toBe('none');
    await expect(ponto(ultimo)).toHaveCount(0);
    expect(await borda(ultimo)).toBe(rgb(CLARO.divisor));
    // Último registro é frase: fonte normal; a contagem dos treinos segue em fonte numérica.
    expect(await ultimo.getByText('Hoje', { exact: true }).evaluate((e) => getComputedStyle(e).fontFamily)).not.toMatch(/Mono/);
    expect(await treinos.getByText('1', { exact: true }).evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Mono/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('atualização atrasada leva o vermelho da situação; sem situação (data próxima) leva o ciano da categoria', async ({ page }) => {
  await abrir(page, { largura: 1280, atualizacao: ATRASADA });
  await expect(cartao(page, 'Atualização')).toHaveAccessibleName(/^Atualização: Atrasada há [234] dias$/);
  expect(await corDoPonto(cartao(page, 'Atualização'))).toBe(rgb(CLARO.perigo));
});

test('atualização com data próxima, sem situação: valor em texto e a cor da categoria (ciano)', async ({ page }) => {
  await abrir(page, { largura: 1280, atualizacao: PROXIMA });
  const atualizacao = cartao(page, 'Atualização');
  await expect(atualizacao).toHaveAccessibleName(/^Atualização: Em [456] dias$/);
  expect(await corDoPonto(atualizacao)).toBe(rgb(DESTAQUES.ciano.cor));
  expect(await fundoDe(atualizacao)).toBe('none'); // liso nas claras (26/11)
});

test('sem atualização pendente: o texto claro no lugar do "—", na cor da categoria (ciano)', async ({ page }) => {
  await abrir(page, { largura: 1280, atualizacao: NENHUMA });
  const atualizacao = cartao(page, 'Atualização');
  await expect(atualizacao).toHaveAccessibleName('Atualização: Sem atualização pendente');
  await expect(atualizacao.getByText('Sem atualização pendente', { exact: true })).toBeVisible();
  await expect(atualizacao.getByText('—', { exact: true })).toHaveCount(0);
  expect(await corDoPonto(atualizacao)).toBe(rgb(DESTAQUES.ciano.cor));
  // Fundo liso na cor da categoria (26/11); a borda é a neutra, a cor fica no ponto e no valor.
  expect(await fundoDe(atualizacao)).toBe('none');
  expect(await borda(atualizacao)).toBe(rgb(CLARO.divisor));
});

test('atualização que não carregou: o cartão fica neutro, com o motivo, e os outros dois seguem na grade', async ({ page }) => {
  await abrir(page, { largura: 1280, atualizacao: 'erro' });
  const atualizacao = cartao(page, 'Atualização');
  await expect(atualizacao).toHaveAccessibleName('Atualização: Indisponível. Não foi possível carregar');
  expect(await fundoDe(atualizacao)).toBe('none');
  await expect(ponto(atualizacao)).toHaveCount(0);
  expect(await borda(atualizacao)).toBe(rgb(CLARO.divisor));
  const caixas = await Promise.all([atualizacao, cartao(page, 'Treinos registrados'), cartao(page, 'Último registro')].map(async (c) => (await c.boundingBox())!));
  for (const c of caixas) expect(Math.abs(c.height - caixas[0].height)).toBeLessThanOrEqual(1);
});

test('texto grande em 390: os três cartões sem corte nem rolagem lateral', async ({ page }) => {
  await abrir(page, { largura: 390, atualizacao: NENHUMA, preferencias: { tamanhoTexto: 'GRANDE' } });
  for (const r of ['Atualização', 'Treinos registrados', 'Último registro']) await expect(cartao(page, r)).toBeVisible();
  await expect(cartao(page, 'Atualização').getByText('Sem atualização pendente', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('aluno novo, sem nenhum registro: só o cartão Atualização na grade e a linha de apoio dos treinos', async ({ page }) => {
  await abrir(page, { largura: 1280, atualizacao: NENHUMA, execucoes: [] });
  await expect(cartao(page, 'Atualização')).toBeVisible();
  await expect(cartao(page, 'Treinos registrados')).toHaveCount(0);
  await expect(cartao(page, 'Último registro')).toHaveCount(0);
  await expect(page.getByText(/^Treinos: ainda sem registros (nesta semana|desde \d\d\/\d\d)\.$/)).toBeVisible();
});
