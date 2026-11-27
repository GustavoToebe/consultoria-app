import { expect, test, type Page } from '@playwright/test';

import type { AvaliacaoFisica } from '../src/api/avaliacaoFisicaTipos';
import type { AlunoDetalhe, ConsultoriaResponse } from '../src/api/tipos';
import { medidasVazias } from '../src/dominio/avaliacaoFisica';
import { ALUNO, erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type Resposta, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Avaliação física (abas Evolução e Comparar, histórico compacto): o treinador registra e compara datas na ficha; o aluno
 * só consulta no Histórico. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

function comMedidas(id: string, data: string, medidas: Partial<AvaliacaoFisica['medidas']>, pesoKg: number | null = null, observacao: string | null = null): AvaliacaoFisica {
  return {
    id, data, medidas: { ...medidasVazias(), ...medidas }, observacao, pesoKg, versao: 0,
    criadoEm: `${data}T12:00:00Z`, alteradoEm: `${data}T12:00:00Z`,
  };
}

function avaliacao(id: string, data: string, cintura: number, quadril: number | null, pesoKg: number | null): AvaliacaoFisica {
  return comMedidas(id, data, { cintura, quadril }, pesoKg);
}

const ANTIGA = avaliacao('av1', '2026-07-01', 90, 100, 82);
/** Cintura nas duas datas; quadril só na primeira (a segunda não mediu). */
const DUAS = [avaliacao('av2', '2026-09-01', 87, null, null), ANTIGA];

/**
 * Três datas com os braços dos dois lados, a coxa só do lado direito, o quadril que falta no meio e a coxa que falta no
 * fim (variação indisponível). Peso de 82 a 80 kg.
 */
const TRES = [
  comMedidas('t3', '2026-11-01', { bracoDireito: 34.4, bracoEsquerdo: 34.6, cintura: 87, quadril: 99 }, 80),
  comMedidas('t2', '2026-09-01', { bracoDireito: 35.2, bracoEsquerdo: 34.6, cintura: 87, coxaDireita: 56 }, null, 'Medida depois do treino, à tarde, com a fita nova da academia.'),
  comMedidas('t1', '2026-07-01', { bracoDireito: 34.4, bracoEsquerdo: 34, cintura: 90, quadril: 100, coxaDireita: 55 }, 82, 'Primeira avaliação.'),
];

/** Cinco datas, para o limite do Comparar. */
const CINCO = ['2026-03-01', '2026-05-01', '2026-07-01', '2026-09-01', '2026-11-01'].map((d, i) => comMedidas(`c${i + 1}`, d, { cintura: 90 - i })).reverse();

const LARGURAS = [390, 1280];

async function fichaDoTreinador(page: Page, lista: AvaliacaoFisica[] | Resposta, extras: RespostasApi = {}) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: Array.isArray(lista) ? { corpo: lista } : lista,
    ...extras,
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  await page.getByRole('heading', { name: 'Avaliação física', exact: true }).scrollIntoViewIfNeeded();
  return api;
}

const abaComparar = (page: Page) => page.getByRole('tab', { name: 'Comparar avaliações' });
const comparativo = (page: Page) => page.getByLabel('Comparativo da avaliação física');
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** O gráfico desenhado: quantos pontos, se há traço entre eles e quantas linhas (séries). */
async function desenhoDoGrafico(page: Page, nome: RegExp) {
  const grafico = page.getByRole('img', { name: nome });
  await expect(grafico).toBeVisible();
  await expect(grafico.locator('circle').first()).toBeAttached();
  const pontos = await grafico.locator('circle').count();
  const linhas = grafico.locator('path[fill="none"]');
  const caminho = (await linhas.first().getAttribute('d')) ?? '';
  return { pontos, comLinha: /[LC]/.test(caminho), series: await linhas.count() };
}

async function escolherMedida(page: Page, nome: string) {
  await page.getByRole('button', { name: /^Medida: / }).click();
  await page.getByRole('option', { name: new RegExp(`^${nome}`) }).click();
}

