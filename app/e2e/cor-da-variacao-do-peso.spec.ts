import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, ConsultoriaResponse, EuResponse, MetaDoPeso, RegistroPeso } from '../src/api/tipos';
import { AREIA, CLARO, ESCURO, type Cores } from '../src/tema/tokens';
import { ALUNO, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Cor da variação do peso pela meta que o treinador decide (plano cor-da-variacao-do-peso): campo em Configurações › Padrões do acompanhamento (na Marca até 27/11) e na ficha,
 * cor na lista do peso da ficha e no Histórico do aluno (REDUZIR: queda verde; AUMENTAR: queda vermelha; SEM_META:
 * cor do texto), na lista e no resumo, seta e sinal sempre, a linha que explica as cores e o campo escondido sem
 * `ALUNO_SENSIVEL_LER`.
 * A meta efetiva vem pronta em cada item da lista de pesos: a tela nunca a calcula. Dados fictícios.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

function pesos(meta: MetaDoPeso | undefined): RegistroPeso[] {
  return [
    { id: 'p3', data: '2026-10-26', pesoKg: 80.5, variacao: -0.7, observacao: null, metaDoPeso: meta },
    { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: null, metaDoPeso: meta },
    { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null, metaDoPeso: meta },
  ];
}

const TEMAS = { CLARO, ESCURO, AREIA } as const;
type NomeDoTema = keyof typeof TEMAS;

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Opção do `Escolha` (como em `agenda-calendario.spec.ts`): botão dentro do grupo, marcada com `aria-checked`. */
const opcao = (onde: Locator | Page, grupo: string, rotulo: string) =>
  onde.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: rotulo, exact: true });

/** Cor do texto na lista do peso (o resumo acima repete a última variação; ele tem o próprio teste, `corNoResumo`). */
async function corDe(page: Page, texto: string): Promise<string> {
  const alvo = page.getByLabel('Registros de peso').getByText(texto, { exact: true });
  await alvo.scrollIntoViewIfNeeded();
  return alvo.evaluate((e) => getComputedStyle(e).color);
}

async function corNoResumo(page: Page, texto: string): Promise<string> {
  return page.getByLabel(/^Desde o registro anterior/).getByText(texto, { exact: true }).evaluate((e) => getComputedStyle(e).color);
}

/**
 * Balão do gráfico no ponto `rotulo` ("26/10: 80,5 kg"): cor da variação (seta e número), fundo do balão e miolo do
 * ponto em foco. O gráfico abre pela aba; o ponto em foco é o único de raio 6.
 */
async function balaoNoPonto(page: Page, rotulo: string, variacao: string) {
  await page.getByRole('tab', { name: 'Gráfico' }).click();
  const ponto = page.getByRole('button', { name: rotulo, exact: true });
  await ponto.scrollIntoViewIfNeeded();
  await ponto.hover();
  // O resumo acima repete a última variação: procura dentro do balão (o pai da linha "dd/mm/aaaa · peso").
  const [dia, valor] = rotulo.split(': ');
  const balao = page.getByText(new RegExp(`^${dia}/\\d{4} · ${valor}$`)).locator('..');
  const parte = balao.getByText(variacao, { exact: true });
  await expect(parte).toBeVisible();
  return {
    cor: await parte.evaluate((e) => getComputedStyle(e).color),
    fundo: await parte.evaluate((e) => {
      for (let n: Element | null = e; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      }
      return null;
    }),
    miolo: await page.getByRole('img', { name: /^Gráfico de peso/ }).locator('circle[r="6"]').evaluate((e) => getComputedStyle(e).fill),
  };
}

async function preparar(page: Page, largura: number, tema: NomeDoTema, usuarioId: string) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [usuarioId, tema]);
}

const ROTAS_DA_FICHA: RespostasApi = {
  'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
};

async function abrirFicha(page: Page, meta: MetaDoPeso | undefined) {
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR)),
    ...ROTAS_DA_FICHA,
    [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
    [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: pesos(meta) },
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  await expect(page.getByLabel('Registros de peso').getByText('80,5 kg', { exact: true })).toBeVisible();
  return api;
}

