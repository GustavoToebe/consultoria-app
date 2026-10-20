import { expect, test } from '@playwright/test';

import type { ConteudoMobilidadeApi, RegistroMobilidadeEnvio, RegistroMobilidadeFeito, VersaoDetalhe } from '../src/api/tipos';
import { fixarHoje, sessaoDeAluno } from './aluno';
import { json, simularApi } from './api-falsa';

const VERSAO_VIGENTE = 'm0000000-0000-4000-8000-000000000001';
const VERSAO_ANTIGA = 'm0000000-0000-4000-8000-000000000009';

const CONTEUDO: ConteudoMobilidadeApi = {
  orientacoes: null,
  secoes: [
    {
      uid: 'sec-quadril',
      titulo: 'Quadril',
      itens: [
        { uid: 'lunge', nome: 'Lunge com rotação', prescricao: '2 x 30 s', videoUrl: null },
        { uid: 'gato', nome: 'Gato e vaca', prescricao: '10 repetições', videoUrl: null },
      ],
    },
    { uid: 'sec-ombro', titulo: 'Ombro', itens: [{ uid: 'parede', nome: 'Deslize na parede', prescricao: '2 x 10', videoUrl: null }] },
  ],
};

const MOBILIDADE: VersaoDetalhe<ConteudoMobilidadeApi> = {
  id: VERSAO_VIGENTE,
  planoId: 'm0000000-0000-4000-8000-000000000002',
  numero: 2,
  titulo: 'Mobilidade de outubro',
  inicio: '2026-10-05',
  fim: '2026-11-01',
  publicadoEm: '2026-10-05T12:00:00Z',
  conteudo: CONTEUDO,
};

test('mobilidade: marcar e desmarcar um item grava o mesmo registro e a contagem do dia acompanha', async ({ page }) => {
  await fixarHoje(page);
  const enviados: RegistroMobilidadeEnvio[] = [];
  // O servidor já tem um item feito hoje nesta versão (parede) e um item de uma versão antiga que nem existe mais na tela.
  const doServidor: RegistroMobilidadeFeito[] = [
    { planoVersaoId: VERSAO_VIGENTE, secaoUid: 'sec-ombro', itemUid: 'parede', data: '2026-10-19', feito: true },
    { planoVersaoId: VERSAO_ANTIGA, secaoUid: 'sec-quadril', itemUid: 'lunge', data: '2026-10-19', feito: true },
  ];
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/mobilidade': { corpo: { mobilidade: MOBILIDADE } },
    'GET /aluno/mobilidade/registros': { corpo: doServidor },
    'POST /aluno/mobilidade/registros': async (pedido, route) => {
      const lote = (pedido.corpo as { registros: RegistroMobilidadeEnvio[] }).registros;
      enviados.push(...lote);
      await json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
    },
  });
  await page.goto('/aluno/mobilidade');
  await expect(page.getByRole('heading', { name: 'Mobilidade', level: 1 })).toBeVisible();

  // Só o item da versão vigente conta; o da versão antiga não aparece nem soma.
  await expect(page.getByText('Hoje: 1 de 3 feitos')).toBeVisible();
  const lunge = page.getByRole('checkbox', { name: 'Lunge com rotação: não feito em hoje' });
  await expect(page.getByRole('checkbox', { name: 'Deslize na parede: feito em hoje' })).toBeChecked();
  await expect(lunge).not.toBeChecked();

  await lunge.click();
  await expect(page.getByText('Hoje: 2 de 3 feitos')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Lunge com rotação: feito em hoje' })).toBeChecked();
  await expect.poll(() => enviados.length, { timeout: 15_000 }).toBe(1);
  expect(enviados[0]).toMatchObject({ planoVersaoId: VERSAO_VIGENTE, secaoUid: 'sec-quadril', itemUid: 'lunge', data: '2026-10-19', feito: true });

  // Desmarcar é o mesmo registro (mesmo id) com feito falso.
  await page.getByRole('checkbox', { name: 'Lunge com rotação: feito em hoje' }).click();
  await expect(page.getByText('Hoje: 1 de 3 feitos')).toBeVisible();
  await expect.poll(() => enviados.length, { timeout: 15_000 }).toBe(2);
  expect(enviados[1]).toMatchObject({ id: enviados[0].id, itemUid: 'lunge', feito: false });

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('mobilidade: o dia escolhido nos chips tem a própria contagem', async ({ page }) => {
  await fixarHoje(page);
  const { errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/mobilidade': { corpo: { mobilidade: MOBILIDADE } },
    'GET /aluno/mobilidade/registros': {
      corpo: [
        { planoVersaoId: VERSAO_VIGENTE, secaoUid: 'sec-quadril', itemUid: 'gato', data: '2026-10-14', feito: true },
        { planoVersaoId: VERSAO_VIGENTE, secaoUid: 'sec-ombro', itemUid: 'parede', data: '2026-10-14', feito: true },
      ] satisfies RegistroMobilidadeFeito[],
    },
  });
  await page.goto('/aluno/mobilidade');
  await expect(page.getByText('Hoje: 0 de 3 feitos')).toBeVisible();
  await page.getByRole('radio', { name: /14\/10/ }).click();
  await expect(page.getByRole('radio', { name: /14\/10/ })).toBeChecked();
  await expect(page.getByText('Em 14/10: 2 de 3 feitos')).toBeVisible();
  expect(errosDaPagina).toEqual([]);
});
