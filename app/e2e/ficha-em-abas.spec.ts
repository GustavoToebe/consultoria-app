import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, Atualizacao, ItemDeAtividade, Lesao, PastaResumo } from '../src/api/tipos';
import { CLARO, contraste, coresDeDestaque, misturar } from '../src/tema/tokens';
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

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const corDe = (l: Locator) => l.evaluate((e) => getComputedStyle(e).color);
const AZUL_CLARO = coresDeDestaque(CLARO, 'claro').azul.cor;
const temaClaro = (page: Page) =>
  page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'CLARO' })), TREINADOR.id);

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
    // As quatro seções dos dados (pedido de 12/11) e o acesso ao app em bloco próprio.
    for (const secao of ['Identificação', 'Contato e endereço', 'Configuração do acompanhamento', 'Objetivo e observações']) {
      await expect(page.getByRole('heading', { name: secao, exact: true })).toBeVisible();
    }
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

// Acompanhamento (24/11): Frequência e mobilidade em dois indicadores neutros ("Treinos esta semana" e "Mobilidade esta
// semana", com "Semana passada: N") e a Água com a linha de resumo e o mini gráfico. Datas relativas a hoje: a pasta vai
// de hoje−10 a hoje+10, o treino e a marca da mobilidade são de hoje e hoje−7 é sempre a semana passada.
const diaLocal = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE');
const VIGENTE: PastaResumo = { id: PASTA_ID, alunoId: ALUNO_ID, titulo: 'Hipertrofia fictícia', inicio: diaLocal(-10), fim: diaLocal(10), concluidaEm: null };
const PLANO_DE_MOBILIDADE = {
  id: 'm1', alunoId: ALUNO_ID, pastaId: PASTA_ID, titulo: 'Mobilidade fictícia', inicio: VIGENTE.inicio, fim: VIGENTE.fim, ativo: true,
  versaoPublicada: 1, publicadoEm: null, rascunhoAlteradoDepoisDePublicar: false, versao: 1,
};
const treinoEm = (dias: number) => ({
  data: diaLocal(dias),
  sessoes: [{ sessaoUid: 's1', sessao: 'Treino A', planoVersaoId: 'v1', exercicios: [{ exercicioUid: 'e1', exercicioId: null, nome: 'Exercício fictício',
    series: [{ id: 'x1', serieUid: 'su1', tipo: 'WS', trabalho: true, carga: null, unidade: null, repeticoes: null, concluida: true, observacao: null }] }] }],
});
const TREINO_DE_HOJE = treinoEm(0);
const comPastaVigente = (mobilidade: unknown[], execucoes: unknown[] = [TREINO_DE_HOJE]): RespostasApi => ({
  [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: { corpo: { pasta: VIGENTE } },
  [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: execucoes },
  [`GET /alunos/${ALUNO_ID}/planos-mobilidade`]: { corpo: mobilidade },
  [`GET /alunos/${ALUNO_ID}/mobilidade/registros`]: { corpo: [{ planoVersaoId: 'mv1', secaoUid: 's', itemUid: 'i', data: diaLocal(0), feito: true }] },
});
// Plano de treino publicado da pasta com quatro sessões de dia fixo: o previsto da semana é 4.
const COM_PREVISTO: RespostasApi = {
  [`GET /alunos/${ALUNO_ID}/planos-treino`]: { corpo: [{ ...PLANO_DE_MOBILIDADE, id: 't1', titulo: 'Treino fictício' }] },
  'GET /planos-treino/t1/versoes/1': { corpo: { id: 'tv1', planoId: 't1', numero: 1, titulo: 'Treino fictício', inicio: null, fim: null, publicadoEm: null,
    conteudo: { objetivo: null, orientacoes: null, sessoes: [1, 2, 4, 5].map((dia) => ({ uid: `s${dia}`, nome: `Treino ${dia}`, diaSemana: dia, tipo: 'TREINO',
      frequenciaSemanal: null, observacao: null, cardio: null, exercicios: [], grupos: [] })) } } },
};
const indicador = (page: Page, rotulo: string) => page.getByLabel(new RegExp(`^${rotulo}: `));
const pediuMobilidade = (pedidos: { caminho: string }[]) => pedidos.some((p) => p.caminho.endsWith('/planos-mobilidade') || p.caminho.endsWith('/mobilidade/registros'));

for (const largura of [390, 1280]) {
  test(`${largura}px: Frequência e mobilidade em dois indicadores, com a semana passada embaixo e o rótulo da pasta uma vez`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`,
      extra: comPastaVigente([PLANO_DE_MOBILIDADE], [TREINO_DE_HOJE, treinoEm(-7)]) });
    await expect(page.getByRole('heading', { name: 'Frequência e mobilidade', exact: true })).toBeVisible();
    await expect(page.getByText(/^Pasta Hipertrofia fictícia \(\d\d\/\d\d a \d\d\/\d\d\)$/)).toHaveCount(1);
    const treinos = indicador(page, 'Treinos esta semana');
    const mobilidade = indicador(page, 'Mobilidade esta semana');
    await expect(treinos).toHaveAttribute('aria-label', 'Treinos esta semana: 1 treino. Semana passada: 1');
    await expect(mobilidade).toHaveAttribute('aria-label', 'Mobilidade esta semana: 1 dia. Semana passada: 0');
    await expect(treinos.getByText('Semana passada: 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Frequência e mobilidade' })).toHaveCount(0);
    const [t, m] = [(await treinos.boundingBox())!, (await mobilidade.boundingBox())!];
    // No PC lado a lado e da mesma altura; no celular um embaixo do outro.
    if (largura === 1280) {
      expect(Math.abs(t.y - m.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.height - m.height)).toBeLessThanOrEqual(1);
    } else expect(m.y).toBeGreaterThanOrEqual(t.y + t.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Frequência com o plano de treino da pasta: "1 de 4 treinos"', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, extra: { ...comPastaVigente([PLANO_DE_MOBILIDADE]), ...COM_PREVISTO } });
  await expect(indicador(page, 'Treinos esta semana')).toHaveAttribute('aria-label', 'Treinos esta semana: 1 de 4 treinos. Semana passada: 0');
  await expect(indicador(page, 'Treinos esta semana').getByText('1 de 4 treinos', { exact: true })).toBeVisible();
});

test('Frequência e mobilidade sem pasta vigente: só os treinos, zero neutro, e a nota uma vez abaixo do indicador', async ({ page }) => {
  await temaClaro(page);
  const { pedidos } = await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento` });
  const nota = page.getByText('Nenhuma pasta vigente.', { exact: true });
  await expect(nota).toHaveCount(1);
  const treinos = indicador(page, 'Treinos esta semana');
  await expect(treinos).toHaveAttribute('aria-label', 'Treinos esta semana: 0 treinos. Semana passada: 0');
  await expect(indicador(page, 'Mobilidade esta semana')).toHaveCount(0);
  // Zero é "0 treinos" em `textoSuave` (D14), nunca "Nenhum registro" nem cor.
  expect(await corDe(treinos.getByText('0 treinos', { exact: true }))).toBe(rgb(CLARO.textoSuave));
  const caixa = (await treinos.boundingBox())!;
  expect((await nota.boundingBox())!.y).toBeGreaterThan(caixa.y + caixa.height);
  expect(pediuMobilidade(pedidos)).toBe(false);
});

