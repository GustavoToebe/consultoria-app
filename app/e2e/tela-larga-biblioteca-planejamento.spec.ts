import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Alimento, CatalogoExercicio, ConteudoDieta, ErgogenicoDaBiblioteca, Exercicio, ItemDieta, PastaModelo, Receita, Refeicao, TipoReceita } from '../src/api/tipos';
import { fixarHoje } from './aluno';
import { json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';
import { BIBLIOTECA, conteudoDoPlano } from './editor-inspetor.dados';
import { pngDeCor } from './imagens-falsas';

/**
 * Tela larga: revisão (24/11) da Biblioteca (todas as abas) e do Planejamento (listas de modelos e editores de treino,
 * dieta, mobilidade e pacote) em 1920, 2560 e 3440 px com o menu aberto. Confere por geometria que o espaço extra vira
 * colunas e que nada passa do limite; com `CAPTURAS_TELA_LARGA_BP=<pasta>` grava as capturas (`<tela>/<FASE>/<largura>.png`,
 * `FASE` = antes|depois). Só dados fictícios.
 */

const PASTA = process.env.CAPTURAS_TELA_LARGA_BP;
const FASE = process.env.FASE ?? 'depois';
const LARGURAS = [[1920, 1080], [2560, 1440], [3440, 1440]] as const;

const PERMISSOES = [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR',
  'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'ALUNO_LER', 'TREINO_LER', 'TREINO_ALTERAR', 'DIETA_LER', 'DIETA_ALTERAR'];

// ---- Biblioteca ----
const GRUPOS_EX = ['Peito', 'Costas', 'Ombro', 'Quadríceps', 'Posterior', 'Bíceps', 'Tríceps', 'Glúteo'];
const EXERCICIOS: Exercicio[] = Array.from({ length: 40 }, (_, i) => ({
  id: `e${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`,
  nome: `${['Supino', 'Remada', 'Desenvolvimento', 'Agachamento', 'Stiff', 'Rosca', 'Tríceps', 'Elevação'][i % 8]} fictício ${i + 1}`,
  grupoMuscular: GRUPOS_EX[i % 8], equipamento: i % 3 === 0 ? 'Barra' : 'Halteres', modalidade: 'LIVRE', videoUrl: null, observacoes: null,
  origem: i % 2 ? 'CATALOGO' : 'MANUAL', imagens: i % 2 ? [`Foto_${i}/0.jpg`, `Foto_${i}/1.jpg`] : [], imagemPropriaEm: null,
}));

const alimento = (n: number, nome: string, kcal: number | null, p: number | null, c: number | null, g: number | null, grupo: string | null = 'Cereais'): Alimento => ({
  id: `f${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`, nome, baseQuantidade: 100, baseUnidade: 'g', kcal, proteina: p, carboidrato: c, gordura: g,
  fibra: n % 3 ? 2.1 : null, gramasPorUnidade: null, fonte: null, origem: n % 2 ? 'CATALOGO' : 'MANUAL', fatorCorrecao: null, fatorCoccao: null, grupo,
});
const ALIMENTOS: Alimento[] = Array.from({ length: 24 }, (_, i) => alimento(i + 1, `Alimento fictício ${String(i + 1).padStart(2, '0')}`, 100 + i * 10, 5 + i, 20 + i, 2 + (i % 5), ['Cereais', 'Carnes', 'Frutas', 'Laticínios'][i % 4]));
const SUPLEMENTOS: Alimento[] = Array.from({ length: 8 }, (_, i) => ({
  ...alimento(100 + i, `Suplemento fictício ${i + 1}`, null, null, null, null, null), tipo: 'SUPLEMENTO', marca: 'Marca fictícia',
  porcao: '30 g', link: i % 2 ? 'https://exemplo.com/produto' : null, cupom: i % 3 ? null : 'CUPOM10', sabores: [], porcoesPorEmbalagem: null,
}));
const ergo = (n: number, nome: string, categoria: string | null): ErgogenicoDaBiblioteca => ({
  id: `g${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`, categoria, nome, principioAtivo: 'Princípio fictício', concentracao: '10 mg', apresentacao: 'Comprimido', observacao: null,
});
const ERGOGENICOS: ErgogenicoDaBiblioteca[] = [
  ...['A', 'B', 'C', 'D'].map((l, i) => ergo(i + 1, `Item fictício ${l}`, 'Medicamentos')),
  ...['E', 'F', 'G'].map((l, i) => ergo(i + 10, `Item fictício ${l}`, 'Injetáveis')),
  ...['H', 'I'].map((l, i) => ergo(i + 20, `Item fictício ${l}`, null)),
];
const CATALOGO: CatalogoExercicio[] = Array.from({ length: 30 }, (_, i) => ({
  id: `c${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`, nome: `Exercício do catálogo ${i + 1}`, grupoMuscular: GRUPOS_EX[i % 8],
  equipamento: 'Halteres', modalidade: 'LIVRE', instrucoes: null, fonte: null, imagens: [`Foto_${i}/0.jpg`, `Foto_${i}/1.jpg`],
}));
const FOTO = pngDeCor(16, [60, 90, 140]);

// ---- Planejamento ----
const COLECOES: PastaModelo[] = [
  { id: 'p0000000-0000-4000-8000-000000000001', nome: 'Hipertrofia', versao: 1 },
  { id: 'p0000000-0000-4000-8000-000000000002', nome: 'Iniciantes', versao: 1 },
  { id: 'p0000000-0000-4000-8000-000000000003', nome: 'Força', versao: 1 },
];
let seq = 0;
const modelo = (tipo: TipoReceita, nome: string, pastaId: string | null, conteudo: unknown = null, descricao: string | null = 'Modelo fictício para a revisão da tela larga.'): Receita =>
  ({ id: `r0000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, tipo, origem: 'CONSULTORIA', nome, descricao, conteudo, ordem: seq, pastaId, versao: 1 });

const ARROZ: Alimento = alimento(900, 'Arroz fictício', 128, 2.5, 28, 0.2);
const PAO: Alimento = alimento(901, 'Pão fictício', 266, 8.4, 49.6, 3.2);
const item = (uid: string, a: Alimento, q: number): ItemDieta => ({
  uid, alimentoId: a.id, nome: a.nome, quantidade: q, unidade: 'g', kcal: (a.kcal ?? 0) * q / 100, proteina: (a.proteina ?? 0) * q / 100,
  carboidrato: (a.carboidrato ?? 0) * q / 100, gordura: (a.gordura ?? 0) * q / 100, manual: false,
});
const REFEICOES: Refeicao[] = [
  { uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null, modoDePreparo: null, opcoes: [{ uid: 'cafe-a', rotulo: 'A', itens: [item('c1', PAO, 50)] }] },
  { uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null, modoDePreparo: null, opcoes: [
    { uid: 'almoco-a', rotulo: 'A', itens: [item('a1', ARROZ, 150), item('a2', PAO, 30)] },
    { uid: 'almoco-b', rotulo: 'B', itens: [item('a3', PAO, 80)] },
  ] },
];
const DIETA: ConteudoDieta = { objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null, aguaLitros: null, refeicoes: REFEICOES, variacoes: [] };
const MOBILIDADE = { orientacoes: 'Antes do treino.', secoes: [
  { uid: 's1', titulo: 'Aquecimento', itens: [{ uid: 'i1', nome: 'Gato-vaca', prescricao: '2 x 10', videoUrl: null }, { uid: 'i2', nome: 'Lunge', prescricao: '2 x 20s cada lado', videoUrl: null }] },
  { uid: 's2', titulo: 'Alongamento', itens: [{ uid: 'i3', nome: 'Posterior', prescricao: '30s', videoUrl: null }] },
] };
const TREINO = conteudoDoPlano(false);

const [HIP, INI, FOR] = COLECOES.map((c) => c.id);
const M_TREINO = modelo('PLANO_TREINO', 'Semana fictícia de força', FOR, TREINO);
const M_DIETA = modelo('PLANO_DIETA', 'Dieta fictícia base', HIP, DIETA);
const M_MOB = modelo('MOBILIDADE', 'Mobilidade fictícia geral', INI, MOBILIDADE);
const M_PACOTE = modelo('PASTA_PLANO', 'Pacote fictício inicial', INI, { planos: [
  { titulo: 'Semana fictícia de força', treino: TREINO, dieta: null, mobilidade: null },
  { titulo: 'Dieta fictícia base', treino: null, dieta: DIETA, mobilidade: null },
  { titulo: 'Mobilidade fictícia geral', treino: null, dieta: null, mobilidade: MOBILIDADE },
] });
const MODELOS: Receita[] = [
  M_TREINO, M_DIETA, M_MOB, M_PACOTE,
  ...Array.from({ length: 11 }, (_, i) => modelo('PLANO_TREINO', `Semana fictícia ${i + 1}`, [HIP, INI, FOR, null][i % 4], TREINO, i % 2 ? null : 'Treino de quatro dias, foco em membros inferiores.')),
  ...Array.from({ length: 5 }, (_, i) => modelo('PLANO_DIETA', `Dieta fictícia ${i + 1}`, [HIP, null][i % 2], DIETA)),
  ...Array.from({ length: 3 }, (_, i) => modelo('MOBILIDADE', `Mobilidade fictícia ${i + 1}`, [INI, null][i % 2], MOBILIDADE)),
  ...Array.from({ length: 3 }, (_, i) => modelo('PASTA_PLANO', `Pacote fictício ${i + 1}`, null, { planos: [] })),
];
const POUCOS: Receita[] = [M_TREINO, modelo('PLANO_TREINO', 'Semana fictícia única', FOR, TREINO)];

async function preparar(page: Page, largura: number, altura: number, { poucos = false, tema = 'ESCURO', tamanhoTexto = 'PADRAO', larguraConteudo = 'AUTOMATICA' }: { poucos?: boolean; tema?: string; tamanhoTexto?: string; larguraConteudo?: string } = {}) {
  await page.setViewportSize({ width: largura, height: altura });
  await fixarHoje(page);
  await page.addInitScript(([id, t, texto, largura]) => {
    try { localStorage.removeItem('menu-lateral-recolhido'); localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t, tamanhoTexto: texto, larguraConteudo: largura })); } catch { /* sem armazenamento */ }
  }, [TREINADOR.id, tema, tamanhoTexto, larguraConteudo] as const);
  await page.route((url) => url.pathname.startsWith('/catalogo/exercicios/'), (route) => route.fulfill({ status: 200, contentType: 'image/png', body: FOTO }));
  const modelos = poucos ? POUCOS : MODELOS;
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: PERMISSOES })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(poucos ? EXERCICIOS.slice(0, 3) : EXERCICIOS),
    'GET /exercicios': { corpo: BIBLIOTECA },
    'GET /alimentos': (pedido: PedidoFalso, route) => json(route, pedido.busca.get('tipo') === 'SUPLEMENTO' ? (poucos ? SUPLEMENTOS.slice(0, 1) : SUPLEMENTOS) : (poucos ? ALIMENTOS.slice(0, 2) : ALIMENTOS)),
    'GET /alimentos/fatores': { corpo: [] },
    'GET /ergogenicos': { corpo: poucos ? ERGOGENICOS.slice(0, 1) : ERGOGENICOS },
    'GET /catalogo/exercicios/grupos': { corpo: GRUPOS_EX },
    'GET /catalogo/exercicios': { corpo: { itens: poucos ? CATALOGO.slice(0, 2) : CATALOGO, total: poucos ? 2 : 412 } },
    'GET /catalogo/alimentos/grupos': { corpo: ['Cereais', 'Frutas'] },
    'GET /catalogo/alimentos': { corpo: { itens: [], total: 0 } },
    'GET /receitas': (pedido: PedidoFalso, route) => { const t = pedido.busca.get('tipo'); return json(route, t ? modelos.filter((m) => m.tipo === t) : modelos); },
    'GET /pastas-modelos': { corpo: COLECOES },
    'GET /receitas/{id}': (pedido: PedidoFalso, route) => json(route, MODELOS.find((m) => pedido.caminho.endsWith(m.id)) ?? M_TREINO),
  });
}

async function capturar(page: Page, tela: string, largura: number | string, fase = FASE) {
  if (!PASTA) return;
  const pasta = path.join(PASTA, tela, fase);
  fs.mkdirSync(pasta, { recursive: true });
  // Abrir as coleções rola a página: a captura começa do topo.
  await page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(pasta, `${largura}.png`) });
}

/** Abre todas as coleções recolhidas do tipo (nascem fechadas). */
async function abrirColecoes(page: Page) {
  // Espera as coleções chegarem (sem isso o laço acha zero fechadas e sai antes da hora).
  await expect(page.getByRole('button', { name: /, (recolhido|aberto)$/ }).first()).toBeVisible();
  for (;;) {
    const fechada = page.getByRole('button', { name: /, recolhido$/ }).first();
    if (!(await fechada.count())) return;
    await fechada.click();
  }
}

const TELAS: { nome: string; poucos?: boolean; abrir: (page: Page) => Promise<void> }[] = [
  { nome: 'biblioteca-exercicios', abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=exercicios'); await expect(p.getByText('Supino fictício 1', { exact: true })).toBeVisible(); } },
  { nome: 'biblioteca-exercicios-poucos', poucos: true, abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=exercicios'); await expect(p.getByText('Supino fictício 1', { exact: true })).toBeVisible(); } },
  { nome: 'biblioteca-alimentos', abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=alimentos'); await expect(p.getByText('Alimento fictício 01', { exact: true })).toBeVisible(); } },
  { nome: 'biblioteca-suplementos', abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=suplementos'); await expect(p.getByText('Suplemento fictício 1', { exact: true })).toBeVisible(); } },
  { nome: 'biblioteca-outros', abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=ergogenicos'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); await abrirColecoes(p); await expect(p.getByText('Item fictício A / Princípio fictício', { exact: true })).toBeVisible(); } },
  { nome: 'biblioteca-catalogo', abrir: async (p) => { await p.goto('/treinador/biblioteca?aba=catalogo'); await expect(p.getByText('Exercício do catálogo 1', { exact: true })).toBeVisible(); } },
  { nome: 'planejamento-treino', abrir: async (p) => { await p.goto('/treinador/planejamento?aba=treino'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); await abrirColecoes(p); await expect(p.getByText('Semana fictícia 1', { exact: true })).toBeVisible(); } },
  { nome: 'planejamento-treino-poucos', poucos: true, abrir: async (p) => { await p.goto('/treinador/planejamento?aba=treino'); await expect(p.getByText('Semana fictícia única', { exact: true })).toBeVisible(); } },
  { nome: 'planejamento-dieta', abrir: async (p) => { await p.goto('/treinador/planejamento?aba=dieta'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); await abrirColecoes(p); await expect(p.getByText('Dieta fictícia 1', { exact: true })).toBeVisible(); } },
  { nome: 'planejamento-mobilidade', abrir: async (p) => { await p.goto('/treinador/planejamento?aba=mobilidade'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); await abrirColecoes(p); await expect(p.getByText('Mobilidade fictícia 1', { exact: true })).toBeVisible(); } },
  { nome: 'planejamento-pacotes', abrir: async (p) => { await p.goto('/treinador/planejamento?aba=pacotes'); await expect(p.getByRole('heading', { level: 1 })).toBeVisible(); await abrirColecoes(p); await expect(p.getByText('Pacote fictício 1', { exact: true })).toBeVisible(); } },
  { nome: 'editor-modelo-treino', abrir: async (p) => { await p.goto(`/treinador/planejamento/modelo/${M_TREINO.id}`); await expect(p.getByRole('heading', { level: 1 })).toHaveText(M_TREINO.nome); await expect(p.locator('#inspetor-do-exercicio')).toBeVisible(); } },
  { nome: 'editor-modelo-dieta', abrir: async (p) => { await p.goto(`/treinador/planejamento/modelo/${M_DIETA.id}`); await expect(p.getByRole('heading', { name: /^Refeições \(/ })).toBeVisible(); } },
  { nome: 'editor-modelo-mobilidade', abrir: async (p) => { await p.goto(`/treinador/planejamento/modelo/${M_MOB.id}`); await expect(p.getByRole('heading', { name: 'Sobre o modelo' })).toBeVisible(); } },
  { nome: 'editor-modelo-pacote', abrir: async (p) => { await p.goto(`/treinador/planejamento/modelo/${M_PACOTE.id}`); await expect(p.getByRole('heading', { name: 'Planos do pacote' })).toBeVisible(); } },
];

test.describe('capturas (só com CAPTURAS_TELA_LARGA_BP)', () => {
  test.skip(!PASTA, 'sem pasta de capturas');
  for (const t of TELAS) {
    test(`captura ${t.nome}`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const [largura, altura] of LARGURAS) {
        await preparar(page, largura, altura, { poucos: t.poucos });
        await t.abrir(page);
        await capturar(page, t.nome, largura);
      }
    });
  }

  // Conferência das telas mexidas fora da tela larga: 1280 e 390, claro, Areia e texto grande (`<tela>/conferencia/`).
  const CONFERIR: { tela: string; largura: number; altura: number; tema: string; tamanhoTexto?: string }[] = [
    { tela: 'biblioteca-exercicios', largura: 1280, altura: 900, tema: 'ESCURO' },
    { tela: 'biblioteca-exercicios', largura: 390, altura: 844, tema: 'CLARO' },
    { tela: 'biblioteca-outros', largura: 1920, altura: 1080, tema: 'AREIA' },
    { tela: 'planejamento-treino', largura: 1280, altura: 900, tema: 'CLARO' },
    { tela: 'planejamento-treino', largura: 390, altura: 844, tema: 'ESCURO' },
    { tela: 'planejamento-treino', largura: 1920, altura: 1080, tema: 'ESCURO', tamanhoTexto: 'GRANDE' },
    { tela: 'biblioteca-alimentos', largura: 2560, altura: 1440, tema: 'AREIA', tamanhoTexto: 'GRANDE' },
    { tela: 'editor-modelo-dieta', largura: 1280, altura: 900, tema: 'AREIA' },
    { tela: 'editor-modelo-dieta', largura: 390, altura: 844, tema: 'ESCURO' },
    { tela: 'editor-modelo-mobilidade', largura: 1280, altura: 900, tema: 'ESCURO' },
    { tela: 'editor-modelo-mobilidade', largura: 390, altura: 844, tema: 'CLARO' },
  ];
  test('conferência em 1280 e 390, claro, Areia e texto grande', async ({ page }) => {
    test.setTimeout(240_000);
    for (const c of CONFERIR) {
      await preparar(page, c.largura, c.altura, { tema: c.tema, tamanhoTexto: c.tamanhoTexto });
      await TELAS.find((t) => t.nome === c.tela)!.abrir(page);
      await capturar(page, c.tela, `${c.largura}-${c.tema.toLowerCase()}${c.tamanhoTexto ? '-texto-grande' : ''}`, 'conferencia');
    }
  });
});

// ---- Geometria (sempre roda) ----

/** x distintos (arredondados) dos alvos: quantas colunas a lista tem. */
async function colunasDos(alvos: Locator): Promise<number> {
  const xs = await alvos.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  return new Set(xs).size;
}

async function semRolagemHorizontal(page: Page) {
  const { scroll, cliente } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, cliente: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(cliente);
}

/** Distância do começo do nome até o fim do botão da linha: a linha não estica além da coluna. */
async function comprimentoDaLinha(page: Page, nome: string, botao: Locator) {
  const texto = (await page.getByText(nome, { exact: true }).first().boundingBox())!;
  const acao = (await botao.boundingBox())!;
  return acao.x + acao.width - texto.x;
}

// Colunas esperadas com o menu aberto: 1280 continua em uma coluna; 1920 (faixa larga) ganha a 2ª; 2560 e 3440, três.
const ESPERADO = [[1280, 900, 1], [1920, 1080, 2], [2560, 1440, 3], [3440, 1440, 3]] as const;

for (const [largura, altura, colunas] of ESPERADO) {
  test(`${largura} px: Biblioteca e Planejamento em ${colunas} coluna(s), sem linha esticada nem campo além do teto`, async ({ page }) => {
    // tela larga: revisão (24/11)
    const { errosDaPagina } = await preparar(page, largura, altura);
    const assentado = (conferir: () => Promise<void>) => expect(conferir).toPass({ timeout: 10_000 });

    // Biblioteca › Exercícios: 30 linhas da página divididas em colunas; a linha mede no máximo a coluna.
    await page.goto('/treinador/biblioteca?aba=exercicios');
    await expect(page.getByText('Supino fictício 1', { exact: true })).toBeVisible();
    const editarExercicio = page.getByRole('button', { name: /^Editar .* fictício \d+$/ });
    await assentado(async () => {
      expect(await colunasDos(editarExercicio)).toBe(colunas);
      expect(await comprimentoDaLinha(page, 'Supino fictício 1', page.getByRole('button', { name: 'Editar Supino fictício 1', exact: true }))).toBeLessThan(1200);
    });
    await semRolagemHorizontal(page);

    // Biblioteca › Alimentos: o mesmo.
    await page.goto('/treinador/biblioteca?aba=alimentos');
    await expect(page.getByText('Alimento fictício 01', { exact: true })).toBeVisible();
    await assentado(async () => expect(await colunasDos(page.getByRole('button', { name: /^Editar Alimento fictício/ }))).toBe(colunas));

    // Planejamento › Treino: busca no teto da Biblioteca (480) e as linhas dos modelos em colunas dentro de cada coleção.
    await page.goto('/treinador/planejamento?aba=treino');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await abrirColecoes(page);
    await expect(page.getByText('Semana fictícia 1', { exact: true })).toBeVisible();
    const busca = (await page.getByLabel('Buscar modelo').boundingBox())!;
    expect(busca.width).toBeLessThanOrEqual(482);
    await assentado(async () => {
      expect(await colunasDos(page.getByRole('button', { name: 'Editar', exact: true }))).toBe(colunas);
      expect(await comprimentoDaLinha(page, 'Semana fictícia 1', page.getByRole('button', { name: 'Mais ações de Semana fictícia 1', exact: true }))).toBeLessThan(1200);
    });
    await semRolagemHorizontal(page);

    // Editor do modelo de dieta: o nome não passa de LARGURA_EDITOR (1040).
    await page.goto(`/treinador/planejamento/modelo/${M_DIETA.id}`);
    await expect(page.getByRole('heading', { name: /^Refeições \(/ })).toBeVisible();
    expect((await page.getByLabel('Nome do modelo').boundingBox())!.width).toBeLessThanOrEqual(1042);
    await semRolagemHorizontal(page);

    // Editor do modelo de mobilidade: Nome e Descrição juntos não passam de 1040.
    await page.goto(`/treinador/planejamento/modelo/${M_MOB.id}`);
    await expect(page.getByRole('heading', { name: 'Sobre o modelo' })).toBeVisible();
    const nome = (await page.getByLabel('Nome do modelo').boundingBox())!;
    const descricao = (await page.getByLabel('Descrição (opcional)').boundingBox())!;
    expect(descricao.x + descricao.width - nome.x).toBeLessThanOrEqual(1042);
    await semRolagemHorizontal(page);
    expect(errosDaPagina).toEqual([]);
  });
}

test('3440 px com poucos itens: as colunas ficam e a linha não estica (vaga vazia à direita)', async ({ page }) => {
  // tela larga: revisão (24/11)
  await preparar(page, 3440, 1440, { poucos: true });
  await page.goto('/treinador/planejamento?aba=treino');
  await expect(page.getByText('Semana fictícia única', { exact: true })).toBeVisible();
  await expect(async () => {
    expect(await colunasDos(page.getByRole('button', { name: 'Editar', exact: true }))).toBe(2);
    expect(await comprimentoDaLinha(page, 'Semana fictícia única', page.getByRole('button', { name: 'Mais ações de Semana fictícia única', exact: true }))).toBeLessThan(1200);
  }).toPass({ timeout: 10_000 });
  await page.goto('/treinador/biblioteca?aba=exercicios');
  await expect(page.getByText('Supino fictício 1', { exact: true })).toBeVisible();
  await expect(async () => {
    expect(await colunasDos(page.getByRole('button', { name: /^Editar .* fictício \d+$/ }))).toBe(3);
    expect(await comprimentoDaLinha(page, 'Supino fictício 1', page.getByRole('button', { name: 'Editar Supino fictício 1', exact: true }))).toBeLessThan(1200);
  }).toPass({ timeout: 10_000 });
});

test('390 px: os botões da busca do Planejamento quebram linha e "Nova semana de treino" não corta na borda', async ({ page }) => {
  // tela larga: revisão (24/11)
  await preparar(page, 390, 844);
  await page.goto('/treinador/planejamento?aba=treino');
  const nova = page.getByRole('button', { name: 'Nova semana de treino' });
  await expect(nova).toBeVisible();
  const caixa = (await nova.boundingBox())!;
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(390 - 16);
  await semRolagemHorizontal(page);
});

test('3440 px em "Limitada" (1800 px): a lista mede a si mesma (Biblioteca em 3 colunas de ~580, modelos do Planejamento em 2)', async ({ page }) => {
  // tela larga: revisão (24/11)
  await preparar(page, 3440, 1440, { larguraConteudo: 'LIMITADA' });
  await page.goto('/treinador/biblioteca?aba=exercicios');
  await expect(page.getByText('Supino fictício 1', { exact: true })).toBeVisible();
  await expect(async () => expect(await colunasDos(page.getByRole('button', { name: /^Editar .* fictício \d+$/ }))).toBe(3)).toPass({ timeout: 10_000 });
  await capturar(page, 'biblioteca-exercicios', '3440-escuro-limitada', 'conferencia');
  await page.goto('/treinador/planejamento?aba=treino');
  await abrirColecoes(page);
  await expect(page.getByText('Semana fictícia 1', { exact: true })).toBeVisible();
  await expect(async () => expect(await colunasDos(page.getByRole('button', { name: 'Editar', exact: true }))).toBe(2)).toPass({ timeout: 10_000 });
  await capturar(page, 'planejamento-treino', '3440-escuro-limitada', 'conferencia');
});
