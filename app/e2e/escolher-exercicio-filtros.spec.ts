import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Exercicio, Modalidade } from '../src/api/tipos';
import { exercicio as exercicioDoPlano, serie } from '../src/dominio/exemplosDeTreino.apoioTeste';
import { json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Etapa "Filtros de exercícios" da folha "Escolher exercício" (pedido de 27/11): folha média em duas colunas (Grupo muscular
 * à esquerda; Modalidade, Vídeo e Imagem à direita) que empilha quando o painel mede menos de 700 px; grupos numa lista de
 * duas colunas em ordem alfabética, com os marcados no topo; "Panturrilha" e "Panturrilhas" numa linha só, com o total e o
 * ⓘ das variações (teclado e toque); marcar a linha marca os dois nomes; a caixa mista quando só um está no filtro;
 * modalidades em chips seguidos que só quebram quando não cabem; Vídeo e Imagem lado a lado; o rodapé de sempre. Só dados fictícios. Capturas com
 * `E2E_CAPTURAS` (1280 e 390, escuro e claro, com dois grupos marcados).
 */
const BASE = process.env.E2E_CAPTURAS;
type Tema = 'ESCURO' | 'CLARO';
const ID = 'f0000000-0000-4000-8000-000000000127';
const ex = (n: number, nome: string, grupoMuscular: string, modalidade: Modalidade, p: Partial<Exercicio> = {}): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000127`, nome, grupoMuscular, equipamento: null, modalidade,
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null, ...p,
});
const GEMEOS = ex(1, 'Gêmeos sentado fictício', 'Panturrilhas', 'MAQUINA');
const LISTA: Exercicio[] = [
  GEMEOS,
  ex(2, 'Panturrilha no leg fictícia', 'Panturrilhas', 'MAQUINA', { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
  ex(3, 'Panturrilha em pé fictícia', 'Panturrilha', 'LIVRE'),
  ex(4, 'Supino reto fictício', 'Peito', 'LIVRE', { imagens: ['Supino/0.jpg'] }),
  ex(5, 'Crucifixo fictício', 'Peito', 'MAQUINA'),
  ex(6, 'Remada baixa fictícia', 'Costas', 'MAQUINA'),
  ex(7, 'Rosca direta fictícia', 'Bíceps', 'LIVRE'),
  ex(8, 'Prancha fictícia', 'Abdômen', 'PESO_CORPORAL'),
  ex(9, 'Elevação pélvica fictícia', 'Glúteos', 'ELASTICO'),
  ex(10, 'Desenvolvimento fictício', 'Ombros', 'LIVRE'),
  ex(11, 'Tríceps corda fictício', 'Tríceps', 'MAQUINA'),
];
/** As linhas da lista em ordem alfabética: 8 grupos (Panturrilha junta as duas variações), 4 em cada coluna. */
const LINHAS = ['Abdômen, 1 exercício', 'Bíceps, 1 exercício', 'Costas, 1 exercício', 'Glúteos, 1 exercício',
  'Ombros, 1 exercício', 'Panturrilha, 3 exercícios', 'Peito, 2 exercícios', 'Tríceps, 1 exercício'];

async function abrirEditor(page: Page, largura: number, tema: Tema = 'ESCURO') {
  await page.setViewportSize({ width: largura, height: largura >= 1280 ? 900 : 844 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const conteudo = { sessoes: [{ uid: 's1', nome: 'Treino A', exercicios: [exercicioDoPlano('x1', { exercicioId: GEMEOS.id, nome: GEMEOS.nome, modalidade: 'MAQUINA', series: [serie('a')] })] }] };
  const modelo = { id: ID, tipo: 'SESSAO_TREINO', nome: 'Dia de treino', descricao: null, conteudo, ordem: 0, pastaId: null, versao: 1 };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: LISTA },
    [`GET /receitas/${ID}`]: { corpo: modelo },
    [`PUT /receitas/${ID}`]: (pedido, route) => json(route, { ...modelo, conteudo: pedido.corpo, versao: 2 }),
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  await expect(page.getByRole('button', { name: 'Adicionar exercício' }).first()).toBeVisible();
  return api;
}

const folhaDe = (page: Page) => page.getByRole('dialog', { name: /^Escolher exercício/ });
const etapaDe = (page: Page) => page.getByRole('dialog', { name: 'Filtros de exercícios' });
const captura = async (page: Page, nome: string) => { if (BASE) await page.screenshot({ path: `${BASE}/${nome}.png` }); };
const caixa = async (l: Locator) => (await l.boundingBox())!;

/** Chips que quebram só quando não cabem: cada um que abre uma fileira nova não caberia no fim da anterior (vão de 6 px). */
async function quebraSoSeNaoCouber(grupo: Locator, chips: Locator) {
  const g = await caixa(grupo);
  const c = await Promise.all((await chips.all()).map(caixa));
  for (let i = 1; i < c.length; i++) {
    if (c[i].y > c[i - 1].y + 2) expect(c[i - 1].x + c[i - 1].width + 6 + c[i].width).toBeGreaterThan(g.x + g.width);
    else expect(Math.abs(c[i].y - c[i - 1].y)).toBeLessThan(2);
  }
}

async function abrirFiltrosDoAdicionar(page: Page) {
  await page.getByRole('button', { name: 'Adicionar exercício' }).first().click();
  await folhaDe(page).getByRole('button', { name: /^Filtros, / }).click();
  await expect(etapaDe(page)).toBeVisible();
  return etapaDe(page);
}

for (const largura of [1280, 390]) {
  test(`filtros de exercícios em ${largura} px: colunas, lista de grupos em 2 colunas, linha agrupada com ⓘ, chips e segmentos`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, largura);
    const etapa = await abrirFiltrosDoAdicionar(page);
    const grupos = etapa.getByRole('group', { name: 'Grupo muscular' });
    const modalidade = etapa.getByRole('group', { name: 'Modalidade' });
    const linhas = grupos.getByRole('checkbox');

    // Folha média: Grupo muscular à esquerda e o resto à direita no PC; empilhado no celular (o painel mede menos de 700).
    const g = await caixa(grupos);
    const m = await caixa(modalidade);
    if (largura === 1280) {
      expect(m.x).toBeGreaterThan(g.x + g.width - 1);
      expect(Math.abs(m.y - g.y)).toBeLessThan(4);
    } else {
      expect(m.y).toBeGreaterThanOrEqual(g.y + g.height - 1);
      expect(Math.abs(m.x - g.x)).toBeLessThan(4);
    }

    // Lista em ordem alfabética, lida de cima para baixo em duas colunas (4 + 4), linhas da mesma largura.
    await expect(linhas).toHaveCount(LINHAS.length);
    for (const [i, nome] of LINHAS.entries()) await expect(linhas.nth(i)).toHaveAccessibleName(nome);
    const primeira = await caixa(linhas.nth(0));
    const quinta = await caixa(linhas.nth(4));
    expect(quinta.x).toBeGreaterThan(primeira.x + 40);
    expect(Math.abs(quinta.y - primeira.y)).toBeLessThan(2);
    // Oito linhas (até 12, 28/11): sem a busca de grupo; a busca com mais de 12 fica em `folha-escolher-exercicio.spec.ts`.
    await expect(grupos.getByRole('textbox', { name: 'Buscar grupo' })).toHaveCount(0);

    // A linha agrupada: total somado e o ⓘ (botão próprio, por teclado e toque) com as variações.
    const info = grupos.getByRole('button', { name: 'Variações de Panturrilha' });
    await expect(info).toHaveAttribute('aria-expanded', 'false');
    await expect(grupos.getByRole('button', { name: /^Variações de / })).toHaveCount(1);
    await info.click();
    await expect(info).toHaveAttribute('aria-expanded', 'true');
    await expect(grupos.getByText('Panturrilha 1 · Panturrilhas 2', { exact: true })).toBeVisible();
    await info.focus();
    await page.keyboard.press('Enter');
    await expect(grupos.getByText('Panturrilha 1 · Panturrilhas 2', { exact: true })).toHaveCount(0);
    // O ⓘ não marca a linha.
    await expect(grupos.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios' })).toHaveAttribute('aria-checked', 'false');

    // Marcar a linha marca os dois nomes reais: "Mostrar 3 exercícios" e, depois de aplicar, o chip com os dois.
    await grupos.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios' }).click();
    await expect(grupos.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios' })).toHaveAttribute('aria-checked', 'true');
    await expect(etapa.getByRole('button', { name: 'Mostrar 3 exercícios' })).toBeVisible();
    await grupos.getByRole('checkbox', { name: 'Peito, 2 exercícios' }).click();

    // Modalidade em chips compactos (bolinha, nome e contagem) seguidos na linha, quebrando só quando o próximo não cabe.
    const chips = modalidade.getByRole('checkbox');
    await expect(chips).toHaveCount(4);
    await expect(chips.nth(0)).toHaveAccessibleName('Peso livre, 4 exercícios');
    await quebraSoSeNaoCouber(modalidade, chips);
    // Vídeo e Imagem na mesma linha (também no celular), cada um com Todos · Com · Sem.
    const video = await caixa(etapa.getByRole('radiogroup', { name: 'Vídeo' }));
    const imagem = await caixa(etapa.getByRole('radiogroup', { name: 'Imagem' }));
    expect(Math.abs(video.y - imagem.y)).toBeLessThan(2);
    expect(imagem.x).toBeGreaterThan(video.x + video.width - 1);
    for (const nome of ['Vídeo', 'Imagem']) {
      await expect(etapa.getByRole('radiogroup', { name: nome }).getByRole('radio')).toHaveText(['Todos', 'Com', 'Sem']);
    }

    // O rodapé de sempre.
    await expect(etapa.getByRole('button', { name: 'Limpar filtros' })).toBeVisible();
    await expect(etapa.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await etapa.getByRole('button', { name: 'Mostrar 5 exercícios' }).click();
    const folha = folhaDe(page);
    await expect(folha.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Panturrilha, Panturrilhas, Peito' })).toBeVisible();
    await expect(folha.getByRole('listbox').getByRole('option')).toHaveCount(5);

    // Reabrindo, os marcados sobem para o topo (em ordem alfabética entre eles) e o resto segue a ordem de antes.
    await folha.getByRole('button', { name: /^Filtros, / }).click();
    await expect(linhas.nth(0)).toHaveAccessibleName('Panturrilha, 3 exercícios');
    await expect(linhas.nth(1)).toHaveAccessibleName('Peito, 2 exercícios');
    await expect(linhas.nth(2)).toHaveAccessibleName('Abdômen, 1 exercício');
    // Desmarcar uma linha no meio do caminho não a tira do lugar.
    await linhas.nth(0).click();
    await expect(linhas.nth(0)).toHaveAccessibleName('Panturrilha, 3 exercícios');
    await expect(linhas.nth(0)).toHaveAttribute('aria-checked', 'false');
    await etapa.getByRole('button', { name: 'Cancelar' }).click();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

test('trocar: o pré-filtro de uma variação deixa a linha agrupada mista, no topo, e tocar nela marca as duas', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrirEditor(page, 1280);
  const trocar = page.getByRole('button', { name: `Trocar exercício: ${GEMEOS.nome}` });
  if (!(await trocar.first().isVisible())) await page.getByText(GEMEOS.nome, { exact: true }).first().click();
  await trocar.first().click();
  const folha = folhaDe(page);
  await expect(folha.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Panturrilhas' })).toBeVisible();
  await folha.getByRole('button', { name: /^Filtros, / }).click();
  const linha = etapaDe(page).getByRole('group', { name: 'Grupo muscular' }).getByRole('checkbox').first();
  await expect(linha).toHaveAccessibleName('Panturrilha, 3 exercícios');
  await expect(linha).toHaveAttribute('aria-checked', 'mixed');
  await expect(etapaDe(page).getByRole('button', { name: 'Mostrar 2 exercícios' })).toBeVisible();
  await linha.click();
  await expect(linha).toHaveAttribute('aria-checked', 'true');
  await expect(etapaDe(page).getByRole('button', { name: 'Mostrar 3 exercícios' })).toBeVisible();
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

// Capturas (só com E2E_CAPTURAS): a etapa de filtros com dois grupos marcados, em 1280 e 390, escuro e claro.
for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1280, 390]) {
    test(`captura da etapa de filtros ${largura} ${tema.toLowerCase()}`, async ({ page }) => {
      test.skip(!BASE, 'só com E2E_CAPTURAS');
      await abrirEditor(page, largura, tema);
      const etapa = await abrirFiltrosDoAdicionar(page);
      await etapa.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios' }).click();
      await etapa.getByRole('checkbox', { name: 'Peito, 2 exercícios' }).click();
      await etapa.getByRole('button', { name: 'Variações de Panturrilha' }).click();
      await captura(page, `escolher-exercicio-filtros-${largura}-${tema.toLowerCase()}`);
    });
  }
}
