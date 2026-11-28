import { expect, test, type Page } from '@playwright/test';

import type { Exercicio } from '../src/api/tipos';
import { PROTOCOLOS } from '../src/dominio/cardio';
import { erroApi, json, paginaDeExerciciosFalsa, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR, type PedidoFalso } from './api-falsa';

/**
 * Biblioteca › Novo/Editar exercício com Modalidade = Cardio (docs/planos/cardio-e-hiit.md, P4a, D12 e D13): somem Grupo
 * muscular e Equipamento (seletores com busca desde 27/11), aparecem "Tipo de cardio (opcional)" e "Medidas que fazem sentido"; o corpo leva o tipo e as
 * medidas só no Cardio, com grupo e equipamento nulos; o 422 aparece no campo; o cardio antigo avisa o que sai ao salvar.
 * E a Ajuda "Cardio e HIIT" (`?secao=cardio-e-hiit`) com as definições do ⓘ. `CAPTURAS` aponta a pasta das capturas.
 * Só dados fictícios.
 */
const captura = (nome: string) => (process.env.CAPTURAS ? `${process.env.CAPTURAS}/${nome}` : test.info().outputPath(nome));

const exercicio = (n: number, nome: string, p: Partial<Exercicio>): Exercicio => ({
  id: `e${String(n).padStart(7, '0')}-0000-4000-8000-000000000027`, nome, grupoMuscular: null, equipamento: null, modalidade: 'MAQUINA',
  videoUrl: null, observacoes: null, origem: 'MANUAL', imagens: [], imagemPropriaEm: null, ...p,
});
const LEG_PRESS = exercicio(1, 'Leg press fictício', { grupoMuscular: 'Pernas', equipamento: 'Máquina' });
// Antes da V113: grupo e equipamento gravados, sem tipo nem medidas na resposta.
const ESTEIRA_ANTIGA = exercicio(2, 'Esteira fictícia', { modalidade: 'CARDIO', grupoMuscular: 'Cardio', equipamento: 'Esteira' });
const ESCADA = exercicio(3, 'Escada fictícia', { modalidade: 'CARDIO', tipoDeCardio: 'ESCADA', medidasDeCardio: ['RITMO'] });
const LISTA = [LEG_PRESS, ESTEIRA_ANTIGA, ESCADA];

type Tema = 'claro' | 'escuro';

async function abrir(page: Page, largura: number, { tema = 'claro' as Tema, salvar = 'ok' as 'ok' | '422' } = {}) {
  await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 1000 });
  if (tema === 'escuro') await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
  const salvos: PedidoFalso[] = [];
  const responder = (p: PedidoFalso, r: Parameters<typeof json>[0]) => {
    salvos.push(p);
    if (salvar === '422') {
      const e = erroApi(422, 'Exercício inválido.', 'EXERCICIO_INVALIDO', [{ field: 'tipoDeCardio', message: 'Tipo de cardio inválido.' }]);
      return json(r, e.corpo, e.status);
    }
    return json(r, { ...LEG_PRESS, ...(p.corpo as object), id: 'e-novo' });
  };
  const api = await simularApi(page, {
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR'] })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios/pagina': paginaDeExerciciosFalsa(LISTA),
    'GET /exercicios': (_p, r) => json(r, LISTA),
    'POST /exercicios': responder,
    'PUT /exercicios/{id}': responder,
  });
  await page.goto('/treinador/biblioteca?aba=exercicios', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(LEG_PRESS.nome, { exact: true })).toBeVisible();
  return { ...api, salvos };
}

const folha = (page: Page) => page.getByRole('dialog');

async function escolher(page: Page, campo: string, atual: string, opcao: string) {
  await folha(page).getByRole('button', { name: `${campo}: ${atual}. Escolher.` }).click();
  await page.getByRole('option', { name: opcao, exact: true }).click();
  await expect(folha(page).getByRole('button', { name: `${campo}: ${opcao}. Escolher.` })).toBeVisible();
}