for (const tema of Object.keys(TEMAS) as NomeDoTema[]) {
  const cores: Cores = TEMAS[tema];
  for (const largura of [390, 1280]) {
    test.describe(`tema ${tema} em ${largura}px`, () => {
      test('ficha com REDUZIR: queda verde, aumento vermelho, seta e sinal, e a linha da meta', async ({ page }) => {
        await preparar(page, largura, tema, TREINADOR.id);
        const { errosDaPagina } = await abrirFicha(page, 'REDUZIR');
        expect(await corDe(page, '▼ −0,7 kg')).toBe(rgb(cores.sucesso));
        expect(await corDe(page, '▲ +1,2 kg')).toBe(rgb(cores.perigo));
        expect(await corNoResumo(page, '▼ −0,7 kg')).toBe(rgb(cores.sucesso));
        await expect(page.getByLabel('Desceu 0,7 kg desde 19/10', { exact: true })).toBeVisible();
        // A meta escrita uma vez, junto do resumo.
        await expect(page.getByText('Cores pela meta: reduzir o peso', { exact: true })).toHaveCount(1);
        await expect(page.getByText('Cores pela meta: reduzir o peso', { exact: true })).toBeVisible();
        expect(errosDaPagina).toEqual([]);
      });

      test('gráfico com REDUZIR: balão e ponto em foco com a cor da lista, balão na superfície do cartão', async ({ page }) => {
        await preparar(page, largura, tema, TREINADOR.id);
        const { errosDaPagina } = await abrirFicha(page, 'REDUZIR');
        const desceu = await balaoNoPonto(page, '26/10: 80,5 kg', '▼ −0,7 kg');
        expect(desceu).toEqual({ cor: rgb(cores.sucesso), fundo: rgb(cores.superficie), miolo: rgb(cores.sucesso) });
        // O leitor de tela ouve a direção e a meta, sem a seta.
        await expect(page.getByText('26/10/2026, 80,5 kg. Desceu 0,7 kg desde 19/10, a favor da meta', { exact: true })).toBeAttached();
        const subiu = await balaoNoPonto(page, '19/10: 81,2 kg', '▲ +1,2 kg');
        expect(subiu).toEqual({ cor: rgb(cores.perigo), fundo: rgb(cores.superficie), miolo: rgb(cores.perigo) });
        // Primeiro registro: sem variação, ponto neutro.
        await page.getByRole('button', { name: '12/10: 80 kg', exact: true }).hover();
        await expect(page.getByText('Sem registro anterior', { exact: true })).toBeVisible();
        expect(await page.getByRole('img', { name: /^Gráfico de peso/ }).locator('circle[r="6"]').evaluate((e) => getComputedStyle(e).fill)).toBe(rgb(cores.texto));
        expect(errosDaPagina).toEqual([]);
      });

      test('ficha com SEM_META: variação na cor do texto e sem a linha da meta', async ({ page }) => {
        await preparar(page, largura, tema, TREINADOR.id);
        const { errosDaPagina } = await abrirFicha(page, 'SEM_META');
        expect(await corDe(page, '▼ −0,7 kg')).toBe(rgb(cores.texto));
        expect(await corDe(page, '▲ +1,2 kg')).toBe(rgb(cores.texto));
        expect(await corNoResumo(page, '▼ −0,7 kg')).toBe(rgb(cores.texto));
        await expect(page.getByText(/Cores pela meta/)).toHaveCount(0);
        // No gráfico também: sem meta, balão e ponto neutros (nada de verde ou vermelho inventado).
        const balao = await balaoNoPonto(page, '26/10: 80,5 kg', '▼ −0,7 kg');
        expect(balao).toEqual({ cor: rgb(cores.texto), fundo: rgb(cores.superficie), miolo: rgb(cores.texto) });
        expect(errosDaPagina).toEqual([]);
      });

      test('Histórico do aluno com AUMENTAR: queda vermelha, aumento verde e "Verde: no caminho da sua meta"', async ({ page }) => {
        await preparar(page, largura, tema, ALUNO.id);
        const { errosDaPagina } = await simularApi(page, {
          ...(await sessaoDeAluno(page)),
          'GET /aluno/pesos': { corpo: pesos('AUMENTAR') },
          'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
          'GET /aluno/avaliacoes-fisicas': { corpo: [] },
        });
        await page.goto('/aluno/historico?aba=corpo');
        await expect(page.getByLabel('Registros de peso').getByText('80,5 kg', { exact: true })).toBeVisible();
        expect(await corDe(page, '▼ −0,7 kg')).toBe(rgb(cores.perigo));
        expect(await corDe(page, '▲ +1,2 kg')).toBe(rgb(cores.sucesso));
        expect(await corNoResumo(page, '▼ −0,7 kg')).toBe(rgb(cores.perigo));
        await expect(page.getByText('Verde: no caminho da sua meta', { exact: true })).toBeVisible();
        await expect(page.getByText(/Cores pela meta/)).toHaveCount(0);
        // A inversão vale no balão: com AUMENTAR a queda é vermelha.
        const balao = await balaoNoPonto(page, '26/10: 80,5 kg', '▼ −0,7 kg');
        expect(balao).toEqual({ cor: rgb(cores.perigo), fundo: rgb(cores.superficie), miolo: rgb(cores.perigo) });
        expect(errosDaPagina).toEqual([]);
      });
    });
  }
}

