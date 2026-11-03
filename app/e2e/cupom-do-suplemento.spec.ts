import { expect, test } from '@playwright/test';

import type { ConteudoDieta, VersaoDetalhe } from '../src/api/tipos';
import { simularApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

/**
 * C51: o cupom do suplemento aparece na dieta do aluno junto do link, com o botão "Copiar cupom". Sem cupom, nada
 * aparece. Números e textos fictícios.
 */
const CONTEUDO: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, ergogenicos: null, aguaLitros: null,
  refeicoes: [],
  suplementacao: [
    { uid: 's1', nome: 'Creatina fictícia', dose: '3 g', horario: '', observacao: '', link: 'https://exemplo.com/p', cupom: 'TESTE10' },
    { uid: 's2', nome: 'Whey fictício', dose: '', horario: '', observacao: '', link: 'https://exemplo.com/q', cupom: null },
  ],
};

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001', planoId: 'p0000000-0000-4000-8000-000000000001', numero: 1, titulo: 'Dieta de teste',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z', conteudo: CONTEUDO,
};

for (const largura of [390, 1280]) {
  test(`aluno: vê o cupom junto do link e copia (${largura}px)`, async ({ page }) => {
    // O navegador de teste não deixa ler a área de transferência: um substituto guarda o que foi copiado.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (texto: string) => { (window as unknown as { __copiado?: string }).__copiado = texto; return Promise.resolve(); } },
      });
    });
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: DIETA } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByText('Cupom: TESTE10')).toBeVisible();
    // Só o item com cupom ganha o botão; o outro mostra o link e nada mais.
    await expect(page.getByRole('button', { name: /Copiar cupom/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Ver produto' })).toHaveCount(2);
    await expect(page.getByText(/Cupom:/)).toHaveCount(1);

    await page.getByTestId('copiar-cupom-s1').click();
    await expect(page.getByText('Copiado.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __copiado?: string }).__copiado)).toBe('TESTE10');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
