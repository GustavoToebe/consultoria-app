import { expect, test, type Page } from '@playwright/test';

import type { ConsultoriaResponse, EuResponse } from '../src/api/tipos';
import { erroApi, json, MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Editor dos PDFs (`/treinador/documentos/personalizar`; D-F1 a D-F8 de `docs/planos/documentos-pdf-motor.md` e 3.2 de
 * `docs/planos/orientacoes-de-design-26-11.md`): arranjo pela área de conteúdo (o menu do app continua à vista), prévia ao
 * vivo sem gravar, "Salvar" com a versão, 409 com "Recarregar" e a guarda "Sair sem salvar?". API falsa própria, só dados
 * fictícios. Com `E2E_CAPTURAS`, grava as capturas da matriz.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const ADMIN: Partial<EuResponse> = { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p1', nome: 'Administrador', acessoTotal: true } };
const CONSULTORIA: ConsultoriaResponse = { marca: { ...MARCA, temaPdf: 'CLASSICO', opcoesPdf: {} }, versao: 3, diasAtualizacaoPadrao: null, metaDoPeso: 'REDUZIR' };
type Tema = 'CLARO' | 'ESCURO' | 'AREIA';

/** A consultoria falsa grava modelo e opções e sobe a versão; o `GET` seguinte já devolve o gravado. */
function consultoriaGravavel(): RespostasApi {
  let atual = CONSULTORIA;
  return {
    'GET /consultoria': (_p, route) => json(route, atual),
    'PUT /consultoria/documentos-pdf': (p, route) => {
      const corpo = p.corpo as { modelo: string; opcoes: ConsultoriaResponse['marca']['opcoesPdf'] };
      atual = { ...atual, versao: atual.versao + 1, marca: { ...atual.marca, temaPdf: corpo.modelo, opcoesPdf: corpo.opcoes } };
      return json(route, atual);
    },
  };
}

async function abrir(page: Page, largura: number, opcoes: { tema?: Tema; minimizado?: boolean; busca?: string; extra?: RespostasApi } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 720 });
  await page.addInitScript(([id, tema, minimizado]) => {
    if (tema) localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema }));
    if (minimizado) localStorage.setItem('menu-lateral-recolhido', '1');
  }, [TREINADOR.id, opcoes.tema ?? '', opcoes.minimizado ? '1' : ''] as const);
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, ADMIN)),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...consultoriaGravavel(),
    ...opcoes.extra,
  });
  await page.goto(`/treinador/documentos/personalizar${opcoes.busca ?? ''}`);
  // Com o painel de confirmação aberto (celular com `?modelo`), o resto da tela sai da árvore de acessibilidade.
  await expect(page.getByRole('heading', { level: 1, name: 'Personalizar documentos' }).or(page.getByRole('alertdialog'))).toBeVisible();
  return api;
}

const folha = (page: Page) => page.getByRole('img', { name: /^Prévia do PDF de/ });
const previa = (page: Page) => page.getByTestId('previa-pdf');
const painel = (page: Page) => page.getByTestId('painel-de-opcoes');
const grupo = (page: Page, nome: string) => page.getByRole('button', { name: new RegExp(`^${nome}, (aberto|recolhido)$`) });
const fundoDoTh = (page: Page) => previa(page).locator('th').first().evaluate((th) => getComputedStyle(th).backgroundColor);
const escritas = (pedidos: { metodo: string; caminho: string }[]) => pedidos.filter((p) => p.metodo !== 'GET' && p.caminho !== '/auth/refresh');
const largura = async (page: Page, alvo: ReturnType<typeof folha>) => Math.round((await alvo.boundingBox())?.width ?? 0);

