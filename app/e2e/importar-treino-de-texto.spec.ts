import { expect, test, type Page } from '@playwright/test';
import type { ConteudoTreino, Exercicio, Receita, Sessao } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Colar treino de PDF / Google Docs (A02): a Folha lê o texto, mostra o que entendeu e só então traz para o rascunho do
// editor (com Desfazer; nada é salvo até o treinador mandar). Dados fictícios, API simulada.
const ID_PLANO = 'm0000000-0000-4000-8000-000000000070';
const ID_NOVO = 'm0000000-0000-4000-8000-000000000071';

const exercicio = (id: string, nome: string, grupoMuscular: string): Exercicio => ({
  id, nome, grupoMuscular, equipamento: null, modalidade: 'MAQUINA', videoUrl: null, observacoes: null, origem: 'PROPRIO', imagens: [], imagemPropriaEm: null,
});
const BIBLIOTECA = [exercicio('ex-supino', 'Supino inclinado máquina', 'Peito'), exercicio('ex-puxada', 'Puxada frontal aberta', 'Costas')];

const TEXTO = [
  'TREINO A - PEITO E COSTAS',
  '',
  'Supino inclinado máquina',
  '2x3 a 5 - FS',
  '1x8 - WS',
  '',
  'Puxada frontal aberta',
  '1x8 a 12 - WS',
  '1x10 a 12 - Back off',
].join('\n');

const sessaoFicticia = (uid: string, nome: string, comExercicio: boolean): Sessao => ({
  uid, nome, diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
  exercicios: comExercicio ? [{
    uid: `${uid}-ex`, exercicioId: null, nome: 'Remada fictícia', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null,
    series: [{ uid: `${uid}-s`, tipo: 'WORKING', repsMin: 8, repsMax: 12, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null }, esforco: null, descansoSegundos: null, tecnica: null }],
  }] : [],
});

const conteudoDo = (sessoes: Sessao[]): ConteudoTreino => ({
  objetivo: null, orientacoes: null,
  metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
  sessoes,
} as unknown as ConteudoTreino);

