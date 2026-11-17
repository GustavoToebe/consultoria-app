import { expect, test, type Page } from '@playwright/test';

import type { AniversarianteDoAluno } from '../src/api/aniversariosTipos';
import type { PainelTreinador } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Aniversários no Início do treinador (`docs/planos/aniversarios.md`): cartão só com ALUNO_LER, só nome e dia/mês (nunca
 * ano nem idade), lista vazia = nada aparece, e a janela (0, 3, 7 ou 15 dias) vem da preferência do aparelho, escolhida em
 * Ajustes (o cartão "Aniversários dos alunos" das Configurações leva até lá). Relógio em 19/10/2026. Só dados fictícios.
 */

const PAINEL: PainelTreinador = {
  atualizacoesParaRevisar: 0, atualizacoesAtrasadas: 0, atualizacoesAvisaramAtraso: 0, atualizacoesProximas: 0, alunosAtivos: 24,
  alunosSemRegistro: [], ultimasExecucoes: [], planosTerminando: [], pastasARenovar: 0, pastasParaRenovar: [], alunosSemPastaComPeriodo: 0,
  alunosSemRegistroTotal: 0, alunosSemAcesso: 3, alunosInativos: 3, sessoesConcluidas7Dias: 0,
};

const ANIVERSARIANTES: AniversarianteDoAluno[] = [
  { alunoId: 'a0000000-0000-4000-8000-000000000101', nome: 'Aluna Fictícia Um', dia: 19, mes: 10, diasAte: 0 },
  { alunoId: 'a0000000-0000-4000-8000-000000000102', nome: 'Aluno Fictício Dois', dia: 21, mes: 10, diasAte: 2 },
  { alunoId: 'a0000000-0000-4000-8000-000000000103', nome: 'Aluna Fictícia Três', dia: 25, mes: 10, diasAte: 6 },
];

async function abrir(page: Page, { permissoes = PERMISSOES_TREINADOR, lista = ANIVERSARIANTES, preferencias }: { permissoes?: string[]; lista?: AniversarianteDoAluno[]; preferencias?: object } = {}) {
  await fixarHoje(page);
  if (preferencias) await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(p)), [TREINADOR.id, preferencias] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes, perfil: { id: 'p1', nome: 'Treinador', acessoTotal: false } })),
    'GET /painel': { corpo: PAINEL },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /alunos/aniversariantes': { corpo: lista },
  });
  await page.goto('/treinador');
  await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
  return api;
}

const pedidosDeAniversario = (pedidos: { caminho: string; busca: URLSearchParams }[]) => pedidos.filter((p) => p.caminho === '/alunos/aniversariantes');

for (const largura of [390, 1280]) {
  test(`o Início mostra nome e dia/mês de quem faz aniversário, sem ano nem idade (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos, naoTratadas, errosDaPagina } = await abrir(page);
    await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toBeVisible();
    await expect(page.getByText('Hoje e nos próximos 7 dias', { exact: true })).toBeVisible();
    const hoje = page.getByRole('link', { name: 'Aluna Fictícia Um, aniversário hoje, dia 19/10. Abrir a ficha' });
    await expect(hoje).toBeVisible();
    await expect(hoje).toContainText('19/10 · Hoje');
    await expect(page.getByRole('link', { name: /^Aluno Fictício Dois, aniversário em 2 dias, dia 21\/10/ })).toContainText('21/10 · Em 2 dias');
    await expect(page.getByRole('link', { name: /^Aluna Fictícia Três/ })).toContainText('25/10 · Em 6 dias');
    await expect(hoje).toHaveAttribute('href', '/treinador/alunos/a0000000-0000-4000-8000-000000000101');
    // Nunca a idade nem o ano de nascimento.
    await expect(page.getByText(/\banos?\b/i)).toHaveCount(0);
    // Padrão da janela 7 dias; o membro (sem acesso total) vê só os seus alunos.
    expect(pedidosDeAniversario(pedidos).at(-1)?.busca.toString()).toBe('dias=7&meus=true');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('sem aniversariante na janela o cartão não aparece', async ({ page }) => {
  await abrir(page, { lista: [] });
  await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toHaveCount(0);
  await expect(page.getByText('Aniversários', { exact: true })).toHaveCount(0);
});

test('sem ALUNO_LER o Início nem consulta os aniversários', async ({ page }) => {
  const { pedidos } = await abrir(page, { permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'ALUNO_LER') });
  await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toHaveCount(0);
  expect(pedidosDeAniversario(pedidos)).toEqual([]);
});

test('a janela vem da preferência do aparelho: 3 dias vai na consulta, e só hoje esconde quem faz depois', async ({ page }) => {
  const { pedidos } = await abrir(page, { preferencias: { diasAniversario: 3 } });
  await expect(page.getByText('Hoje e nos próximos 3 dias', { exact: true })).toBeVisible();
  expect(pedidosDeAniversario(pedidos).at(-1)?.busca.get('dias')).toBe('3');
  // A resposta traz também quem faz em 6 dias (fora da janela): a regra do app não o mostra.
  await expect(page.getByRole('link', { name: /^Aluna Fictícia Três/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Aluno Fictício Dois/ })).toBeVisible();
});

for (const largura of [390, 1280]) {
  test(`o Início espera a preferência antes de pedir: nenhum pedido sai com a janela padrão e o cartão não pisca nela (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { pedidos } = await abrir(page, { preferencias: { diasAniversario: 15 } });
    await expect(page.getByText('Hoje e nos próximos 15 dias', { exact: true })).toBeVisible();
    // Com a janela padrão (7) o cartão apareceria um instante e o pedido de 7 dias teria saído antes da preferência (8c35e28e).
    await expect(page.getByText('Hoje e nos próximos 7 dias', { exact: true })).toHaveCount(0);
    const janelas = pedidosDeAniversario(pedidos).map((p) => p.busca.get('dias'));
    expect(janelas.length).toBeGreaterThan(0);
    expect(new Set(janelas)).toEqual(new Set(['15']));
  });
}

test('Ajustes escolhe a janela e as Configurações levam até lá', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos } = await abrir(page);
  await page.goto('/treinador/configuracoes');
  await page.getByRole('link', { name: /^Aniversários dos alunos, / }).click();
  await expect(page).toHaveURL(/\/treinador\/ajustes$/);
  await expect(page.getByRole('heading', { name: 'Aniversários', level: 2 })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Aniversários no Início' }).getByRole('radio', { name: '15 dias', exact: true }).click();
  await page.goto('/treinador');
  await expect(page.getByText('Hoje e nos próximos 15 dias', { exact: true })).toBeVisible();
  expect(pedidosDeAniversario(pedidos).at(-1)?.busca.get('dias')).toBe('15');
});