for (const largura of [390, 1280]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`novo exercício com Cardio: troca os campos e manda tipo e medidas (${largura} px, ${tema})`, async ({ page }) => {
      const { salvos, naoTratadas, errosDaPagina } = await abrir(page, largura, { tema });
      await page.getByRole('button', { name: 'Novo exercício' }).click();
      await expect(folha(page).getByRole('button', { name: /^Grupo muscular · opcional: / })).toBeVisible();
      await expect(folha(page).getByRole('button', { name: /^Equipamento · opcional: / })).toBeVisible();
      await folha(page).getByLabel('Nome', { exact: true }).fill('Escada nova fictícia');
      await escolher(page, 'Modalidade', 'Máquina', 'Cardio');
      await expect(folha(page).getByRole('button', { name: /^Grupo muscular/ })).toHaveCount(0);
      await expect(folha(page).getByRole('button', { name: /^Equipamento/ })).toHaveCount(0);
      await expect(folha(page).getByRole('button', { name: 'Tipo de cardio (opcional): Não informado. Escolher.' })).toBeVisible();
      const medidas = folha(page).getByRole('group', { name: 'Medidas que fazem sentido' });
      await expect(medidas.getByRole('checkbox', { name: 'Distância' })).toHaveAttribute('aria-checked', 'true');
      await expect(medidas.getByRole('checkbox', { name: 'Ritmo' })).toHaveAttribute('aria-checked', 'true');
      await expect(medidas.getByText('O editor do treino mostra só as marcadas. Duração e zona aparecem sempre.')).toBeVisible();
      await escolher(page, 'Tipo de cardio (opcional)', 'Não informado', 'Escada');
      await medidas.getByRole('checkbox', { name: 'Distância' }).click();
      await expect(medidas.getByRole('checkbox', { name: 'Distância' })).toHaveAttribute('aria-checked', 'false');

      if (largura === 1280) {
        // Modalidade e Tipo lado a lado, mesma altura (46, a dos três seletores fora do Cardio); as duas medidas também lado a lado.
        const [m, t] = await Promise.all([
          folha(page).getByRole('button', { name: /^Modalidade:/ }).boundingBox(),
          folha(page).getByRole('button', { name: /^Tipo de cardio/ }).boundingBox(),
        ]);
        expect(Math.abs(m!.y - t!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(m!.height - t!.height)).toBeLessThanOrEqual(1);
        expect(Math.abs(m!.height - 46)).toBeLessThanOrEqual(1);
        expect(t!.x).toBeGreaterThan(m!.x + m!.width);
      }
      await page.screenshot({ path: captura(`novo-cardio-${largura}-${tema}.png`) });

      await folha(page).getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText('Exercício salvo.')).toBeVisible();
      expect(salvos).toHaveLength(1);
      expect(salvos[0].corpo).toEqual({
        nome: 'Escada nova fictícia', grupoMuscular: null, equipamento: null, modalidade: 'CARDIO', videoUrl: null, observacoes: null,
        tipoDeCardio: 'ESCADA', medidasDeCardio: ['RITMO'],
      });
      expect(naoTratadas).toEqual([]);
      expect(errosDaPagina).toEqual([]);
    });
  }
}

