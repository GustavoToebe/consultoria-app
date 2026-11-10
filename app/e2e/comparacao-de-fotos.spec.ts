import { expect, test, type Locator, type Page } from '@playwright/test';

import type { AlunoDetalhe, FotoDaLinha } from '../src/api/tipos';
import { LARGURA_IMAGEM, layoutDaImagem, type RetanguloDaImagem } from '../src/dominio/comparacaoDeFotos';
import { ALUNO, json, MARCA, PERMISSOES_TREINADOR, type Resposta, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Comparação de fotos na ficha e no Histórico. A API é falsa e as fotos são um JPEG mínimo,
 * sem imagem de pessoa.
 */
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const FICHA: AlunoDetalhe = {
  id: ALUNO_ID, nome: ALUNO.nome, email: ALUNO.email, telefone: null, objetivo: null,
  ativo: true, temAcesso: true, conviteExpiraEm: null, versao: 1, diasAtualizacao: null, anonimizado: false,
  emailDeAcesso: ALUNO.email, aguardandoPrimeiroAcesso: false,
};

const FOTOS: FotoDaLinha[] = [
  { fotoId: 'f1', origem: 'ANAMNESE', origemId: 'n1', data: '2026-01-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 80 },
  { fotoId: 'f2', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-10', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.5 },
  { fotoId: 'f3', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-01-20', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79.3 },
  { fotoId: 'f4', origem: 'ATUALIZACAO', origemId: 'u3', data: '2026-02-01', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 79 },
  { fotoId: 'f5', origem: 'ATUALIZACAO', origemId: 'u4', data: '2026-02-10', perguntaId: 'frente', posicao: 'Frente', ordem: 0, pesoKg: 78.5 },
];

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/9k=',
  'base64',
);

function jpeg(_pedido: unknown, route: Parameters<typeof json>[0]) {
  return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
}

const PERMISSOES = [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER'];

for (const largura of [390, 1280, 3440]) {
  test(`treinador compara fotos e gera a imagem em ${largura}px`, async ({ page }) => {
    const altura = largura === 3440 ? 1440 : 900;
    await page.setViewportSize({ width: largura, height: altura });
    const marca = { ...MARCA, logoUrl: '/publico/marcas/c0000000-0000-4000-8000-000000000001/logo?v=1' };
    const { pedidos, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: null } },
      [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: FOTOS },
      'GET /atualizacoes/{id}/fotos/{fotoId}': jpeg,
      'GET /anamneses/{id}/fotos/{fotoId}': jpeg,
      'GET /publico/marcas/{id}/logo': jpeg,
      [`POST /alunos/${ALUNO_ID}/fotos/comparacao`]: (pedido, route) => {
        expect(pedido.corpo).toMatchObject({
          formato: 'STORIES', comLogo: false, imagens: [{ fotoIds: ['f1', 'f5'] }],
        });
        return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG });
      },
    });

    await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Frente', exact: true }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await expect(page.getByText('01/01 → 10/02: −1,5 kg em 40 dias')).toBeVisible();

    await page.getByRole('button', { name: '10/01', exact: true }).click();
    await page.getByRole('button', { name: '20/01', exact: true }).click();
    await page.getByRole('button', { name: '01/02', exact: true }).click();
    const quinta = page.getByRole('button', { name: '10/02', exact: true });
    await expect(quinta).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: '01/02', exact: true }).click();
    await expect(page.getByRole('button', { name: '01/02', exact: true })).not.toHaveAttribute('aria-selected', 'true');

    const previa = page.getByLabel('Prévia da comparação');
    const caixas = await previa.locator('> div').all();
    expect(caixas.length).toBe(4);
    const pontos = await Promise.all(caixas.map(async (c) => c.boundingBox()));
    const ys = pontos.map((p) => p?.y ?? 0);
    const xs = pontos.map((p) => p?.x ?? 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(8);
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[3]).toBeGreaterThan(xs[2]);

    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    await expect(page.getByRole('button', { name: 'Baixar imagem' })).toBeDisabled();
    // A falta de autorização aparece uma vez só, como o motivo do botão.
    await expect(page.getByText('O aluno ainda não autorizou o uso das fotos.', { exact: false })).toHaveCount(1);
    await page.getByRole('button', { name: 'Fechar' }).click();
    // Fechar a Folha volta a entrada dela no histórico (`history.go`, assíncrono); recarregar antes do `popstate` aborta a
    // navegação (ERR_ABORTED). Espera a entrada da Folha sair do histórico.
    await expect(page.getByRole('dialog', { name: 'Gerar imagem' })).toHaveCount(0);
    await page.waitForFunction(() => !(window.history.state as { folhaNivel?: number } | null)?.folhaNivel);

    await page.route(`**/api/alunos/${ALUNO_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return json(route, { ...FICHA, usoDeImagemAutorizadoEm: '2026-10-01T12:00:00Z' });
    });
    await page.reload();
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    await expect(page.getByText('Aluno autorizou em 01/10/2026')).toBeVisible();
    const dialog = page.getByRole('dialog', { name: 'Gerar imagem' });
    const caixaDialog = await dialog.boundingBox();
    expect(caixaDialog).not.toBeNull();
    expect(caixaDialog!.x).toBeGreaterThanOrEqual(-1);
    expect(caixaDialog!.y).toBeGreaterThanOrEqual(-1);
    expect(caixaDialog!.width).toBeLessThanOrEqual(largura + 1);
    expect(caixaDialog!.height).toBeLessThanOrEqual(altura + 1);
    // A prévia nasce depois de medir o corpo da folha e as fotos chegam pela API: espera as duas.
    await expect(page.getByLabel('Prévia da imagem').getByRole('img')).toHaveCount(2);
    const imagens = await page.getByLabel('Prévia da imagem').getByRole('img').all();
    const linhas = await Promise.all(imagens.map(async (c) => (await c.boundingBox())?.y ?? 0));
    expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThan(8);
    await expect(page.getByRole('radio', { name: 'Stories' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Os dois' }).click();
    await expect(page.getByRole('button', { name: 'Baixar imagens (.zip)' })).toBeVisible();
    await expect(page.getByText(/Sai um \.zip com duas imagens/)).toBeVisible();
    await page.getByRole('radio', { name: 'Stories' }).click();
    const logo = page.getByRole('img', { name: 'Logo da consultoria', exact: true });
    await expect(logo).toBeVisible();
    await page.getByRole('switch', { name: 'Com a logo da consultoria' }).click();
    await expect(logo).toHaveCount(0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar imagem' }).click();
    expect((await download).suggestedFilename()).toBe('stories.jpg');
    expect(errosDaPagina).toEqual([]);
    expect(pedidos.some((p) => p.caminho.endsWith('/fotos/comparacao'))).toBe(true);
  });

  test(`aluno autoriza na conta e compara no histórico em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 3440 ? 1440 : 900 });
    let autorizado = false;
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/uso-de-imagem': (_pedido, route) => json(route, { autorizadoEm: autorizado ? '2026-10-23T15:00:00Z' : null }),
      'PUT /aluno/uso-de-imagem': (pedido, route) => {
        autorizado = (pedido.corpo as { autorizado: boolean }).autorizado;
        return json(route, { autorizadoEm: '2026-10-23T15:00:00Z' });
      },
      'GET /aluno/fotos/linha-do-tempo': { corpo: FOTOS },
      'GET /aluno/fotos/{id}': jpeg,
      'GET /aluno/pesos': { corpo: [] },
      'GET /aluno/execucoes': { corpo: [] },
    });
    await page.goto('/aluno/conta');
    await page.getByRole('switch', { name: /Autorizo a consultoria/ }).click();
    await expect(page.getByText('Autorizado em 23/10/2026')).toBeVisible();

    await page.goto('/aluno/historico');
    await page.getByRole('tab', { name: 'Comparar' }).click();
    await page.getByRole('button', { name: 'Primeira × última' }).click();
    await expect(page.getByText('01/01 → 10/02: −1,5 kg em 40 dias')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar imagem' })).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('o carrossel emparelha as fotos das duas datas pela ordem', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fotos: FotoDaLinha[] = [
    { fotoId: 'a1', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0, pesoKg: 80 },
    { fotoId: 'a2', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1, pesoKg: 80 },
    { fotoId: 'b1', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 0, pesoKg: 78 },
    { fotoId: 'b2', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: 1, pesoKg: 78 },
    { fotoId: 'l1', origem: 'ATUALIZACAO', origemId: 'u1', data: '2026-01-01', perguntaId: 'livre', posicao: 'Foto livre', ordem: 0, pesoKg: 80 },
    { fotoId: 'l2', origem: 'ATUALIZACAO', origemId: 'u2', data: '2026-02-20', perguntaId: 'livre', posicao: 'Foto livre', ordem: 0, pesoKg: 78 },
  ];
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca: MARCA })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: '2026-10-01T12:00:00Z' } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: fotos },
    'GET /atualizacoes/{id}/fotos/{fotoId}': jpeg,
    [`POST /alunos/${ALUNO_ID}/fotos/comparacao`]: (pedido, route) => {
      expect(pedido.corpo).toMatchObject({
        formato: 'STORIES',
        comLogo: false,
        imagens: [{ fotoIds: ['a1', 'b1'] }, { fotoIds: ['a2', 'b2'] }],
      });
      return route.fulfill({ status: 200, contentType: 'application/zip', body: Buffer.from('PK') });
    },
  });

  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  await page.getByRole('tab', { name: 'Comparar' }).click();
  await page.getByRole('button', { name: 'Fotos em jejum', exact: true }).click();
  await page.getByRole('button', { name: 'Primeira × última' }).click();
  await page.getByRole('button', { name: 'Gerar carrossel' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gerar carrossel' });
  await expect(dialog.getByLabel('Prévia da imagem')).toHaveCount(2);
  await expect(dialog.getByText('Foto 1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Foto 2', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Livre')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar imagens (.zip)' }).click();
  expect((await download).suggestedFilename()).toBe('comparacao.zip');
  expect(errosDaPagina).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Composição (passo 4b de `docs/planos/composicao-visual.md`): posição e tamanho medidos na tela, sem captura.

const TEMAS = {
  claro: { tema: 'CLARO' }, escuro: { tema: 'ESCURO' }, areia: { tema: 'AREIA' }, 'contraste-alto': { tema: 'CLARO', contraste: 'ALTO' },
} as const;
const AUTORIZADO_EM = '2026-10-01T12:00:00Z';

async function caixa(l: Locator) {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

/** O centro do elemento está na janela e nada o cobre (o `elementFromPoint` devolve ele ou um filho). */
function semNadaPorCima(l: Locator) {
  return l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const no = document.elementFromPoint(x, y);
    return !!no && (no === e || e.contains(no));
  });
}

/** Contraste do texto com o primeiro fundo opaco atrás dele (WCAG 2.2, 1.4.3). */
function contraste(l: Locator) {
  return l.evaluate((e) => {
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const luz = ([r, g, b]: number[]) => {
      const canal = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };
    let fundo: number[] | null = null;
    for (let no: Element | null = e; no && !fundo; no = no.parentElement) {
      const c = rgb(getComputedStyle(no).backgroundColor);
      if (c.length === 3 || (c.length === 4 && c[3] === 1)) fundo = c.slice(0, 3);
    }
    const [a, b] = [luz(rgb(getComputedStyle(e).color)), luz(fundo ?? [255, 255, 255])].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
}

async function abrirComparacao(page: Page, opcoes: {
  largura: number; altura: number; preferencias?: object; autorizadoEm?: string | null; fotos?: FotoDaLinha[];
  gerar?: Resposta;
}) {
  await page.setViewportSize({ width: opcoes.largura, height: opcoes.altura });
  await page.addInitScript(([id, pref]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify(pref)),
    [TREINADOR.id, opcoes.preferencias ?? TEMAS.claro] as const);
  const marca = { ...MARCA, logoUrl: '/publico/marcas/c0000000-0000-4000-8000-000000000001/logo?v=1' };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES, marca })),
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    [`GET /alunos/${ALUNO_ID}`]: { corpo: { ...FICHA, usoDeImagemAutorizadoEm: opcoes.autorizadoEm === undefined ? AUTORIZADO_EM : opcoes.autorizadoEm } },
    [`GET /alunos/${ALUNO_ID}/fotos`]: { corpo: opcoes.fotos ?? FOTOS },
    'GET /atualizacoes/{id}/fotos/{fotoId}': jpeg,
    'GET /anamneses/{id}/fotos/{fotoId}': jpeg,
    'GET /publico/marcas/{id}/logo': jpeg,
    ...(opcoes.gerar ? { [`POST /alunos/${ALUNO_ID}/fotos/comparacao`]: opcoes.gerar } : {}),
  });
  await page.goto(`/treinador/alunos/${ALUNO_ID}?aba=evolucao`);
  await page.getByRole('tab', { name: 'Comparar' }).click();
  await page.getByRole('button', { name: 'Primeira × última' }).click();
  return api;
}

