import { expect, test, type Page } from '@playwright/test';

import type { AvaliacaoFisica } from '../src/api/avaliacaoFisicaTipos';
import type { AlunoDetalhe } from '../src/api/tipos';
import { medidasVazias } from '../src/dominio/avaliacaoFisica';
import { ALUNO, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/** Avaliação física: o treinador registra e compara datas na ficha; o aluno só consulta no Histórico. Dados fictícios. */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

function avaliacao(id: string, data: string, cintura: number, quadril: number | null, pesoKg: number | null): AvaliacaoFisica {
  return {
    id, data, medidas: { ...medidasVazias(), cintura, quadril }, observacao: null, pesoKg, versao: 0,
    criadoEm: `${data}T12:00:00Z`, alteradoEm: `${data}T12:00:00Z`,
  };
}

const ANTIGA = avaliacao('av1', '2026-07-01', 90, 100, 82);

for (const largura of [390, 1280]) {
  test(`treinador registra, compara duas datas e vê o comparativo em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    let lista: AvaliacaoFisica[] = [ANTIGA];
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: (_pedido, route) => json(route, lista),
      [`POST /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: (pedido, route) => {
        const corpo = pedido.corpo as { data: string; medidas: AvaliacaoFisica['medidas'] };
        const nova = { ...avaliacao('av2', corpo.data, corpo.medidas.cintura ?? 0, corpo.medidas.quadril, null), medidas: corpo.medidas };
        lista = [nova, ...lista];
        return json(route, nova);
      },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
    const cartao = page.getByText('Avaliação física', { exact: true }).first();
    await cartao.scrollIntoViewIfNeeded();
    await expect(page.getByText('2 medidas · Peso 82 kg')).toBeVisible();

    await page.getByRole('button', { name: 'Nova avaliação' }).click();
    // A observação da avaliação aparece ao aluno no Histórico: o formulário diz isso.
    await expect(page.getByText('O aluno vê esta observação.', { exact: true })).toBeVisible();
    // Salvar sem nenhuma medida mostra o erro e não chama a API.
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Preencha ao menos uma medida.')).toBeVisible();
    await page.getByLabel('Cintura (cm)').fill('85,5');
    await page.getByLabel('Braço direito (cm)').fill('34,25');
    await expect(page.getByLabel('Braço direito (cm)')).toHaveValue('34,2');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);

    const post = pedidos.find((p) => p.metodo === 'POST' && p.caminho.endsWith('/avaliacoes-fisicas'));
    expect(post?.corpo).toMatchObject({ medidas: { cintura: 85.5, bracoDireito: 34.2, quadril: null }, observacao: null });

    // Com duas avaliações, marcar as duas datas mostra a tabela e a diferença entre a primeira e a última.
    await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
    const nova = (post?.corpo as { data: string }).data.split('-').reverse().join('/');
    await page.getByRole('checkbox', { name: `Comparar ${nova}` }).click();
    await expect(page.getByText('Comparativo', { exact: true })).toBeVisible();
    // O bloco "Evolução por medida" também mostra centímetros: os valores do comparativo são lidos na tabela dele.
    const tabela = page.getByLabel('Comparativo da avaliação física');
    await expect(tabela.getByText('−4,5 cm')).toBeVisible();
    await expect(tabela.getByText('90,0 cm')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    // Sem palavra de avaliação.
    await expect(page.getByText(/gordura|melhorou|piorou/i)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Histórico do aluno (duas avaliações por padrão); `funcionalidades` é o que o plano da consultoria liga (nulo = tudo, como sem a lista). */
async function abrirHistoricoDoAluno(page: Page, funcionalidades: string[] | null, avaliacoes = [avaliacao('av2', '2026-09-01', 87, null, null), ANTIGA]) {
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    ...(funcionalidades ? await sessao(page, ALUNO, { funcionalidadesDoPlano: funcionalidades }) : {}),
    'GET /aluno/pesos': { corpo: [] },
    'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
    'GET /aluno/avaliacoes-fisicas': { corpo: avaliacoes },
  });
  await page.goto('/aluno/historico');
  await expect(page.getByText('Suas medidas registradas pelo seu treinador, em centímetros.')).toBeVisible();
  return api;
}

async function compararAsDuasDatas(page: Page) {
  await page.getByRole('checkbox', { name: 'Comparar 01/07/2026' }).click();
  await page.getByRole('checkbox', { name: 'Comparar 01/09/2026' }).click();
  await expect(page.getByLabel('Comparativo da avaliação física').getByText('−3,0 cm')).toBeVisible();
}

for (const largura of [390, 1280]) {
  test(`aluno vê as avaliações no Histórico, só para consulta, e compara em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['PDF', 'MOBILIDADE', 'EQUIPE']);
    await expect(page.getByRole('button', { name: 'Nova avaliação' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Editar avaliação/ })).toHaveCount(0);
    await compararAsDuasDatas(page);
    // Com `PDF` no plano e conexão, o aluno baixa o mesmo comparativo da equipe.
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: sem PDF no plano o "Baixar comparativo" não aparece em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['MOBILIDADE', 'EQUIPE']);
    await compararAsDuasDatas(page);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: ao perder a internet o "Baixar comparativo" some e volta com ela em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, ['PDF']);
    await compararAsDuasDatas(page);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    // A comparação já está na tela: sem rede, ela continua e só o PDF (que busca a logo) sai.
    await page.context().setOffline(true);
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toHaveCount(0);
    await expect(page.getByLabel('Comparativo da avaliação física').getByText('−3,0 cm')).toBeVisible();
    await page.context().setOffline(false);
    // O Chromium emulado não avisa o NetInfo (que ouve `navigator.connection`) quando a rede volta; o aviso é o mesmo que o navegador de verdade dá.
    await page.evaluate(() => {
      (navigator as Navigator & { connection?: EventTarget }).connection?.dispatchEvent(new Event('change'));
      window.dispatchEvent(new Event('online'));
    });
    await expect(page.getByRole('button', { name: 'Baixar comparativo' })).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

/** Título, selo de período e descrição do cartão (o selo "Desde o primeiro registro" também existe no cartão Fotos). */
const faixaDoCartao = (page: Page) =>
  page.locator('div').filter({ has: page.getByRole('heading', { name: 'Avaliação física', exact: true }) }).filter({ hasNotText: 'Fotos' }).last();

for (const largura of [390, 1280]) {
  test(`vazio: a equipe vê uma frase só e "Nova avaliação"; o aluno vê o vazio de sempre em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: { corpo: [] },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
    const faixa = faixaDoCartao(page);
    await faixa.scrollIntoViewIfNeeded();
    await expect(faixa.getByText('Nenhuma avaliação registrada. Circunferências em centímetros, por data.', { exact: true })).toBeVisible();
    // Sem registro nenhum, "Desde o primeiro registro" enganaria; a linha solta do vazio também sai.
    await expect(faixa.getByText('Desde o primeiro registro')).toHaveCount(0);
    await expect(page.getByText('Nenhuma avaliação registrada.', { exact: true })).toHaveCount(0);
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
}

/** O gráfico desenhado: quantos pontos e se há traço entre eles (`L`/`C` no caminho da linha). */
async function desenhoDoGrafico(page: Page, nome: string) {
  const grafico = page.getByRole('img', { name: nome, exact: true });
  await expect(grafico).toBeVisible();
  await expect(grafico.locator('circle').first()).toBeAttached();
  const pontos = await grafico.locator('circle').count();
  const caminho = (await grafico.locator('path[fill="none"]').getAttribute('d')) ?? '';
  return { pontos, comLinha: /[LC]/.test(caminho) };
}

/** Cintura nas duas datas; quadril só na primeira (a segunda não mediu). */
const DUAS = [avaliacao('av2', '2026-09-01', 87, null, null), ANTIGA];

for (const largura of [390, 1280]) {
  test(`treinador: gráfico por medida com a linha em 2 datas e só o ponto em 1, sem inventar a ausente, em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES_TREINADOR })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`GET /alunos/${ALUNO_ID}/avaliacoes-fisicas`]: { corpo: DUAS },
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
    const secao = page.getByText('Evolução por medida', { exact: true });
    await secao.scrollIntoViewIfNeeded();
    await expect(secao).toBeVisible();

    // Padrão: a primeira medida que tem valor (Cintura), com a linha entre as duas datas.
    expect(await desenhoDoGrafico(page, 'Gráfico de Cintura com 2 datas')).toEqual({ pontos: 2, comLinha: true });
    const cintura = page.getByLabel('Cintura por data');
    await expect(cintura.getByText('87,0 cm')).toBeVisible();
    await expect(cintura.getByText('90,0 cm')).toBeVisible();

    // Quadril: só a data em que foi medido vira ponto; a outra aparece com "—" na lista, sem linha nem valor inventado.
    await page.getByRole('radiogroup', { name: 'Medida' }).getByRole('radio', { name: 'Quadril', exact: true }).click();
    expect(await desenhoDoGrafico(page, 'Gráfico de Quadril com 1 data')).toEqual({ pontos: 1, comLinha: false });
    await expect(page.getByText('Com uma data só, o gráfico mostra o ponto; a linha aparece a partir de duas datas.')).toBeVisible();
    const quadril = page.getByLabel('Quadril por data');
    await expect(quadril.getByText('100,0 cm')).toBeVisible();
    await expect(quadril.getByText('—', { exact: true })).toBeVisible();
    // A tabela do comparativo continua do jeito que era.
    await expect(page.getByRole('checkbox', { name: 'Comparar 01/07/2026' })).toBeVisible();
    await expect(page.getByText(/gordura|melhorou|piorou/i)).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`aluno: gráfico por medida no Histórico e, com gráficos desligados, só a lista em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { errosDaPagina } = await abrirHistoricoDoAluno(page, null);
    const secao = page.getByText('Evolução por medida', { exact: true });
    await secao.scrollIntoViewIfNeeded();
    expect(await desenhoDoGrafico(page, 'Gráfico de Cintura com 2 datas')).toEqual({ pontos: 2, comLinha: true });
    await expect(page.getByLabel('Cintura por data').getByText('87,0 cm')).toBeVisible();

    // Gráficos desligados (preferência da pessoa): fica a lista, com o aviso de onde religar.
    await page.evaluate((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ graficos: false })), ALUNO.id);
    await page.reload();
    await page.getByText('Evolução por medida', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Cintura por data').getByText('87,0 cm')).toBeVisible();
    await expect(page.getByRole('img', { name: /Gráfico de Cintura/ })).toHaveCount(0);
    await expect(page.getByText('Os gráficos estão desligados em Conta › Aparência e preferências.').first()).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}
