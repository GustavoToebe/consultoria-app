import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, VersaoDetalhe } from '../src/api/tipos';
import { simularApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * Impressão sem diálogo real: o `window.print` é trocado por um stub e o `afterprint` é disparado (ou não) pelo teste,
 * como o navegador faz ao imprimir ou ao cancelar. O diálogo de verdade não é automatizável.
 */
const CONTEUDO: ConteudoDieta = {
  objetivo: null,
  dataInicio: null,
  profissional: null,
  refeicoes: [
    {
      uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null,
      opcoes: [{
        uid: 'cafe-a', rotulo: 'A',
        itens: [{
          uid: 'ovo', alimentoId: 'ovo', nome: 'Ovo', quantidade: 2, unidade: 'un', kcal: null, proteina: null, carboidrato: null,
          gordura: null, manual: false, fatorCorrecao: null, fatorCoccao: null,
        }],
      }],
    },
  ],
  orientacoes: [],
  observacoes: null,
  suplementacao: [],
  ergogenicos: null,
  aguaLitros: null,
};

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001',
  planoId: 'p0000000-0000-4000-8000-000000000001',
  numero: 2,
  titulo: 'Dieta de teste',
  inicio: '2026-10-01',
  fim: '2026-10-31',
  publicadoEm: '2026-10-01T12:00:00Z',
  conteudo: CONTEUDO,
};

async function abrir(page: Page, aoImprimir: 'afterprint' | 'cancelar') {
  await page.addInitScript((modo) => {
    (window as unknown as { __impressoes: number }).__impressoes = 0;
    window.print = () => {
      (window as unknown as { __impressoes: number }).__impressoes += 1;
      if (modo === 'afterprint') window.dispatchEvent(new Event('afterprint'));
    };
  }, aoImprimir);
  const api = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: DIETA } },
    'GET /aluno/pesos': { corpo: [] },
  });
  await page.goto('/aluno/dieta');
  await expect(page.getByRole('button', { name: 'Baixar PDF da dieta' })).toBeVisible();
  // O título da aba só assenta depois que a rota abre.
  await expect.poll(() => page.title()).toContain('Dieta');
  return api;
}

async function baixar(page: Page) {
  await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
  const folha = page.getByRole('dialog', { name: 'PDF da dieta' });
  await expect(folha).toBeVisible();
  await folha.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
}

const impressoes = (page: Page) => page.evaluate(() => (window as unknown as { __impressoes: number }).__impressoes);

test('imprimir e deixar o navegador terminar: o bloco some e o título volta', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 'afterprint');
  const tituloOriginal = await page.title();
  await baixar(page);
  await expect.poll(() => impressoes(page)).toBe(1);
  await expect(page.locator('#treinos-impressao')).toHaveCount(0);
  expect(await page.title()).toBe(tituloOriginal);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('imprimir, cancelar sem afterprint e imprimir de novo: um bloco só e o título volta no fim', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await abrir(page, 'cancelar');
  const tituloOriginal = await page.title();

  await baixar(page);
  await expect.poll(() => impressoes(page)).toBe(1);
  await expect(page.locator('#treinos-impressao')).toHaveCount(1);
  const tituloDoPdf = await page.title();
  expect(tituloDoPdf).not.toBe(tituloOriginal);

  await baixar(page);
  await expect.poll(() => impressoes(page)).toBe(2);
  await expect(page.locator('#treinos-impressao')).toHaveCount(1);

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#treinos-impressao')).toHaveCount(0);
  expect(await page.title()).toBe(tituloOriginal);
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
