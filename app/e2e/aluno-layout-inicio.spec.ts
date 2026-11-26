import { expect, test, type Locator, type Page } from '@playwright/test';

import type { CompromissoDoAluno } from '../src/api/agendaTipos';
import type { AnamneseDetalhe, Atualizacao } from '../src/api/tipos';
import type { ItemDaVitrineDoAluno } from '../src/api/vitrineTipos';
import { ALUNO, erroApi, sessao, simularApi, type RespostasApi } from './api-falsa';
import { dietaFalsa, fixarHoje, sessaoDeAlunoComTreino, SESSOES_COM_DIAS } from './aluno';

/**
 * Início do aluno na web larga (26/11, `docs/planos/aluno-web-layout.md` seção 1, `dominio/arranjoDoInicio.inicioLargoDoAluno`):
 * da área de 952 em diante, no teto de 1312: no topo a `PrincipalComApoio` (Hoje → Dieta → compromissos | pendências → Água)
 * e, embaixo, na largura toda, Sua semana · Seu nível, o mapa do ano e a vitrine por último, com o "Ver tudo" no cabeçalho do
 * cartão. Sem pendências a Água sobe sozinha e o Hoje não cresce. O celular (390) não muda. Só dados fictícios.
 * Com `CAPTURAS_INICIO=<pasta>` também grava as capturas da matriz (fora do git).
 */

const VITRINE: ItemDaVitrineDoAluno[] = [1, 2].map((n) => ({
  id: `v0000000-0000-4000-8000-00000000000${n}`, nome: `Item fictício ${n}`, descricao: 'Descrição fictícia.', tipo: 'FISICO',
  precoCentavos: null, precoVigenteCentavos: null, especialAte: null, cupom: null, linkUrl: null, temFoto: false, fotoAtualizadaEm: null, categoria: null,
}));
const ANAMNESE = {
  id: 'n0000000-0000-4000-8000-000000000001', alunoId: 'a0000000-0000-4000-8000-000000000002', nomeAluno: null, situacao: 'PENDENTE',
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001', questionarioVersaoNumero: 1, questionarioNome: null, modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: {}, atribuidaEm: '2026-10-18T12:00:00Z', atribuidaPorNome: null, enviadaEm: null, revisadaEm: null, revisadaPorNome: null,
  dispensadaEm: null, dispensadaPorNome: null, alteracoes: [], dispensaMotivo: null, versao: 1,
} as AnamneseDetalhe;
const ATUALIZACAO_ATRASADA = {
  id: 'z0000000-0000-4000-8000-000000000001', pastaId: 'p0000000-0000-4000-8000-000000000001', alunoId: 'a0000000-0000-4000-8000-000000000002', nomeAluno: null,
  dataAtualizacao: '2026-10-17', fase: 'ABERTA', diasParaData: -2, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 1,
  questionarioVersaoId: 'v0000000-0000-4000-8000-000000000001', questionarioNome: null, modelo: { formato: 2, instrucoes: [], secoes: [] },
  respostas: null, enviadaEm: null, feedback: null, versao: 1, resumo: null,
} as Atualizacao;
const compromisso = (id: string, data: string, hora: string): CompromissoDoAluno => {
  const inicio = new Date(`${data}T${hora}:00-03:00`);
  return { id, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 3600_000).toISOString(), data, hora, horaFim: `${Number(hora.slice(0, 2)) + 1}:00`,
    duracaoMinutos: 60, local: 'Sala 2', situacao: 'AGENDADO', responsavelNome: 'Treinadora Teste', lembretesMinutos: [30] };
};

interface Cenario {
  largura: number;
  altura?: number;
  tema?: 'ESCURO' | 'CLARO';
  minimizado?: boolean;
  retorno?: boolean;
  pendencias?: boolean;
  compromissos?: boolean;
  vitrine?: boolean;
  dieta?: 'ok' | 'erro';
}

