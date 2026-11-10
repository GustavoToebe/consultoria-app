import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, ItemDeAtividade, Lesao } from '../src/api/tipos';
import { ALUNO, PERMISSOES_TREINADOR as BASE, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Ficha do aluno em cinco abas (`docs/planos/ficha-do-aluno-em-abas.md`, passo 3): `?aba=` no endereço, `?pastaId=` abre a
 * aba Planos e `?editar=1` a aba Ficha do aluno, aba sem bloco permitido some, o aviso de lesões só com
 * `ALUNO_SENSIVEL_LER` (só a contagem) e a Atividade recente com itens (o que abre e o que não abre) e vazia. Dados fictícios.
 */
// As permissões padrão do e2e mais as dos blocos de Acompanhamento e Evolução, para as cinco abas aparecerem.
const PERMISSOES_TREINADOR = [...BASE, 'REGISTRO_LER', 'ATUALIZACAO_LER', 'TREINO_LER', 'DIETA_LER'];
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';
const PASTA_ID = 'f0000000-0000-4000-8000-0000000000a1';
const ATUALIZACAO_ID = 'b0000000-0000-4000-8000-0000000000b1';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const LESOES: Lesao[] = [
  { id: 'l1', regiao: 'Região fictícia A', descricao: 'Descrição fictícia', dataInicio: null, dataFim: null, situacao: 'ATIVA', observacao: null },
  { id: 'l2', regiao: 'Região fictícia B', descricao: 'Outra descrição fictícia', dataInicio: null, dataFim: null, situacao: 'RECUPERADA', observacao: null },
];

const agora = Date.now();
const ATIVIDADE: ItemDeAtividade[] = [
  { tipo: 'ATUALIZACAO_ENVIADA', titulo: 'Atualização enviada', quando: new Date(agora - 3_600_000).toISOString(), destino: { tipo: 'ATUALIZACAO', id: ATUALIZACAO_ID } },
  { tipo: 'PLANO_PUBLICADO', titulo: 'Plano publicado', quando: new Date(agora - 86_400_000).toISOString(), destino: { tipo: 'PASTA', id: PASTA_ID } },
  { tipo: 'TREINO_CONCLUIDO', titulo: 'Treino concluído', quando: new Date(agora - 2 * 86_400_000).toISOString(), destino: null },
];

async function abrir(page: Page, o: { url?: string; largura?: number; permissoes?: string[]; atividade?: ItemDeAtividade[]; lesoes?: Lesao[] } = {}) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [{ id: 'p1', data: '2026-10-26', pesoKg: 80.5, variacao: null, observacao: null }] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: o.lesoes ?? [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: [] },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: o.atividade ?? [] } },
  });
  await page.goto(o.url ?? `/treinador/alunos/${ALUNO_ID}`);
  await expect(page.getByRole('tab', { name: 'Resumo', exact: true })).toBeVisible();
  return api;
}

const aba = (page: Page, nome: string) => page.getByRole('tab', { name: nome, exact: true });

for (const largura of [390, 1280]) {
  test(`${largura}px: abre no Resumo e troca de aba pelo endereço`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura });
    for (const nome of ['Resumo', 'Planos', 'Acompanhamento', 'Evolução', 'Ficha do aluno']) await expect(aba(page, nome)).toHaveCount(1);
    await expect(aba(page, 'Resumo')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Próximo passo', { exact: true })).toBeVisible();
    await expect(page.getByText('Atividade recente', { exact: true })).toBeVisible();
    // O Resumo é curto: as tabelas e os gráficos ficam nas abas.
    await expect(page.getByText('Pastas de plano', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Dados do aluno', { exact: true })).toHaveCount(0);

    await aba(page, 'Evolução').click();
    await expect(page).toHaveURL(/[?&]aba=evolucao/);
    await expect(aba(page, 'Evolução')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Fotos', { exact: true })).toBeVisible();
    await expect(page.getByText('Próximo passo', { exact: true })).toHaveCount(0);

    await aba(page, 'Ficha do aluno').click();
    await expect(page).toHaveURL(/[?&]aba=ficha/);
    await expect(page.getByText('Dados do aluno', { exact: true })).toBeVisible();
    await expect(page.getByText('Histórico de lesões', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('1280px: Resumo e Atividade recente lado a lado; 390px: um embaixo do outro', async ({ page }) => {
  await abrir(page, { largura: 1280 });
  const passo = page.getByText('Próximo passo', { exact: true });
  const atividade = page.getByText('Atividade recente', { exact: true });
  await expect(atividade).toBeVisible();
  const [p, a] = [(await passo.boundingBox())!, (await atividade.boundingBox())!];
  expect(a.x).toBeGreaterThan(p.x + p.width);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(async () => (await atividade.boundingBox())!.y).toBeGreaterThan((await passo.boundingBox())!.y);
  await expect.poll(async () => Math.abs((await atividade.boundingBox())!.x - (await passo.boundingBox())!.x)).toBeLessThan(40);
});

test('?aba= de uma aba conhecida abre nela; valor desconhecido cai no Resumo', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=ficha` });
  await expect(aba(page, 'Ficha do aluno')).toHaveAttribute('aria-selected', 'true');
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=qualquer`);
  await expect(aba(page, 'Resumo')).toHaveAttribute('aria-selected', 'true');
});

test('?pastaId= abre a aba Planos e sai do endereço', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?pastaId=${PASTA_ID}` });
  await expect(aba(page, 'Planos')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]aba=planos/);
  await expect(page).not.toHaveURL(/pastaId=/);
  await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
});

test('?editar=1 abre a aba Ficha do aluno já editando e sai do endereço', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?editar=1` });
  await expect(aba(page, 'Ficha do aluno')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]aba=ficha/);
  await expect(page).not.toHaveURL(/editar=/);
});