for (const largura of [390, 1280]) {
  test(`Padrões do acompanhamento: "Meta do peso dos alunos" nasce como veio e vai no PUT da marca em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const consultoria: ConsultoriaResponse = { marca: MARCA, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } })),
      ...ROTAS_DA_FICHA,
      'GET /consultoria': { corpo: consultoria },
      'PUT /consultoria/marca': (p, route) => json(route, { ...consultoria, ...(p.corpo as object), marca: MARCA, versao: 4 }),
    });
    await page.goto('/treinador/configuracoes/padroes-do-acompanhamento');
    const reduzir = opcao(page, 'Meta do peso dos alunos', 'Reduzir');
    await reduzir.scrollIntoViewIfNeeded();
    await expect(reduzir).toHaveAttribute('aria-checked', 'true');
    // Nada mudou: sem o rodapé de salvar.
    await expect(page.getByRole('button', { name: 'Salvar padrões' })).toHaveCount(0);
    await opcao(page, 'Meta do peso dos alunos', 'Aumentar').click();
    await page.getByRole('button', { name: 'Salvar padrões' }).click();
    await expect(page.getByText('Padrões do acompanhamento salvos.', { exact: true })).toBeVisible();
    const envio = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === '/consultoria/marca');
    expect(envio?.corpo).toMatchObject({ metaDoPeso: 'AUMENTAR', versao: 3, nome: MARCA.nome, corPrimaria: MARCA.corPrimaria });
    expect(errosDaPagina).toEqual([]);
  });

  test(`ficha: meta própria troca as cores ao salvar e "Padrão" vai como PADRAO_DA_CONSULTORIA em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    // Estado do servidor falso: meta do aluno (nula = padrão da consultoria, REDUZIR) e a efetiva nos pesos.
    let doAluno: MetaDoPeso | null = null;
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR)),
      ...ROTAS_DA_FICHA,
      [`GET /alunos/${ALUNO_ID}`]: (_p, route) => json(route, { ...FICHA, ...(doAluno ? { metaDoPeso: doAluno } : {}) }),
      [`GET /alunos/${ALUNO_ID}/pesos`]: (_p, route) => json(route, pesos(doAluno ?? 'REDUZIR')),
      [`PUT /alunos/${ALUNO_ID}`]: (p, route) => {
        const enviada = (p.corpo as { metaDoPeso?: string | null }).metaDoPeso;
        if (enviada === 'PADRAO_DA_CONSULTORIA') doAluno = null;
        else if (enviada) doAluno = enviada as MetaDoPeso;
        return json(route, { ...FICHA, versao: 2, ...(doAluno ? { metaDoPeso: doAluno } : {}) });
      },
    });
    // A meta fica nos Dados do aluno (aba Ficha do aluno) e as cores no Peso (aba Evolução).
    const corNoPeso = async (linha: string) => {
      await page.getByRole('tab', { name: 'Evolução', exact: true }).click();
      await expect(page.getByText(linha, { exact: true })).toBeVisible();
      const cor = await corDe(page, '▼ −0,7 kg');
      await page.getByRole('tab', { name: 'Ficha do aluno', exact: true }).click();
      return cor;
    };
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
    await expect(page.getByLabel('Meta do peso: Padrão da consultoria', { exact: true })).toBeVisible();
    expect(await corNoPeso('Cores pela meta: reduzir o peso')).toBe(rgb(CLARO.sucesso));

    // Meta própria: Aumentar. Salvar troca as cores sem recarregar a página.
    await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
    const padrao = opcao(page, 'Meta do peso', 'Padrão da consultoria');
    await expect(padrao).toHaveAttribute('aria-checked', 'true');
    await opcao(page, 'Meta do peso', 'Aumentar').click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Dados salvos.')).toBeVisible();
    await expect(page.getByLabel('Meta do peso: Aumentar', { exact: true })).toBeVisible();
    expect(await corNoPeso('Cores pela meta: aumentar o peso')).toBe(rgb(CLARO.perigo));

    // Salvar outro campo reenvia a meta escolhida (não a apaga) e volta ao padrão só com PADRAO_DA_CONSULTORIA.
    await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
    await expect(opcao(page, 'Meta do peso', 'Aumentar')).toHaveAttribute('aria-checked', 'true');
    await opcao(page, 'Meta do peso', 'Padrão da consultoria').click();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByLabel('Meta do peso: Padrão da consultoria', { exact: true })).toBeVisible();
    expect(await corNoPeso('Cores pela meta: reduzir o peso')).toBe(rgb(CLARO.sucesso));

    const envios = pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`).map((p) => (p.corpo as { metaDoPeso?: unknown }).metaDoPeso);
    expect(envios).toEqual(['AUMENTAR', 'PADRAO_DA_CONSULTORIA']);
    expect(errosDaPagina).toEqual([]);
  });

  test(`sem ALUNO_SENSIVEL_LER a meta não aparece na ficha nem vai no PUT em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const rotas = await sessao(page, TREINADOR);
    const eu = (rotas['GET /eu'] as { corpo: EuResponse }).corpo;
    rotas['GET /eu'] = { corpo: { ...eu, permissoes: (eu.permissoes ?? []).filter((p) => p !== 'ALUNO_SENSIVEL_LER') } };
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...rotas,
      ...ROTAS_DA_FICHA,
      [`GET /alunos/${ALUNO_ID}`]: { corpo: FICHA },
      [`PUT /alunos/${ALUNO_ID}`]: (_p, route) => json(route, { ...FICHA, versao: 2 }),
    });
    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=ficha`);
    await expect(page.getByText('Dados do aluno', { exact: true })).toBeVisible();
    await expect(page.getByText('Meta do peso', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
    await expect(page.getByText('Meta do peso', { exact: true })).toHaveCount(0);
    await expect(opcao(page, 'Meta do peso', 'Padrão da consultoria')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Dados salvos.')).toBeVisible();
    const envio = pedidos.find((p) => p.metodo === 'PUT' && p.caminho === `/alunos/${ALUNO_ID}`);
    expect(envio?.corpo).not.toHaveProperty('metaDoPeso');
    expect(pedidos.some((p) => p.caminho === `/alunos/${ALUNO_ID}/pesos`)).toBe(false);
    expect(errosDaPagina).toEqual([]);
  });
}
