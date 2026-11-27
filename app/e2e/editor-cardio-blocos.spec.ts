import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { Cardio, ConteudoTreino, Exercicio, Receita, Serie } from '../src/api/tipos';
import { erroApi, json, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';
import { sessaoFalsa } from './aluno';

/**
 * Editor de blocos de cardio no editor de treino (docs/planos/cardio-e-hiit.md, P2): cada série do exercício de cardio é
 * um bloco, Contínuo ou Intervalado, com os protocolos, o erro único no campo, o aviso de fora da faixa, vários blocos e o
 * resumo na lista. O contínuo sai com as chaves de sempre (D16). Só dados fictícios; a API é simulada.
 * Capturas em `E2E_CAPTURAS` (padrão: a pasta do teste), em 390, 1280 e 1920, claro e escuro.
 */

const ID = 'm0000000-0000-4000-8000-0000000000c1';
const BIKE_ID = 'e0000000-0000-4000-8000-0000000000c1';
const capturas = process.env.E2E_CAPTURAS;
/** A tela rola numa caixa interna (o `fullPage` não alcança): `topo` leva o título da prescrição ao alto antes da captura. */
async function capturar(page: Page, nome: string, saida: string, topo = false) {
  if (topo) await page.getByText('Prescrição do cardio', { exact: true }).evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: capturas ? path.join(capturas, nome) : path.join(saida, nome) });
}

const bloco = (uid: string, cardio: Cardio): Serie => ({
  uid, tipo: null, repsMin: null, repsMax: null, amrap: null, carga: null, esforco: null, descansoSegundos: null, tecnica: null, alvoExtra: null, cardio,
});
const CONTINUO_VAZIO: Cardio = { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null };

/** Biblioteca com a bike de teste, que só mede o ritmo (a distância some no contínuo, D12). */
const BIBLIOTECA = [{ id: BIKE_ID, nome: 'Bike de teste', modalidade: 'CARDIO', grupoMuscular: null, equipamento: null, videoUrl: null, observacoes: null,
  imagens: [], imagemPropriaEm: null, ativo: true, tipoDeCardio: 'BIKE', medidasDeCardio: ['RITMO'] }] as unknown as Exercicio[];

/** Tema da preferência; `CLARO_ALTO` = claro com o contraste alto. */
type Tema = 'CLARO' | 'ESCURO' | 'AREIA' | 'CLARO_ALTO';
async function abrir(page: Page, series: Serie[], tema: Tema = 'CLARO', putFalha = false) {
  const preferencias = tema === 'CLARO_ALTO' ? { tema: 'CLARO', contraste: 'ALTO' } : { tema };
  await page.addInitScript(([id, p]) => localStorage.setItem(`treinos:${id}:preferencias`, p), [TREINADOR.id, JSON.stringify(preferencias)] as const);
  const dia = sessaoFalsa('dia', 'Dia com cardio', 1, 1);
  dia.exercicios = [{ ...dia.exercicios[0], uid: 'bike', nome: 'Bike de teste', exercicioId: BIKE_ID, modalidade: 'CARDIO', unidade: 'nenhuma', progressao: false, series }];
  const conteudo: ConteudoTreino = { objetivo: null, orientacoes: null, sessoes: [dia] };
  let atual: Receita = { id: ID, tipo: 'SESSAO_TREINO', origem: 'CONSULTORIA', nome: 'Cardio fictício', descricao: null, pastaId: null, ordem: 1, versao: 1, conteudo };
  const api = await simularApi(page, {
    // Chave do intervalado ligada (D16): o modo desligado é o `cardio-intervalado-chave.spec.ts`.
    ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'MODELO_LER', 'MODELO_ALTERAR'], cardioIntervaladoHabilitado: true })),
    'GET /inscricoes': { corpo: { itens: [], total: 0 } },
    'GET /exercicios': { corpo: BIBLIOTECA },
    [`GET /receitas/${ID}`]: (_p, route) => json(route, atual),
    [`PUT /receitas/${ID}/conteudo`]: (p, route) => {
      if (putFalha) {
        const e = erroApi(422, 'O plano tem problemas que impedem salvar.', 'PLANO_INVALIDO', [{ field: 'sessoes[0].exercicios[0].series[0].cardio.aquecimentoSeg', message: 'Aquecimento de 0 a 60 min.' }]);
        return json(route, e.corpo, e.status);
      }
      atual = { ...atual, ...p.corpo as Receita, versao: atual.versao + 1 };
      return json(route, atual);
    },
  });
  await page.goto(`/treinador/planejamento/modelo/${ID}`);
  await expect(page.getByRole('button', { name: 'Salvar modelo', exact: true })).toBeVisible();
  return { ...api, salvo: () => (api.pedidos.filter((p) => p.metodo === 'PUT').at(-1)!.corpo as { conteudo: ConteudoTreino }).conteudo.sessoes[0].exercicios[0].series };
}

