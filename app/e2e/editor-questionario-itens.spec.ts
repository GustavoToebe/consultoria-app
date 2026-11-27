import { expect, test, type Page } from '@playwright/test';

import type { ConteudoQuestionario, PerguntaAtualizacao, SalvarQuestionarioRequest } from '../src/api/tipos';
import { erroApi } from './api-falsa';
import { ATUALIZACAO_ID, abrirEditor } from './editor-questionario.dados';

/**
 * Pergunta "Itens do plano do aluno" (ITENS_DO_PLANO) no editor de questionário de atualização: a galeria a oferece só na
 * atualização, os controles (fonte, quantos, motivo e a pergunta do motivo) vão no PUT do rascunho e a Prévia mostra a
 * lista fictícia ("Supino reto"). Exemplo do Gustavo: "Teve algum exercício que substituiu…?" → "Quais exercícios você
 * substituiu?" com o motivo "O que usou no lugar?". Capturas só com `E2E_CAPTURAS` (fora do git). Só dados fictícios.
 */
const CAPTURAS = process.env.E2E_CAPTURAS;

const RASCUNHO: ConteudoQuestionario = {
  formato: 2, instrucoes: [],
  secoes: [{ uid: 'sec-treino', titulo: 'Treino', perguntas: [
    { id: 'substituiu', tipo: 'SIM_NAO', rotulo: 'Teve algum exercício que substituiu por não ter o maquinário?', obrigatoria: false },
  ] }],
};

const corpoDoPut = (pedidos: { metodo: string; caminho: string; corpo: unknown }[]) =>
  pedidos.filter((p) => p.metodo === 'PUT' && p.caminho === `/questionarios/${ATUALIZACAO_ID}`).map((p) => p.corpo as SalvarQuestionarioRequest);
const perguntaDeItens = (c: SalvarQuestionarioRequest | undefined): PerguntaAtualizacao | undefined =>
  c?.conteudo.secoes.flatMap((s) => s.perguntas).find((p) => p.tipo === 'ITENS_DO_PLANO');

async function adicionarItens(page: Page) {
  await page.getByRole('button', { name: 'Adicionar pergunta' }).first().click();
  const folha = page.getByRole('dialog', { name: 'Adicionar pergunta' });
  await folha.getByRole('button', { name: 'Itens do plano do aluno' }).click();
  await expect(folha).toHaveCount(0);
}

for (const largura of [390, 1280]) {
  for (const tema of ['CLARO', 'ESCURO'] as const) {
    test(`${largura} px, ${tema.toLowerCase()}: adicionar "Itens do plano", escolher fonte e motivo, salvar e ver na Prévia`, async ({ page }) => {
      const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'atualizacao', largura, tema, rascunho: RASCUNHO });
      await expect(page.getByRole('heading', { name: 'Questionário de atualização', level: 1 })).toBeVisible();
      await adicionarItens(page);

      await page.getByLabel('Texto da pergunta').last().fill('Quais exercícios você substituiu?');
      await page.getByRole('radio', { name: 'Exercícios do treino' }).click();
      await expect(page.getByText('Os exercícios do treino liberado na pasta da atualização.')).toBeVisible();
      await page.getByRole('radio', { name: 'Opcional' }).click();
      await page.getByLabel('Pergunta do motivo (opcional)').fill('O que usou no lugar?');
      await expect(page.getByText(/adicione depois uma pergunta de Fotos com até 2 fotos/)).toBeVisible();
      // Só aparece depois do "Sim" da pergunta anterior (a condição nasce apontando para ela).
      await page.getByRole('switch', { name: 'Mostrar só conforme uma resposta anterior' }).click();
      await page.getByRole('checkbox', { name: 'Sim', exact: true }).click();
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/itens-editor-${largura}-${tema.toLowerCase()}.png`, fullPage: true });

      await page.getByRole('button', { name: 'Salvar rascunho' }).click();
      await expect.poll(() => corpoDoPut(pedidos).length).toBe(1);
      expect(perguntaDeItens(corpoDoPut(pedidos)[0])).toMatchObject({
        rotulo: 'Quais exercícios você substituiu?', fonte: 'EXERCICIOS_DO_TREINO', motivo: 'OPCIONAL', rotuloMotivo: 'O que usou no lugar?',
        mostrarSe: { perguntaId: 'substituiu', valores: ['sim'] },
      });
      expect(perguntaDeItens(corpoDoPut(pedidos)[0])?.max).toBeUndefined();

      // Prévia: a lista fictícia dos exercícios, com o campo do motivo depois de marcar.
      await page.getByRole('tab', { name: 'Prévia' }).click();
      const supino = page.getByRole('checkbox', { name: 'Supino reto' });
      await expect(supino).toHaveCount(0);
      await page.getByRole('radio', { name: 'Sim', exact: true }).click();
      await expect(supino).toBeVisible();
      await supino.click();
      await expect(page.getByLabel(/O que usou no lugar\?/).first()).toBeVisible();
      if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/itens-previa-${largura}-${tema.toLowerCase()}.png`, fullPage: true });

      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }

  test(`${largura} px: "Um item" grava max 1 e "Sem motivo" tira o motivo e a pergunta dele do rascunho`, async ({ page }) => {
    const { pedidos, naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'atualizacao', largura, rascunho: RASCUNHO });
    await adicionarItens(page);
    await page.getByLabel('Texto da pergunta').last().fill('Qual dia foi mais desgastante?');
    await page.getByRole('radio', { name: 'Dias treinados' }).click();
    await page.getByRole('radio', { name: 'Um item' }).click();
    await page.getByRole('radio', { name: 'Obrigatório' }).click();
    await page.getByLabel('Pergunta do motivo (opcional)').fill('Por quê?');
    await page.getByRole('radio', { name: 'Sem motivo' }).click();
    await expect(page.getByLabel('Pergunta do motivo (opcional)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => corpoDoPut(pedidos).length).toBe(1);
    const p = perguntaDeItens(corpoDoPut(pedidos)[0]);
    expect(p).toMatchObject({ fonte: 'DIAS_TREINADOS', max: 1 });
    expect(p?.motivo).toBeUndefined();
    expect(p?.rotuloMotivo).toBeUndefined();
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura} px: a anamnese não oferece "Itens do plano do aluno"`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, { qual: 'anamnese', largura, rascunho: RASCUNHO });
    await page.getByRole('button', { name: 'Adicionar pergunta' }).first().click();
    const folha = page.getByRole('dialog', { name: 'Adicionar pergunta' });
    await expect(folha.getByRole('button', { name: 'Texto curto' })).toBeVisible();
    await expect(folha.getByRole('button', { name: 'Itens do plano do aluno' })).toHaveCount(0);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`${largura} px: salvar recusado pela API avisa e mantém a pergunta na tela`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrirEditor(page, {
      qual: 'atualizacao', largura, rascunho: RASCUNHO,
      extra: { [`PUT /questionarios/${ATUALIZACAO_ID}`]: erroApi(500, 'Erro interno.', 'ERRO_INTERNO') },
    });
    await adicionarItens(page);
    await page.getByLabel('Texto da pergunta').last().fill('Quais alimentos quer trocar?');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByText('Não foi possível salvar o rascunho. Veja o motivo no topo.')).toBeVisible();
    await expect(page.getByLabel('Texto da pergunta').last()).toHaveValue('Quais alimentos quer trocar?');
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}
