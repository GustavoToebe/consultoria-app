import { expect, test, type Page } from '@playwright/test';
import type { Configuracao, Receita, Serie } from '../src/api/tipos';
import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { linhaDaSerie } from './linhaDaSerie';

// Só modelos e prescrições fictícios; nenhuma chamada chega ao banco.
const serieInicial: Serie = {
  uid: 'serie-inicial', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null },
  esforco: { rir: 1, rpe: null }, descansoSegundos: null, tecnica: null,
};

async function modelo(page: Page, tipo: Receita['tipo'], metodologia: Configuracao = CONFIGURACAO_PADRAO) {
  let atual: Receita = { id: 'm0000000-0000-4000-8000-000000000001', tipo, nome: 'Modelo de teste', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: tipo === 'METODOLOGIA' ? structuredClone(metodologia) : { series: [serieInicial] } };
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

// "Nova série" mostra os botões de 1 clique: um por tipo ("Adicionar Back off") e as técnicas sobre a WS ("Adicionar WS com Cluster").
async function novaSerie(page: Page, botao: string) {
  await page.getByRole('button', { name: 'Nova série', exact: true }).click();
  await page.getByRole('button', { name: botao, exact: true }).click();
}
// A técnica é uma lista suspensa (`EscolhaSuspensa`): abre o botão ("Técnica da série: Nenhuma. Escolher.") e escolhe a opção.
async function escolherTecnica(page: Page, campo: 'Técnica da série', nome: string) {
  await page.getByRole('button', { name: new RegExp(`^${campo}: `) }).click();
  await page.getByRole('option', { name: nome, exact: true }).click();
}
/** Em duas colunas (1280) o exercício se escolhe na lista; no estreito (390) o título do cartão abre (um por vez). */
async function escolherExercicio(page: Page, largura: number, posicao: number, total: number, nome: string) {
  if (largura >= 960) await page.getByRole('button', { name: new RegExp(`^Exercício ${posicao} de ${total}: ${nome}`) }).click();
  else await page.getByRole('button', { name: `Editar ${nome}`, exact: true }).click();
}

const BOTAO_REST_PAUSE_NA_ULTIMA = 'Aplicar Rest-pause só na última série';

/** "Nova série" › "Adicionar WS com Cluster" (o que os atalhos de exemplo montavam), já com 4 blocos de 4. */
async function adicionarWsComCluster(page: Page) {
  await novaSerie(page, 'Adicionar WS com Cluster');
  await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
  await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
  await expect(page.getByText('4 blocos × 4 reps = 16 reps', { exact: true })).toBeVisible();
}

const cargaDeTrabalho = { modo: 'CARGA_TRABALHO' as const, percentualMin: null, percentualMax: null };

const ID_PLANO = 'm0000000-0000-4000-8000-000000000020';

/** Receita de séries "Exemplo: FS e Cluster", no formato em que a API a entrega (só estrutura, com os padrões do tipo). */
const receitaFsECluster: Receita = {
  id: 'm0000000-0000-4000-8000-000000000021', tipo: 'SERIES', nome: 'Exemplo: FS e Cluster', descricao: 'FS 1x10-15 e WS com Cluster 4×4 (pausa de 15 s).', pastaId: null, ordem: 1, versao: 1,
  conteudo: {
    series: [
      { uid: 'r-fs', tipo: 'FEEDER', repsMin: 10, repsMax: 15, carga: { modo: 'PERCENTUAL_WS', percentualMin: 85, percentualMax: 85 }, esforco: null, descansoSegundos: null, tecnica: null },
      { uid: 'r-cluster', tipo: 'WORKING', repsMin: 16, repsMax: 16, carga: cargaDeTrabalho, esforco: null, descansoSegundos: null,
        tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 15 } },
    ] satisfies Serie[],
  },
};

