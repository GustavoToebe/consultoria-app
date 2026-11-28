import { expect, test, type Page } from '@playwright/test';

import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { ALUNO_ID, BIBLIOTECA, PLANO_ID, planoDetalhe } from './editor-inspetor.dados';

/**
 * Cabeçalho do editor do exercício (proposta de 27/11, seção 0.5 e item 8; `treino/CartaoExercicio`): "Exercício 1 de 7 ·
 * Peito · Peso livre" em cima e o nome embaixo; à direita "Trocar exercício" (`acao`: aparece uma vez no painel, pedido do
 * Gustavo de 27/11), ⋯ e "Excluir exercício" (perigo). As duas seções recolhíveis com o resumo quando fechadas. Só dados
 * fictícios (o plano de `editor-inspetor.dados.ts`). Capturas com `E2E_CAPTURAS`: `<base>/editor-exercicio-cabecalho-1280-<tema>.png`.
 */

type Tema = 'ESCURO' | 'CLARO';
const SUPINO = BIBLIOTECA[0];

async function abrir(page: Page, tema: Tema = 'ESCURO') {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(([usuario, prefs]) => {
    try { localStorage.setItem(`treinos:${usuario}:preferencias`, JSON.stringify(prefs)); } catch { /* sem armazenamento */ }
  }, [TREINADOR.id, { tema, contraste: 'PADRAO', larguraConteudo: 'AUTOMATICA' }] as const);
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR'] })),
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluna Fictícia' } },
    [`GET /alunos/${ALUNO_ID}/foto-perfil`]: erroApi(404, 'Sem foto.', 'NAO_ENCONTRADO'),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /planos-treino/${PLANO_ID}`]: (_p, route) => json(route, planoDetalhe(false)),
  });
  await page.goto(`/treinador/treinos/${PLANO_ID}`);
  await expect(page.getByText('Peito e tríceps', { exact: true }).first()).toBeVisible();
  // 1280 px já é lista + painel: o primeiro exercício abre no painel.
  await expect(page.getByText('Exercício 1 de 7 · Peito · Peso livre', { exact: true })).toBeVisible();
}

const trocar = (page: Page) => page.getByRole('button', { name: `Trocar exercício: ${SUPINO.nome}`, exact: true });
const fundo = (page: Page, nome: string | RegExp) =>
  page.getByRole('button', { name: nome }).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test.describe('cabeçalho do editor do exercício (1280)', () => {
  test('posição · grupo · modalidade, o nome, Trocar (acao, um só), ⋯ e Excluir', async ({ page }) => {
    await abrir(page);
    await expect(page.getByText(SUPINO.nome, { exact: true }).first()).toBeVisible();

    // Um "Trocar exercício" na área, com texto, e na cor de ação: o mesmo fundo do "Usar receita de séries" (acao).
    await expect(trocar(page)).toHaveCount(1);
    await expect(trocar(page).getByText('Trocar exercício', { exact: true })).toBeVisible();
    expect(await fundo(page, `Trocar exercício: ${SUPINO.nome}`)).toBe(await fundo(page, /^Usar receita de séries/));
    // E diferente do neutro ao lado ("Salvar como receita", secundario).
    expect(await fundo(page, `Trocar exercício: ${SUPINO.nome}`)).not.toBe(await fundo(page, /^Salvar como receita/));

    await expect(page.getByRole('button', { name: `Mais ações de ${SUPINO.nome}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Excluir exercício: ${SUPINO.nome}`, exact: true })).toBeVisible();
  });

  test('seções recolhíveis: fechadas com o resumo, abertas com os campos', async ({ page }) => {
    await abrir(page);
    const extras = page.getByRole('button', { name: 'Nome de exibição e instruções', exact: true });
    await expect(extras).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(`${SUPINO.nome} · sem vídeo · sem cadência`, { exact: true })).toBeVisible();
    await extras.click();
    await expect(extras).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('textbox', { name: /^Nome de exibição/ })).toHaveValue(SUPINO.nome);
    await expect(page.getByText(`${SUPINO.nome} · sem vídeo · sem cadência`, { exact: true })).toHaveCount(0);

    const alternativas = page.getByRole('button', { name: 'Alternativas de troca · 0 de 3', exact: true });
    await expect(alternativas).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Nenhuma alternativa', { exact: true })).toBeVisible();
    await alternativas.click();
    await expect(page.getByRole('button', { name: `Adicionar alternativa a ${SUPINO.nome}`, exact: true })).toBeVisible();
  });
});

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`captura do cabeçalho do editor do exercício (1280, ${tema.toLowerCase()})`, async ({ page }) => {
    const pasta = process.env.E2E_CAPTURAS;
    test.skip(!pasta, 'só com E2E_CAPTURAS');
    await abrir(page, tema);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${pasta}/editor-exercicio-cabecalho-1280-${tema.toLowerCase()}.png` });
  });
}
