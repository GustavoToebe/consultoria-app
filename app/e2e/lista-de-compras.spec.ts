import { expect, test } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, VersaoDetalhe } from '../src/api/tipos';
import { simularApi } from './api-falsa';
import { sessaoDeAluno } from './aluno';

function item(uid: string, nome: string, quantidade: number, unidade: ItemDieta['unidade'], fatores: Partial<ItemDieta> = {}): ItemDieta {
  return {
    uid, alimentoId: uid, nome, quantidade, unidade, kcal: null, proteina: null, carboidrato: null, gordura: null, manual: false,
    fatorCorrecao: null, fatorCoccao: null, ...fatores,
  };
}

/**
 * Almoço com duas opções (A: arroz cozido com fator de cocção 2,5 e frango sem fator; B: batata com fator de correção
 * 1,25) e café com opção única (ovos em unidade). Números fictícios, só para conferir a conta da tela.
 */
const CONTEUDO: ConteudoDieta = {
  objetivo: null,
  dataInicio: null,
  profissional: null,
  refeicoes: [
    {
      uid: 'cafe', nome: 'Café da manhã', horario: '07:00', observacao: null,
      opcoes: [{ uid: 'cafe-a', rotulo: 'A', itens: [item('ovo', 'Ovo', 2, 'un')] }],
    },
    {
      uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null,
      opcoes: [
        { uid: 'almoco-a', rotulo: 'A', itens: [item('arroz', 'Arroz branco cozido', 150, 'g', { fatorCoccao: 2.5 }), item('frango', 'Frango grelhado', 100, 'g')] },
        { uid: 'almoco-b', rotulo: 'B', itens: [item('batata', 'Batata cozida', 200, 'g', { fatorCorrecao: 1.25 })] },
      ],
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

test('lista de compras: semana e mês, quantidade crua pelo fator de cocção e opção por refeição', async ({ page }) => {
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: DIETA } },
  });
  await page.goto('/aluno/lista-de-compras');
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 1 })).toBeVisible();
  await expect(page.getByText('Dieta de teste (v2)')).toBeVisible();

  // Semana (padrão): arroz cozido 150 g ÷ 2,5 = 60 g cru por dia, 420 g na semana; frango sem fator, como na dieta.
  await expect(page.getByText('Lista da semana')).toBeVisible();
  await expect(page.getByText('420 g cru')).toBeVisible();
  await expect(page.getByText('700 g (como na dieta)', { exact: true })).toBeVisible();
  await expect(page.getByText('14 un')).toBeVisible();

  // Mês (30 dias): passa de 1.000 g vira kg, arredondado para cima.
  await page.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: 'Mês' }).click();
  await expect(page.getByText('Lista do mês')).toBeVisible();
  await expect(page.getByText('1,80 kg cru')).toBeVisible();
  await expect(page.getByText('3,00 kg (como na dieta)', { exact: true })).toBeVisible();
  await expect(page.getByText('60 un')).toBeVisible();

  // Opção B do almoço: sai o arroz e o frango, entra a batata com o fator de correção (200 × 1,25 × 30 = 7,5 kg).
  await page.getByRole('radiogroup', { name: '12:00 · Almoço' }).getByRole('button', { name: 'Opção B' }).click();
  await expect(page.getByText('Batata cozida')).toBeVisible();
  await expect(page.getByText('7,50 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Arroz branco cozido')).toHaveCount(0);
  await expect(page.getByText('cru')).toHaveCount(0);

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