// 25/11: só os treinos levam a bolinha azul do treino (a do Resumo), sem pintar o cartão; a mobilidade fica sem bolinha.
test('Frequência: indicadores neutros (sem pintura), o valor em texto e a bolinha azul só nos treinos', async ({ page }) => {
  await temaClaro(page);
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, extra: comPastaVigente([PLANO_DE_MOBILIDADE]) });
  for (const [rotulo, valor] of [['Treinos esta semana', '1 treino'], ['Mobilidade esta semana', '1 dia']] as const) {
    const cartao = indicador(page, rotulo);
    await expect(cartao.getByText(valor, { exact: true })).toBeVisible();
    expect(await cartao.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe('none');
    expect(await corDe(cartao.getByText(valor, { exact: true }))).toBe(rgb(CLARO.texto));
    const bolinhas = cartao.locator('[aria-hidden="true"]');
    if (rotulo === 'Mobilidade esta semana') await expect(bolinhas).toHaveCount(0);
    else {
      await expect(bolinhas).toHaveCount(1);
      expect(await bolinhas.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(rgb(AZUL_CLARO));
    }
  }
});

// Cores da segunda rodada (`docs/planos/cores-de-destaque.md`, D12 a D14) no tema claro: o selo do prazo da pasta é o
// mesmo no Resumo e na lista de pastas; os treinos da semana em azul; zero ("0") e indisponível ("—" com o motivo) neutros
// e distintos pelo texto.
const pastaQueTermina = (fim: number): PastaResumo => ({ ...VIGENTE, inicio: diaLocal(-20), fim: diaLocal(fim) });
const comPasta = (pasta: PastaResumo, execucoes: unknown[]): RespostasApi => ({
  [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: { corpo: { pasta } },
  [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: execucoes },
});
// Regex, não o texto exato: o "hoje" do app é o de Brasília e o `diaLocal` é o da máquina do teste (UTC na CI).
const VENCIDA = /^Vencida há [234] dias$/;
const VENCE = /^Vence em [456] dias$/;
// Cartão de indicador pintado (23/11): a peça é o `CartaoDeIndicador`, achado pelo nome acessível.
const numeroDosTreinos = (page: Page) => page.getByLabel(/^Treinos registrados: /);

for (const largura of [390, 1280]) {
  test(`${largura}px: pasta vencida em vermelho com os dias escritos, no Resumo e na lista; treinos da semana na cor da categoria`, async ({ page }) => {
    await temaClaro(page);
    const pasta = pastaQueTermina(-3);
    const { errosDaPagina } = await abrir(page, { largura, pastas: [pasta], extra: comPasta(pasta, [TREINO_DE_HOJE]) });
    const selo = page.getByText(VENCIDA);
    await expect(selo).toBeVisible();
    expect(await corDe(selo)).toBe(rgb(CLARO.perigo));
    const numero = numeroDosTreinos(page).getByText('1', { exact: true });
    await expect(numero).toBeVisible();
    // ficha: resumo em cartões (24/11): treino é categoria, então o cartão é pintado de azul (ponto, degradê, borda); o
    // número fica na cor se passar 4,5:1 sobre o fundo mais forte, senão em `texto` (a regra do cartão pintado).
    const forte = misturar(CLARO.superficie2, AZUL_CLARO, 0.08 /* TINTA_DA_PINTURA.claro: ui/superficiePintada importa o RN, que o Playwright não carrega */);
    expect(await corDe(numero)).toBe(rgb(contraste(AZUL_CLARO, forte) >= 4.5 ? AZUL_CLARO : CLARO.texto));
    expect(await numeroDosTreinos(page).locator('[aria-hidden="true"]').first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(rgb(AZUL_CLARO));
    expect(await numeroDosTreinos(page).evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
    await expect(numeroDosTreinos(page).getByText('nesta semana', { exact: true })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await aba(page, 'Planos').click();
    await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
    await expect(page.getByText(VENCIDA)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('a vigente vencida segue vermelha com a do ciclo seguinte ainda em rascunho, no Resumo e na lista', async ({ page }) => {
  const vigente = pastaQueTermina(-3);
  const seguinte: PastaResumo = { ...vigente, id: 'f0000000-0000-4000-8000-0000000000a2', titulo: 'Pasta seguinte', inicio: diaLocal(-2), fim: diaLocal(12) };
  await abrir(page, { pastas: [vigente, seguinte], extra: comPasta(vigente, [TREINO_DE_HOJE]) });
  await expect(page.getByText(VENCIDA)).toHaveCount(1);
  await aba(page, 'Planos').click();
  await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
  await expect(page.getByText(VENCIDA)).toHaveCount(1);
});

// A aba Planos reaproveita a pasta vigente e a lista de pastas que o Resumo da ficha já buscou: abrir Resumo → Planos pede
// cada rota uma vez só, e a vigente vencida segue vermelha na lista (só leitura; a contagem vem dos pedidos interceptados).
const contar = (pedidos: { metodo: string; caminho: string }[], caminho: string) =>
  pedidos.filter((p) => p.metodo === 'GET' && p.caminho === caminho).length;

test('Resumo → Planos: a pasta vigente e a lista de pastas são pedidas uma vez só e o prazo vermelho continua na lista', async ({ page }) => {
  const pasta = pastaQueTermina(-3);
  const { pedidos } = await abrir(page, { pastas: [pasta], extra: comPasta(pasta, [TREINO_DE_HOJE]) });
  await expect(page.getByText(VENCIDA)).toBeVisible();
  await aba(page, 'Planos').click();
  await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
  await expect(page.getByText(VENCIDA)).toBeVisible();
  expect(contar(pedidos, `/alunos/${ALUNO_ID}/pastas/vigente`)).toBe(1);
  expect(contar(pedidos, `/alunos/${ALUNO_ID}/pastas`)).toBe(1);
});

// Finalizar a pasta pela lista refaz a busca da ficha uma vez: a lista mostra a pasta concluída e o Resumo, que usa a mesma
// resposta, perde o prazo da pasta (voltar a ele não pede nada), com 1 pedido novo da lista de pastas e da vigente, não 2.
test('mudar a pasta (finalizar) atualiza a lista e o Resumo com 1 pedido novo da lista de pastas', async ({ page }) => {
  const pasta = pastaQueTermina(5);
  let concluida = false;
  const { pedidos, errosDaPagina } = await abrir(page, {
    permissoes: [...PERMISSOES_TREINADOR, 'PASTA_ALTERAR'],
    extra: {
      [`GET /alunos/${ALUNO_ID}/execucoes`]: { corpo: [TREINO_DE_HOJE] },
      [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: (_p, route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ pasta: concluida ? null : pasta }) }),
      [`GET /alunos/${ALUNO_ID}/pastas`]: (_p, route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify([concluida ? { ...pasta, concluidaEm: new Date().toISOString() } : pasta]) }),
      [`POST /pastas/${PASTA_ID}/finalizar`]: (_p, route) => { concluida = true; return route.fulfill({ status: 204 }); },
    },
  });
  await expect(page.getByText(VENCE)).toBeVisible();
  await aba(page, 'Planos').click();
  await page.getByRole('button', { name: new RegExp(`^Pasta ${pasta.titulo}, aberta`) }).click();
  await page.getByRole('dialog', { name: pasta.titulo }).getByRole('button', { name: 'Finalizar pasta' }).click();
  const lista = () => contar(pedidos, `/alunos/${ALUNO_ID}/pastas`);
  const vigente = () => contar(pedidos, `/alunos/${ALUNO_ID}/pastas/vigente`);
  expect([lista(), vigente()]).toEqual([1, 1]);
  await page.getByRole('dialog', { name: `Finalizar “${pasta.titulo}”` }).getByRole('button', { name: 'Finalizar pasta' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Pasta ${pasta.titulo}, concluída`) })).toBeVisible();
  expect([lista(), vigente()]).toEqual([2, 2]);
  await aba(page, 'Resumo').click();
  await expect(page.getByRole('tab', { name: 'Resumo', selected: true })).toBeVisible();
  await expect(page.getByText(VENCE)).toHaveCount(0);
  expect([lista(), vigente()]).toEqual([2, 2]);
  expect(errosDaPagina).toEqual([]);
});

// Com a busca da ficha em erro, o cartão de pastas busca a lista sozinho: a pasta aparece na aba Planos (1 pedido dentro
// da busca que falhou e 1 do cartão).
test('busca da ficha em erro: a aba Planos busca a lista sozinha e mostra a pasta', async ({ page }) => {
  const pasta = pastaQueTermina(5);
  const { pedidos, errosDaPagina } = await abrir(page, { pastas: [pasta], extra: { [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: erroApi(500, 'Falha fictícia.') } });
  await aba(page, 'Planos').click();
  await expect(page.getByRole('button', { name: new RegExp(`^Pasta ${pasta.titulo}, aberta`) })).toBeVisible();
  expect(contar(pedidos, `/alunos/${ALUNO_ID}/pastas`)).toBe(2);
  expect(errosDaPagina).toEqual([]);
});

test('pasta perto do fim: "Vence em 5 dias" em âmbar no Resumo e na lista', async ({ page }) => {
  await temaClaro(page);
  const pasta = pastaQueTermina(5);
  await abrir(page, { pastas: [pasta], extra: comPasta(pasta, [TREINO_DE_HOJE]) });
  const selo = page.getByText(VENCE);
  await expect(selo).toBeVisible();
  expect(await corDe(selo)).toBe(rgb(CLARO.atencao));
  await aba(page, 'Planos').click();
  await expect(page.getByText(VENCE)).toBeVisible();
});

test('pasta vencida já renovada (a seguinte é a vigente): nenhum selo de prazo', async ({ page }) => {
  const antiga = pastaQueTermina(-3);
  const nova: PastaResumo = { ...antiga, id: 'f0000000-0000-4000-8000-0000000000a2', titulo: 'Pasta seguinte', inicio: diaLocal(-2), fim: diaLocal(12) };
  await abrir(page, { pastas: [antiga, nova], extra: comPasta(nova, [TREINO_DE_HOJE]) });
  await expect(page.getByText('Pasta seguinte', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Vencida |^Vence /)).toHaveCount(0);
  await aba(page, 'Planos').click();
  await expect(page.getByText('Pastas de plano', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Vencida |^Vence /)).toHaveCount(0);
});

test('Resumo: semana sem treino mostra "0" neutro, sem o motivo do indisponível', async ({ page }) => {
  await temaClaro(page);
  // Treino só antes desta semana (dentro da pasta): a semana tem zero, e o último registro existe.
  await abrir(page, { pastas: [VIGENTE], extra: comPasta(VIGENTE, [{ ...TREINO_DE_HOJE, data: diaLocal(-8) }]) });
  const zero = numeroDosTreinos(page).getByText('0', { exact: true });
  await expect(zero).toBeVisible();
  expect(await corDe(zero)).toBe(rgb(CLARO.textoSuave));
  await expect(page.getByText('Não foi possível carregar', { exact: true })).toHaveCount(0);
});

test('Resumo: treinos que não carregaram mostram "—" com o motivo, nunca o zero', async ({ page }) => {
  await temaClaro(page);
  await abrir(page, { extra: { [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: erroApi(500, 'Falha fictícia.') } });
  const indisponivel = numeroDosTreinos(page);
  await expect(indisponivel.getByText('—', { exact: true })).toBeVisible();
  await expect(indisponivel.getByText('Não foi possível carregar', { exact: true })).toBeVisible();
  await expect(indisponivel.getByText('0', { exact: true })).toHaveCount(0);
  expect(await corDe(indisponivel.getByText('—', { exact: true }))).toBe(rgb(CLARO.textoSuave));
});

test('Frequência e mobilidade: pasta sem mobilidade publicada diz isso só no indicador da mobilidade', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, extra: comPastaVigente([]) });
  await expect(indicador(page, 'Mobilidade esta semana')).toHaveAttribute('aria-label', 'Mobilidade esta semana: —. A pasta vigente não tem mobilidade publicada.');
  await expect(page.getByText('A pasta vigente não tem mobilidade publicada.', { exact: true })).toHaveCount(1);
});

test('Frequência e mobilidade sem TREINO_LER: só os treinos, sem previsto, e nada da mobilidade nem do plano é pedido', async ({ page }) => {
  const { pedidos } = await abrir(page, {
    url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, permissoes: PERMISSOES_TREINADOR.filter((p) => p !== 'TREINO_LER'),
    extra: { ...comPastaVigente([PLANO_DE_MOBILIDADE]), ...COM_PREVISTO },
  });
  await expect(indicador(page, 'Treinos esta semana')).toHaveAttribute('aria-label', 'Treinos esta semana: 1 treino. Semana passada: 0');
  await expect(indicador(page, 'Mobilidade esta semana')).toHaveCount(0);
  expect(pediuMobilidade(pedidos)).toBe(false);
  expect(pedidos.some((p) => p.caminho.endsWith('/planos-treino'))).toBe(false);
});

test('Frequência e mobilidade com o resumo da ficha em erro: a mensagem uma vez, sem indicadores e sem pedir a mobilidade', async ({ page }) => {
  const { pedidos } = await abrir(page, {
    url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`,
    extra: { ...comPastaVigente([PLANO_DE_MOBILIDADE]), [`GET /alunos/${ALUNO_ID}/pastas/vigente`]: erroApi(500, 'Falha fictícia.') },
  });
  await expect(page.getByRole('heading', { name: 'Frequência e mobilidade', exact: true })).toBeVisible();
  await expect(page.getByText('Falha fictícia.', { exact: true })).toHaveCount(1);
  await expect(indicador(page, 'Treinos esta semana')).toHaveCount(0);
  await expect(page.getByText('Mobilidade esta semana', { exact: true })).toHaveCount(0);
  expect(pediuMobilidade(pedidos)).toBe(false);
});

// Água: a meta vem da dieta publicada em uso (5,0 L); hoje 3,0 L e hoje−6 0,0 L, os outros cinco dias sem registro.
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const COM_AGUA: RespostasApi = {
  [`GET /alunos/${ALUNO_ID}/agua`]: { corpo: [{ data: diaLocal(-6), aguaMl: 0 }, { data: diaLocal(0), aguaMl: 3000 }] },
  [`GET /alunos/${ALUNO_ID}/planos-dieta`]: { corpo: [{ ...PLANO_DE_MOBILIDADE, id: 'd1', titulo: 'Dieta fictícia' }] },
  'GET /planos-dieta/d1/versoes/1': { corpo: { id: 'dv1', planoId: 'd1', numero: 1, titulo: 'Dieta fictícia', inicio: null, fim: null, publicadoEm: null, conteudo: { aguaLitros: 5 } } },
};
const colunasDaAgua = (page: Page) => page.getByRole('img', { name: /^\d\d\/\d\d: / });

for (const largura of [390, 1280]) {
  test(`${largura}px: Água com o resumo no topo e sete colunas em ordem, do mais antigo a "Hoje"`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, extra: COM_AGUA });
    await expect(page.getByText('Registrou 2 de 7 dias · média 1,5 L por dia · meta 5,0 L', { exact: true })).toBeVisible();
    const colunas = colunasDaAgua(page);
    await expect(colunas).toHaveCount(7);
    const nomes = Array.from({ length: 7 }, (_, i) => diaLocal(i - 6)).map((d, i) =>
      `${ddmm(d)}: ${i === 0 ? '0,0 L de 5,0 L' : i === 6 ? '3,0 L de 5,0 L' : 'sem registro'}`);
    expect(await colunas.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(nomes);
    // A dica do navegador diz o mesmo; o rótulo de baixo termina em "Hoje".
    await expect(colunas.last()).toHaveAttribute('title', nomes[6]);
    await expect(page.getByText('Hoje', { exact: true })).toBeVisible();
    // Zero tem altura mínima (não some) e fica bem abaixo da barra de hoje.
    const zero = (await colunas.first().locator('div').first().boundingBox())!;
    const hoje = (await colunas.last().locator('div').first().boundingBox())!;
    expect(zero.height).toBeGreaterThan(0);
    expect(hoje.height).toBeGreaterThan(zero.height * 10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Água sem nenhum registro: só a frase com a meta, sem gráfico', async ({ page }) => {
  await abrir(page, { url: `/treinador/alunos/${ALUNO_ID}?aba=acompanhamento`, extra: { ...COM_AGUA, [`GET /alunos/${ALUNO_ID}/agua`]: { corpo: [] } } });
  await expect(page.getByText('Nenhum registro nos últimos 7 dias · meta 5,0 L', { exact: true })).toBeVisible();
  await expect(colunasDaAgua(page)).toHaveCount(0);
});

test('sem permissão: aba sem bloco permitido não aparece e o endereço dela cai no Resumo', async ({ page }) => {
  await abrir(page, { permissoes: ['ALUNO_LER'], url: `/treinador/alunos/${ALUNO_ID}?aba=evolucao` });
  await expect(aba(page, 'Resumo')).toHaveAttribute('aria-selected', 'true');
  await expect(aba(page, 'Planos')).toHaveCount(1);
  await expect(aba(page, 'Ficha do aluno')).toHaveCount(1);
  await expect(aba(page, 'Acompanhamento')).toHaveCount(0);
  await expect(aba(page, 'Evolução')).toHaveCount(0);
});