for (const largura of LARGURAS) {
  test(`treinador registra, compara duas datas e vê o comparativo em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let lista: AvaliacaoFisica[] = [ANTIGA];
    const { pedidos, errosDaPagina } = await fichaDoTreinador(page, (_pedido, route) => json(route, lista), {
      [`POST /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: (pedido, route) => {
        const corpo = pedido.corpo as { data: string; medidas: AvaliacaoFisica['medidas'] };
        const nova = { ...avaliacao('av2', corpo.data, corpo.medidas.cintura ?? 0, corpo.medidas.quadril, null), medidas: corpo.medidas };
        lista = [nova, ...lista];
        return json(route, nova);
      },
    });
    await expect(page.getByText('2 medidas · Peso 82 kg')).toBeVisible();
    // Uma avaliação só: sem abas (não há o que comparar) e o resumo diz que é um registro.
    await expect(abaComparar(page)).toHaveCount(0);
    await expect(page.getByText('Um registro só: a variação aparece a partir de duas datas.')).toBeVisible();

    await page.getByRole('button', { name: 'Nova avaliação' }).click();
    await expect(page.getByText('O aluno vê esta observação.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Preencha ao menos uma medida.')).toBeVisible();
    await page.getByLabel('Cintura (cm)').fill('85,5');
    await page.getByLabel('Braço direito (cm)').fill('34,25');
    await expect(page.getByLabel('Braço direito (cm)')).toHaveValue('34,2');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/avaliacoes-fisicas'));
    expect(post?.corpo).toMatchObject({ medidas: { cintura: 85.5, bracoDireito: 34.2, quadril: null }, observacao: null });

    await abaComparar(page).click();
    await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
    await expect(comparativo(page).getByText('−4,5 cm')).toBeVisible();
    await expect(comparativo(page).getByText('90,0 cm')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    await expect(page.getByText(/gordura|melhorou|piorou|progresso/i)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`treinador: abas, seletor de medida, resumo e gráfico sem inventar a data ausente em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await fichaDoTreinador(page, DUAS);
    await expect(page.getByRole('tab', { name: 'Evolução por medida' })).toHaveAttribute('aria-selected', 'true');
    await expect(abaComparar(page)).toHaveAttribute('aria-selected', 'false');

    // Padrão: a primeira medida com valor (Cintura); resumo com a última e a variação desde a primeira data.
    await expect(page.getByRole('button', { name: 'Medida: Cintura. Escolher.' })).toBeVisible();
    await expect(page.getByText('87,0 cm', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('em 01/09/2026', { exact: true })).toBeVisible();
    await expect(page.getByText('−3,0 cm', { exact: true })).toBeVisible();
    await expect(page.getByText('desde 01/07', { exact: true })).toBeVisible();
    expect(await desenhoDoGrafico(page, /^Gráfico de Cintura com 2 datas\. Escala vertical: \d+ a \d+ cm/)).toMatchObject({ pontos: 2, comLinha: true, series: 1 });
    await expect(page.getByText(/^Escala vertical: \d+ a \d+ cm, não começa em zero\.$/)).toBeVisible();

    // Quadril: só a data medida vira ponto; a outra aparece com "—" na lista.
    await escolherMedida(page, 'Quadril');
    if (largura >= 768) await expect(page.getByRole('button', { name: 'Medida: Quadril. Escolher.' })).toBeFocused();
    expect(await desenhoDoGrafico(page, /^Gráfico de Quadril com 1 data\./)).toMatchObject({ pontos: 1, comLinha: false });
    await expect(page.getByText('Um registro só: a variação aparece a partir de duas datas.')).toBeVisible();
    const quadril = page.getByLabel('Quadril por data');
    await expect(quadril.getByText('100,0 cm')).toBeVisible();
    await expect(quadril.getByText('—', { exact: true })).toBeVisible();
    await expect(page.getByText(/gordura|melhorou|piorou|progresso/i)).toHaveCount(0);
    expect(await semRolagemLateral(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });

  test(`treinador: direito × esquerdo no mesmo gráfico e volta à medida quando falta um lado em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await fichaDoTreinador(page, TRES);
    await expect(page.getByRole('button', { name: 'Medida: Braço direito. Escolher.' })).toBeVisible();
    const par = page.getByRole('switch', { name: 'Braço direito e braço esquerdo juntos' });
    await expect(par).toBeChecked();
    // Duas séries (contínua e tracejada), a legenda em texto e a lista com os dois lados.
    const desenho = await desenhoDoGrafico(page, /^Gráfico de Braço direito \(3 datas\) e braço esquerdo \(3 datas\)\./);
    expect(desenho).toMatchObject({ pontos: 6, series: 2 });
    await expect(page.getByRole('img', { name: /^Gráfico de Braço direito/ }).locator('path[stroke-dasharray]')).toHaveCount(1);
    const lista = page.getByLabel('Braço direito e braço esquerdo por data');
    await expect(lista.getByText('34,0 cm')).toBeVisible();
    await expect(lista.getByText('35,2 cm')).toBeVisible();

    // Desligado: só a medida escolhida.
    await par.click();
    expect(await desenhoDoGrafico(page, /^Gráfico de Braço direito com 3 datas\./)).toMatchObject({ series: 1 });

    // Coxa só com o lado direito: sem o interruptor, e a frase diz qual lado falta.
    await escolherMedida(page, 'Coxa direita');
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByText('Sem registro de coxa esquerda: o gráfico mostra só coxa direita.')).toBeVisible();
    expect(await semRolagemLateral(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });

  test(`treinador: histórico compacto com "Mais recente", lápis à vista e "Excluir" no ⋯ em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let lista = [...TRES];
    const { pedidos, errosDaPagina } = await fichaDoTreinador(page, (_p, route) => json(route, lista), {
      'DELETE /avaliacoes-fisicas/t1': async (_p, route) => {
        lista = lista.filter((a) => a.id !== 't1');
        await route.fulfill({ status: 204 });
      },
    });
    await expect(page.getByText('Mais recente', { exact: true })).toHaveCount(1);
    await expect(page.getByText('4 medidas · Peso 80 kg')).toBeVisible();
    await expect(page.getByText('Medida depois do treino, à tarde, com a fita nova da academia.')).toBeVisible();

    await page.getByRole('button', { name: 'Editar avaliação de 01/11/2026' }).click();
    await expect(page.getByText('Editar avaliação física', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByRole('button', { name: /^Excluir avaliação de/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Mais ações da avaliação de 01/07/2026' }).click();
    await page.getByText('Excluir avaliação', { exact: true }).click();
    await expect(page.getByText('Excluir esta avaliação física?')).toBeVisible();
    await expect(page.getByText('Avaliação de 01/07/2026. As medidas saem; o registro de peso continua.')).toBeVisible();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Editar avaliação de 01/07/2026' })).toHaveCount(0);
    const del = pedidos.find((p) => p.metodo === 'DELETE');
    expect(del?.busca.get('versao')).toBe('0');
    expect(errosDaPagina).toEqual([]);
  });

  test(`Comparar: duas últimas, quatro datas, a 5ª recusada com o motivo e limpar em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await fichaDoTreinador(page, CINCO);
    // Fora do Comparar a linha não tem caixa de marcar.
    await expect(page.getByRole('checkbox', { name: /^Comparar / })).toHaveCount(0);
    await abaComparar(page).click();
    await expect(abaComparar(page)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('0 de 4 selecionadas')).toBeVisible();
    await expect(page.getByText('Escolha pelo menos 2 datas para comparar.')).toBeVisible();

    await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
    await expect(page.getByRole('checkbox', { name: 'Comparar 01/11/2026' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Comparar 01/09/2026' })).toBeChecked();
    await expect(page.getByText('2 de 4 selecionadas')).toBeVisible();
    await expect(page.getByText('Variação = 01/11 menos 01/09.')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
    // O toque no texto da linha também marca.
    await page.getByText('01/05/2026', { exact: true }).click();
    await expect(page.getByText('4 de 4 selecionadas')).toBeVisible();
    await expect(page.getByText('Variação = 01/11 menos 01/05 (primeira e última datas selecionadas).')).toBeVisible();
    const quinta = page.getByRole('checkbox', { name: /^Comparar 01\/03\/2026/ });
    await expect(quinta).toBeDisabled();
    await expect(page.getByText('Compare no máximo 4 datas. Desmarque uma para escolher outra.')).toBeVisible();
    // Só a linha (div): a pílula do período do cartão ("Desde o primeiro 01/03/2026") traz a mesma data num <span> mono (25/11).
    await page.getByText('01/03/2026', { exact: true }).and(page.locator('div')).click({ force: true });
    await expect(page.getByText('4 de 4 selecionadas')).toBeVisible();

    await page.getByRole('button', { name: 'Limpar seleção' }).click();
    await expect(page.getByText('0 de 4 selecionadas')).toBeVisible();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`Comparar: tabela por grupo, ordem das datas, "Não registrada", "Indisponível" e sinais em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await fichaDoTreinador(page, TRES);
    await abaComparar(page).click();
    for (const d of ['01/09/2026', '01/11/2026', '01/07/2026']) await page.getByRole('checkbox', { name: `Comparar ${d}` }).click();
    const tabela = comparativo(page);
    await expect(page.getByText('Variação = 01/11 menos 01/07 (primeira e última datas selecionadas).')).toBeVisible();
    await expect(page.getByText('Comparativo de circunferências (cm)')).toBeVisible();
    const grupos = await tabela.getByText(/^(Tronco|Braços|Pernas|Peso do dia \(informativo\))$/).allTextContents();
    expect(grupos).toEqual(['Tronco', 'Braços', 'Pernas', 'Peso do dia (informativo)']);
    await expect(tabela.getByText('−3,0 cm', { exact: true })).toBeVisible();
    await expect(tabela.getByText('+0,6 cm', { exact: true })).toBeVisible();
    await expect(tabela.getByText('0,0 cm', { exact: true })).toBeVisible();
    await expect(tabela.getByText('Não registrada').first()).toBeVisible();
    await expect(tabela.getByText('Indisponível', { exact: true }).first()).toBeVisible();
    await expect(tabela.getByText('−2,0 kg', { exact: true })).toBeVisible();

    if (largura >= 768) {
      // PC: tabela com as datas em ordem cronológica no cabeçalho (dd/mm: as três datas são do mesmo ano).
      await expect(page.getByRole('table', { name: 'Tronco: circunferências por data' }).getByRole('columnheader'))
        .toHaveText(['Medida', '01/07', '01/09', '01/11', 'Variação']);
    } else {
      // Celular: um bloco por medida, sem rolagem lateral.
      await expect(page.getByRole('list', { name: 'Tronco: circunferências por data' })).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
    }
    expect(await semRolagemLateral(page)).toBe(true);
    await expect(page.getByText(/gordura|melhorou|piorou|progresso|assimetria/i)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('Baixar comparativo gera o PDF sem erro, com o interruptor do gráfico ligado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    window.print = () => {
      (window as unknown as { __pdf: string }).__pdf = document.getElementById('treinos-impressao')?.innerHTML ?? '';
    };
  });
  const errosNoConsole: string[] = [];
  // Só o 404 das rotas da ficha que a API falsa não simula (pastas, pesos, foto) é tolerado; o do PDF (logo etc.) falha.
  const foraDoCartao = /\/api\/alunos\/[^/]+\/(pastas|pesos|foto-perfil)$/;
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.text().startsWith('Failed to load resource') && foraDoCartao.test(m.location().url))) {
      errosNoConsole.push(`${m.text()} @ ${m.location().url}`);
    }
  });
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const { errosDaPagina } = await fichaDoTreinador(page, TRES, { 'GET /consultoria': { corpo: consultoria } });
  await abaComparar(page).click();
  await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
  const interruptor = page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' });
  await expect(interruptor).not.toBeChecked();
  await expect(page.getByText('O gráfico de braço direito e braço esquerdo, só com as datas marcadas.')).toBeVisible();
  await interruptor.click();
  await expect(interruptor).toBeChecked();
  await page.getByRole('button', { name: 'Baixar comparativo' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pdf?: string }).__pdf ?? '')).toContain('Tronco');
  const html = await page.evaluate(() => (window as unknown as { __pdf: string }).__pdf);
  expect(html).toContain(ALUNO.nome);
  expect(html).toContain('Não registrada');
  expect(errosDaPagina).toEqual([]);
  expect(errosNoConsole).toEqual([]);
});

test('com a preferência de gráficos desligada o interruptor do PDF continua aparecendo, nasce desligado e dá para ligar à mão', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ graficos: false })), TREINADOR.id);
  const { errosDaPagina } = await fichaDoTreinador(page, TRES);
  await abaComparar(page).click();
  await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
  const interruptor = page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' });
  await expect(interruptor).toBeVisible();
  await expect(interruptor).not.toBeChecked();
  await interruptor.click();
  await expect(interruptor).toBeChecked();
  expect(errosDaPagina).toEqual([]);
});

const IMG_DO_GRAFICO = '#treinos-impressao img[src^="data:image/svg+xml;base64,"]';

test('PDF: o gráfico (svg em <img>) decodifica, aparece na impressão em tema claro e some com o interruptor desligado', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Tela no tema Escuro: a impressão tem de sair clara mesmo assim. `window.print` só conta (não abre o diálogo) e o
  // `afterprint` nunca dispara, então o bloco de impressão fica na página para ser conferido.
  await page.addInitScript((id) => {
    localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' }));
    (window as unknown as { __impressoes: number }).__impressoes = 0;
    window.print = () => { (window as unknown as { __impressoes: number }).__impressoes += 1; };
  }, TREINADOR.id);
  const errosNoConsole: string[] = [];
  const foraDoCartao = /\/api\/alunos\/[^/]+\/(pastas|pesos|foto-perfil)$/;
  page.on('console', (m) => {
    if (m.type() === 'error' && !(m.text().startsWith('Failed to load resource') && foraDoCartao.test(m.location().url))) {
      errosNoConsole.push(`${m.text()} @ ${m.location().url}`);
    }
  });
  const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
  const { errosDaPagina } = await fichaDoTreinador(page, TRES, { 'GET /consultoria': { corpo: consultoria } });
  await abaComparar(page).click();
  for (const d of ['01/07/2026', '01/09/2026', '01/11/2026']) await page.getByRole('checkbox', { name: `Comparar ${d}` }).click();
  const interruptor = page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' });
  await interruptor.click();
  await expect(interruptor).toBeChecked();

  const impressoes = () => page.evaluate(() => (window as unknown as { __impressoes: number }).__impressoes);
  await page.getByRole('button', { name: 'Baixar comparativo' }).click();
  await expect.poll(impressoes).toBe(1);

  // Ligado: o <img> sobreviveu ao sanitizador e decodificou de verdade.
  const grafico = page.locator(IMG_DO_GRAFICO);
  await expect(grafico).toHaveCount(1);
  await expect.poll(() => grafico.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0 && i.naturalHeight > 0)).toBe(true);
  await expect(page.locator('#treinos-impressao .legenda')).toContainText('Linha contínua, círculos: Braço direito');
  await expect(page.locator('#treinos-impressao .legenda')).toContainText('Linha tracejada, quadrados: Braço esquerdo');

  // Em impressão: só o bloco aparece, o resto da página some e o fundo é branco (tema da tela é Escuro).
  // O escuro do RN web fica num elemento do app, não no `body`: sobe do ponto central até o primeiro fundo opaco.
  const fundoNaTela = await page.evaluate(() => {
    for (let e: Element | null = document.elementFromPoint(640, 450); e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return 'transparent';
  });
  expect(fundoNaTela).not.toBe('rgb(255, 255, 255)');
  expect(fundoNaTela).not.toBe('transparent');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#treinos-impressao')).toBeVisible();
  await expect(grafico).toBeVisible();
  const emImpressao = await page.evaluate(() => ({
    outros: Array.from(document.body.children).filter((e) => e.id !== 'treinos-impressao').map((e) => getComputedStyle(e).display),
    fundoBody: getComputedStyle(document.body).backgroundColor,
    fundoHtml: getComputedStyle(document.documentElement).backgroundColor,
    texto: getComputedStyle(document.body).color,
  }));
  expect(emImpressao.outros.length).toBeGreaterThan(0);
  expect(emImpressao.outros.every((d) => d === 'none')).toBe(true);
  expect(emImpressao).toMatchObject({ fundoBody: 'rgb(255, 255, 255)', fundoHtml: 'rgb(255, 255, 255)', texto: 'rgb(0, 0, 0)' });

  // Desligado: nova impressão troca o bloco e não há mais <img> de svg.
  await page.emulateMedia({ media: 'screen' });
  await interruptor.click();
  await expect(interruptor).not.toBeChecked();
  await page.getByRole('button', { name: 'Baixar comparativo' }).click();
  await expect.poll(impressoes).toBe(2);
  await expect(page.locator(IMG_DO_GRAFICO)).toHaveCount(0);
  await expect(page.locator('#treinos-impressao')).toContainText('Tronco');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#treinos-impressao')).toBeVisible();

  expect(errosDaPagina).toEqual([]);
  expect(errosNoConsole).toEqual([]);
});

const VIRADA_DO_ANO = [avaliacao('a2', '2026-02-01', 88, null, null), avaliacao('a1', '2025-11-01', 90, null, null)];
const consultoriaDoPdf: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };

/** `window.print` só conta (não abre o diálogo): o bloco de impressão fica na página para ser conferido. */
async function simularImpressao(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __impressoes: number }).__impressoes = 0;
    window.print = () => { (window as unknown as { __impressoes: number }).__impressoes += 1; };
  });
  return () => page.evaluate(() => (window as unknown as { __impressoes: number }).__impressoes);
}

/** O SVG do gráfico do PDF, decodificado do `<img src="data:image/svg+xml;base64,...">`. */
const svgDoPdf = (page: Page) => page.evaluate((seletor) => {
  const src = document.querySelector(seletor)?.getAttribute('src') ?? '';
  return atob(src.split(',')[1] ?? '');
}, IMG_DO_GRAFICO);

test('datas de anos diferentes: resumo, eixo do gráfico, Comparar e referência levam o ano (D11)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await fichaDoTreinador(page, VIRADA_DO_ANO);
  await expect(page.getByText('desde 01/11/2025', { exact: true })).toBeVisible();
  // Eixo do gráfico: com dois anos, as duas pontas levam o ano (não há dois "01/xx" ambíguos).
  const grafico = page.getByRole('img', { name: /^Gráfico de Cintura com 2 datas\./ });
  await expect(grafico.locator('text', { hasText: /^01\/11\/2025$/ })).toBeAttached();
  await expect(grafico.locator('text', { hasText: /^01\/02\/2026$/ })).toBeAttached();
  await abaComparar(page).click();
  await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
  await expect(page.getByText('Variação = 01/02/2026 menos 01/11/2025.')).toBeVisible();
  // A `Tabela` só desenha o cabeçalho depois de medir a própria largura (`onLayout`): `toHaveText` espera; `allTextContents` não.
  await expect(page.getByRole('table', { name: 'Tronco: circunferências por data' }).getByRole('columnheader'))
    .toHaveText(['Medida', '01/11/2025', '01/02/2026', 'Variação']);
  expect(errosDaPagina).toEqual([]);
});

test('mesmo ano: o eixo do gráfico da Evolução fica em dd/mm', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await fichaDoTreinador(page, DUAS);
  const grafico = page.getByRole('img', { name: /^Gráfico de Cintura com 2 datas\./ });
  await expect(grafico.locator('text', { hasText: /^01\/07$/ })).toBeAttached();
  await expect(grafico.locator('text', { hasText: /^01\/09$/ })).toBeAttached();
  await expect(grafico.locator('text', { hasText: /2026/ })).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('PDF atravessando o ano: cabeçalho da tabela e eixo do gráfico levam o ano', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const impressoes = await simularImpressao(page);
  const { errosDaPagina } = await fichaDoTreinador(page, VIRADA_DO_ANO, { 'GET /consultoria': { corpo: consultoriaDoPdf } });
  await abaComparar(page).click();
  await page.getByRole('button', { name: 'Comparar as duas últimas' }).click();
  await page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' }).click();
  await page.getByRole('button', { name: 'Baixar comparativo' }).click();
  await expect.poll(impressoes).toBe(1);
  const cabecalho = await page.locator('#treinos-impressao thead th').allTextContents();
  expect(cabecalho.slice(0, 3)).toEqual(['Medida (cm)', '01/11/2025', '01/02/2026']);
  const svg = await svgDoPdf(page);
  expect(svg).toContain('>01/11/2025<');
  expect(svg).toContain('>01/02/2026<');
  expect(errosDaPagina).toEqual([]);
});

test('PDF: o gráfico leva só as datas marcadas (os mesmos pontos da tabela), não todas as avaliações', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const impressoes = await simularImpressao(page);
  const { errosDaPagina } = await fichaDoTreinador(page, TRES, { 'GET /consultoria': { corpo: consultoriaDoPdf } });
  await abaComparar(page).click();
  // Marca 01/07 e 01/11; a de 01/09 existe, mas fica fora da tabela e, agora, do gráfico.
  for (const d of ['01/07/2026', '01/11/2026']) await page.getByRole('checkbox', { name: `Comparar ${d}` }).click();
  await page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' }).click();
  await page.getByRole('button', { name: 'Baixar comparativo' }).click();
  await expect.poll(impressoes).toBe(1);
  expect(await page.locator('#treinos-impressao thead th').allTextContents()).toEqual(expect.arrayContaining(['01/07', '01/11']));
  expect(await page.locator('#treinos-impressao thead').first().textContent()).not.toContain('01/09');
  const svg = await svgDoPdf(page);
  // Braço direito (círculos) e esquerdo (quadrados): dois pontos de cada, nas duas datas marcadas.
  expect((svg.match(/<circle /g) ?? []).length).toBe(2);
  expect((svg.match(/<rect x=/g) ?? []).length).toBe(2);
  expect(svg).toContain('>01/07<');
  expect(svg).toContain('>01/11<');
  expect(svg).not.toContain('>01/09<');
  expect(errosDaPagina).toEqual([]);
});

test('histórico ordenado por data desc e "Mais recente" na data mais nova, mesmo com a API fora de ordem', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errosDaPagina } = await fichaDoTreinador(page, [...TRES].reverse());
  const rotulos = await page.getByRole('button', { name: /^Editar avaliação de / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(rotulos).toEqual(['Editar avaliação de 01/11/2026', 'Editar avaliação de 01/09/2026', 'Editar avaliação de 01/07/2026']);
  await expect(page.getByText('Mais recente', { exact: true })).toHaveCount(1);
  const linhaDaMaisNova = page.locator('div').filter({ has: page.getByRole('button', { name: 'Editar avaliação de 01/11/2026' }) }).filter({ hasText: 'Mais recente' });
  await expect(linhaDaMaisNova.last()).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('editar com a avaliação já alterada por outra pessoa (409): fecha a Folha, mostra o erro e recarrega a lista', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { pedidos, errosDaPagina } = await fichaDoTreinador(page, TRES, {
    'PUT /avaliacoes-fisicas/t3': (_p, route) => json(route, erroApi(409, 'Outra pessoa alterou esta avaliação. Recarregue e confira.', 'CONFLITO_EDICAO').corpo, 409),
  });
  const buscas = () => pedidos.filter((p) => p.metodo === 'GET' && p.caminho.endsWith('/avaliacoes-fisicas')).length;
  const antes = buscas();
  await page.getByRole('button', { name: 'Editar avaliação de 01/11/2026' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
  await expect(page.getByText('Outra pessoa alterou esta avaliação. Recarregue e confira.')).toBeVisible();
  await expect.poll(buscas).toBeGreaterThan(antes);
  // Abrir a Folha de novo limpa o erro da ação anterior.
  await page.getByRole('button', { name: 'Editar avaliação de 01/11/2026' }).click();
  await expect(page.getByText('Outra pessoa alterou esta avaliação. Recarregue e confira.')).toHaveCount(0);
  expect(errosDaPagina).toEqual([]);
});

test('Folha da avaliação: com o texto no maior tamanho, a data digitada cabe no campo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tamanhoTexto: 'EXTRA' })), TREINADOR.id);
  const { errosDaPagina } = await fichaDoTreinador(page, TRES);
  await page.getByRole('button', { name: 'Editar avaliação de 01/11/2026' }).click();
  const campo = page.getByLabel('Data', { exact: true });
  await expect(campo).toHaveValue('01/11/2026');
  expect(await campo.evaluate((e: HTMLInputElement) => e.scrollWidth <= e.clientWidth)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

/** Histórico do aluno (duas avaliações por padrão); `funcionalidades` é o que o plano da consultoria liga (nulo = tudo, como sem a lista). */
async function abrirHistoricoDoAluno(page: Page, funcionalidades: string[] | null, avaliacoes = DUAS, extras: RespostasApi = {}) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(funcionalidades ? await sessao(page, ALUNO, { funcionalidadesDoPlano: funcionalidades }) : {}),
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: avaliacoes },
    ...extras,
  });
  await page.goto('/aluno/historico?aba=corpo');
  await expect(page.getByText('Suas medidas registradas pelo seu treinador, em centímetros.')).toBeVisible();
  return api;
}

async function compararAsDuasDatas(page: Page) {
  await abaComparar(page).click();
  await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
  await page.getByRole('checkbox', { name: 'Comparar 01/09/2026' }).click();
  await expect(comparativo(page).getByText('−3,0 cm')).toBeVisible();
}

for (const largura of LARGURAS) {
  test(`aluno vê as avaliações no Histórico, só para consulta, e compara em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['PDF', 'MOBILIDADE', 'EQUIPE']);
    await expect(page.getByRole('button', { name: 'Nova avaliação' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Editar avaliação|Mais ações da avaliação/ })).toHaveCount(0);
    await compararAsDuasDatas(page);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: sem PDF no plano o "Baixar comparativo" não aparece em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['MOBILIDADE', 'EQUIPE']);
    await compararAsDuasDatas(page);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Incluir o gráfico da medida no PDF' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: ao perder a internet o "Baixar comparativo" some e volta com ela em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['PDF']);
    await compararAsDuasDatas(page);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    await page.context().setOffline(true);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toHaveCount(0);
    await expect(comparativo(page).getByText('−3,0 cm')).toBeVisible();
    await page.context().setOffline(false);
    // O Chromium emulado não avisa o NetInfo (que ouve `navigator.connection`) quando a rede volta; o aviso é o mesmo que o navegador de verdade dá.
    await page.evaluate(() => {
      (navigator as Navigator & { connection?: EventTarget }).connection?.dispatchEvent(new Event('change'));
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: Histórico sem internet mostra "Sem conexão." em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/pesos': { corpo: [] },
      'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
      'GET /aluno/avaliacoes-fisicas': (_p, route) => route.abort('internetdisconnected'),
    });
    await page.goto('/aluno/historico?aba=corpo');
    await expect(page.getByText('Suas medidas registradas pelo seu treinador, em centímetros.')).toBeVisible();
    await expect(page.getByText('Sem conexão.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova avaliação' })).toHaveCount(0);
  });
}

