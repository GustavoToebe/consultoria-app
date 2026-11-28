import { expect, test, type Page } from '@playwright/test';

import type { Exercicio, Modalidade } from '../src/api/tipos';
import { exercicio as exercicioDoPlano, serie } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { erroApi, json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';
import { pngDeCor } from './imagens-falsas';

/**
 * Folha "Escolher exercício" (trocar e adicionar, item 9 de 27/11) igual à Biblioteca › Exercícios: a mesma linha (miniatura,
 * nome, "● Modalidade · Grupo", ícones), a legenda, o painel de filtros (grupo em vários chips com a contagem, modalidade,
 * vídeo e imagem; "Mostrar N exercícios"), o pré-filtro da troca pelo grupo do atual (chip que se tira), a linha "Atual",
 * o teclado (↑↓ e Enter na lista a partir da busca) e a linha "Usar “…” como exercício manual" quando a busca não acha nada.
 * Só dados fictícios. Capturas com `E2E_CAPTURAS`.
 */
const BASE = process.env.E2E_CAPTURAS;
type Tema = 'ESCURO' | 'CLARO';
const FOTO = pngDeCor(16, [60, 120, 200]);
const ID = 'f0000000-0000-4000-8000-000000000027';
const ex = (n: number, nome: string, grupoMuscular: string | null, modalidade: Modalidade, p: Partial<Exercicio> = {}): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000027`, nome, grupoMuscular, equipamento: null, modalidade,
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null, ...p,
});
const SUPINO = ex(1, 'Supino reto fictício', 'Peito', 'LIVRE', { equipamento: 'Barra', videoUrl: 'https://youtu.be/dQw4w9WgXcQ', imagens: ['Supino/0.jpg'] });
const CRUCIFIXO = ex(2, 'Crucifixo na máquina fictício', 'Peito', 'MAQUINA', { imagens: ['Crucifixo/0.jpg'] });
const REMADA = ex(3, 'Remada baixa fictícia', 'Costas', 'MAQUINA', { equipamento: 'Polia' });
const LISTA: Exercicio[] = [
  SUPINO, CRUCIFIXO, REMADA,
  ex(4, 'Elevação lateral fictícia', 'Ombros', 'LIVRE', { equipamento: 'Halteres' }),
  ex(5, 'Rosca martelo fictícia', 'Bíceps', 'LIVRE'),
  ex(6, 'Tríceps na polia fictício', 'Tríceps', 'MAQUINA'),
  ex(7, 'Agachamento livre fictício', 'Quadríceps', 'LIVRE', { equipamento: 'Barra' }),
  ex(8, 'Stiff fictício', 'Posterior', 'LIVRE'),
  ex(9, 'Elevação pélvica fictícia', 'Glúteos', 'LIVRE'),
  ex(10, 'Panturrilha em pé fictícia', 'Panturrilha', 'MAQUINA'),
  ex(11, 'Prancha fictícia', 'Abdômen', 'PESO_CORPORAL'),
  ex(12, 'Encolhimento fictício', 'Trapézio', 'LIVRE'),
  ex(13, 'Rosca de punho fictícia', 'Antebraço', 'LIVRE'),
  ex(14, 'Cadeira abdutora fictícia', 'Abdutores', 'MAQUINA'),
  ex(15, 'Esteira fictícia', 'Cardio', 'CARDIO'),
  ex(16, 'Mini band lateral fictícia', 'Glúteos', 'ELASTICO'),
  ex(17, 'Supino inclinado fictício', 'Peito', 'LIVRE', { equipamento: 'Halteres' }),
];

async function preparar(page: Page, largura: number, tema: Tema, extra: RespostasApi) {
  await page.setViewportSize({ width: largura, height: largura >= 1920 ? 1080 : largura >= 1280 ? 900 : 844 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  await page.route('**/catalogo/exercicios/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: FOTO }));
  return simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    ...extra,
  });
}

/** Editor de modelo com o supino da biblioteca na sessão (para trocar) e o botão de adicionar. */
async function abrirEditor(page: Page, largura: number, tema: Tema = 'ESCURO', exercicios: RespostasApi[string] = { corpo: LISTA }) {
  const conteudo = { sessoes: [{ uid: 's1', nome: 'Treino A', exercicios: [exercicioDoPlano('x1', { exercicioId: SUPINO.id, nome: SUPINO.nome, modalidade: 'LIVRE', series: [serie('a')] })] }] };
  const modelo = { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo, ordem: 0, pastaId: null, versao: 1 };
  const api = await preparar(page, largura, tema, {
    'GET /exercicios': exercicios,
    [`GET /receitas/${ID}`]: { corpo: modelo },
    [`PUT /receitas/${ID}`]: (pedido, route) => json(route, { ...modelo, conteudo: pedido.corpo, versao: 2 }),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  await expect(page.getByRole('button', { name: 'Adicionar exercício' }).first()).toBeVisible();
  return api;
}

const folhaDe = (page: Page) => page.getByRole('dialog', { name: 'Escolher exercício' });
const opcoes = (page: Page) => folhaDe(page).getByRole('listbox').getByRole('option');
const captura = async (page: Page, nome: string) => { if (BASE) await page.screenshot({ path: `${BASE}/${nome}.png` }); };

async function abrirTroca(page: Page) {
  const trocar = page.getByRole('button', { name: `Trocar exercício: ${SUPINO.nome}` });
  if (!(await trocar.first().isVisible())) await page.getByText(SUPINO.nome, { exact: true }).first().click();
  await trocar.first().click();
  await expect(folhaDe(page)).toBeVisible();
}

for (const largura of [1280, 390]) {
  test(`trocar: pré-filtro pelo grupo do atual (chip que se tira), "Atual" marcado, ↑↓ e Enter trocam (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, largura);
    await abrirTroca(page);
    const folha = folhaDe(page);
    // Só o grupo do supino, com o chip removível; a linha dele traz "Atual" e começa ativa.
    await expect(folha.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' })).toBeVisible();
    await expect(opcoes(page)).toHaveCount(3);
    await expect(folha.getByRole('option', { name: /Supino reto fictício.*atual$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(folha.getByText('Atual', { exact: true })).toBeVisible();
    await expect(folha.getByText('Peso livre · Peito · Barra', { exact: true })).toBeVisible();
    await expect(folha.getByRole('list', { name: 'Cores das modalidades' }).getByRole('listitem')).toHaveText(['Peso livre', 'Máquina']);
    // A busca controla a lista: ↓ anda (aria-activedescendant) e Enter escolhe.
    const busca = folha.getByRole('textbox', { name: 'Buscar na biblioteca' });
    await busca.focus();
    await page.keyboard.press('ArrowDown');
    await expect(opcoes(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    const ativa = await opcoes(page).nth(1).getAttribute('id');
    await expect(busca).toHaveAttribute('aria-activedescendant', ativa!);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(opcoes(page).nth(2)).toHaveAttribute('aria-selected', 'true');
    // O ✕ do chip tira o pré-filtro: a biblioteca inteira volta.
    await folha.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Peito' }).click();
    await expect(opcoes(page)).toHaveCount(LISTA.length);
    await busca.fill('remada');
    // Com resultado na lista, não há a linha do manual (só quando a busca não acha nada).
    await expect(opcoes(page)).toHaveCount(1);
    await expect(folhaDe(page).getByRole('option', { name: /^Usar só o nome/ })).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(folha).toHaveCount(0);
    await expect(page.getByText(REMADA.nome).first()).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`adicionar: sem resultado a última linha é "Usar “…” como exercício manual"; erro e vazio (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, largura);
    await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
    const folha = folhaDe(page);
    await expect(folha.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    // Marcar pela linha e pelo teclado (Enter marca na escolha de vários).
    await folha.getByRole('option', { name: /^Crucifixo na máquina fictício/ }).click();
    await expect(folha.getByRole('option', { name: /^Crucifixo na máquina fictício/ })).toHaveAttribute('aria-selected', 'true');
    const busca = folha.getByRole('textbox', { name: 'Buscar na biblioteca' });
    await busca.fill('agachamento');
    await page.keyboard.press('Enter');
    await expect(folha.getByRole('button', { name: 'Adicionar 2 exercícios' })).toBeEnabled();
    await busca.fill('Flexão diamante');
    await expect(folha.getByText('Nenhum exercício com “Flexão diamante” na biblioteca.')).toBeVisible();
    await expect(opcoes(page)).toHaveCount(1);
    await expect(folha.getByText('Usar “Flexão diamante” como exercício manual', { exact: true })).toBeVisible();
    await captura(page, `adicionar-sem-resultado-${largura}-escuro`);
    await opcoes(page).first().click();
    await expect(folha).toHaveCount(0);
    for (const nome of ['Crucifixo na máquina fictício', 'Agachamento livre fictício', 'Flexão diamante']) await expect(page.getByText(nome).first()).toBeVisible();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('adicionar: erro da API com "Tentar de novo" e a biblioteca vazia ainda deixam usar o nome digitado', async ({ page }) => {
  let falhar = true;
  const { errosDaPagina } = await abrirEditor(page, 1280, 'ESCURO', (_p, route) => {
    if (falhar) { const e = erroApi(500, 'Falha simulada.'); return json(route, e.corpo, e.status); }
    return json(route, []);
  });
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  const folha = folhaDe(page);
  await expect(folha.getByRole('button', { name: /Tentar de novo/ })).toBeVisible();
  await captura(page, 'adicionar-erro-1280-escuro');
  falhar = false;
  await folha.getByRole('button', { name: /Tentar de novo/ }).click();
  await expect(folha.getByText(/A biblioteca está vazia/)).toBeVisible();
  await folha.getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Burpee');
  await expect(folha.getByText('Usar “Burpee” como exercício manual', { exact: true })).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});

test('folha: a etapa de filtros tem os chips de grupo com a contagem, a busca de grupo e "Mostrar N exercícios"', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, 1280);
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  await folhaDe(page).getByRole('button', { name: /^Filtros, / }).click();
  const etapa = page.getByRole('dialog', { name: 'Filtros de exercícios' });
  // 14 grupos (mais que 12): a busca no topo; ordem alfabética; a contagem é falada.
  await expect(etapa.getByRole('textbox', { name: 'Buscar grupo' })).toBeVisible();
  const chips = etapa.getByRole('group', { name: 'Grupo muscular' }).getByRole('checkbox');
  await expect(chips.first()).toHaveAccessibleName('Abdômen, 1 exercício');
  await expect(etapa.getByRole('checkbox', { name: 'Peito, 3 exercícios' })).toBeVisible();
  await expect(etapa.getByRole('button', { name: `Mostrar ${LISTA.length} exercícios` })).toBeVisible();
  await etapa.getByRole('checkbox', { name: 'Peito, 3 exercícios' }).click();
  await etapa.getByRole('checkbox', { name: 'Costas, 1 exercício' }).click();
  await etapa.getByRole('radiogroup', { name: 'Imagem' }).getByRole('radio', { name: 'Com' }).click();
  await expect(etapa.getByRole('button', { name: 'Mostrar 2 exercícios' })).toBeVisible();
  // A busca de grupo nunca esconde os marcados.
  await etapa.getByRole('textbox', { name: 'Buscar grupo' }).fill('abd');
  await expect(chips).toHaveCount(4);
  await captura(page, 'folha-filtros-1280-escuro');
  await etapa.getByRole('button', { name: 'Mostrar 2 exercícios' }).click();
  await expect(opcoes(page)).toHaveCount(2);
  await expect(folhaDe(page).getByRole('button', { name: 'Filtros, 2 ligados' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

/** Biblioteca › Exercícios: a página filtra no servidor; a lista inteira só vem ao abrir os filtros (contagens e "Mostrar N"). */
async function abrirBiblioteca(page: Page, largura: number, tema: Tema) {
  const api = await preparar(page, largura, tema, {
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(LISTA),
    'GET /exercicios': { corpo: LISTA },
  });
  await page.goto('/treinador/biblioteca?aba=exercicios');
  await expect(page.getByText(LISTA[0].nome, { exact: true })).toBeVisible();
  return api;
}

test('Biblioteca: o painel novo (chips de grupo com contagem, segmentos e "Mostrar N exercícios") filtra a lista', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirBiblioteca(page, 1280, 'ESCURO');
  await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
  const painel = page.getByRole('dialog', { name: 'Filtros de exercícios' });
  await expect(painel.getByRole('checkbox', { name: 'Glúteos, 2 exercícios' })).toBeVisible();
  await painel.getByRole('checkbox', { name: 'Glúteos, 2 exercícios' }).click();
  await painel.getByRole('checkbox', { name: 'Peito, 3 exercícios' }).click();
  await painel.getByRole('group', { name: 'Modalidade' }).getByRole('checkbox', { name: 'Peso livre' }).click();
  await expect(painel.getByRole('button', { name: 'Mostrar 3 exercícios' })).toBeVisible();
  await painel.getByRole('button', { name: 'Mostrar 3 exercícios' }).click();
  await expect(page.getByRole('button', { name: 'Filtros, 2 ligados' })).toBeVisible();
  await expect(page.getByText(REMADA.nome, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Elevação pélvica fictícia', { exact: true })).toBeVisible();
  // Com a busca, "Mostrar N" conta como o servidor (nome e grupo, sem o equipamento): "barra" não acha nada aqui.
  await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('supino');
  await expect(page.getByText(CRUCIFIXO.nome, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Filtros, 2 ligados' }).click();
  await expect(painel.getByRole('button', { name: 'Mostrar 2 exercícios' })).toBeVisible();
  await painel.getByRole('button', { name: 'Mostrar 2 exercícios' }).click();
  await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('barra');
  await page.getByRole('button', { name: 'Filtros, 2 ligados' }).click();
  await expect(painel.getByRole('button', { name: 'Mostrar 0 exercícios' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// Capturas (só com E2E_CAPTURAS): troca com o pré-filtro, a etapa de filtros da folha e o painel da Biblioteca, em 1280 e
// 1920, escuro e claro; e 390 da troca.
for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1280, 1920, 390]) {
    test(`capturas ${largura} ${tema.toLowerCase()}`, async ({ page }) => {
      test.skip(!BASE, 'só com E2E_CAPTURAS');
      const t = tema.toLowerCase();
      await abrirEditor(page, largura, tema);
      await abrirTroca(page);
      await captura(page, `trocar-prefiltro-${largura}-${t}`);
      if (largura === 390) return;
      await folhaDe(page).getByRole('button', { name: 'Fechar' }).click();
      await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
      await folhaDe(page).getByRole('button', { name: /^Filtros, / }).click();
      await captura(page, `folha-filtros-${largura}-${t}`);
      await page.getByRole('dialog', { name: 'Filtros de exercícios' }).getByRole('button', { name: 'Cancelar' }).click();
      await folhaDe(page).getByRole('textbox', { name: 'Buscar na biblioteca' }).fill('Flexão diamante');
      await expect(folhaDe(page).getByText('Usar “Flexão diamante” como exercício manual', { exact: true })).toBeVisible();
      await captura(page, `adicionar-sem-resultado-${largura}-${t}`);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await abrirBiblioteca(page, largura, tema);
      await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
      await expect(page.getByRole('dialog', { name: 'Filtros de exercícios' }).getByRole('checkbox', { name: 'Peito, 3 exercícios' })).toBeVisible();
      await captura(page, `biblioteca-filtros-${largura}-${t}`);
      await page.keyboard.press('Escape');
      await captura(page, `biblioteca-lista-${largura}-${t}`);
    });
  }
}