const escolherNaLista = async (page: Page, campo: RegExp, opcao: RegExp) => {
  await page.getByRole('button', { name: campo }).click();
  await page.getByRole('option', { name: opcao }).click();
};
const digitarNaLista = async (page: Page, campo: RegExp, texto: string) => {
  await page.getByRole('button', { name: campo }).click();
  await page.getByRole('textbox', { name: 'Digite ou escolha', exact: true }).fill(texto);
  await page.keyboard.press('Enter');
};
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const paraOAluno = (page: Page) => page.getByRole('group', { name: 'Prévia para o aluno' });

for (const largura of [390, 1280]) {
  test(`cardio contínuo: um erro só, no campo, e o JSON sai com as chaves de sempre (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const api = await abrir(page, [bloco('b1', CONTINUO_VAZIO)]);
    if (largura < 960) await page.getByRole('button', { name: 'Editar Bike de teste', exact: true }).click();
    await expect(page.getByText('Prescrição do cardio', { exact: true })).toBeVisible();
    // Sem tabela de séries de musculação.
    await expect(page.getByRole('button', { name: 'Nova série', exact: true })).toHaveCount(0);
    // O erro aparece uma vez, no campo da duração; a distância some (a biblioteca só marca o ritmo).
    await expect(page.getByText('Informe a duração ou a distância.', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Distância (km)', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('40');
    await page.getByRole('textbox', { name: 'Ritmo (opcional)', exact: true }).fill('6');
    await page.getByRole('radio', { name: 'Zona 2', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Ritmo (opcional)', exact: true })).toHaveValue('6 min/km');
    await expect(page.getByText('Informe a duração ou a distância.', { exact: true })).toHaveCount(0);
    await expect(paraOAluno(page)).toContainText('Contínuo · 40 min · 6 min/km · Zona 2');
    expect(await semRolagemLateral(page)).toBe(true);
    await capturar(page, `continuo-${largura}-claro.png`, testInfo.outputPath(), true);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const [s] = api.salvo();
    // D16: nenhuma chave nova no contínuo (o app antigo recusaria o pacote).
    expect(Object.keys(s.cardio!).sort()).toEqual(['distanciaKm', 'duracaoMin', 'intervalos', 'ritmo', 'zona']);
    expect(s.cardio).toEqual({ duracaoMin: 40, distanciaKm: null, ritmo: '6 min/km', zona: 2, intervalos: null });
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`cardio intervalado: protocolos preenchem os padrões, aviso fora da faixa e dois blocos (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const api = await abrir(page, [bloco('b1', CONTINUO_VAZIO)]);
    if (largura < 960) await page.getByRole('button', { name: 'Editar Bike de teste', exact: true }).click();
    await page.getByRole('radio', { name: 'Intervalado', exact: true }).click();
    // Personalizado e vazio: nenhum número inventado.
    await expect(page.getByRole('button', { name: 'Estímulo: —. Escolher.', exact: true })).toBeVisible();
    await escolherNaLista(page, /^Protocolo: /, /^HIIT de intervalo curto/);
    await expect(page.getByText('10 × 30 s / 30 s · ~20 min no total', { exact: true })).toBeVisible();
    await escolherNaLista(page, /^Protocolo: /, /^HIIT de intervalo longo/);
    await expect(page.getByText(/^5 × 3 min \/ 2 min · ~3\d min no total$/)).toBeVisible();
    await escolherNaLista(page, /^Protocolo: /, /^RST/);
    await expect(page.getByText(/^10 × 6 s \/ 30 s · ~1\d min no total$/)).toBeVisible();
    await escolherNaLista(page, /^Protocolo: /, /^SIT/);
    await expect(page.getByText('6 × 30 s / 3 min · ~25 min no total', { exact: true })).toBeVisible();
    await expect(paraOAluno(page)).toContainText('SIT · 6 × 30 s all-out / 3 min · ~25 min');
    await expect(paraOAluno(page)).toContainText('Aquecimento 4 min · Desaquecimento 3 min');
    // O ⓘ explica o protocolo e leva à Ajuda.
    await page.getByRole('button', { name: /^O que é SIT/ }).click();
    await expect(page.getByText(/^Tiros all-out de 20–30 s/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Saiba mais sobre os protocolos' })).toBeVisible();
    await capturar(page, `sit-${largura}-claro.png`, testInfo.outputPath(), true);
    // Fora da faixa: avisa, não bloqueia.
    await digitarNaLista(page, /^Estímulo: /, '45');
    await expect(page.getByText('Fora da faixa do SIT (estímulo de 20 a 30 s)', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Passiva', exact: true }).click();
    await capturar(page, `fora-da-faixa-${largura}-claro.png`, testInfo.outputPath(), true);
    // "Fechar edição" devolve o foco à linha do bloco (WCAG 2.4.3) e reabre pelo toque.
    await page.getByRole('button', { name: 'Fechar edição do bloco 1', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Bloco 1 · SIT/ })).toBeFocused();
    await page.getByRole('button', { name: /^Bloco 1 · SIT/ }).click();
    // Segundo bloco, contínuo de 10 min; o cabeçalho soma os dois.
    await page.getByRole('button', { name: 'Novo bloco de cardio', exact: true }).click();
    await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('10');
    await expect(page.getByText('· 2 blocos · ~37 min', { exact: true })).toBeVisible();
    // Na lista de exercícios (duas colunas), o mesmo resumo.
    if (largura >= 960) await expect(page.getByRole('button', { name: /^Exercício 1 de 1: Bike de teste\. Cardio · 2 blocos · ~37 min/ })).toBeVisible();
    expect(await semRolagemLateral(page)).toBe(true);
    await capturar(page, `dois-blocos-${largura}-claro.png`, testInfo.outputPath(), true);
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    await expect.poll(() => api.pedidos.filter((p) => p.metodo === 'PUT').length).toBe(1);
    const [sit, cont] = api.salvo();
    expect(sit.cardio).toEqual({
      modo: 'INTERVALADO', protocolo: 'SIT', duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, esforcoMaximo: true,
      aquecimentoSeg: 240, desaquecimentoSeg: 180, recuperacaoTipo: 'PASSIVA', intervalos: { trabalhoSeg: 45, descansoSeg: 180, voltas: 6 },
    });
    expect(Object.keys(cont.cardio!).sort()).toEqual(['distanciaKm', 'duracaoMin', 'intervalos', 'ritmo', 'zona']);
    expect(api.errosDaPagina).toEqual([]);
    expect(api.naoTratadas).toEqual([]);
  });

  test(`cardio sem blocos: estado vazio e erro da API ao salvar (${largura}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: largura, height: 1000 });
    const api = await abrir(page, [], 'CLARO', true);
    if (largura < 960) await page.getByRole('button', { name: 'Editar Bike de teste', exact: true }).click();
    await expect(page.getByText(/^Nenhum bloco ainda\./)).toBeVisible();
    await capturar(page, `vazio-${largura}-claro.png`, testInfo.outputPath());
    await page.getByRole('button', { name: 'Novo bloco de cardio', exact: true }).click();
    await page.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('20');
    await page.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
    // A falha do servidor aparece no topo e no aviso; nada do que foi digitado se perde.
    await expect(page.getByText('O plano tem problemas que impedem salvar.').first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Duração (min)', exact: true })).toHaveValue('20');
    await capturar(page, `erro-api-${largura}-claro.png`, testInfo.outputPath());
    expect(api.naoTratadas).toEqual([]);
  });
}

// Capturas do visual nas três larguras, no claro e no escuro (e, em 1280, no areia e no contraste alto): o SIT aberto e um
// contínuo fechado embaixo.
for (const largura of [390, 1280, 1920]) {
  for (const tema of (largura === 1280 ? ['CLARO', 'ESCURO', 'AREIA', 'CLARO_ALTO'] : ['CLARO', 'ESCURO']) as Tema[]) {
    test(`cardio: capturas (${largura}px, ${tema.toLowerCase()})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: largura, height: largura < 960 ? 900 : 1100 });
      const sit: Cardio = { modo: 'INTERVALADO', protocolo: 'SIT', duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, esforcoMaximo: true,
        aquecimentoSeg: 240, desaquecimentoSeg: 180, recuperacaoTipo: 'PASSIVA', intervalos: { trabalhoSeg: 30, descansoSeg: 180, voltas: 6 } };
      await abrir(page, [bloco('b1', sit), bloco('b2', { ...CONTINUO_VAZIO, duracaoMin: 10, zona: 2 })], tema);
      if (largura < 960) await page.getByRole('button', { name: 'Editar Bike de teste', exact: true }).click();
      await expect(page.getByText('6 × 30 s / 3 min · ~25 min no total', { exact: true })).toBeVisible();
      await capturar(page, `editor-${largura}-${tema.toLowerCase()}.png`, testInfo.outputPath(), true);
    });
  }
}