/** Título, selo de período e descrição do cartão (o selo "Desde o primeiro registro" também existe no cartão Fotos). */
const faixaDoCartao = (page: Page) =>
  page.locator('div').filter({ has: page.getByRole('heading', { name: 'Avaliação física', exact: true }) }).filter({ hasNotText: 'Fotos' }).last();

for (const largura of LARGURAS) {
  test(`vazio: a equipe vê uma frase só e "Nova avaliação"; o aluno vê o vazio de sempre em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await fichaDoTreinador(page, []);
    const faixa = faixaDoCartao(page);
    await expect(faixa.getByText('Nenhuma avaliação registrada. Circunferências em centímetros, por data.', { exact: true })).toBeVisible();
    await expect(faixa.getByText('Desde o primeiro registro')).toHaveCount(0);
    await expect(page.getByText('Nenhuma avaliação registrada.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Evolução por medida' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nova avaliação' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`vazio do aluno no Histórico continua com selo, descrição e a linha do vazio em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, null, []);
    const faixa = faixaDoCartao(page);
    await expect(faixa.getByText('Desde o primeiro registro')).toBeVisible();
    await expect(faixa.getByText('Suas medidas registradas pelo seu treinador, em centímetros.', { exact: true })).toBeVisible();
    await expect(page.getByText('Nenhuma avaliação registrada.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova avaliação' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: gráfico por medida no Histórico e, com gráficos desligados, só a lista em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, null);
    expect(await desenhoDoGrafico(page, /^Gráfico de Cintura com 2 datas\./)).toMatchObject({ pontos: 2, comLinha: true });
    await expect(page.getByLabel('Cintura por data').getByText('87,0 cm')).toBeVisible();

    await page.evaluate((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ graficos: false })), ALUNO.id);
    await page.reload();
    await expect(page.getByLabel('Cintura por data').getByText('87,0 cm')).toBeVisible();
    await expect(page.getByRole('img', { name: /Gráfico de Cintura/ })).toHaveCount(0);
    await expect(page.getByText('Os gráficos estão desligados em Conta › Aparência e preferências.').first()).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}
