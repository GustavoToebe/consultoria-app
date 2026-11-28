import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Exercicio, Modalidade } from '../src/api/tipos';
import { paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Biblioteca › Exercícios, painel "Filtros de exercícios" (pedido de 27/11): folha média de 800 px no PC (a `BarraDeFiltros`
 * com `painelLateral.largura`, que a `AbaExercicios` passa) em duas colunas, Grupo muscular à esquerda; a lista de grupos em
 * duas colunas com a linha agrupada ("Panturrilha" + "Panturrilhas") e o ⓘ; marcar a linha vai à API com os dois nomes;
 * no celular tudo empilha. Só dados fictícios. Capturas com `E2E_CAPTURAS` (1280 e 390, escuro e claro, dois grupos marcados).
 */
const BASE = process.env.E2E_CAPTURAS;
type Tema = 'ESCURO' | 'CLARO';
const ex = (n: number, nome: string, grupoMuscular: string, modalidade: Modalidade): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000227`, nome, grupoMuscular, equipamento: null, modalidade,
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
});
const LISTA: Exercicio[] = [
  ex(1, 'Gêmeos sentado fictício', 'Panturrilhas', 'MAQUINA'),
  ex(2, 'Panturrilha no leg fictícia', 'Panturrilhas', 'MAQUINA'),
  ex(3, 'Panturrilha em pé fictícia', 'Panturrilha', 'LIVRE'),
  ex(4, 'Supino reto fictício', 'Peito', 'LIVRE'),
  ex(5, 'Crucifixo fictício', 'Peito', 'MAQUINA'),
  ex(6, 'Remada baixa fictícia', 'Costas', 'MAQUINA'),
  ex(7, 'Rosca direta fictícia', 'Bíceps', 'LIVRE'),
  ex(8, 'Prancha fictícia', 'Abdômen', 'PESO_CORPORAL'),
];

async function abrirBiblioteca(page: Page, largura: number, tema: Tema = 'ESCURO') {
  await page.setViewportSize({ width: largura, height: largura >= 1280 ? 900 : 844 });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [TREINADOR.id, tema] as const);
  const consultas: string[] = [];
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(LISTA, consultas),
    'GET /exercicios': { corpo: LISTA },
  });
  await page.goto('/treinador/biblioteca?aba=exercicios');
  await expect(page.getByText(LISTA[0].nome, { exact: true })).toBeVisible();
  return { ...api, consultas };
}

const painelDe = (page: Page) => page.getByRole('dialog', { name: 'Filtros de exercícios' });
const caixa = async (l: Locator) => (await l.boundingBox())!;
const captura = async (page: Page, nome: string) => { if (BASE) await page.screenshot({ path: `${BASE}/${nome}.png` }); };

for (const largura of [1280, 390]) {
  test(`Biblioteca em ${largura} px: painel em duas colunas (PC) ou empilhado, linha agrupada e os dois nomes na API`, async ({ page }) => {
    const { naoTratadas, errosDaPagina, consultas } = await abrirBiblioteca(page, largura);
    await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
    const painel = painelDe(page);
    const grupos = painel.getByRole('group', { name: 'Grupo muscular' });
    const modalidade = painel.getByRole('group', { name: 'Modalidade' });
    // As contagens chegam com a lista inteira (buscada ao abrir).
    const panturrilha = grupos.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios', exact: true });
    await expect(panturrilha).toBeVisible();
    const g = await caixa(grupos);
    const m = await caixa(modalidade);
    if (largura === 1280) {
      expect((await caixa(painel)).width).toBeGreaterThan(760);
      expect(m.x).toBeGreaterThan(g.x + g.width - 1);
    } else {
      expect(m.y).toBeGreaterThanOrEqual(g.y + g.height - 1);
    }
    // Ordem alfabética, uma linha por grupo (a contagem fica no nome falado e, à vista, à direita).
    await expect(grupos.getByRole('checkbox')).toHaveText(['Abdômen', 'Bíceps', 'Costas', 'Panturrilha', 'Peito']);
    await grupos.getByRole('button', { name: 'Variações de Panturrilha' }).click();
    await expect(grupos.getByText('Panturrilha 1 · Panturrilhas 2', { exact: true })).toBeVisible();
    await panturrilha.click();
    await grupos.getByRole('checkbox', { name: 'Peito, 2 exercícios', exact: true }).click();
    await captura(page, `biblioteca-filtros-exercicios-${largura}-escuro`);
    await expect(painel.getByRole('button', { name: 'Limpar filtros' })).toBeVisible();
    await expect(painel.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await painel.getByRole('button', { name: 'Mostrar 5 exercícios' }).click();
    await expect(page.getByRole('button', { name: 'Tirar filtro: Grupo muscular: Panturrilha, Panturrilhas, Peito' })).toBeVisible();
    // O filtro enviado continua sendo a lista dos nomes reais.
    await expect.poll(() => new URLSearchParams(consultas.at(-1) ?? '').getAll('grupo').sort()).toEqual(['Panturrilha', 'Panturrilhas', 'Peito']);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const tema of ['ESCURO', 'CLARO'] as const) {
  for (const largura of [1280, 390]) {
    test(`captura do painel da Biblioteca ${largura} ${tema.toLowerCase()}`, async ({ page }) => {
      test.skip(!BASE, 'só com E2E_CAPTURAS');
      await abrirBiblioteca(page, largura, tema);
      await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
      const grupos = painelDe(page).getByRole('group', { name: 'Grupo muscular' });
      await grupos.getByRole('checkbox', { name: 'Panturrilha, 3 exercícios', exact: true }).click();
      await grupos.getByRole('checkbox', { name: 'Peito, 2 exercícios', exact: true }).click();
      await captura(page, `biblioteca-filtros-exercicios-${largura}-${tema.toLowerCase()}-marcados`);
    });
  }
}