async function planoComUmExercicio(page: Page, series: Serie[] = [serieInicial]) {
  const plano: Receita = {
    id: ID_PLANO, tipo: 'PLANO_TREINO', nome: 'Semana fictícia', descricao: null, pastaId: null, ordem: 1, versao: 1,
    conteudo: {
      objetivo: null, orientacoes: null,
      metodologia: { id: null, nome: 'Metodologia fictícia', configuracao: structuredClone(CONFIGURACAO_PADRAO) },
      sessoes: [{
        uid: 'sessao-1', nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
        exercicios: [{ uid: 'ex-1', exercicioId: null, nome: 'Supino fictício', modalidade: 'LIVRE', videoUrl: null, observacao: null, progressao: true, unidade: 'kg', grupoUid: null, series }],
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
    await expect(page.getByText('Preparação · 3 a 5 reps · 85% da WS')).toBeVisible();
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
    await page.getByRole('button', { name: 'Nova série', exact: true }).click();
    // Não existe mais "Só técnica": a técnica é uma escolha à parte, sobre uma série de um tipo.
    await expect(page.getByRole('button', { name: 'Só técnica', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Adicionar WS com Rest pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Técnica da série: Rest pause. Escolher.', exact: true })).toBeVisible();
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await expect(page.getByText('A sugestão e os percentuais saem da carga que o aluno informa para o dia, não da série anterior.')).toBeVisible();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Reps mín.', exact: true })).toHaveCount(0);
    await expect(linhaDaSerie(page, /^Série 2 · WS/, true)).toBeVisible();
    await expect(page.getByText(/^Editando: Série \d · Trabalho · WS com Cluster$/)).toBeVisible();
    await expect(page.getByText(/1×6 \(4\+2\) · WS com Cluster 15 s/).first()).toBeVisible();
    await expect(page.getByText('Blocos 4+2 = 6 reps', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('tela-editada.png'), fullPage: true });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const series = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(series[1]).toMatchObject({ tipo: 'WORKING', repsMin: 6, repsMax: 6, carga: { modo: 'CARGA_TRABALHO' }, tecnica: { tipo: 'CLUSTER', blocos: [4, 2] } });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`séries: bloco inválido não grava o total anterior e o esforço da série fica (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    // Grupo de trabalho com uma série só: o atalho de Rest-pause na última série não existe.
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
    await expect(page.getByText('4 blocos × 4 reps = 16 reps', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('11');
    await expect(page.getByText('Para o aluno: Complete os blocos para visualizar a prescrição.', { exact: true })).toBeVisible();
    await expect(page.getByText('4 blocos × 4 reps = 16 reps', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('2');
    await expect(page.getByText('2 blocos × 4 reps = 8 reps', { exact: true })).toBeVisible();
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
    // A explicação do tipo começa recolhida; o "O que é?" abre e fecha.
    const oQueEWs = page.getByRole('button', { name: 'O que é o tipo WS?', exact: true });
    await expect(page.getByText(explicacaoWs, { exact: true })).toHaveCount(0);
    await expect(oQueEWs).toHaveAttribute('aria-expanded', 'false');
    await oQueEWs.click();
    await expect(page.getByText(explicacaoWs, { exact: true })).toBeVisible();
    await expect(oQueEWs).toHaveAttribute('aria-expanded', 'true');
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await expect(page.getByText(explicacaoCluster, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'O que é Cluster?', exact: true }).click();
    await expect(page.getByText(explicacaoCluster, { exact: true })).toBeVisible();
    // "Blocos iguais" pede só os dois números; a notação fica atrás do "Digitar como 4+2".
    await expect(page.getByRole('textbox', { name: 'Blocos de repetições', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('4');
    await page.getByRole('textbox', { name: 'Repetições em cada bloco', exact: true }).fill('4');
    // A pausa é um número e uma unidade; trocar a unidade limpa o valor (15 s não são 15 respirações).
    await expect(page.getByRole('textbox', { name: 'Pausa entre blocos (s)', exact: true })).toHaveValue('15');
    await page.getByRole('radiogroup', { name: 'Unidade da pausa entre blocos', exact: true }).getByRole('radio', { name: 'Respirações', exact: true }).click();
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
    await page.getByRole('button', { name: 'Uma série completa a mais', exact: true }).click();
    await expect(page.getByText(/2×3 a 6 · WS/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: BOTAO_REST_PAUSE_NA_ULTIMA, exact: true })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`metodologia: RIR padrão do tipo grava, e "Não prescrito" volta a nulo (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'METODOLOGIA');
    const salvar = page.getByRole('button', { name: 'Salvar modelo', exact: true });
    // O padrão do tipo é o mesmo RIR da série, numa lista: sem RPE e sem "Esforço não prescrito" à parte.
    await page.getByRole('button', { name: 'Back off, recolhido', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'RPE (1 a 10, de meio em meio)', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'RPE', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'RIR padrão: 0 (Falha). Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '2', exact: true }).click();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as Configuracao).tipos.find((t) => t.codigo === 'BACK_OFF')).toMatchObject({ esforcoPadrao: { rir: 2, rpe: null } });
    // Salvar recarrega o editor: o cartão volta recolhido.
    await page.getByRole('button', { name: 'Back off, recolhido', exact: true }).click();
    await page.getByRole('button', { name: 'RIR padrão: 2. Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '— (Não prescrito)', exact: true }).click();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(2);
    expect((api.salvo().conteudo as Configuracao).tipos.find((t) => t.codigo === 'BACK_OFF')).toMatchObject({ esforcoPadrao: null });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`metodologia: RPE já gravado no padrão aparece como aviso, e escolher um RIR o troca (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const metodologia = structuredClone(CONFIGURACAO_PADRAO);
    metodologia.tipos[0].esforcoPadrao = { rir: null, rpe: 6 };
    const api = await modelo(page, 'METODOLOGIA', metodologia);
    await page.getByRole('button', { name: 'Aquecimento, recolhido', exact: true }).click();
    await expect(page.getByText('Este tipo tem RPE 6 como padrão. Escolher um RIR troca o RPE.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'RIR padrão: — (Não prescrito). Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '2', exact: true }).click();
    await expect(page.getByText(/Este tipo tem RPE 6/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as Configuracao).tipos[0].esforcoPadrao).toMatchObject({ rir: 2, rpe: null });
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
    await expect(page.getByText('Para o aluno: Complete os blocos para visualizar a prescrição.', { exact: true })).toBeVisible();
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Quantos blocos', exact: true }).fill('3');
    await expect(page.getByText('3 blocos × 5 reps = 15 reps', { exact: true })).toBeVisible();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const cluster = (api.salvo().conteudo as { series: Serie[] }).series.find((s) => s.tecnica?.tipo === 'CLUSTER');
    expect(cluster).toMatchObject({ repsMin: 15, repsMax: 15, tecnica: { blocos: [5, 5, 5] } });
  });

  test(`séries: voltar para blocos diferentes mostra a lista convertida (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('4');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('2');
    await page.getByRole('radio', { name: 'Blocos iguais', exact: true }).click();
    await page.getByRole('button', { name: 'Converter para blocos iguais', exact: true }).click();
    await expect(page.getByText('2 blocos × 4 reps = 8 reps', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Blocos diferentes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('4');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('4');
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('1');
    await expect(page.getByText('Blocos 1+4 = 5 reps', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica).toMatchObject({ tipo: 'CLUSTER', blocos: [1, 4] });
  });

  test(`séries: a receita "Exemplo: FS e Cluster" entra por Usar receita e monta o grupo Cluster (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComUmExercicio(page);
    // Os atalhos de exemplo saíram do cartão do exercício: só as receitas montam essas séries.
    await escolherExercicio(page, largura, 1, 1, 'Supino fictício');
    await expect(page.getByRole('button', { name: 'Exemplo: FS e Cluster', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Exemplo: FS, WS e Cluster', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova WS com Rest-pause', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Usar uma receita de séries', exact: true }).click();
    await expect(page.getByText('Exemplo: FS e Cluster', { exact: true })).toBeVisible();
    // A receita mostra a sequência antes de aplicar e avisa que substitui as séries (reunião de 30/10).
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toBeVisible();
    await expect(page.getByText('FS ×1 · WS ×1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar receita Exemplo: FS e Cluster', exact: true }).click();
    await expect(page.getByText('Substitui as séries deste exercício', { exact: true })).toHaveCount(0);
    // Dois grupos, duas abas; a aberta é a última (WS com Cluster) e o título dela traz a faixa dos números.
    await expect(linhaDaSerie(page, /^Série \d/)).toHaveCount(2);
    await expect(page.getByText(/^Editando: Série \d · Trabalho · WS com Cluster$/)).toBeVisible();
    await expect(page.getByText(/1×16 \(4×4\) · WS com Cluster/).first()).toBeVisible();
    await expect(page.getByText(/1×3 a 6 · WS/)).toHaveCount(0);
    await linhaDaSerie(page, /^Série 1 · FS/).click();
    await expect(page.getByText(/1×10 a 15 · FS/).first()).toBeVisible();
    await linhaDaSerie(page, /^Série 2 · WS/).click();
    await expect(page.getByText('4 blocos × 4 reps = 16 reps', { exact: true })).toBeVisible();
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
    await expect(page.getByText('3 blocos × 5 reps = 15 reps', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('1.5');
    await page.getByRole('textbox', { name: 'Bloco 2', exact: true }).fill('9');
    await expect(page.getByRole('button', { name: 'Mais um bloco', exact: true })).toBeDisabled();
    await expect(salvar).toBeDisabled();
    await page.getByRole('textbox', { name: 'Bloco 1', exact: true }).fill('6');
    await expect(page.getByText('Blocos 6+9 = 15 reps', { exact: true })).toBeVisible();
    await salvar.click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const cluster = (api.salvo().conteudo as { series: Serie[] }).series.find((s) => s.tecnica?.tipo === 'CLUSTER');
    expect(cluster?.tecnica?.blocos).toEqual([6, 9]);
  });

  test(`séries: notação igual e edição depois da conversão acompanham o valor gravado (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4+2');
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('2×3');
    await page.getByRole('radio', { name: 'Blocos diferentes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Bloco 1', exact: true })).toHaveValue('3');
    await expect(page.getByRole('textbox', { name: 'Bloco 2', exact: true })).toHaveValue('3');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].tecnica?.blocos).toEqual([3, 3]);
  });

  test(`séries: Cluster num tipo fora da metodologia guarda o tipo e o esforço de cada série (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'ws', tipo: 'WORKING', repsMin: 3, repsMax: 6, carga: cargaDeTrabalho, esforco: { rir: 2, rpe: null }, descansoSegundos: null, tecnica: null },
      { uid: 'legado', tipo: 'LEGADO', repsMin: 8, repsMax: 8, carga: cargaDeTrabalho, esforco: null, descansoSegundos: null, tecnica: null },
    ]);
    await page.getByRole('radio', { name: 'LEGADO', exact: true }).click();
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4×4');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvo = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(salvo.find((s) => s.tecnica?.tipo === 'CLUSTER')).toMatchObject({ tipo: 'LEGADO', repsMin: 16, repsMax: 16, esforco: { rir: 2, rpe: null }, tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4] } });
    expect(salvo.find((s) => s.tecnica == null)).toMatchObject({ tipo: 'LEGADO', repsMin: 8, esforco: null });
  });

  test(`séries: trocar para um tipo da metodologia preenche o esforço padrão dele (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'fs', tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: cargaDeTrabalho, esforco: { rir: 2, rpe: null }, descansoSegundos: null, tecnica: null },
    ]);
    await page.getByRole('radio', { name: 'WS', exact: true }).click();
    await escolherTecnica(page, 'Técnica da série', 'Cluster');
    await page.getByRole('button', { name: 'Digitar como 4+2', exact: true }).click();
    await page.getByRole('textbox', { name: 'Blocos de repetições', exact: true }).fill('4×4');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0]).toMatchObject({ tipo: 'WORKING', esforco: { rir: 0, rpe: null }, tecnica: { tipo: 'CLUSTER' } });
  });

  test(`séries: pausa gravada nas duas unidades mostra os dois campos, e apagar um não os junta (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      { uid: 'ws', tipo: 'WORKING', repsMin: 16, repsMax: 16, carga: cargaDeTrabalho, esforco: { rir: 1, rpe: null }, descansoSegundos: null,
        tecnica: { tipo: 'CLUSTER', blocos: [4, 4, 4, 4], pausaSegundos: 15, pausaRespiracoes: 3 } },
    ]);
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

/** Série fictícia do grupo: o mesmo tipo e a mesma carga, só o esforço muda. */
const serieCom = (uid: string, tipo: string, carga: Serie['carga'], esforco: Serie['esforco'], reps: [number, number] = [6, 8]): Serie => ({
  uid, tipo, repsMin: reps[0], repsMax: reps[1], carga, esforco, descansoSegundos: null, tecnica: null,
});
const percentualDaWs = (min: number) => ({ modo: 'PERCENTUAL_WS' as const, percentualMin: min, percentualMax: null });
const caixaDe = async (page: Page, rotulo: string) => (await page.getByLabel(rotulo, { exact: true }).boundingBox())!;

for (const largura of [390, 1280]) {
  test(`esforço: RIR 10 grava e volta igual (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modelo(page, 'SERIES');
    // A receita de séries funciona como a série de um exercício: as formas de carga da WS estão à vista.
    const forma = page.getByRole('radiogroup', { name: 'Forma de carga', exact: true });
    await expect(forma.getByRole('radio', { name: 'Carga de trabalho (WS)', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(forma.getByRole('radio', { name: 'Carga fixa (kg)', exact: true })).toBeVisible();
    // O RIR fica na linha da série; no PC a lista abre colada ao botão e no celular numa folha (as duas com `option`).
    await page.getByRole('button', { name: 'Série 1 · RIR: 1. Escolher.', exact: true }).click();
    // A última opção ("10") fica ao alcance do clique: a lista nunca sai da janela.
    await page.getByRole('option', { name: '10', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].esforco).toEqual({ rir: 10, rpe: null });
    // O PUT chegar não basta: enquanto a resposta não volta o editor segue "pendente" e o `beforeunload` cancela o reload.
    await expect(page.getByText('Modelo salvo.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Série 1 · RIR: 10. Escolher.', exact: true })).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`esforço: 4 séries iguais com RIR 3, 2, 2, 1 são um grupo, com o RIR de cada série (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [3, 2, 2, 1].map((rir, i) => serieCom(`ws-${i}`, 'WORKING', cargaDeTrabalho, { rir, rpe: null })));
    await expect(linhaDaSerie(page, /^Série \d · WS/)).toHaveCount(1);
    // Cada série tem a sua lista de RIR, sem um RIR do grupo por cima.
    for (const [i, rir] of [3, 2, 2, 1].entries()) await expect(page.getByRole('button', { name: `Série ${i + 1} · RIR: ${rir}. Escolher.`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Série 2 · RIR: 2. Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: 'Série 4 · RIR: 1. Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '0 (Falha)', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Série 4 · RIR: 0 (Falha). Escolher.', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Série 1 · RIR: 3. Escolher.', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('rir-por-serie.png') });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series.map((s) => s.esforco?.rir)).toEqual([3, 3, 2, 0]);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`esforço: com percentual, o RIR de cada série fica na linha do percentual dela (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [
      serieCom('ws', 'WORKING', cargaDeTrabalho, { rir: 1, rpe: null }),
      ...[2, 1, 1].map((rir, i) => serieCom(`bo-${i}`, 'BACK_OFF', percentualDaWs(85 - i * 5), { rir, rpe: null })),
      serieCom('bo-sem', 'BACK_OFF', percentualDaWs(70), null),
    ]);
    await linhaDaSerie(page, /^Série 2 · Back off/).click();
    await expect(page.getByRole('textbox', { name: 'Série 3 · Mínimo (%)', exact: true })).toHaveValue('75');
    const min1 = await caixaDe(page, 'Série 1 · Mínimo (%)');
    const min2 = await caixaDe(page, 'Série 2 · Mínimo (%)');
    const max1 = await caixaDe(page, 'Série 1 · Máximo (%)');
    // Mínimo e máximo na mesma linha, caixas na mesma altura (a ajuda fica embaixo, não dentro de um dos campos).
    if (largura >= 1024) { expect(Math.abs(max1.y - min1.y)).toBeLessThan(1); expect(Math.abs(max1.height - min1.height)).toBeLessThan(1); }
    const rir1 = (await page.getByRole('button', { name: 'Série 1 · RIR: 2. Escolher.', exact: true }).boundingBox())!;
    // No PC, Mín, Máx e RIR lado a lado; no celular o RIR desce para a linha de baixo, com o valor inteiro. Sempre antes da série seguinte.
    if (largura >= 1024) expect(Math.abs(rir1.y + rir1.height / 2 - (min1.y + min1.height / 2))).toBeLessThan(40);
    else {
      expect(rir1.y).toBeGreaterThan(min1.y + min1.height - 1);
      const valor = page.getByRole('button', { name: 'Série 4 · RIR: — (Não prescrito). Escolher.', exact: true }).getByText('— (Não prescrito)', { exact: true });
      expect(await valor.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    expect(rir1.y + rir1.height).toBeLessThan(min2.y);
    // A série que não tinha RIR também tem o dela à vista, e escolher grava só nela.
    await page.getByRole('button', { name: 'Série 4 · RIR: — (Não prescrito). Escolher.', exact: true }).click();
    await page.getByRole('option', { name: '3', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Série 2 · RIR: 1. Escolher.', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('rir-na-linha-do-percentual.png') });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series.map((s) => s.esforco?.rir ?? null)).toEqual([1, 2, 1, 1, 3]);
    // O mesmo trecho no tema escuro: só tokens (campo, bordaCampo, texto).
    await expect(page.getByText('Modelo salvo.')).toBeVisible();
    await page.evaluate((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
    await page.reload();
    await linhaDaSerie(page, /^Série 2 · Back off/).click();
    await page.getByRole('button', { name: 'Série 2 · RIR: 1. Escolher.', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('rir-na-linha-do-percentual-escuro.png') });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`esforço: aquecimento novo não oferece RPE; com RPE gravado, mostra (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [serieCom('aq', 'WARM_UP', null, { rir: null, rpe: 6 }, [10, 15]), serieInicial]);
    await expect(page.getByRole('textbox', { name: 'Série 1 · RPE', exact: true })).toHaveValue('6');
    await novaSerie(page, 'Adicionar Aquecimento');
    await expect(linhaDaSerie(page, /^Série 3 · Aquecimento/, true)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Série 1 · RIR: / })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Série 1 · RPE', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Prescrever por RPE/ })).toHaveCount(0);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`aquecimento: seletor binário e o % em branco grava sem carga, sem erro (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await modeloDeSeries(page, [serieCom('aq', 'WARM_UP', percentualDaWs(40), null, [10, 15]), serieInicial]);
    const forma = page.getByRole('radiogroup', { name: 'Forma de carga', exact: true });
    // Só "% da WS | Carga fixa": "Sem sugestão" é o % em branco.
    await expect(forma.getByRole('radio')).toHaveText([/% da WS/, /Carga fixa/]);
    await page.getByRole('textbox', { name: 'Série 1 · Mínimo (%)', exact: true }).fill('');
    await expect(forma.getByRole('radio', { name: '% da WS', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Percentual da WS entre 1 e 200.', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    expect((api.salvo().conteudo as { series: Serie[] }).series[0].carga ?? null).toBeNull();
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`aquecimento: 3 séries com % só na Série 1 não dão erro, ficam numa aba só e as outras gravam sem sugestão (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const aq = (n: number) => serieCom(`aq${n}`, 'WARM_UP', null, null, [10, 15]);
    const api = await modeloDeSeries(page, [aq(1), aq(2), aq(3), serieInicial]);
    const abas = linhaDaSerie(page, /^Série \d/);
    await expect(abas).toHaveCount(2);
    await linhaDaSerie(page, /^Série 1 · Aquecimento/).click();
    await page.getByRole('textbox', { name: 'Série 1 · Mínimo (%)', exact: true }).fill('40');
    // Continua uma aba só (as séries 2 e 3 seguem em branco no mesmo grupo) e nenhuma ficou com erro.
    await expect(abas).toHaveCount(2);
    await expect(page.getByRole('textbox', { name: 'Série 1 · Mínimo (%)', exact: true })).toHaveValue('40');
    await expect(page.getByRole('textbox', { name: 'Série 3 · Mínimo (%)', exact: true })).toHaveValue('');
    await expect(page.getByText('Percentual da WS entre 1 e 200.', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvas = (api.salvo().conteudo as { series: Serie[] }).series;
    expect(salvas.map((s) => s.carga?.modo ?? 'NENHUMA')).toEqual(['PERCENTUAL_WS', 'NENHUMA', 'NENHUMA', 'CARGA_TRABALHO']);
    expect(salvas[0].carga?.percentualMin).toBe(40);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`carga fixa: WS 3x12 com 12 kg no resumo, o campo de kg valida e o Back off em % avisa (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await planoComUmExercicio(page, [0, 1, 2].map((i) => serieCom(`ws-${i}`, 'WORKING', cargaDeTrabalho, { rir: 1, rpe: null }, [12, 12])));
    await escolherExercicio(page, largura, 1, 1, 'Supino fictício');
    // A WS escolhe entre a carga de trabalho (marcada) e a fixa, no mesmo seletor.
    await page.getByRole('radiogroup', { name: 'Forma de carga', exact: true }).getByRole('radio', { name: 'Carga fixa (kg)', exact: true }).click();
    const kg = page.getByRole('textbox', { name: 'Carga (kg)', exact: true });
    await kg.fill('0');
    await expect(page.getByText('Carga fixa: maior que zero e até 1000 kg.', { exact: true }).first()).toBeVisible();
    await kg.fill('12,555');
    await expect(kg).toHaveValue('12,55');
    await kg.fill('12');
    await expect(page.getByText('Carga fixa: maior que zero e até 1000 kg.', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/12 kg/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await kg.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('carga-fixa.png') });
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const salvas = (api.salvo().conteudo as unknown as { sessoes: { exercicios: { series: Serie[] }[] }[] }).sessoes[0].exercicios[0].series;
    expect(salvas.map((s) => s.carga)).toEqual([0, 1, 2].map(() => expect.objectContaining({ modo: 'CARGA_FIXA', valorKg: 12 })));
    // A fixa não é série de trabalho: o Back off em % da WS fica sem referência e a tela avisa.
    await novaSerie(page, 'Adicionar Back off');
    await expect(page.getByText(/Há série em % da WS sem série de trabalho/).first()).toBeVisible();
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });
}