async function abrir(page: Page, c: Cenario) {
  const { largura, altura = 1080, tema = 'ESCURO', minimizado = false, retorno = true, pendencias = true, compromissos = true, vitrine = true, dieta = 'ok' } = c;
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t, min]) => {
    try {
      localStorage.removeItem('menu-lateral-recolhido');
      if (min) localStorage.setItem('menu-lateral-recolhido', '1');
      localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t }));
    } catch { /* sem armazenamento */ }
  }, [ALUNO.id, tema, minimizado] as const);
  await fixarHoje(page);
  const respostas: RespostasApi = {
    ...(await sessaoDeAlunoComTreino(page, SESSOES_COM_DIAS)),
    ...(await sessao(page, ALUNO, { retornoHabilitado: retorno, vitrineHabilitada: vitrine })),
    'GET /aluno/dieta': dieta === 'erro' ? erroApi(503, 'Servidor fora do ar.') : { corpo: dietaFalsa(5, 3) },
    'GET /aluno/atualizacao': pendencias ? { corpo: ATUALIZACAO_ATRASADA } : erroApi(404, 'Nenhuma atualização.', 'NAO_ENCONTRADO'),
    'GET /aluno/atualizacoes': { corpo: [] },
    'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } },
    ...(pendencias ? { 'GET /aluno/anamnese': { corpo: ANAMNESE } } : {}),
    ...(compromissos ? { 'GET /aluno/compromissos': { corpo: [compromisso('k1', '2026-10-21', '10:00'), compromisso('k2', '2026-10-28', '18:00')] } } : {}),
    ...(vitrine ? { 'GET /aluno/vitrine': { corpo: VITRINE } } : {}),
  };
  const api = await simularApi(page, respostas);
  await page.goto('/aluno');
  return api;
}

const caixa = async (l: Locator) => {
  await expect(l).toBeVisible();
  let b: Awaited<ReturnType<Locator['boundingBox']>> = null;
  await expect.poll(async () => (b = await l.boundingBox()) !== null).toBe(true);
  return b!;
};
const cartaoCom = (page: Page, dentro: Locator) => page.getByTestId('cartao').filter({ has: dentro });
const grade = (page: Page) => page.getByLabel(/^Mapa de treinos:/);
const titulo = (page: Page, nome: string) => page.getByRole('heading', { name: nome, exact: true });
const semRolagemDeLado = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const ranking = (pedidos: { metodo: string; caminho: string }[]) => pedidos.filter((p) => p.metodo === 'GET' && p.caminho === '/aluno/comunidade/ranking');
const dentro = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;

/** Espera o arranjo final: pendências (se houver), nível, mapa e vitrine chegaram. */
async function assentar(page: Page, o: { pendencias?: boolean; retorno?: boolean; vitrine?: boolean } = {}) {
  const { pendencias = true, retorno = true, vitrine = true } = o;
  await expect(titulo(page, 'Hoje')).toBeVisible();
  if (pendencias) await expect(titulo(page, 'Suas pendências')).toBeVisible();
  if (retorno) { await expect(page.getByText(/^Nível \d/)).toBeVisible(); await expect(grade(page)).toBeVisible(); }
  if (vitrine) await expect(page.getByText('Item fictício 1')).toBeVisible();
}

const apoio = (page: Page) => page.getByRole('complementary', { name: 'Pendências e água de hoje' });