async function capturar(page: Page, nome: string) {
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/documentos-editor-${nome}.png` });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test('(390) celular: confirma o modelo escolhido na galeria, grava sem opções e volta aos modelos', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 390, { busca: '?modelo=ELEGANTE' });
  const dialogo = page.getByRole('alertdialog', { name: 'Usar o modelo Elegante?' });
  await expect(dialogo).toBeVisible();
  // O `?modelo` é consumido na chegada: o voltar não reabre a escolha.
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  await expect(page.getByText('Personalize numa tela maior')).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
  await capturar(page, '390-confirmar');
  await dialogo.getByRole('button', { name: 'Usar este modelo' }).click();
  await expect(page.getByText('Documentos salvos no modelo Elegante.', { exact: false })).toBeVisible();
  expect(escritas(pedidos)).toEqual([{ metodo: 'PUT', caminho: '/consultoria/documentos-pdf', busca: expect.anything(), corpo: { modelo: 'ELEGANTE', opcoes: {}, versao: 3 } }]);
  await expect(page).toHaveURL(/\/treinador\/documentos$/);
  expect(errosDaPagina).toEqual([]);
});

for (const minimizado of [false, true]) {
  test(`(1024, menu ${minimizado ? 'minimizado' : 'aberto'}) a área fica abaixo de 1024: só "Personalize numa tela maior"`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, 1024, { minimizado });
    await expect(page.getByText('Personalize numa tela maior')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver os modelos' })).toBeVisible();
    await expect(previa(page)).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await semRolagemLateral(page);
    await capturar(page, `1024-${minimizado ? 'minimizado' : 'aberto'}`);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const tema of ['ESCURO', 'CLARO'] as const) {
  test(`(1280, ${tema.toLowerCase()}) painel de 360 e folha ajustada; a opção muda a prévia ao vivo, sem gravar nem rolar ao topo, e o Salvar grava`, async ({ page }) => {
    const { pedidos, errosDaPagina } = await abrir(page, 1280, { tema });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    expect(await largura(page, painel(page))).toBe(360);
    // A área (1040) deixa ~568 px para a folha: Ajustar reduz a A4 e o controle aparece.
    const ajustada = await largura(page, folha(page));
    expect(ajustada).toBeGreaterThan(476);
    expect(ajustada).toBeLessThan(794);
    await expect(page.getByRole('radio', { name: 'Ajustar' })).toHaveAttribute('aria-checked', 'true');
    // O papel (o `.previa-pdf` da instância, `cssDaPrevia`) é branco em qualquer tema.
    expect(await previa(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Restaurar o modelo' })).toBeDisabled();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await capturar(page, `1280-${tema.toLowerCase()}`);

    // Desce a página, abre Cores e escolhe Azul: a prévia muda na hora e a rolagem fica onde estava.
    // A rolagem da página é a do `ScrollView` do editor: marca o ancestral da folha que rola, para ler e mexer nele.
    await previa(page).evaluate((el) => {
      let no: Element | null = el;
      while (no && !(/(auto|scroll)/.test(getComputedStyle(no).overflowY) && no.scrollHeight > no.clientHeight)) no = no.parentElement;
      no?.setAttribute('data-rolagem-do-teste', '');
    });
    const rolagem = page.locator('[data-rolagem-do-teste]');
    const topo = () => rolagem.evaluate((no) => no.scrollTop);
    await rolagem.evaluate((no) => { no.scrollTop = 500; });
    const antes = await topo();
    expect(antes).toBeGreaterThan(400);
    await grupo(page, 'Cores').click();
    await expect(painel(page).getByText('Cor da marca', { exact: true }).first()).toBeVisible();
    expect(await fundoDoTh(page)).toBe('rgb(185, 28, 28)');
    await painel(page).getByRole('radio', { name: 'Azul' }).click();
    await expect.poll(() => fundoDoTh(page)).toBe('rgb(37, 99, 235)');
    expect(await topo()).toBe(antes);
    await expect(grupo(page, 'Cores')).toBeVisible();
    await expect(page.getByText('Destaque: Azul')).toBeVisible();
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    expect(escritas(pedidos)).toEqual([]);
    await capturar(page, `1280-${tema.toLowerCase()}-cores`);

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Documentos salvos no modelo Clássico.', { exact: false })).toBeVisible();
    expect(escritas(pedidos)).toEqual([{ metodo: 'PUT', caminho: '/consultoria/documentos-pdf', busca: expect.anything(), corpo: { modelo: 'CLASSICO', opcoes: { cores: { destaque: 'AZUL' } }, versao: 3 } }]);
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await expect(page.getByText('Em uso nos PDFs')).toBeVisible();
    await semRolagemLateral(page);
    expect(errosDaPagina).toEqual([]);
  });
}

const MATRIZ: { janela: number; painel: number; tema: Tema; nome: string }[] = [
  { janela: 1536, painel: 360, tema: 'CLARO', nome: '1536' },
  { janela: 1920, painel: 400, tema: 'ESCURO', nome: '1920-escuro' },
  { janela: 1920, painel: 400, tema: 'CLARO', nome: '1920-claro' },
  { janela: 1920, painel: 400, tema: 'AREIA', nome: '1920-areia' },
  { janela: 2560, painel: 400, tema: 'CLARO', nome: '2560' },
  { janela: 3440, painel: 440, tema: 'ESCURO', nome: '3440' },
];

for (const m of MATRIZ) {
  test(`(${m.nome}) painel de ${m.painel} e folha a 100% (794), sem controle de zoom`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, m.janela, { tema: m.tema });
    await expect(previa(page)).toContainText('Aluno de Exemplo');
    expect(await largura(page, painel(page))).toBe(m.painel);
    expect(await largura(page, folha(page))).toBe(794);
    await expect(page.getByRole('radio', { name: 'Ajustar' })).toHaveCount(0);
    expect(await previa(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await grupo(page, 'Cabeçalho').click();
    await expect(page.getByText('Faixa cheia · logo à esquerda · média')).toBeVisible();
    await page.getByRole('tab', { name: 'Dieta' }).click();
    await expect(previa(page)).toContainText('Sugestão de plano alimentar');
    await semRolagemLateral(page);
    await capturar(page, m.nome);
    expect(errosDaPagina).toEqual([]);
  });
}

test('(1280) ?modelo da galeria abre o modelo como rascunho; trocar e restaurar têm Desfazer, sem pergunta', async ({ page }) => {
  const { pedidos, errosDaPagina } = await abrir(page, 1280, { busca: '?modelo=ESPORTIVO' });
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  await expect(page.getByText('Esportivo · Sem alterações')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeEnabled();

  await grupo(page, 'Modelo').click();
  await painel(page).getByRole('radio', { name: /^Elegante\. / }).click();
  await expect(page.getByText('Modelo trocado para Elegante.')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(painel(page).getByRole('radio', { name: /^Esportivo\. / })).toHaveAttribute('aria-checked', 'true');

  // Mudar uma opção abre só um grupo por vez; "Restaurar o modelo" volta aos valores dele, e o Desfazer devolve a opção.
  await grupo(page, 'Tabelas').click();
  await expect(grupo(page, 'Modelo')).toHaveAccessibleName('Modelo, recolhido');
  await painel(page).getByRole('radio', { name: 'Cartões' }).click();
  await expect(page.getByText('Esportivo · 1 alteração: Estilo das tabelas')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar o modelo' }).click();
  await expect(page.getByText('Opções do modelo Esportivo restauradas.')).toBeVisible();
  await expect(page.getByText('Esportivo · Sem alterações')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Esportivo · 1 alteração: Estilo das tabelas')).toBeVisible();
  expect(escritas(pedidos)).toEqual([]);
  await capturar(page, '1280-desfazer');
  expect(errosDaPagina).toEqual([]);
});

test('(1280) 409 ao salvar: painel com "Recarregar", que relê a consultoria e descarta o rascunho', async ({ page }) => {
  const { pedidos } = await abrir(page, 1280, { extra: { 'PUT /consultoria/documentos-pdf': erroApi(409, 'Conflito.', 'CONFLITO_EDICAO') } });
  await grupo(page, 'Texto').click();
  await painel(page).getByRole('radio', { name: 'Serifada' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  const dialogo = page.getByRole('alertdialog', { name: 'Os documentos foram alterados em outro lugar' });
  await expect(dialogo).toBeVisible();
  await capturar(page, '1280-409');
  const leituras = pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/consultoria').length;
  await dialogo.getByRole('button', { name: 'Recarregar' }).click();
  await expect.poll(() => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/consultoria').length).toBe(leituras + 1);
  await expect(page.getByText('Clássico · Sem alterações')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled();
});

test('(1280) 422 ao salvar: a mensagem do campo aparece na barra', async ({ page }) => {
  await abrir(page, 1280, { extra: { 'PUT /consultoria/documentos-pdf': erroApi(422, 'Dados inválidos.', 'DOCUMENTOS_PDF_INVALIDOS', [{ field: 'opcoes.tabelas.densidade', message: 'Valor não aceito.' }]) } });
  await grupo(page, 'Tabelas').click();
  await painel(page).getByRole('radio', { name: 'Espaçosa' }).click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Tabelas: Valor não aceito.')).toBeVisible();
  await expect(page.getByText('Falha ao salvar')).toBeVisible();
});

test('(1280) guarda de saída: com alteração, sair pelo menu pergunta "Sair sem salvar?"', async ({ page }) => {
  await abrir(page, 1280);
  await grupo(page, 'Cabeçalho').click();
  await painel(page).getByRole('radio', { name: 'Linha fina' }).click();
  await page.getByRole('link', { name: 'Alunos', exact: true }).first().click();
  const dialogo = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
  await expect(dialogo).toBeVisible();
  await capturar(page, '1280-guarda');
  await dialogo.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(page).toHaveURL(/\/treinador\/documentos\/personalizar$/);
  await expect(page.getByText('Clássico · 1 alteração: Estilo do cabeçalho')).toBeVisible();
});

test('sem acesso: perfil sem administrador não abre o editor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MARCA_ALTERAR'], perfil: { id: 'p2', nome: 'Treinador', acessoTotal: false } })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  });
  await page.goto('/treinador/documentos/personalizar');
  await expect(page.getByRole('heading', { level: 1, name: 'Sem acesso a esta tela' })).toBeVisible();
  await expect(previa(page)).toHaveCount(0);
});
