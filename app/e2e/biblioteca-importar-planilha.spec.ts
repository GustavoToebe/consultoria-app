import { expect, test, type Page } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, paginaDeExerciciosFalsa, sessao, simularApi, TREINADOR, type RespostasApi } from './api-falsa';

/**
 * Biblioteca e a importação por planilha (25/11): o link "Importar da sua planilha" saiu de baixo do título (a Importação
 * segue no menu lateral e em Configurações › Dados). Só o estado vazio de verdade (nenhum item na biblioteca) oferece o
 * link secundário "Importar de planilha", e só a quem pode importar para aquela lista; busca ou filtro sem resultado leva a
 * limpar. Em 390 e 1280. Só dados fictícios.
 */
const VAZIO: RespostasApi = {
  'GET /inscricoes': { corpo: { itens: [], total: 0 } },
  'GET /exercicios/pagina': { corpo: { itens: [], total: 0, grupos: [] } },
  'GET /alimentos': { corpo: [] },
  'GET /ergogenicos': { corpo: [] },
};
const PODE_IMPORTAR = [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'ERGOGENICO_LER', 'ERGOGENICO_ALTERAR'];

const EXERCICIOS: Exercicio[] = ['Remada baixa', 'Rosca direta'].map((nome, i) => ({
  id: `e${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`, nome, grupoMuscular: 'Costas',
  equipamento: null, modalidade: 'LIVRE', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
}));

async function abrir(page: Page, caminho: string, permissoes: string[], extra: RespostasApi = {}) {
  const api = await simularApi(page, { ...(await sessao(page, TREINADOR, { permissoes })), ...VAZIO, ...extra });
  await page.goto(caminho);
  return api;
}

const LINK = (page: Page) => page.getByRole('link', { name: 'Importar de planilha' });
const ABAS = [
  ['Exercícios', '/treinador/biblioteca?aba=exercicios', 'Biblioteca de exercícios vazia'],
  ['Alimentos', '/treinador/biblioteca?aba=alimentos', 'Biblioteca de alimentos vazia'],
  ['Suplementos', '/treinador/biblioteca?aba=suplementos', 'Biblioteca de suplementos vazia'],
  ['Outros', '/treinador/biblioteca?aba=ergogenicos', 'Biblioteca vazia'],
] as const;

for (const [nome, largura, altura] of [['PC 1280', 1280, 900], ['celular 390', 390, 844]] as const) {
  test.describe(nome, () => {
    test.use({ viewport: { width: largura, height: altura } });

    test('sem o link "Importar da sua planilha" sob o título, nem com itens na lista', async ({ page }) => {
      const { naoTratadas, errosDaPagina } = await abrir(page, '/treinador/biblioteca', PODE_IMPORTAR, {
        'GET /exercicios/pagina': paginaDeExerciciosFalsa(EXERCICIOS, []),
      });
      await expect(page.getByText('Remada baixa', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: /Importar da sua planilha/ })).toHaveCount(0);
      await expect(LINK(page)).toHaveCount(0);
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });

    for (const [aba, caminho, titulo] of ABAS) {
      test(`${aba} vazia: link secundário leva à Importação`, async ({ page }) => {
        await abrir(page, caminho, PODE_IMPORTAR);
        await expect(page.getByText(titulo, { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: /Importar da sua planilha/ })).toHaveCount(0);
        await expect(LINK(page)).toBeVisible();
        await LINK(page).click();
        await expect(page).toHaveURL(/\/treinador\/importacao$/);
      });
    }

    test('sem permissão de importar para a biblioteca, o estado vazio não oferece o link', async ({ page }) => {
      await abrir(page, '/treinador/biblioteca?aba=exercicios', [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER']);
      await expect(page.getByText('Biblioteca de exercícios vazia', { exact: true })).toBeVisible();
      await expect(LINK(page)).toHaveCount(0);
    });

    test('busca sem resultado não é biblioteca vazia: sem o link, com "Limpar busca"', async ({ page }) => {
      await abrir(page, '/treinador/biblioteca?aba=alimentos', PODE_IMPORTAR, {
        'GET /alimentos': { corpo: [{
          id: 'a0000001-0000-4000-8000-000000000000', nome: 'Arroz cozido', tipo: 'ALIMENTO', unidade: 'GRAMA', quantidadeBase: 100,
          kcal: 128, proteina: 2.5, carboidrato: 28, gordura: 0.2, fibra: null, gramasPorUnidade: null, fonte: null, fc: null, fcc: null,
          grupo: null, origem: 'MANUAL', ativo: true, marca: null, categoria: null, porcao: null, porcoes: null, sabores: null, link: null, cupom: null,
        }] },
      });
      await expect(page.getByText('Arroz cozido', { exact: true }).first()).toBeVisible();
      await page.getByLabel('Buscar alimento').fill('zzzz');
      await expect(page.getByText('Nenhum alimento encontrado', { exact: true })).toBeVisible();
      await expect(LINK(page)).toHaveCount(0);
    });
  });
}