/** Medidas da folha de gerar: prévia, coluna das configurações, ação e o topo do rodapé. */
async function medirFolha(dialogo: Locator) {
  const acao = dialogo.getByRole('button', { name: /^Baixar/ });
  const status = dialogo.getByText(/^Aluno autorizou em/);
  const previa = await caixa(dialogo.getByLabel('Prévia da imagem').first());
  const formato = await caixa(dialogo.getByRole('radio', { name: 'Stories' }));
  const botao = await caixa(acao);
  const topoDoRodape = (await status.count()) ? Math.min(botao.y, (await caixa(status)).y) : botao.y;
  return { acao, previa, formato, botao, topoDoRodape };
}

function proporcao(b: { width: number; height: number }) {
  return b.width / b.height;
}

const LARGURAS_DA_COMPOSICAO = [[390, 844], [768, 1024], [1280, 900], [1920, 1080]] as const;
const CASOS_DA_COMPOSICAO: (readonly [number, number, keyof typeof TEMAS])[] = [
  ...LARGURAS_DA_COMPOSICAO.flatMap(([l, a]) => (['claro', 'escuro'] as const).map((t) => [l, a, t] as const)),
  [390, 844, 'areia'], [1280, 900, 'areia'], [390, 844, 'contraste-alto'], [1280, 900, 'contraste-alto'],
];

