import { expect, test, type Page } from '@playwright/test';
import type { Configuracao, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

// Só modelos e prescrições fictícios; nenhuma chamada chega ao banco.
const serieInicial: Serie = {
  uid: 'serie-inicial', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null },
  esforco: { rir: 1, rpe: null }, descansoSegundos: null, tecnica: null,
};

async function modelo(page: Page, tipo: Receita['tipo'], metodologia: Configuracao = CONFIGURACAO_PADRAO) {
  let atual: Receita = { id: 'm0000000-0000-4000-8000-000000000001', tipo, nome: 'Modelo de teste', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: tipo === 'METODOLOGIA' ? structuredClone(CONFIGURACAO_PADRAO) : { series: [serieInicial] } };
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /receitas/${atual.id}`]: (_p, route) => json(route, atual),
    'GET /receitas': { corpo: [{ ...atual, tipo: 'METODOLOGIA', conteudo: metodologia }] },
    [`PUT /receitas/${atual.id}`]: (p, route) => { atual = { ...atual, ...p.corpo as Receita, versao: atual.versao + 1 }; return json(route, atual); },
  });
  await page.goto(`/treinador/planejamento/modelo/${atual.id}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { pedidos, errosDaPagina, naoTratadas, salvo: () => atual };
}

async function modeloDeSeries(page: Page, series: Serie[]) {
  let atual: Receita = { id: 'm0000000-0000-4000-8000-000000000001', tipo: 'SERIES', nome: 'Modelo de teste', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo: { series } };
  const { pedidos, errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /receitas/${atual.id}`]: (_p, route) => json(route, atual),
    'GET /receitas': { corpo: [{ ...atual, tipo: 'METODOLOGIA', conteudo: CONFIGURACAO_PADRAO }] },
    [`PUT /receitas/${atual.id}`]: (p, route) => { atual = { ...atual, ...p.corpo as Receita, versao: atual.versao + 1 }; return json(route, atual); },
  });
  await page.goto(`/treinador/planejamento/modelo/${atual.id}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { pedidos, errosDaPagina, naoTratadas, salvo: () => atual };
}

const BOTAO_REST_PAUSE_NA_ULTIMA = 'Aplicar Rest-pause só na última série';

/** Painel "Nova série": WS com Cluster (o que os atalhos de exemplo montavam), já com 4 blocos de 4. */
async function adicionarWsComCluster(page: Page) {
  await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
  await page.getByRole('button', { name: 'Cluster', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
  await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
  await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
  await expect(page.getByText('1 série completa · 4 blocos de 4 reps · pausa de 15 s', { exact: true })).toBeVisible();
  await expect(page.getByText('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.')).toBeVisible();
}

const cargaDeTrabalho = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null, referenciaUid: null };

const ID_PLANO = 'm0000000-0000-4000-8000-000000000020';

/** Receita de séries "Exemplo: FS e Cluster", no formato em que a API a entrega (só estrutura, com os padrões do tipo). */
const receitaFsECluster: Receita = {
  id: 'm0000000-0000-4000-8000-000000000021', tipo: 'SERIES', nome: 'Exemplo: FS e Cluster', descricao: 'FS 1x10-15 e WS com Cluster 4×4 (pausa de 15 s).', pastaId: null, ordem: 1, versao: 1,
  conteudo: {
    series: [
      { uid: 'r-fs', tipo: 'FEEDER', repsMin: 10, repsMax: 15, carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 85, referenciaUid: null }, esforco: null, descansoSegundos: null, tecnica: null },
      { uid: 'r-cluster', tipo: 'WORKING', repsMin: 16, repsMax: 16, carga: cargaDeTrabalho, esforco: null, descansoSegundos: null,
        tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 15 } },
    ] satisfies Serie[],
  },
};

async function planoComUmExercicio(page: Page) {
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [{ uid: 'ex-1', exercicioId: null, nome: 'Supino fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series: [serieInicial] }],
      }],
    },
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /pastas-modelos': { corpo: [] },
    'GET /exercicios': { corpo: [] },
    'GET /receitas': (p, route) => json(route, p.busca.get('tipo') === 'SERIES' ? [receitaFsECluster] : []),
    [`GET /receitas/${ID_PLANO}`]: (_p, route) => json(route, plano),
    // O plano de treino como modelo grava o conteúdo por esta rota (o editor de treino não usa o PUT da receita).
    [`PUT /receitas/${ID_PLANO}/conteudo`]: (p, route) => { Object.assign(plano, p.corpo as Receita, { versao: plano.versao + 1 }); return json(route, plano); },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID_PLANO}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { ...api, salvo: () => plano };
}