test('fora do Cardio o corpo não leva tipo nem medidas, e o grupo digitado volta ao sair do Cardio', async ({ page }) => {
  const { salvos, naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: 'Novo exercício' }).click();
  await folha(page).getByLabel('Nome', { exact: true }).fill('Remada fictícia');
  // Grupo novo pela busca do seletor ("+ Usar"): nenhum exercício da lista é de Costas.
  await folha(page).getByRole('button', { name: 'Grupo muscular · opcional: Não informado. Escolher.' }).click();
  await page.getByRole('textbox', { name: 'Buscar ou criar grupo' }).fill('Costas');
  await page.getByRole('option', { name: '+ Usar “Costas”, Grupo muscular novo' }).click();
  await escolher(page, 'Modalidade', 'Máquina', 'Cardio');
  await escolher(page, 'Modalidade', 'Cardio', 'Peso livre');
  await expect(folha(page).getByRole('button', { name: 'Grupo muscular · opcional: Costas. Escolher.' })).toBeVisible();
  await folha(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Exercício salvo.')).toBeVisible();
  expect(salvos[0].corpo).toEqual({ nome: 'Remada fictícia', grupoMuscular: 'Costas', equipamento: null, modalidade: 'LIVRE', videoUrl: null, observacoes: null });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

test('editar: o cardio salvo abre com o tipo e as medidas dele; o antigo avisa que grupo e equipamento saem', async ({ page }) => {
  const { salvos, naoTratadas, errosDaPagina } = await abrir(page, 1280);
  await page.getByRole('button', { name: `Editar ${ESCADA.nome}` }).click();
  await expect(folha(page).getByRole('button', { name: 'Tipo de cardio (opcional): Escada. Escolher.' })).toBeVisible();
  const medidas = folha(page).getByRole('group', { name: 'Medidas que fazem sentido' });
  await expect(medidas.getByRole('checkbox', { name: 'Distância' })).toHaveAttribute('aria-checked', 'false');
  await expect(medidas.getByRole('checkbox', { name: 'Ritmo' })).toHaveAttribute('aria-checked', 'true');
  await expect(folha(page).getByText(/Ao salvar como Cardio/)).toHaveCount(0);
  await folha(page).getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: `Editar ${ESTEIRA_ANTIGA.nome}` }).click();
  await expect(folha(page).getByRole('button', { name: 'Tipo de cardio (opcional): Não informado. Escolher.' })).toBeVisible();
  // Sem medidas na resposta (antes da V113): as duas, como a API grava por padrão.
  await expect(medidas.getByRole('checkbox', { name: 'Distância' })).toHaveAttribute('aria-checked', 'true');
  await expect(folha(page).getByText('Ao salvar como Cardio, saem do exercício o grupo muscular (Cardio) e o equipamento (Esteira); o tipo de cardio fica no lugar deles.')).toBeVisible();
  await page.screenshot({ path: captura('editar-cardio-antigo-1280-claro.png') });
  await escolher(page, 'Tipo de cardio (opcional)', 'Não informado', 'Esteira');
  await folha(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Exercício salvo.')).toBeVisible();
  expect(salvos[0].caminho).toBe(`/exercicios/${ESTEIRA_ANTIGA.id}`);
  expect(salvos[0].corpo).toMatchObject({ grupoMuscular: null, equipamento: null, modalidade: 'CARDIO', tipoDeCardio: 'ESTEIRA', medidasDeCardio: ['DISTANCIA', 'RITMO'] });
  expect(naoTratadas).toEqual([]);
  expect(errosDaPagina).toEqual([]);
});

for (const largura of [390, 1280]) {
  test(`a linha do cardio mostra o tipo ("Cardio · Escada"); o antigo, o equipamento, sem o grupo "Cardio" (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura);
    await expect(page.getByText('Cardio · Escada', { exact: true })).toBeVisible();
    await expect(page.getByText('Cardio · Esteira', { exact: true })).toBeVisible();
    await expect(page.getByText(/Cardio · Cardio/)).toHaveCount(0);
    await page.screenshot({ path: captura(`lista-cardio-${largura}-claro.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });

  test(`422 no tipo de cardio aparece junto do campo e a folha continua aberta (${largura} px)`, async ({ page }) => {
    const { naoTratadas, errosDaPagina } = await abrir(page, largura, { salvar: '422' });
    await page.getByRole('button', { name: 'Novo exercício' }).click();
    await folha(page).getByLabel('Nome', { exact: true }).fill('Bike fictícia');
    await escolher(page, 'Modalidade', 'Máquina', 'Cardio');
    await folha(page).getByRole('button', { name: 'Salvar' }).click();
    await expect(folha(page).getByText('Tipo de cardio inválido.')).toBeVisible();
    // O erro do campo não se repete como mensagem geral.
    await expect(folha(page).getByText('Exercício inválido.')).toHaveCount(0);
    await page.screenshot({ path: captura(`novo-cardio-422-${largura}-claro.png`) });
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`Ajuda › Cardio e HIIT abre pelo ?secao= com as definições dos protocolos (${largura} px, ${tema})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura < 768 ? 844 : 900 });
      if (tema === 'escuro') await page.addInitScript((id) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: 'ESCURO' })), TREINADOR.id);
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'BIBLIOTECA_LER'] })),
        'GET /inscricoes': { corpo: { itens: [], total: 0 } },
        'GET /painel': { corpo: { atualizacoesParaRevisar: 0 } },
      });
      await page.goto('/treinador/ajuda?secao=cardio-e-hiit', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 2, name: 'Cardio e HIIT' })).toBeVisible();
      for (const p of PROTOCOLOS) await expect(page.getByText(p.definicao, { exact: false }).first()).toBeVisible();
      await page.getByRole('heading', { level: 2, name: 'Cardio e HIIT' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: captura(`ajuda-cardio-e-hiit-${largura}-${tema}.png`) });
      expect(errosDaPagina).toEqual([]);
    });
  }
}