test('aviso de lesões: só a contagem das ativas, com o atalho para a aba Ficha', async ({ page }) => {
  const { pedidos } = await abrir(page, { lesoes: LESOES });
  await expect(page.getByText('1 lesão ativa', { exact: true })).toBeVisible();
  // Nenhum detalhe da lesão no Resumo.
  await expect(page.getByText(/Região fictícia|Descrição fictícia/)).toHaveCount(0);
  await expect(page.getByText('Último peso', { exact: true })).toBeVisible();
  expect(pedidos.some((p) => p.caminho === `/alunos/${ALUNO_ID}/lesoes`)).toBe(true);
  await page.getByRole('button', { name: /^1 lesão ativa: ver na ficha/ }).click();
  await expect(aba(page, 'Ficha do aluno')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Histórico de lesões', { exact: true })).toBeVisible();
});

test('sem ALUNO_SENSIVEL_LER: nem aviso de lesões nem peso, e nada é pedido', async ({ page }) => {
  const semSensivel = PERMISSOES_TREINADOR.filter((p) => !p.startsWith('ALUNO_SENSIVEL'));
  const { pedidos } = await abrir(page, { permissoes: semSensivel, lesoes: LESOES });
  await expect(page.getByText('Próximo passo', { exact: true })).toBeVisible();
  await expect(page.getByText(/lesão|lesões/)).toHaveCount(0);
  await expect(page.getByText('Último peso', { exact: true })).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.endsWith('/lesoes') || p.caminho.endsWith('/pesos'))).toBe(false);
});

test('Atividade recente: a atualização é link, a pasta abre na aba Planos e o treino concluído não é botão', async ({ page }) => {
  await abrir(page, { atividade: ATIVIDADE });
  const link = page.getByRole('link', { name: /^Atualização enviada/ });
  await expect(link).toHaveAttribute('href', `/treinador/atualizacoes/${ATUALIZACAO_ID}`);
  await expect(page.getByText('Treino concluído', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Treino concluído/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Treino concluído/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Plano publicado, .*abrir a pasta$/ }).click();
  await expect(aba(page, 'Planos')).toHaveAttribute('aria-selected', 'true');
  await expect(page).not.toHaveURL(/pastaId=/);
  await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
});

test('Atividade recente vazia: uma linha discreta', async ({ page }) => {
  await abrir(page);
  await expect(page.getByText('Nenhuma atividade recente.', { exact: true })).toBeVisible();
});

// Larguras intermediária e grande em cada tema: nada transborda na horizontal e as abas e o Resumo seguem inteiros.
const TEMAS = [['claro', 'CLARO', 'PADRAO'], ['escuro', 'ESCURO', 'PADRAO'], ['areia', 'AREIA', 'PADRAO'], ['contraste', 'CLARO', 'ALTO']] as const;
for (const [nome, t, contraste] of TEMAS) {
  for (const largura of [768, 1920]) {
    test(`tema ${nome} em ${largura}px: Resumo e Evolução sem rolagem horizontal`, async ({ page }) => {
      await page.addInitScript(([id, tm, c]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: tm, contraste: c })), [TREINADOR.id, t, contraste]);
      const { errosDaPagina } = await abrir(page, { largura, lesoes: LESOES, atividade: ATIVIDADE });
      await expect(page.getByText('1 lesão ativa', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Atualização enviada/ })).toBeVisible();
      const semTransbordo = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(await semTransbordo()).toBe(true);
      await aba(page, 'Evolução').click();
      await expect(page.getByText('Fotos', { exact: true })).toBeVisible();
      expect(await semTransbordo()).toBe(true);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('sem permissão: aba sem bloco permitido não aparece e o endereço dela cai no Resumo', async ({ page }) => {
  await abrir(page, { permissoes: ['ALUNO_LER'], url: `/treinador/alunos/${ALUNO_ID}?aba=evolucao` });
  await expect(aba(page, 'Resumo')).toHaveAttribute('aria-selected', 'true');
  await expect(aba(page, 'Planos')).toHaveCount(1);
  await expect(aba(page, 'Ficha do aluno')).toHaveCount(1);
  await expect(aba(page, 'Acompanhamento')).toHaveCount(0);
  await expect(aba(page, 'Evolução')).toHaveCount(0);
});