for (const largura of [1280, 1920, 2560]) {
  test(`${largura} com tudo: Hoje, Dieta e compromissos com pendências e Água ao lado; semana · nível, o mapa e a vitrine por último, no teto de 1312`, async ({ page }) => {
    const { errosDaPagina, pedidos } = await abrir(page, { largura });
    await assentar(page);
    const [h, ver, d, comp, ap, pend, ag, princ, sem, niv, m, v] = await Promise.all([
      titulo(page, 'Hoje'), page.getByRole('button', { name: /^Ver meu treino/ }), page.getByRole('link', { name: /^Dieta,/ }), titulo(page, 'Seus compromissos'),
      apoio(page), titulo(page, 'Suas pendências'), cartaoCom(page, titulo(page, 'Água de hoje')), page.getByTestId('inicio-principal'),
      cartaoCom(page, titulo(page, 'Sua semana')), cartaoCom(page, titulo(page, 'Seu nível')), cartaoCom(page, grade(page)), cartaoCom(page, titulo(page, 'Vitrine')),
    ].map(caixa));
    const fim = m.x + m.width;
    // Topo: a principal (Hoje → Dieta → compromissos) e o apoio da peça (360, vão de 32) com pendências → Água.
    expect(Math.abs(ap.width - 360)).toBeLessThan(2);
    expect(Math.abs(princ.x + princ.width + 32 - ap.x)).toBeLessThan(2);
    expect(Math.abs(ap.x + ap.width - fim)).toBeLessThan(2);
    expect(Math.abs(pend.y - h.y)).toBeLessThan(4);
    expect(dentro(pend, ap)).toBe(true);
    expect(dentro(ag, ap)).toBe(true);
    expect(ag.y).toBeGreaterThan(pend.y);
    expect(Math.abs(d.x - h.x)).toBeLessThan(2);
    expect(d.y).toBeGreaterThan(ver.y);
    expect(comp.y).toBeGreaterThan(d.y);
    expect(Math.abs(comp.x - h.x)).toBeLessThan(2);
    // Embaixo, na largura toda: semana e nível na mesma linha e da mesma altura; o mapa; a vitrine por último.
    expect(sem.y).toBeGreaterThan(Math.max(princ.y + princ.height, ag.y + ag.height));
    expect(Math.abs(sem.x - h.x)).toBeLessThan(2);
    expect(Math.abs(sem.y - niv.y)).toBeLessThan(2);
    expect(Math.abs(sem.height - niv.height)).toBeLessThan(2);
    expect(Math.abs(m.x - h.x)).toBeLessThan(2);
    expect(Math.abs(fim - (niv.x + niv.width))).toBeLessThan(2);
    expect(m.y).toBeGreaterThan(sem.y + sem.height);
    expect(v.y).toBeGreaterThan(m.y + m.height);
    expect(Math.abs(v.width - m.width)).toBeLessThan(2);
    // O mapa ocupa o cartão (a célula encolhe para caber, nunca 1/3 vazio).
    const g = await caixa(grade(page));
    expect((g.x + g.width - m.x) / m.width).toBeGreaterThan(0.9);
    // "Ver tudo" dentro do cabeçalho do cartão da vitrine, os dois itens lado a lado.
    expect(dentro(await caixa(page.getByRole('button', { name: 'Ver tudo da vitrine' })), v)).toBe(true);
    const [i1, i2] = await Promise.all([page.getByTestId(`inicio-vitrine-${VITRINE[0].id}`), page.getByTestId(`inicio-vitrine-${VITRINE[1].id}`)].map(caixa));
    expect(Math.abs(i1.y - i2.y)).toBeLessThan(2);
    // Teto único das telas do aluno: 1312.
    expect(m.width).toBeLessThanOrEqual(1312 + 1);
    expect(ranking(pedidos)).toHaveLength(1);
    expect(await semRolagemDeLado(page)).toBe(true);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920 sem pendências: a Água sobe sozinha para a altura do Hoje, que não cresce; a Dieta continua sob o Hoje', async ({ page }) => {
  await abrir(page, { largura: 1920, pendencias: false, compromissos: false });
  await assentar(page, { pendencias: false });
  await expect(titulo(page, 'Suas pendências')).toHaveCount(0);
  const [h, ver, d, ap, ag, princ, m] = await Promise.all([
    titulo(page, 'Hoje'), page.getByRole('button', { name: /^Ver meu treino/ }), page.getByRole('link', { name: /^Dieta,/ }),
    apoio(page), cartaoCom(page, titulo(page, 'Água de hoje')), page.getByTestId('inicio-principal'), cartaoCom(page, grade(page)),
  ].map(caixa));
  expect(ag.y).toBeLessThan(ver.y);
  expect(dentro(ag, ap)).toBe(true);
  expect(Math.abs(princ.width - (m.width - 32 - 360))).toBeLessThan(2);
  expect(Math.abs(d.x - h.x)).toBeLessThan(2);
  expect(d.y).toBeGreaterThan(ver.y);
});

for (const largura of [1280, 1920]) {
  test(`${largura} com erro ao carregar a dieta: o aviso e o "Tentar de novo" ficam no lugar da Dieta, sob o Hoje`, async ({ page }) => {
    const { errosDaPagina } = await abrir(page, { largura, dieta: 'erro' });
    await assentar(page);
    const aviso = await caixa(page.getByText('Não foi possível carregar a dieta.'));
    const [ver, ap, sem] = await Promise.all([page.getByRole('button', { name: /^Ver meu treino/ }), apoio(page), titulo(page, 'Sua semana')].map(caixa));
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    expect(aviso.y).toBeGreaterThan(ver.y);
    expect(aviso.x).toBeLessThan(ap.x);
    expect(sem.y).toBeGreaterThan(aviso.y);
    // Sem meta de água (a dieta não veio): o apoio fica só com as pendências.
    await expect(titulo(page, 'Água de hoje')).toHaveCount(0);
    expect(errosDaPagina).toEqual([]);
  });
}

test('1920 sem o retorno: sem mapa nem nível; a semana sozinha na metade da linha e a vitrine por último', async ({ page }) => {
  await abrir(page, { largura: 1920, retorno: false });
  await assentar(page, { retorno: false });
  await expect(titulo(page, 'Seu nível')).toHaveCount(0);
  await expect(grade(page)).toHaveCount(0);
  const [sem, v] = await Promise.all([cartaoCom(page, titulo(page, 'Sua semana')), cartaoCom(page, titulo(page, 'Vitrine'))].map(caixa));
  expect(Math.abs(sem.width - (v.width - 32) / 2)).toBeLessThan(4);
  expect(v.y).toBeGreaterThan(sem.y + sem.height);
  expect(v.width).toBeLessThanOrEqual(1312 + 1);
});

test('390: o celular não muda (uma coluna: Hoje → Dieta → Água → pendências → compromissos → semana → nível → mapa → vitrine)', async ({ page }) => {
  const { errosDaPagina, pedidos } = await abrir(page, { largura: 390, altura: 844 });
  await assentar(page);
  const caixas = await Promise.all([
    titulo(page, 'Hoje'), page.getByRole('link', { name: /^Dieta,/ }), titulo(page, 'Água de hoje'), titulo(page, 'Suas pendências'),
    titulo(page, 'Seus compromissos'), titulo(page, 'Sua semana'), titulo(page, 'Seu nível'), grade(page), titulo(page, 'Vitrine'),
  ].map(caixa));
  const ys = caixas.map((c) => c.y);
  expect(ys).toEqual([...ys].sort((x, y) => x - y));
  const xs = caixas.slice(0, 7).map((c) => Math.round(c.x));
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(20);
  expect(ranking(pedidos)).toHaveLength(1);
  expect(await semRolagemDeLado(page)).toBe(true);
  expect(errosDaPagina).toEqual([]);
});

// Capturas da matriz (orientações de 26/11, 0.5): só com `CAPTURAS_INICIO`, numa pasta fora do git.
const PASTA = process.env.CAPTURAS_INICIO;
const MATRIZ: Cenario[] = [
  { largura: 390, altura: 844 }, { largura: 390, altura: 844, tema: 'CLARO' },
  { largura: 1024, altura: 768 }, { largura: 1024, altura: 768, minimizado: true },
  { largura: 1280, altura: 720 }, { largura: 1280, altura: 720, tema: 'CLARO' },
  { largura: 1536, altura: 864 }, { largura: 1920 }, { largura: 1920, tema: 'CLARO' },
  { largura: 2560, altura: 1440 }, { largura: 3440, altura: 1440 },
  { largura: 1920, pendencias: false, compromissos: false }, { largura: 1280, altura: 720, pendencias: false, compromissos: false, vitrine: false },
  { largura: 1920, dieta: 'erro' }, { largura: 1920, retorno: false },
];
for (const c of MATRIZ) {
  const nome = [c.largura, c.tema ?? 'ESCURO', c.minimizado && 'minimizado', c.pendencias === false && 'sem-pendencias', c.dieta === 'erro' && 'erro-dieta',
    c.retorno === false && 'sem-retorno', c.vitrine === false && 'sem-vitrine'].filter(Boolean).join('-');
  test(`captura ${nome}`, async ({ page }) => {
    test.skip(!PASTA, 'só com CAPTURAS_INICIO');
    await abrir(page, c);
    await expect(titulo(page, 'Hoje')).toBeVisible();
    if (c.retorno !== false) await expect(grade(page)).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true });
  });
}