for (const largura of [390, 1280]) {
  test(`metodologia: editar regra em faixa e padrão da técnica (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'METODOLOGIA');
    await expect(page.getByRole('button', { name: 'Ir para Técnicas', exact: true })).toBeVisible();
    await expect(page.getByText('Preparação · 3 reps · 85% da WS')).toBeVisible();
    await page.getByRole('button', { name: 'FS, recolhido', exact: true }).click();
    await expect(page.getByLabel('Explicação para o aluno').first()).toBeVisible();
    await expect(page.getByText('Regra de percentuais por quantidade', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ir para Geral', exact: true }).click();
    await expect(page.getByText('Arredondar a sugestão de carga do aluno para')).toBeInViewport();
    await page.getByRole('textbox', { name: '1ª mín. (%)', exact: true }).first().fill('80');
    await page.getByRole('textbox', { name: '1ª máx. (%)', exact: true }).first().fill('90');
    await page.getByRole('button', { name: 'Rest pause, recolhido', exact: true }).click();
    await page.getByRole('textbox', { name: 'Pausa (s)', exact: true }).fill('25');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = api.salvo().conteudo as Configuracao;
    expect(salvo.tipos[1].regraPercentuais!['1']).toEqual([{ min: 80, max: 90 }]);
    expect(salvo.tecnicas[0].padrao).toMatchObject({ pausaSegundos: 25, pausas: 1 });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: técnica dentro da série WS, prévia e cluster 4+2 persistidos (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    // Não existe mais "Só técnica": a técnica é uma escolha à parte, sobre uma série de um tipo.
    await expect(page.getByRole('button', { name: 'Só técnica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Rest pause', exact: true }).click();
    await page.getByRole('button', { name: 'Adicionar série', exact: true }).click();
    await expect(page.getByText('1 série completa · 3 a 6 reps + 1 retomada · pausa de 20 s', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await expect(page.getByText('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.')).toBeVisible();
    await expect(page.getByText('A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.')).toBeVisible();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trabalho · WS com Cluster, aberto', exact: true })).toBeVisible();
    await expect(page.getByText(/^1x6 \(4\+2\) - WS com Cluster 15 s/)).toBeVisible();
    await expect(page.getByText('1 série completa · blocos de 4 e 2 reps (6 no total) · pausa de 15 s', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(series[1]).toMatchObject({ tipo: 'WORKING', repsMin: 6, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'CLUSTER', blocos: [4, 2] } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: bloco inválido não grava o total anterior e a série reaberta não afirma a origem do esforço (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    // Grupo de trabalho com uma série só: o atalho de Rest-pause na última série não existe.
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await expect(page.getByText('Revise o esforço desta série ao usar Cluster.')).toBeVisible();
    await expect(page.getByText('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
    await expect(page.getByText('1 série completa · 4 blocos de 4 reps · pausa de 15 s', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('11');
    await expect(page.getByText('Complete os blocos para visualizar a prescrição.', { exact: true })).toBeVisible();
    await expect(page.getByText('1 série completa · 4 blocos de 4 reps · pausa de 15 s', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('2');
    await expect(page.getByText('1 série completa · 2 blocos de 4 reps · pausa de 15 s', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const serie = (api.salvo().conteudo as { series: Serie[] }).series[0];
    expect(serie.tecnica).toMatchObject({ tipo: 'CLUSTER', blocos: [4, 4] });
    expect(serie.repsMin).toBe(8);
    expect(serie.repsMax).toBe(8);
    expect(serie.esforco).toEqual({ rir: 1, rpe: null });
  });

  test(`séries: explicação recolhida no "O que é?" e pausa com unidade (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    const explicacaoWs = CONFIGURACAO_PADRAO.tipos.find((t) => t.codigo === 'WORKING')!.explicacao!.trim();
    const explicacaoCluster = CONFIGURACAO_PADRAO.tecnicas.find((t) => t.tipo === 'CLUSTER')!.explicacao!.trim();
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    // A explicação do tipo começa recolhida; o "O que é?" abre e fecha.
    const oQueEWs = page.getByRole('button', { name: 'O que é o tipo WS?', exact: true });
    await expect(page.getByText(explicacaoWs, { exact: true })).toHaveCount(0);
    await expect(oQueEWs).toHaveAttribute('aria-expanded', 'false');
    await oQueEWs.click();
    await expect(page.getByText(explicacaoWs, { exact: true })).toBeVisible();
    await expect(oQueEWs).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await expect(page.getByText(explicacaoCluster, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'O que é Cluster?', exact: true }).click();
    await expect(page.getByText(explicacaoCluster, { exact: true })).toBeVisible();
    // "Blocos iguais" pede só os dois números; a notação fica atrás do "Digitar como 4+2".
    await expect(page.getByRole('textbox', { name: 'Blocos de repetições', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
    // A pausa é um número e uma unidade; trocar a unidade limpa o valor (15 s não são 15 respirações).
    await expect(page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true })).toHaveValue('15');
    await page.getByRole('radiogroup', { name: 'Unidade da pausa entre blocos', exact: true }).getByRole('button', { name: 'Respirações', exact: true }).click();
    const respiracoes = page.getByRole('textbox', { name: 'Pausa entre blocos em respirações', exact: true });
    await expect(respiracoes).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true })).toHaveCount(0);
    await expect(page.getByText('Informe a pausa em segundos ou em respirações.').first()).toBeVisible();
    await respiracoes.fill('4');
    // O nome acessível começa pelo texto visível e diz de qual pausa é; o campo que aparece recebe o foco.
    await page.getByRole('button', { name: 'Informar também em segundos (pausa entre blocos)', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true })).toBeFocused();
    await page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true }).fill('10');
    await expect(respiracoes).toHaveValue('4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica).toMatchObject({ tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 10, pausaRespiracoes: 4 });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: Aplicar Rest-pause só na última série não altera a anterior (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    await page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true }).click();
    // Separada a última, o primeiro grupo ainda tem 1 série (e segue aberto): o atalho não é mais oferecido nele.
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(series).toHaveLength(2);
    expect(series[0].tecnica).toBeNull();
    expect(series[1].tecnica?.tipo).toBe('REST_PAUSE');
    expect(series[0].esforco).toEqual({ rir: 1, rpe: null });
    expect(series[1].esforco).toEqual({ rir: 1, rpe: null });
    expect(series[1].repsMin).toBe(series[0].repsMin);
    expect(series[1].carga).toEqual(series[0].carga);
  });

  test(`séries: o atalho de Rest-pause some com a técnica fora da metodologia (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const semRestPause: Configuracao = { ...structuredClone(CONFIGURACAO_PADRAO), tecnicas: CONFIGURACAO_PADRAO.tecnicas.filter((t) => t.tipo !== 'REST_PAUSE') };
    const api = await modelo(page, 'SERIES', semRestPause);
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    await expect(page.getByText(/^2x3 a 6 - WS/)).toBeVisible();
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`metodologia: RPE sem valor não trava e RPE inválido mostra o erro no campo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'METODOLOGIA');
    const rpe = page.getByRole('textbox', { name: 'RPE (1 a 10, de meio em meio)', exact: true });
    const mensagem = 'RPE precisa ficar entre 1 e 10, de meio em meio.';
    const salvar = page.getByRole('button', { name: 'Salvar modelo', exact: true });
    await page.getByRole('button', { name: 'Aquecimento, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'RPE', exact: true }).click();
    // RPE escolhido e ainda sem valor equivale a "sem esforço": nenhum erro, nenhuma lista de problemas.
    await expect(rpe).toHaveValue('');
    await expect(page.getByText(mensagem)).toHaveCount(0);
    await expect(page.getByText(/problemas? para salvar/)).toHaveCount(0);
    // Valor fora da faixa: o erro específico aparece no campo e na lista, com o motivo no botão.
    await rpe.fill('11');
    await expect(page.getByText(mensagem).first()).toBeVisible();
    await expect(page.getByText('1 problema para salvar')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Tipo “Aquecimento” · Esforço padrão: RPE precisa ficar entre 1 e 10/ })).toBeVisible();
    await expect(salvar).toBeDisabled();
    // Apagar o valor volta a "sem esforço" e destrava; o corpo salvo leva esforço nulo, não um objeto vazio.
    await rpe.fill('');
    await expect(page.getByText(mensagem)).toHaveCount(0);
    await expect(salvar).toBeEnabled();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as Configuracao).tipos[0]).toMatchObject({ codigo: 'WARM_UP', esforcoPadrao: null });
    // Valor válido, de meio em meio, é gravado como digitado. Salvar recarrega o editor: o cartão volta recolhido e sem esforço.
    await page.getByRole('button', { name: 'Aquecimento, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'RPE', exact: true }).click();
    await rpe.fill('8,5');
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(2);
    expect((api.salvo().conteudo as Configuracao).tipos[0].esforcoPadrao).toMatchObject({ rpe: 8.5, rir: null });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: decimal em quantos blocos continua inválido ao mudar as repetições (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    const salvar = page.getByRole('button', { name: 'Salvar modelo', exact: true });
    await adicionarWsComCluster(page);
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('1.5');
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('5');
    await expect(page.getByRole('textbox', { name: 'Quantos blocos', exact: true })).toHaveValue('1.5');
    await expect(page.getByText(/blocos de 5 reps/)).toHaveCount(0);
    await expect(page.getByText('Complete os blocos para visualizar a prescrição.', { exact: true })).toBeVisible();
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('3');
    await expect(page.getByText('1 série completa · 3 blocos de 5 reps · pausa de 15 s', { exact: true })).toBeVisible();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const cluster = (api.salvo().conteudo as { series: Serie[] }).series.find((s) => s.tecnica?.tipo === 'CLUSTER');
    expect(cluster).toMatchObject({ repsMin: 15, repsMax: 15, tecnica: { blocos: [5, 5, 5] } });
  });

  test(`séries: voltar para blocos diferentes mostra a lista convertida (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('4');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: 'Blocos iguais', exact: true }).click();
    await page.getByRole('button', { name: 'Converter para blocos iguais', exact: true }).click();
    await expect(page.getByText('1 série completa · 2 blocos de 4 reps · pausa de 15 s', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Blocos diferentes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('4');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('4');
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('1');
    await expect(page.getByText('1 série completa · blocos de 1 e 4 reps (5 no total) · pausa de 15 s', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica).toMatchObject({ tipo: 'CLUSTER', blocos: [1, 4] });
  });

  test(`séries: a receita "Exemplo: FS e Cluster" entra por Usar receita e monta o grupo Cluster (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComUmExercicio(page);
    // Os atalhos de exemplo saíram do cartão do exercício: só as receitas montam essas séries.
    await page.getByRole('button', { name: 'Editar Supino fictício', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exemplo: FS e Cluster', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exemplo: FS, WS e Cluster', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova WS com Rest-pause', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Usar receita', exact: true }).click();
    await expect(page.getByText('Exemplo: FS e Cluster', { exact: true })).toBeVisible();
    // A receita mostra a sequência antes de aplicar e avisa que substitui as séries (reunião de 30/10).
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toBeVisible();
    await expect(page.getByText('FS ×1 · WS ×1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar receita Exemplo: FS e Cluster', exact: true }).click();
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^1x10 a 15 - FS/)).toBeVisible();
    await expect(page.getByText(/^1x16 \(4×4\) - WS com Cluster/)).toBeVisible();
    await expect(page.getByText(/^1x3 a 6 - WS/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Trabalho · WS com Cluster, recolhido', exact: true }).click();
    await expect(page.getByText('1 série completa · 4 blocos de 4 reps · pausa de 15 s', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const sessoes = (api.salvo().conteudo as { sessoes: { exercicios: { series: Serie[] }[] }[] }).sessoes;
    const series = sessoes[0].exercicios[0].series;
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ tipo: 'FEEDER', repsMin: 10, repsMax: 15 });
    expect(series[1]).toMatchObject({ tipo: 'WORKING', repsMin: 16, repsMax: 16, carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 15 } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: decimal nas repetições ou num bloco não regrava a lista anterior (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    const salvar = page.getByRole('button', { name: 'Salvar modelo', exact: true });
    await adicionarWsComCluster(page);
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('1.5');
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('3');
    await expect(page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true })).toHaveValue('1.5');
    await expect(page.getByText(/3 blocos de 4 reps/)).toHaveCount(0);
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('5');
    await expect(page.getByText('1 série completa · 3 blocos de 5 reps · pausa de 15 s', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('1.5');
    await page.getByRole('textbox', { name: 'Bloco 2', exact: true }).fill('9');
    await expect(page.getByRole('button', { name: 'Mais um bloco', exact: true })).toBeDisabled();
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('6');
    await expect(page.getByText('1 série completa · blocos de 6 e 9 reps (15 no total) · pausa de 15 s', { exact: true })).toBeVisible();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const cluster = (api.salvo().conteudo as { series: Serie[] }).series.find((s) => s.tecnica?.tipo === 'CLUSTER');
    expect(cluster?.tecnica?.blocos).toEqual([6, 9]);
  });

  test(`séries: notação igual e edição depois da conversão acompanham o valor gravado (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('2×3');
    await page.getByRole('button', { name: 'Blocos diferentes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('3');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('3');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica?.blocos).toEqual([3, 3]);
  });

  test(`séries: tipo sem padrão não herda origem de esforço, e tipo com padrão continua afirmando (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'ws', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: cargaDeTrabalho, esforco: { rir: 2, rpe: null }, descansoSegundos: null, tecnica: null },
      { uid: 'legado', tipo: 'LEGADO', repsMin: 8, repsMax: 8, carga: cargaDeTrabalho, esforco: null, descansoSegundos: null, tecnica: null },
    ]);
    await page.getByRole('button', { name: 'Trabalho · WS, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'LEGADO', exact: true }).click();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await expect(page.getByText('Revise o esforço desta série ao usar Cluster.')).toBeVisible();
    await expect(page.getByText('Este esforço veio do padrão da LEGADO. Revise a prescrição ao usar Cluster.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4×4');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(salvo.find((s) => s.tecnica?.tipo === 'CLUSTER')).toMatchObject({ tipo: 'LEGADO', repsMin: 16, repsMax: 16, esforco: { rir: 2, rpe: null }, tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4] } });
    expect(salvo.find((s) => s.tecnica == null)).toMatchObject({ tipo: 'LEGADO', repsMin: 8, esforco: null });
  });

  test(`séries: trocar para um tipo da metodologia afirma a origem do esforço que ele preencheu (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'fs', tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: cargaDeTrabalho, esforco: { rir: 2, rpe: null }, descansoSegundos: null, tecnica: null },
    ]);
    await page.getByRole('button', { name: 'Preparação · FS, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'WS', exact: true }).click();
    await page.getByRole('button', { name: 'Cluster', exact: true }).click();
    await expect(page.getByText('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.')).toBeVisible();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4×4');
    await expect(page.getByText('Este esforço veio do padrão da WS. Revise a prescrição ao usar Cluster.')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0]).toMatchObject({ tipo: 'WORKING', esforco: { rir: 1, rpe: null }, tecnica: { tipo: 'CLUSTER' } });
  });

  test(`séries: pausa gravada nas duas unidades mostra os dois campos, e apagar um não os junta (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'ws', tipo: 'WORKING', repsMin: 16, repsMax: 16, carga: cargaDeTrabalho, esforco: { rir: 1, rpe: null }, descansoSegundos: null,
        tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 15, pausaRespiracoes: 3 } },
    ]);
    await page.getByRole('button', { name: /WS com Cluster/ }).click();
    const segundos = page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true });
    const respiracoes = page.getByRole('textbox', { name: 'Pausa entre blocos em respirações', exact: true });
    await expect(segundos).toHaveValue('15');
    await expect(respiracoes).toHaveValue('3');
    await expect(page.getByRole('radiogroup', { name: 'Unidade da pausa entre blocos', exact: true })).toHaveCount(0);
    // Apagar as respirações deixa só um valor, mas o campo em que a pessoa digita continua na tela e com o foco.
    await respiracoes.fill('');
    await expect(respiracoes).toBeVisible();
    await expect(respiracoes).toBeFocused();
    await respiracoes.pressSequentially('5');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica).toMatchObject({ pausaSegundos: 15, pausaRespiracoes: 5 });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
