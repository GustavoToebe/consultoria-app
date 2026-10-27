import { expect, test } from '@playwright/test';
import { fixarHoje, sessaoComTecnicas, sessaoDeAlunoComTreino } from './aluno';
import { json, simularApi } from './api-falsa';
import type { RegistroEnvio } from '../src/api/tipos';

for (const largura of [390, 1280]) test(`aluno: carga de trabalho editável, explicação e registro por etapa no Rest-pause e no Cluster (${largura}px)`, async ({ page }, testInfo) => {
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
  const ultimo = (uid: string) => enviados.filter((r) => r.serieUid === uid).at(-1);
  await page.goto('/aluno/sessao/tecnicas/exemplo?data=2026-10-19');

  // Série inteira (WS): a carga vem da base do dia e continua editável.
  const peso1 = page.getByRole('textbox', { name: 'Peso da série 1, em quilos', exact: true });
  await expect(peso1).toHaveValue('');
  await expect(peso1).toHaveAttribute('placeholder', '—');
  await page.getByRole('textbox', { name: 'Carga de trabalho do dia', exact: true }).fill('40');
  await expect(peso1).toHaveValue('40');
  await expect(page.getByText(/até a falha/).last()).toBeVisible();
  await page.getByRole('button', { name: 'Explicação de WS, série 1', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/Working set:/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Rest-pause: etapa inicial feita (liga a pausa antes da retomada), retomada não feita, concluir.
  const concluir2 = page.getByRole('button', { name: 'Concluir a série 2', exact: true });
  await expect(concluir2).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Peso, etapa inicial da série 2, em quilos', exact: true })).toHaveValue('40');
  await page.getByRole('textbox', { name: 'Peso, etapa inicial da série 2, em quilos', exact: true }).fill('42');
  await page.getByRole('textbox', { name: 'Repetições feitas, etapa inicial da série 2', exact: true }).fill('8');
  await page.getByRole('checkbox', { name: 'Etapa inicial feita, série 2', exact: true }).click();
  await expect(page.getByText('Pausa antes da retomada', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Execução parcial: 8 reps em 1 de 2 etapas')).toBeVisible();
  await expect.poll(() => ultimo('rest')?.etapas?.length).toBe(1);
  expect(ultimo('rest')).toMatchObject({ concluida: false, repeticoes: null, carga: 42, referenciaCarga: 40, referenciaOrigem: 'BASE_DO_DIA' });
  await page.getByRole('button', { name: 'Não fiz: retomada da série 2', exact: true }).click();
  await expect(concluir2).toBeEnabled();
  await concluir2.click();
  await expect(page.getByText('Série concluída.')).toBeVisible();
  await expect.poll(() => ultimo('rest')?.concluida).toBe(true);
  expect(ultimo('rest')).toMatchObject({
    repeticoes: 8, carga: 42,
    etapas: [{ posicao: 1, repeticoes: 8, carga: 42, situacao: 'FEITA' }, { posicao: 2, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' }],
  });

  // Cluster: o bloco 2 pede 90% da WS sobre a mesma referência (40 kg → 36 kg); pausa só em respirações não tem cronômetro.
  await expect(page.getByText('Bloco 2 · Meta 2 reps · 90% da WS')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Peso, bloco 1 da série 3, em quilos', exact: true })).toHaveValue('40');
  await expect(page.getByRole('textbox', { name: 'Peso, bloco 2 da série 3, em quilos', exact: true })).toHaveValue('36');
  await expect(page.getByRole('button', { name: /pausa.*série 3/i })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Repetições feitas, bloco 1 da série 3', exact: true }).fill('4');
  await page.getByRole('checkbox', { name: 'Bloco 1 feito, série 3', exact: true }).click();
  await expect(page.getByText('Execução parcial: 4 reps em 1 de 2 blocos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Concluir a série 3', exact: true })).toBeDisabled();
  await page.getByText('Bloco 2 · Meta 2 reps · 90% da WS').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('cluster-parcial.png') });
  await expect.poll(() => ultimo('cluster')?.etapas?.length).toBe(1);
  expect(ultimo('cluster')).toMatchObject({ concluida: false, repeticoes: null, referenciaCarga: 40 });
  await page.getByRole('textbox', { name: 'Repetições feitas, bloco 2 da série 3', exact: true }).fill('2');
  await page.getByRole('checkbox', { name: 'Bloco 2 feito, série 3', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir a série 3', exact: true }).click();
  await expect(page.getByText('Realizadas: 6 reps · 2 de 2 blocos')).toBeVisible();
  await expect.poll(() => ultimo('cluster')?.concluida).toBe(true);
  expect(ultimo('cluster')).toMatchObject({ repeticoes: 6, carga: null });
  expect(errosDaPagina).toEqual([]);
  expect(naoTratadas).toEqual([]);
});
