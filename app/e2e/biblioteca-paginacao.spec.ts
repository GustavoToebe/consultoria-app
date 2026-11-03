import { expect, test } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { PERMISSOES_TREINADOR, paginaDeExerciciosFalsa, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Biblioteca › Exercícios: a lista vem em páginas de 30 do servidor, com a busca (sem acento) e o filtro de grupo
 * feitos lá, e o seletor de grupos não encolhe com o filtro. Só dados fictícios.
 */
const NOMES = Array.from({ length: 65 }, (_, i) => `Elevação ${String(i + 1).padStart(2, '0')}`);
const TODOS: Exercicio[] = NOMES.map((nome, i) => ({
  id: `e${String(i + 1).padStart(7, '0')}-0000-4000-8000-000000000000`, nome, grupoMuscular: i < 40 ? 'Ombro' : 'Costas',
  equipamento: null, modalidade: 'LIVRE', videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null,
}));

for (const largura of [390, 1280]) {
  test(`exercícios da biblioteca: páginas de 30, busca sem acento e grupo no servidor (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const consultas: string[] = [];
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /exercicios/pagina': paginaDeExerciciosFalsa(TODOS, consultas),
    });
    await page.goto('/treinador/biblioteca');

    // Primeira página: 30 de 65, sem "Anterior".
    await expect(page.getByText('Elevação 30', { exact: true })).toBeVisible();
    await expect(page.getByText('Elevação 31', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Página 1 de 3 · 65 exercícios')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Editar Elevação/ })).toHaveCount(30);
    // Aceite do C8: as 30 linhas somam menos de 3.000 px (do topo da primeira ao fim da última).
    const primeira = (await page.getByRole('button', { name: 'Editar Elevação 01' }).boundingBox())!;
    const ultima = (await page.getByRole('button', { name: 'Editar Elevação 30' }).boundingBox())!;
    expect(ultima.y + ultima.height - primeira.y).toBeLessThan(3000);

    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText('Elevação 31', { exact: true })).toBeVisible();
    await expect(page.getByText('Elevação 30', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Página 2 de 3 · 65 exercícios')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText('Elevação 65', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    // Busca sem acento, no servidor: volta à primeira página e some a paginação (6 resultados).
    await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('elevacao 6');
    await expect(page.getByText('Elevação 60', { exact: true })).toBeVisible();
    await expect(page.getByText('Elevação 31', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Página \d de/)).toHaveCount(0);
    expect(consultas.at(-1)).toContain('busca=elevacao+6');
    expect(consultas.at(-1)).toContain('pagina=0');

    // O filtro de grupo não tira os grupos do seletor.
    await page.getByRole('textbox', { name: 'Buscar exercício' }).fill('');
    await page.getByRole('button', { name: 'Filtros, nenhum ligado' }).click();
    await page.getByRole('button', { name: 'Grupo muscular: Todos os grupos. Escolher.' }).click();
    const painel = page.getByRole('dialog', { name: 'Grupo muscular' });
    await painel.getByRole('checkbox', { name: 'Costas' }).click();
    await expect(painel.getByRole('checkbox', { name: 'Ombro' })).toBeVisible();
    await page.keyboard.press('Escape');
    // No celular os filtros ficam numa Folha e só valem ao tocar em "Ver resultado".
    const verResultado = page.getByRole('button', { name: 'Ver resultado' });
    if (await verResultado.isVisible()) await verResultado.click();
    await expect(page.getByText('Elevação 41', { exact: true })).toBeVisible();
    await expect(page.getByText('Elevação 40', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Página 1 de 1')).toHaveCount(0);
    expect(consultas.at(-1)).toContain('grupo=Costas');

    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
