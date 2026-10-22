import { expect, test } from '@playwright/test';
import { fixarHoje, sessaoComTecnicas, sessaoDeAlunoComTreino } from './aluno';
import { json, simularApi } from './api-falsa';
import type { RegistroEnvio } from '../src/api/tipos';

for (const largura of [390, 1280]) test(`aluno: mesma carga editável, gravação, explicação e pausa só em segundos (${largura}px)`, async ({ page }) => {
  await page.setViewportSize({ width: largura, height: 900 });
  await fixarHoje(page);
  const enviados: RegistroEnvio[] = [];
  const { errosDaPagina, naoTratadas } = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, sessaoComTecnicas())),
    'POST /aluno/execucoes/lote': (p, route) => {
      const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
      enviados.push(...lote);
      return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
  await page.goto('/aluno/sessao/tecnicas/exemplo?data=2026-10-19');
  const carga = (n: number) => page.getByRole('textbox', { name: `Peso da série ${n}, em quilos`, exact: true });
  await expect(carga(2)).toHaveValue('');
  await expect(carga(2)).toHaveAttribute('placeholder', '—');
  await page.getByRole('textbox', { name: 'Carga de trabalho do dia', exact: true }).fill('40');
  await expect(carga(2)).toHaveValue('40');
  await expect(page.getByRole('button', { name: 'Iniciar pausa de 20 segundos da série 2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Iniciar pausa.*série 3/ })).toHaveCount(0);
  await expect(page.getByText(/até a falha/).last()).toBeVisible();
  await page.getByRole('button', { name: 'Explicação de WS da série 1', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/Working set:/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await carga(2).fill('42');
  await page.getByRole('textbox', { name: 'Repetições da série 2', exact: true }).fill('8');
  await page.getByRole('checkbox', { name: 'Série 2 feita', exact: true }).click();
  await expect.poll(() => enviados.find((r) => r.serieUid === 'rest')?.carga).toBe(42);
  expect(enviados.find((r) => r.serieUid === 'rest')?.repeticoes).toBe(8);
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});
