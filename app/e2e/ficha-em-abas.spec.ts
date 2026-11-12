import { expect, test, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, ItemDeAtividade, Lesao, PastaResumo } from '../src/api/tipos';
import { ALUNO, erroApi, PERMISSOES_TREINADOR as BASE, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

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

const SEM_ATUALIZACAO: Atualizacao = {
  id: null, pastaId: null, alunoId: ALUNO_ID, nomeAluno: null, dataAtualizacao: null, fase: 'NENHUMA', diasParaData: 0, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0, questionarioVersaoId: null, questionarioNome: null, modelo: null,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: null,
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

async function abrir(page: Page, o: {
  url?: string; largura?: number; permissoes?: string[]; atividade?: ItemDeAtividade[]; lesoes?: Lesao[]; pastas?: PastaResumo[];
  extra?: RespostasApi;
} = {}) {
  await page.setViewportSize({ width: o.largura ?? 1280, height: 900 });
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: o.permissoes ?? PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [{ id: 'p1', data: '2026-10-26', pesoKg: 80.5, variacao: null, observacao: null }] },
    [`GET /alunos/${ALUNO_ID}/lesoes`]: { corpo: o.lesoes ?? [] },
    [`GET /alunos/${ALUNO_ID}/pastas`]: { corpo: o.pastas ?? [] },
    [`GET /alunos/${ALUNO_ID}/atividade-recente`]: { corpo: { itens: o.atividade ?? [] } },
    // O próximo passo só diz "Tudo em dia" depois de conferir a atualização e os treinos: nenhuma atualização (a resposta da
    // API sem pasta) e nenhum registro.
    [`GET /alunos/${ALUNO_ID}/atualizacao`]: { corpo: SEM_ATUALIZACAO },
    [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [] },
    ...o.extra,
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
    await expect(page.getByRole('heading', { name: 'Próximo passo', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planejamento', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Última medição', exact: true })).toBeVisible();
    // Vazio é linha de apoio, sem cartão.
    await expect(page.getByText('Atividade recente: nenhum evento disponível.', { exact: true })).toBeVisible();
    // O Resumo é curto: as tabelas e os gráficos ficam nas abas.
    await expect(page.getByText('Pastas de plano', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Dados do aluno', { exact: true })).toHaveCount(0);

    await aba(page, 'Evolução').click();
    await expect(page).toHaveURL(/[?&]aba=evolucao/);
    await expect(aba(page, 'Evolução')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Fotos', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Próximo passo', exact: true })).toHaveCount(0);

    await aba(page, 'Ficha do aluno').click();
    await expect(page).toHaveURL(/[?&]aba=ficha/);
    await expect(page.getByText('Dados do aluno', { exact: true })).toBeVisible();
    // Por assunto (guia de 11/11, pág. 34): dados e contato, acesso ao app em bloco próprio, configuração do acompanhamento.
    await expect(page.getByText('Dados e contato', { exact: true })).toBeVisible();
    await expect(page.getByText('Configuração do acompanhamento', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acesso ao app', exact: true })).toBeVisible();
    await expect(page.getByText('Histórico de lesões', { exact: true })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('Resumo: o próximo passo vem antes de tudo; Planejamento e Última medição lado a lado no PC e em coluna no celular', async ({ page }) => {
  await abrir(page, { largura: 1280 });
  const passo = page.getByRole('heading', { name: 'Próximo passo', exact: true });
  const planejamento = page.getByRole('heading', { name: 'Planejamento', exact: true });
  const medicao = page.getByRole('heading', { name: 'Última medição', exact: true });
  await expect(medicao).toBeVisible();
  const [p, pl, m] = [(await passo.boundingBox())!, (await planejamento.boundingBox())!, (await medicao.boundingBox())!];
  expect(pl.y).toBeGreaterThan(p.y);
  expect(m.x).toBeGreaterThan(pl.x + pl.width);
  expect(Math.abs(m.y - pl.y)).toBeLessThan(8);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(async () => (await medicao.boundingBox())!.y).toBeGreaterThan((await planejamento.boundingBox())!.y);
  await expect.poll(async () => Math.abs((await medicao.boundingBox())!.x - (await planejamento.boundingBox())!.x)).toBeLessThan(40);
  expect((await planejamento.boundingBox())!.y).toBeGreaterThan((await passo.boundingBox())!.y);
});

test('Resumo sem pasta: o passo pede a primeira pasta, o Planejamento diz "Nenhuma pasta ainda" e os treinos são uma linha de apoio', async ({ page }) => {
  await abrir(page);
  await expect(page.getByText('Sem pasta ainda. Crie a primeira com o treino e a dieta.', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhuma pasta ainda', { exact: true })).toBeVisible();
  await expect(page.getByText('Treinos: ainda sem registros nesta semana.', { exact: true })).toBeVisible();
  await expect(page.getByText('Tudo em dia.', { exact: true })).toHaveCount(0);
});

test('Resumo com uma pasta aberta e sem período: "Nenhuma pasta vigente" não esconde a pasta, e o atalho só a abre', async ({ page }) => {
  const pasta: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Pasta fictícia', inicio: null, fim: null, concluidaEm: null };
  const { pedidos } = await abrir(page, { pastas: [pasta] });
  await expect(page.getByText('Nenhuma pasta vigente', { exact: true })).toBeVisible();
  await expect(page.getByText('1 pasta aberta · Sem período definido', { exact: true })).toBeVisible();
  // Existe pasta e o aluno entra no app: nada pede ação, e as duas fontes chegaram.
  await expect(page.getByText('Tudo em dia.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir pasta', exact: true }).click();
  await expect(aba(page, 'Planos')).toHaveAttribute('aria-selected', 'true');
  await expect(page).not.toHaveURL(/pastaId=/);
  // Só navega: nada é publicado nem renovado.
  expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh')).toEqual([]);
});

test('Resumo com uma pasta que só tem rascunho: diz "em rascunho" e o atalho "Abrir rascunho" só leva à aba Planos', async ({ page }) => {
  const pasta: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Pasta fictícia', inicio: null, fim: null, concluidaEm: null };
  const rascunho = {
    id: 't1', alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Treino fictício', inicio: null, fim: null, ativo: false,
    versaoPublicada: 0, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  };
  const { pedidos } = await abrir(page, {
    pastas: [pasta],
    extra: {
      [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [rascunho] },
      [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [] },
      [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: [] },
    },
  });
  await expect(page.getByText('1 pasta em rascunho · Sem período definido', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir rascunho', exact: true }).click();
  await expect(aba(page, 'Planos')).toHaveAttribute('aria-selected', 'true');
  // Só navega: nada é publicado.
  expect(pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh')).toEqual([]);
});

test('Resumo: enquanto a atualização carrega nunca diz "Tudo em dia"; quando falha, diz o que não conferiu', async ({ page }) => {
  let soltar: () => void = () => {};
  const espera = new Promise<void>((r) => { soltar = r; });
  const pasta: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Pasta fictícia', inicio: null, fim: null, concluidaEm: null };
  await abrir(page, {
    pastas: [pasta],
    extra: {
      [`GET /alunos/${ALUNO_ID}/atualizacao`]: async (_p, route) => {
        await espera;
        const { status, corpo } = erroApi(500, 'Falha fictícia.');
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
      },
    },
  });
  await expect(page.getByRole('progressbar', { name: 'Conferindo a situação do aluno…' })).toBeVisible();
  await expect(page.getByText('Tudo em dia.', { exact: true })).toHaveCount(0);
  soltar();
  await expect(page.getByText('Não foi possível conferir a atualização. O resto não pede ação agora.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar de novo', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Tudo em dia.', { exact: true })).toHaveCount(0);
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
  // Última medição: o peso com a data em que foi registrado, nunca "peso atual".
  await expect(page.getByText('80,5 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Registrado em 26/10/2026', { exact: true })).toBeVisible();
  await expect(page.getByText(/peso atual/i)).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho === `/alunos/${ALUNO_ID}/lesoes`)).toBe(true);
  await page.getByRole('button', { name: /^1 lesão ativa: ver na ficha/ }).click();
  await expect(aba(page, 'Ficha do aluno')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Histórico de lesões', { exact: true })).toBeVisible();
});

test('sem ALUNO_SENSIVEL_LER: nem aviso de lesões nem peso, e nada é pedido', async ({ page }) => {
  const semSensivel = PERMISSOES_TREINADOR.filter((p) => !p.startsWith('ALUNO_SENSIVEL'));
  const { pedidos } = await abrir(page, { permissoes: semSensivel, lesoes: LESOES });
  await expect(page.getByRole('heading', { name: 'Próximo passo', exact: true })).toBeVisible();
  await expect(page.getByText(/lesão|lesões/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Última medição', exact: true })).toHaveCount(0);
  expect(pedidos.some((p) => p.caminho.endsWith('/lesoes') || p.caminho.endsWith('/pesos'))).toBe(false);
});

test('Última medição: "Ver evolução" abre a aba Evolução', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Ver evolução', exact: true }).click();
  await expect(aba(page, 'Evolução')).toHaveAttribute('aria-selected', 'true');
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

test('Atividade recente vazia: uma linha de apoio, sem cartão', async ({ page }) => {
  await abrir(page);
  await expect(page.getByText('Atividade recente: nenhum evento disponível.', { exact: true })).toBeVisible();
  await expect(page.getByText('Atividade recente', { exact: true })).toHaveCount(0);
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