async function abrirEditor(page: Page, sessoes: Sessao[]) {
  let plano: Receita = { id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: conteudoDo(sessoes) };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /receitas': (_p, route) => json(route, []),
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
    [`PUT /receitas/${ID_PLANO}/conteudo`]: (p, route) => { plano = { ...plano, ...(p.corpo as Receita), versao: plano.versao + 1 }; return json(route, plano); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { api, plano: () => plano };
}

for (const largura of [390, 1280]) {
  test(`colar o texto, ver o que foi entendido, trazer para o editor (plano vazio) e desfazer (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { api, plano } = await abrirEditor(page, []);

    await page.getByRole('button', { name: 'Colar treino (Docs / PDF)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Trazer para o editor', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Texto do treino', exact: true }).fill(TEXTO);

    // A prévia mostra o que o sistema entendeu antes de mexer em qualquer coisa.
    await expect(page.getByTestId('resumo-do-texto')).toContainText('1 divisão · 2 exercícios · 5 séries prontas');
    await expect(page.getByTestId('resumo-do-texto')).toContainText('Todos os exercícios foram ligados à biblioteca.');
    await expect(page.getByTestId('divisao-lida')).toHaveCount(1);
    await expect(page.getByTestId('exercicio-lido')).toHaveCount(2);
    await expect(page.getByTestId('exercicio-lido').first()).toContainText('Supino inclinado máquina · Peito');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('colar-treino-previa.png'), fullPage: true });
    // Nada foi enviado ainda.
    expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);

    await page.getByRole('button', { name: 'Trazer para o editor', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Trazer para o editor', exact: true })).toHaveCount(0);
    await expect(page.getByText('Sessões (1)', { exact: true })).toBeVisible();
    await expect(page.getByText('Treino A - Peito e costas', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Treino colado trazido para o editor.', { exact: false })).toBeVisible();
    expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);

    // Salvar grava o que veio do texto, com o vínculo da biblioteca.
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = (plano().conteudo as ConteudoTreino).sessoes;
    expect(salvo).toHaveLength(1);
    expect(salvo[0].exercicios.map((e) => [e.nome, e.exercicioId])).toEqual([['Supino inclinado máquina', 'ex-supino'], ['Puxada frontal aberta', 'ex-puxada']]);
    expect(salvo[0].exercicios[0].series.map((s) => s.tipo)).toEqual(['FEEDER', 'FEEDER', 'WORKING']);

    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    await expect(page.getByText('Sessões (1)', { exact: true })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}

test('plano que já tem exercício: o botão vira "Adicionar ao plano" e a divisão nova entra no fim', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { api } = await abrirEditor(page, [sessaoFicticia('sessao-existente', 'Treino A', true)]);
  await page.getByRole('button', { name: 'Colar treino (Docs / PDF)', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto do treino', exact: true }).fill('Treino B\nPuxada frontal aberta\n1x8 a 12 - WS');
  await page.getByRole('button', { name: 'Adicionar ao plano', exact: true }).click();
  await expect(page.getByText('Sessões (2)', { exact: true })).toBeVisible();
  expect(api.pedidos.filter((p) => p.metodo === 'PUT')).toEqual([]);
  expect(api.errosDaPagina).toEqual([]);
});

test('tabela de PDF colada: nome quebrado, tipo na linha de baixo, faixa do back off com aviso e observação solta no editor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { api, plano } = await abrirEditor(page, []);
  await page.getByRole('button', { name: 'Colar treino (Docs / PDF)', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto do treino', exact: true }).fill([
    'Segunda - Costas',
    'EXERCÍCIO SÉRIES x REPS OBS LINKS',
    'Remada fictícia na polia',
    'unilateral',
    '1x10 a 15 -',
    'Aquecimento',
    '3x3 - FS',
    '1x3 a 6 - WS',
    '2x6 a 8 - Back off',
    'Back off - Faça com 80%, 85% ou 90% da carga realizada na WS',
    'Vídeo',
    'Faça igual o vídeo do lado',
    'Domingo - Off ativo',
    'Cardio 50 min ou HIIT de 25 min',
  ].join('\n'));

  // Um exercício só (não um por linha), com as 7 séries, e o cardio do dia off.
  await expect(page.getByTestId('resumo-do-texto')).toContainText('2 divisões · 2 exercícios · 8 séries prontas');
  await expect(page.getByTestId('exercicio-lido').first()).toContainText('Remada fictícia na polia unilateral');
  await expect(page.getByText('o texto traz vários percentuais de back off (80%, 85% ou 90%). Gravei a faixa de 80% a 90%; confira.', { exact: false })).toBeVisible();
  await expect(page.getByText('usei o primeiro tempo (50 min)', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Trazer para o editor', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
  await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
  const [costas, domingo] = (plano().conteudo as ConteudoTreino).sessoes;
  expect(costas.exercicios).toHaveLength(1);
  expect(costas.exercicios[0].observacao).toBe('Faça igual o vídeo do lado');
  const backOff = costas.exercicios[0].series.filter((s) => s.tipo === 'BACK_OFF');
  expect(backOff.map((s) => s.carga)).toEqual([
    { modo: 'PERCENTUAL_WS', percentualMin: 80, percentualMax: 90 }, { modo: 'PERCENTUAL_WS', percentualMin: 80, percentualMax: 90 },
  ]);
  expect(domingo.exercicios[0]).toMatchObject({ nome: 'Cardio', observacao: 'Cardio 50 min ou HIIT de 25 min' });
  expect(domingo.exercicios[0].series[0].cardio).toMatchObject({ duracaoMin: 50, distanciaKm: null });
  expect(api.errosDaPagina).toEqual([]);
  expect(api.naoTratadas).toEqual([]);
});

test('texto sem exercício reconhecido não deixa trazer e diz o motivo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abrirEditor(page, []);
  await page.getByRole('button', { name: 'Colar treino (Docs / PDF)', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto do treino', exact: true }).fill('3x8 - WS');
  await expect(page.getByTestId('resumo-do-texto')).toContainText('Nada reconhecido ainda');
  await expect(page.getByRole('button', { name: 'Trazer para o editor', exact: true })).toBeDisabled();
});

test('atalho da Importação: cria o modelo de semana de treino e abre o editor já com a Folha de colar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let criado: Receita | null = null;
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /importacoes': { corpo: { itens: [], total: 0, pagina: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /receitas': (_p, route) => json(route, criado ? [criado] : []),
    'POST /receitas': (p, route) => { criado = { ...(p.corpo as Receita), id: ID_NOVO, ordem: 1, versao: 1 }; return json(route, criado, 201); },
    [`GET /receitas/${ID_NOVO}`]: (_p, route) => json(route, criado),
  });
  await page.goto('/treinador/importacao');
  await page.getByRole('button', { name: 'Colar treino de PDF / Docs', exact: true }).click();
  // O modelo é novo: pede o nome antes de criar.
  await page.getByRole('textbox', { name: 'Nome do modelo', exact: true }).fill('Semana colada fictícia');
  await page.getByRole('button', { name: 'Criar e editar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Texto do treino', exact: true })).toBeVisible();
  expect(api.pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/receitas'))?.corpo).toMatchObject({ tipo: 'PLANO_TREINO', nome: 'Semana colada fictícia' });
  // O pedido de abrir a Folha sai do endereço: fechar e voltar não a reabre.
  expect(page.url()).not.toContain('colar=1');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Texto do treino', exact: true })).toHaveCount(0);
  expect(api.errosDaPagina).toEqual([]);
});