for (const [largura, altura, tema] of CASOS_DA_COMPOSICAO) {
  test(`composição da comparação e da folha de gerar em ${largura}px, tema ${tema}`, async ({ page }) => {
    const { errosDaPagina } = await abrirComparacao(page, { largura, altura, preferencias: TEMAS[tema] });

    // 01: par de fotos junto, áreas iguais na proporção da foto, data e peso dentro da célula, resumo embaixo.
    const fileira = page.getByLabel('Prévia da comparação');
    const celulas = await fileira.locator('> div').all();
    expect(celulas.length).toBe(2);
    const [a, b] = await Promise.all(celulas.map(caixa));
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(b.x - (a.x + a.width)).toBeLessThanOrEqual(16);
    for (const celula of celulas) {
      const c = await caixa(celula);
      const foto = await caixa(celula.getByRole('img').first());
      // A imagem fica dentro da moldura de 1 px da `ImagemProtegida`.
      expect(Math.abs(foto.width - c.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(proporcao(foto) - 3 / 4) / (3 / 4)).toBeLessThan(0.02);
      const legenda = await celula.locator('div[dir="auto"]').all();
      expect(legenda.length).toBe(2);
      for (const texto of legenda) {
        const t = await caixa(texto);
        expect(t.x).toBeGreaterThanOrEqual(c.x - 1);
        expect(t.y + t.height).toBeLessThanOrEqual(c.y + c.height + 1);
        expect(await contraste(texto)).toBeGreaterThanOrEqual(4.5);
      }
    }
    const resumo = page.getByText('01/01 → 10/02: −1,5 kg em 40 dias');
    const r = await caixa(resumo);
    expect(r.y).toBeGreaterThanOrEqual(Math.max(a.y + a.height, b.y + b.height));
    expect(Math.abs(r.x - a.x)).toBeLessThanOrEqual(1);
    expect(await contraste(resumo)).toBeGreaterThanOrEqual(4.5);
    expect((await caixa(page.getByRole('button', { name: 'Gerar imagem' }))).y).toBeGreaterThan(r.y + r.height);

    // 02: a folha abre com a ação à vista, sem rolar, e a prévia inteira acima do rodapé.
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gerar imagem' });
    await expect(dialogo.getByLabel('Prévia da imagem').getByRole('img')).toHaveCount(2);
    const stories = await medirFolha(dialogo);
    expect(await semNadaPorCima(stories.acao)).toBe(true);
    expect(stories.previa.y).toBeGreaterThanOrEqual(0);
    expect(stories.previa.y + stories.previa.height).toBeLessThanOrEqual(stories.topoDoRodape);
    expect(Math.abs(proporcao(stories.previa) - 1080 / 1920) / (1080 / 1920)).toBeLessThan(0.02);
    // Prévia fiel ao arquivo: cada quadro e a logo no lugar do `layoutDaImagem`, na escala da tela (a logo do teste é 1×1).
    const escala = stories.previa.width / LARGURA_IMAGEM;
    const esperado = layoutDaImagem('STORIES', 2, true, 1, 1);
    const noLugar = async (l: Locator, r: RetanguloDaImagem) => {
      const c = await caixa(l);
      expect(Math.abs(c.x - stories.previa.x - r.x * escala)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.y - stories.previa.y - r.y * escala)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.width - r.largura * escala)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.height - r.altura * escala)).toBeLessThanOrEqual(2);
    };
    const quadros = await dialogo.getByLabel('Prévia da imagem').getByRole('img').all();
    for (const [i, quadro] of quadros.entries()) await noLugar(quadro, esperado.fotos[i]);
    const logo = dialogo.getByRole('img', { name: 'Logo da consultoria', exact: true });
    await expect(logo).toBeVisible();
    await noLugar(logo, esperado.logo!);
    if (largura >= 768) expect(stories.formato.x).toBeGreaterThan(stories.previa.x + stories.previa.width);
    else expect(stories.formato.y).toBeGreaterThan(stories.previa.y + stories.previa.height);
    // A ação principal fica na borda direita do rodapé no PC e ocupa a largura no celular.
    const folha = await caixa(dialogo);
    expect(Math.abs(folha.x + folha.width - 16 - (stories.botao.x + stories.botao.width))).toBeLessThanOrEqual(2);
    if (largura < 768) expect(Math.abs(stories.botao.x - (folha.x + 16))).toBeLessThanOrEqual(2);
    // O rodapé fica no pé da folha: a altura é fixa (90%) e o corpo cresce até ele, sem faixa vazia embaixo (P1).
    expect(await dialogo.evaluate((d) => d.getBoundingClientRect().bottom - d.lastElementChild!.getBoundingClientRect().bottom)).toBeLessThanOrEqual(3);

    // 03: autorização uma vez só, como status; switch junto do rótulo.
    await expect(dialogo.getByText(/autoriz/i)).toHaveCount(1);
    expect(await contraste(dialogo.getByText(/^Aluno autorizou em/))).toBeGreaterThanOrEqual(4.5);
    const rotulo = dialogo.getByText('Com a logo da consultoria', { exact: true });
    const fimDoRotulo = await rotulo.evaluate((e) => { const faixa = document.createRange(); faixa.selectNodeContents(e); return faixa.getBoundingClientRect().right; });
    const chave = await caixa(dialogo.getByRole('switch', { name: 'Com a logo da consultoria' }));
    expect(chave.x - fimDoRotulo).toBeGreaterThanOrEqual(0);
    expect(chave.x - fimDoRotulo).toBeLessThanOrEqual(32);

    // 04: trocar o formato muda só a prévia; configurações e ação não saem do lugar.
    await dialogo.getByRole('radio', { name: 'Feed retrato' }).click();
    await expect.poll(async () => proporcao(await caixa(dialogo.getByLabel('Prévia da imagem')))).toBeCloseTo(1080 / 1350, 1);
    const feed = await medirFolha(dialogo);
    expect(Math.abs(proporcao(feed.previa) - 1080 / 1350) / (1080 / 1350)).toBeLessThan(0.02);
    expect(Math.abs(feed.previa.height - stories.previa.height)).toBeLessThanOrEqual(1);
    await dialogo.getByRole('radio', { name: 'Os dois' }).click();
    await expect(feed.acao).toHaveAccessibleName('Baixar imagens (.zip)');
    const explicacao = dialogo.getByText(/^Sai um \.zip com duas imagens/);
    const e = await caixa(explicacao);
    const seletor = await caixa(dialogo.getByRole('radio', { name: 'Os dois' }));
    expect(e.y - (seletor.y + seletor.height)).toBeGreaterThanOrEqual(0);
    expect(e.y - (seletor.y + seletor.height)).toBeLessThanOrEqual(12);
    expect(await contraste(explicacao)).toBeGreaterThanOrEqual(4.5);
    const dois = await medirFolha(dialogo);
    for (const outro of [feed, dois]) {
      expect(Math.abs(outro.botao.x + outro.botao.width - (stories.botao.x + stories.botao.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(outro.botao.y - stories.botao.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(outro.formato.x - stories.formato.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(outro.formato.y - stories.formato.y)).toBeLessThanOrEqual(1);
    }

    // Fim da rolagem: o último controle aparece inteiro, acima do rodapé, sem nada por cima.
    await dialogo.evaluate((d) => {
      for (const no of d.querySelectorAll<HTMLElement>('div')) {
        if (no.scrollHeight > no.clientHeight + 1 && getComputedStyle(no).overflowY !== 'visible') no.scrollTop = no.scrollHeight;
      }
    });
    const interruptor = dialogo.getByRole('switch', { name: 'Com a logo da consultoria' });
    const fim = await caixa(interruptor);
    expect(fim.y + fim.height).toBeLessThanOrEqual((await medirFolha(dialogo)).topoDoRodape);
    expect(await semNadaPorCima(interruptor)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
  test(`sem autorização, o motivo aparece uma vez e a ação fica à vista em ${largura}px`, async ({ page }) => {
    const { errosDaPagina } = await abrirComparacao(page, { largura, altura, autorizadoEm: null });
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gerar imagem' });
    const acao = dialogo.getByRole('button', { name: 'Baixar imagem' });
    await expect(acao).toBeDisabled();
    await expect(dialogo.getByText(/autoriz/i)).toHaveCount(1);
    const motivo = dialogo.getByText(/^O aluno ainda não autorizou/);
    expect(await semNadaPorCima(motivo)).toBe(true);
    expect(await contraste(motivo)).toBeGreaterThanOrEqual(4.5);
    const b = await caixa(acao);
    expect(b.y + b.height).toBeLessThanOrEqual(altura);
    expect(errosDaPagina).toEqual([]);
  });

  test(`erro ao gerar aparece junto da ação, que não sai do lugar, em ${largura}px`, async ({ page }) => {
    const { errosDaPagina } = await abrirComparacao(page, {
      largura, altura, gerar: (_p, route) => json(route, { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível gerar a imagem.' }, 500),
    });
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gerar imagem' });
    const acao = dialogo.getByRole('button', { name: 'Baixar imagem' });
    const antes = await caixa(acao);
    await acao.click();
    const alerta = dialogo.getByRole('alert');
    await expect(alerta).toBeVisible();
    expect(await semNadaPorCima(alerta)).toBe(true);
    const depois = await caixa(acao);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(depois.x + depois.width - (antes.x + antes.width))).toBeLessThanOrEqual(1);
    expect(await semNadaPorCima(acao)).toBe(true);
    await expect(acao).toBeEnabled();
    expect(errosDaPagina).toEqual([]);
  });

  test(`autorização revogada ao gerar trava a ação com um motivo só em ${largura}px`, async ({ page }) => {
    const { errosDaPagina } = await abrirComparacao(page, {
      largura, altura,
      gerar: (_p, route) => json(route, { codigo: 'USO_DE_IMAGEM_NAO_AUTORIZADO', mensagem: 'O aluno não autorizou o uso das fotos.' }, 409),
    });
    await page.getByRole('button', { name: 'Gerar imagem' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gerar imagem' });
    await dialogo.getByRole('button', { name: 'Baixar imagem' }).click();
    await expect(dialogo.getByRole('button', { name: 'Baixar imagem' })).toBeDisabled();
    await expect(dialogo.getByText(/autoriz/i)).toHaveCount(1);
    await expect(dialogo.getByRole('alert')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });

  test(`carrossel com duas imagens mostra as prévias e a ação à vista em ${largura}px`, async ({ page }) => {
    const fotos: FotoDaLinha[] = ['a1', 'a2', 'b1', 'b2'].map((id, i) => ({
      fotoId: id, origem: 'ATUALIZACAO', origemId: id.startsWith('a') ? 'u1' : 'u2', data: id.startsWith('a') ? '2026-01-01' : '2026-02-20',
      perguntaId: 'fotos', posicao: 'Fotos em jejum', ordem: i % 2, pesoKg: 80,
    }));
    const { errosDaPagina } = await abrirComparacao(page, { largura, altura, fotos });
    await page.getByRole('button', { name: 'Gerar carrossel' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Gerar carrossel' });
    const previas = dialogo.getByLabel('Prévia da imagem');
    await expect(previas).toHaveCount(2);
    const [p1, p2] = await Promise.all((await previas.all()).map(caixa));
    expect(Math.abs(p1.y - p2.y)).toBeLessThanOrEqual(1);
    expect(p2.x).toBeGreaterThan(p1.x + p1.width);
    const acao = dialogo.getByRole('button', { name: 'Baixar imagens (.zip)' });
    expect(await semNadaPorCima(acao)).toBe(true);
    expect(p1.y + p1.height).toBeLessThanOrEqual((await caixa(acao)).y);
    await dialogo.getByRole('radio', { name: 'Os dois' }).click();
    await expect(dialogo.getByText(/^Sai um \.zip com 2 imagens em cada pasta/)).toBeVisible();
    expect(errosDaPagina).toEqual([]);
  });
}

test('no formato, o foco do teclado é distinto da opção marcada', async ({ page }) => {
  await abrirComparacao(page, { largura: 1280, altura: 900 });
  await page.getByRole('button', { name: 'Gerar imagem' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Gerar imagem' });
  const stories = dialogo.getByRole('radio', { name: 'Stories' });
  const feed = dialogo.getByRole('radio', { name: 'Feed retrato' });
  await stories.click();
  await page.keyboard.press('ArrowRight');
  await expect(feed).toBeFocused();
  await expect(feed).toHaveAttribute('aria-checked', 'false');
  await expect(stories).toHaveAttribute('aria-checked', 'true');
  const estilo = (l: Locator) => l.evaluate((e) => {
    const s = getComputedStyle(e);
    return { foco: e.matches(':focus-visible'), contorno: s.outlineStyle, fundo: s.backgroundColor };
  });
  const focado = await estilo(feed);
  const marcado = await estilo(stories);
  expect(focado.foco).toBe(true);
  expect(focado.contorno).not.toBe('none');
  expect(marcado.contorno).toBe('none');
  expect(focado.fundo).not.toBe(marcado.fundo);
  // Marcado pelo mouse e com o ponteiro longe: a seleção invertida não depende do hover.
  await feed.click();
  await page.mouse.move(0, 0);
  await expect(feed).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await estilo(feed)).fundo).toBe(marcado.fundo);
  expect(await contraste(feed.locator('div[dir="auto"]').first())).toBeGreaterThanOrEqual(4.5);
});
