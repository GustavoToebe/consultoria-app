import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, ItemDieta, VersaoDetalhe } from '../src/api/tipos';
import type { PlanoDetalhe } from '../src/api/tipos';
import { MARCA, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoDeAluno } from './aluno';

function item(uid: string, nome: string, quantidade: number, unidade: ItemDieta['unidade'], fatores: Partial<ItemDieta> = {}): ItemDieta {
  return {
    uid, alimentoId: uid, nome, quantidade, unidade, kcal: null, proteina: null, carboidrato: null, gordura: null, manual: false,
    fatorCorrecao: null, fatorCoccao: null, ...fatores,
  };
}

/** Os títulos dos grupos aparecem de cima para baixo nesta ordem (os cartões ficam empilhados nas duas larguras). */
async function emOrdemNaTela(page: Page, textos: string[]) {
  const alturas: number[] = [];
  for (const texto of textos) {
    const caixa = await page.getByText(texto, { exact: true }).first().boundingBox();
    expect(caixa, texto).not.toBeNull();
    alturas.push(caixa?.y ?? 0);
  }
  expect(alturas).toEqual([...alturas].sort((a, b) => a - b));
}

/**
 * Almoço com duas opções (A: arroz cozido com fator de cocção 2,5 e frango sem fator; B: batata com fator de correção
 * 1,25) e café com opção única (ovos em unidade). Arroz e frango têm grupo (copiado na publicação); ovo e batata não.
 * Números fictícios, só para conferir a conta da tela.
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
        { uid: 'almoco-a', rotulo: 'A', itens: [item('arroz', 'Arroz branco cozido', 150, 'g', { fatorCoccao: 2.5, grupo: 'Cereais e derivados' }), item('frango', 'Frango grelhado', 100, 'g', { grupo: 'Carnes e derivados' })] },
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
  await expect(page.getByText('Dieta de teste', { exact: true })).toBeVisible();

  // Semana (padrão): arroz cozido 150 g ÷ 2,5 = 60 g cru por dia, 420 g na semana; frango sem fator, como na dieta.
  await expect(page.getByText('Lista da semana')).toBeVisible();
  await expect(page.getByText('420 g cru')).toBeVisible();
  await expect(page.getByText('700 g (como na dieta)', { exact: true })).toBeVisible();
  await expect(page.getByText('14 un')).toBeVisible();

  // Agrupada pelo grupo do alimento, na ordem do mercado (carnes antes de cereais), "Outros itens" (sem grupo) por último, com a contagem.
  await emOrdemNaTela(page, ['Carnes e derivados', 'Frango grelhado', 'Cereais e derivados', 'Arroz branco cozido', 'Outros itens', 'Ovo']);
  await expect(page.getByText('1 item')).toHaveCount(3);

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
  // Sem arroz e frango, os grupos deles somem; batata e ovo ficam em "Outros itens".
  await expect(page.getByText('Carnes e derivados')).toHaveCount(0);
  await expect(page.getByText('Cereais e derivados')).toHaveCount(0);
  await expect(page.getByText('2 itens')).toBeVisible();

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('lista de compras: grupos do catálogo na ordem do mercado, grupo do treinador depois e "Outros itens" no fim', async ({ page }) => {
  // Em ordem alfabética sairia Carnes, Cereais, Frutas, Ovos, Verduras: a ordem do mercado é outra.
  const conteudo: ConteudoDieta = {
    ...CONTEUDO,
    refeicoes: [{
      uid: 'unica', nome: 'Refeição', horario: '12:00', observacao: null,
      opcoes: [{
        uid: 'unica-a', rotulo: 'A',
        itens: [
          item('arroz', 'Arroz branco cozido', 100, 'g', { grupo: 'Cereais e derivados' }),
          item('whey', 'Proteína em pó', 30, 'g', { grupo: 'Suplementos' }),
          item('frango', 'Frango grelhado', 100, 'g', { grupo: 'Carnes e derivados' }),
          item('sal', 'Sal', 2, 'g'),
          item('maca', 'Maçã', 100, 'g', { grupo: 'Frutas e derivados' }),
          item('ovo', 'Ovo', 2, 'un', { grupo: 'Ovos e derivados' }),
          item('alface', 'Alface', 50, 'g', { grupo: 'Verduras, hortaliças e derivados' }),
        ],
      }],
    }],
  };
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: { ...DIETA, conteudo } } },
  });
  await page.goto('/aluno/lista-de-compras');
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 1 })).toBeVisible();
  await emOrdemNaTela(page, [
    'Verduras, hortaliças e derivados', 'Alface',
    'Frutas e derivados', 'Maçã',
    'Carnes e derivados', 'Frango grelhado',
    'Ovos e derivados', 'Ovo',
    'Cereais e derivados', 'Arroz branco cozido',
    'Suplementos', 'Proteína em pó',
    'Outros itens', 'Sal',
  ]);

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
test(`lista de compras do aluno: 2 semanas, comprado, limpar, ajustar, voltar ao calculado e item avulso, guardados no aparelho, em ${largura}px`, async ({ page }) => {
  await page.setViewportSize({ width: largura, height: 900 });
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: DIETA } },
  });
  await page.goto('/aluno/lista-de-compras');
  await expect(page.getByText('Lista da semana')).toBeVisible();

  // 2 semanas (14 dias): arroz 60 g cru por dia = 840 g; frango 100 g = 1,40 kg; ovos 2 por dia = 28.
  await page.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: '2 semanas' }).click();
  await expect(page.getByText('Lista de 2 semanas')).toBeVisible();
  await expect(page.getByText('840 g cru', { exact: true })).toBeVisible();
  await expect(page.getByText('1,40 kg (como na dieta)', { exact: true })).toBeVisible();
  await expect(page.getByText('28 un (como na dieta)', { exact: true })).toBeVisible();
  await expect(page.getByText('0 de 3 comprados')).toBeVisible();

  // Comprado: o ✓ marca e a contagem sobe; fica no aparelho (recarregar mantém) e vale só para este período.
  await page.getByRole('checkbox', { name: 'Ovo: não comprado' }).click();
  await expect(page.getByText('1 de 3 comprados')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Ovo: comprado' })).toBeChecked();
  await page.reload();
  await expect(page.getByText('Lista de 2 semanas')).toBeVisible();
  await expect(page.getByText('1 de 3 comprados')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByText('0 de 3 comprados')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: '2 semanas' }).click();
  await expect(page.getByText('1 de 3 comprados')).toBeVisible();

  // Limpar marcações, com desfazer no aviso.
  await page.getByRole('button', { name: 'Limpar marcações' }).click();
  await expect(page.getByText('0 de 3 comprados')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('1 de 3 comprados')).toBeVisible();

  // Ajustar a quantidade de um item calculado e voltar ao calculado.
  await page.getByRole('button', { name: 'Ajustar lista' }).click();
  await page.getByRole('button', { name: 'Ajustar Arroz branco cozido' }).click();
  let folha = page.getByRole('dialog', { name: 'Ajustar quantidade' });
  await expect(folha.getByLabel('Quantidade', { exact: true })).toHaveValue('840');
  await folha.getByLabel('Quantidade', { exact: true }).fill('1');
  await folha.getByLabel('Unidade (opcional)').fill('pacote de 1 kg');
  await folha.getByRole('button', { name: 'Salvar' }).click();
  await expect(folha).toHaveCount(0);
  await expect(page.getByText('1 pacote de 1 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Ajustado por você')).toBeVisible();
  await expect(page.getByText('Calculado: 840 g cru')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar Arroz branco cozido' }).click();
  folha = page.getByRole('dialog', { name: 'Ajustar quantidade' });
  await folha.getByRole('button', { name: 'Voltar ao calculado' }).click();
  await expect(page.getByText('Ajustado por você')).toHaveCount(0);
  await expect(page.getByText('840 g cru', { exact: true })).toBeVisible();

  // Item avulso: entra no fim da lista, conta no total e sai com desfazer.
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  folha = page.getByRole('dialog', { name: 'Adicionar item' });
  await folha.getByRole('button', { name: 'Adicionar' }).click();
  await expect(folha.getByText('Informe o nome do item.')).toBeVisible();
  await folha.getByLabel('Nome').fill('Café');
  await folha.getByLabel('Quantidade (opcional)').fill('2');
  await folha.getByLabel('Unidade (opcional)').fill('pacotes');
  await folha.getByRole('button', { name: 'Adicionar' }).click();
  await expect(folha).toHaveCount(0);
  await expect(page.getByText('2 pacotes', { exact: true })).toBeVisible();
  await expect(page.getByText('Adicionado por você')).toBeVisible();
  await expect(page.getByText('1 de 4 comprados')).toBeVisible();
  // O item avulso vai para o último grupo, "Adicionados por você", depois de "Outros itens".
  await emOrdemNaTela(page, ['Cereais e derivados', 'Outros itens', 'Adicionados por você', 'Café']);
  await page.getByRole('button', { name: 'Remover Café' }).click();
  await expect(page.getByText('Adicionado por você')).toHaveCount(0);
  await expect(page.getByText('1 de 3 comprados')).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Adicionado por você')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir ajustes' }).click();
  await page.getByRole('checkbox', { name: 'Café: não comprado' }).click();
  await expect(page.getByText('2 de 4 comprados')).toBeVisible();
  await page.screenshot({ path: `test-results-e2e/lista-de-compras-${largura}.png`, fullPage: true });

  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});
}

async function baixarDietaDetalhada(page: Page) {
  await page.addInitScript(() => { window.print = () => undefined; });
  const { naoTratadas, errosDaPagina } = await simularApi(page, {
    ...(await sessaoDeAluno(page)),
    'GET /aluno/dieta': { corpo: { dieta: DIETA } },
    'GET /aluno/pesos': { corpo: [] },
  });
  await page.goto('/aluno/dieta');
  await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
  const folha = page.getByRole('dialog', { name: 'PDF da dieta' });
  await expect(folha).toBeVisible();
  await folha.getByRole('radiogroup', { name: 'Forma do PDF' }).getByRole('button', { name: 'Detalhado' }).click();
  await folha.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: 'Mês' }).click();
  await folha.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
  const bloco = page.locator('#treinos-impressao');
  await expect(bloco).toContainText('Lista de compras · 30 dias');
  await expect(bloco).toContainText('FCc');
  await expect(bloco).toContainText('FC');
  await expect(bloco).toContainText('Arroz branco cozido');

  await page.getByRole('button', { name: 'Baixar PDF da dieta' }).click();
  await expect(folha.getByRole('button', { name: 'Detalhado' })).toHaveAttribute('aria-checked', 'true');
  await expect(folha.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: 'Mês' })).toHaveAttribute('aria-checked', 'true');
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
}

for (const largura of [390, 1280]) {
  test(`pdf da dieta: aluno escolhe Detalhado e 30 dias em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await baixarDietaDetalhada(page);
  });
}

const PLANO_ID = 'p0000000-0000-4000-8000-000000000001';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const DETALHE: PlanoDetalhe<ConteudoDieta> = {
  plano: {
    id: PLANO_ID, alunoId: ALUNO_ID, pastaId: null, titulo: 'Dieta de teste',
    inicio: '2026-10-01', fim: '2026-10-31', ativo: true, versaoPublicada: 1,
    publicadoEm: '2026-10-01T12:00:00Z', rascunhoAlteradoDepoisDePublicar: false, versao: 1,
  },
  rascunho: CONTEUDO,
  versoes: [{ id: 'v0000000-0000-4000-8000-000000000001', numero: 1, publicadoEm: '2026-10-01T12:00:00Z' }],
};

for (const largura of [390, 1280]) {
  test(`pdf da dieta: treinador na ficha do plano escolhe Detalhado em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await page.addInitScript(() => { window.print = () => undefined; });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'DIETA_LER', 'DIETA_ALTERAR'] })),
      'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      'GET /inscricoes': { corpo: { itens: [], total: 0 } },
      'GET /alimentos': { corpo: [] },
      'GET /consultoria': { corpo: { marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } },
      [`GET /alunos/${ALUNO_ID}`]: { corpo: { id: ALUNO_ID, nome: 'Aluno Teste' } },
      [`GET /alunos/${ALUNO_ID}/pesos`]: { corpo: [] },
      [`GET /planos-dieta/${PLANO_ID}`]: { corpo: DETALHE },
      [`GET /planos-dieta/${PLANO_ID}/versoes/1`]: { corpo: { ...DIETA, planoId: PLANO_ID, numero: 1 } },
    });
    await page.goto(`/treinador/dietas/${PLANO_ID}`);
    await page.getByRole('button', { name: /PDF/ }).click();
    const folha = page.getByRole('dialog', { name: 'PDF da dieta' });
    await expect(folha).toBeVisible();
    await folha.getByRole('radiogroup', { name: 'Forma do PDF' }).getByRole('button', { name: 'Detalhado' }).click();
    await folha.getByRole('radiogroup', { name: 'Período da lista' }).getByRole('button', { name: 'Mês' }).click();
    await folha.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const bloco = page.locator('#treinos-impressao');
    await expect(bloco).toContainText('Lista de compras · 30 dias');
    await expect(bloco).toContainText('Arroz branco cozido');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
