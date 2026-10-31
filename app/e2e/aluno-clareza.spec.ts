import { expect, test, type Page } from '@playwright/test';

import type { ConteudoDieta, RegistroEnvio, RegistroPeso, SessoesConcluidasResponse, VersaoDetalhe } from '../src/api/tipos';
import { fixarHoje, sessaoComTopSetEBackOff, sessaoDeAluno, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, json, sessao, simularApi } from './api-falsa';

/**
 * Clareza das telas do aluno (reunião de 30/10 com o Saraiva, A8 a A11, B5 e B6). Só textos e ordem do que aparece: a
 * conta da carga e o corpo enviado à API não mudam. Dados fictícios; relógio em segunda, 19/10/2026, 12:00.
 */

const enviarLote = (enviados: RegistroEnvio[]) => (p: { corpo: unknown }, route: Parameters<typeof json>[0]) => {
  const lote = (p.corpo as { registros: RegistroEnvio[] }).registros;
  enviados.push(...lote);
  return json(route, { resultados: lote.map((r) => ({ id: r.id, situacao: 'ACEITO', motivo: null })) });
};

const semEstourar = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

for (const largura of [390, 1280]) {
  test(`A8/A9: a série separa meta, último registro, hoje e o peso sugerido com a origem (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const sessoes = sessaoComTopSetEBackOff();
    sessoes[0]!.exercicios[0]!.series[0] = { ...sessoes[0]!.exercicios[0]!.series[0]!, alvoExtra: 'Segure 2 s embaixo' };
    const enviados: RegistroEnvio[] = [];
    const { errosDaPagina, naoTratadas } = await simularApi(page, {
      ...(await sessaoDeAlunoComTreino(page, sessoes)),
      'POST /aluno/execucoes/lote': enviarLote(enviados),
    });
    await page.goto('/aluno/sessao/topo/agacho?data=2026-10-19');

    // Cabeçalho, meta e a área de hoje em cada uma das três séries.
    await expect(page.getByText('Série 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Meta', { exact: true })).toHaveCount(3);
    await expect(page.getByText('Hoje', { exact: true })).toHaveCount(3);
    await expect(page.getByText('Ainda não registrado', { exact: true })).toHaveCount(3);
    // A observação do treinador tem nome claro; "Alvo extra" saiu da tela.
    await expect(page.getByText('Observação desta série: Segure 2 s embaixo', { exact: true })).toBeVisible();
    await expect(page.getByText(/Alvo extra/i)).toHaveCount(0);
    // A base do dia diz que é o ponto de partida.
    await expect(page.getByText(/^É o ponto de partida do dia\./)).toBeVisible();

    // Com a base, a WS mostra o sugerido e a origem; a próxima série parte desta, então o aviso do ✓ aparece.
    await page.getByRole('textbox', { name: 'Carga de trabalho do dia', exact: true }).fill('100');
    await expect(page.getByRole('textbox', { name: 'Peso da série 1, em quilos', exact: true })).toHaveValue('100');
    await expect(page.getByText(/^Sugerido: 100 kg · carga da base do dia$/)).toBeVisible();
    await expect(page.getByText('As séries seguintes só usam este peso depois que você marcar ✓.', { exact: true })).toBeVisible();

    // Marcar: "Ainda não registrado" some só dessa série e a sugestão dela sai (feita não sugere).
    await page.getByRole('textbox', { name: 'Repetições da série 1', exact: true }).fill('5');
    await page.getByRole('checkbox', { name: 'Série 1 feita', exact: true }).click();
    await expect(page.getByText('Ainda não registrado', { exact: true })).toHaveCount(2);
    await expect(page.getByText(/^Sugerido: 100 kg · carga da base do dia$/)).toHaveCount(0);
    // O Top set parte da WS registrada e diz isso.
    await expect(page.getByText(/^Sugerido: 105 kg · 5% acima da série anterior/)).toBeVisible();
    await expect.poll(() => enviados.filter((r) => r.serieUid === 'ws' && r.concluida).length).toBeGreaterThan(0);
    // O corpo enviado é o de sempre: carga e repetições digitadas.
    expect(enviados.filter((r) => r.serieUid === 'ws').at(-1)).toMatchObject({ carga: 100, repeticoes: 5, concluida: true });

    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const DIETA: VersaoDetalhe<ConteudoDieta> = {
  id: 'd0000000-0000-4000-8000-000000000001', planoId: 'p0000000-0000-4000-8000-000000000001', numero: 1, titulo: 'Dieta de teste',
  inicio: '2026-10-01', fim: '2026-10-31', publicadoEm: '2026-10-01T12:00:00Z',
  conteudo: {
    objetivo: null, dataInicio: null, profissional: null, orientacoes: [], observacoes: null, aguaLitros: null,
    refeicoes: [{
      uid: 'almoco', nome: 'Almoço', horario: '12:00', observacao: null,
      opcoes: [
        { uid: 'a', rotulo: 'A', itens: [{ uid: 'i1', alimentoId: null, nome: 'Arroz fictício', quantidade: 150, unidade: 'g', kcal: 190, proteina: 4, carboidrato: 30, gordura: 1, manual: true }] },
        { uid: 'b', rotulo: 'B', itens: [{ uid: 'i2', alimentoId: null, nome: 'Batata fictícia', quantidade: 200, unidade: 'g', kcal: 170, proteina: 4, carboidrato: 30, gordura: 1, manual: true }] },
      ],
    }],
    suplementacao: [{ uid: 's1', nome: 'Suplemento fictício', dose: '5 g', horario: '08:00', observacao: '', link: null }],
    ergogenicos: [{ uid: 'e1', nome: 'Item fictício', principioAtivo: '', concentracao: '', dose: '1 cápsula', horario: '', observacao: 'Com água', prescricao: '' }],
  },
};

for (const largura of [390, 1280]) {
  test(`A10/A12: dieta com linhas rotuladas, horário no cabeçalho e as opções que não se somam (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const { naoTratadas, errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/dieta': { corpo: { dieta: DIETA } },
      'GET /aluno/pesos': { corpo: [] },
    });
    await page.goto('/aluno/dieta');
    await expect(page.getByText('Horário: 12:00', { exact: true })).toBeVisible();
    await expect(page.getByText('As opções não se somam: o total do dia conta só a opção A.', { exact: true })).toBeVisible();
    // Cada informação numa linha, com o rótulo; só as preenchidas.
    await expect(page.getByText('Dose: 5 g', { exact: true })).toBeVisible();
    await expect(page.getByText('Horário: 08:00', { exact: true })).toBeVisible();
    await expect(page.getByText('Dose: 1 cápsula', { exact: true })).toBeVisible();
    await expect(page.getByText('Observação: Com água', { exact: true })).toBeVisible();
    await expect(page.getByText(/1 cápsula · /)).toHaveCount(0);
    await semEstourar(page);
    expect(naoTratadas).toEqual([]);
    expect(errosDaPagina).toEqual([]);
  });
}

const PESOS: RegistroPeso[] = [
  { id: 'p1', data: '2026-10-12', pesoKg: 80, variacao: null, observacao: null },
  { id: 'p2', data: '2026-10-19', pesoKg: 81.2, variacao: 1.2, observacao: null },
];

for (const largura of [390, 1280]) {
  test(`A11/B6: histórico vazio diz o motivo e o peso mostra seta, número e "desde" (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await fixarHoje(page);
    const { errosDaPagina } = await simularApi(page, {
      ...(await sessaoDeAluno(page)),
      'GET /aluno/pesos': { corpo: PESOS },
      'GET /aluno/fotos/linha-do-tempo': { corpo: [] },
      'GET /aluno/avaliacoes-fisicas': { corpo: [] },
    });
    await page.goto('/aluno/historico');
    // B6: registros e progresso vazios dizem por quê, em vez de sumir.
    await expect(page.getByText('Nenhum registro neste período.', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Nenhum registro neste período.', { exact: true })).toHaveCount(2);
    // A11: direção e número na cor do texto, contra quando; legenda uma vez.
    await expect(page.getByLabel('Subiu 1,2 kg desde 12/10', { exact: true })).toBeVisible();
    await expect(page.getByText('▲ +1,2 kg', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Sem registro anterior', { exact: true })).toBeVisible();
    await expect(page.getByText('▲ subiu · ▼ desceu desde o registro anterior', { exact: true })).toHaveCount(1);
    await semEstourar(page);
    expect(errosDaPagina).toEqual([]);
  });
}

/** Treino de dois exercícios com três séries cada; o aluno faz o 2º primeiro e termina no 1º (fora de ordem). */
async function abrirTreinoDeDois(page: Page, ligada: boolean) {
  await fixarHoje(page);
  const conclusoes: unknown[] = [];
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, [sessaoFalsa('sx', 'Treino curto', 1, 2)])),
    ...(ligada ? await sessao(page, ALUNO, { retornoHabilitado: true }) : {}),
    'POST /aluno/execucoes/lote': enviarLote([]),
    ...(ligada
      ? {
          'GET /aluno/sessoes-concluidas': { corpo: { totalConcluidos: 0, sessoes: [] } satisfies SessoesConcluidasResponse },
          'POST /aluno/sessoes-concluidas': (p, route) => {
            conclusoes.push(p.corpo);
            return json(route, { resultados: [] });
          },
        }
      : {}),
  });
  await page.goto('/aluno/sessao/sx/sxe2?data=2026-10-19');
  for (const n of [1, 2, 3]) await page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Série 3 feita', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Anterior: Exercício sxe1', exact: true }).click();
  await expect(page).toHaveURL(/\/aluno\/sessao\/sx\/sxe1\?data=2026-10-19$/);
  for (const n of [1, 2, 3]) await page.getByRole('checkbox', { name: `Série ${n} feita`, exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Série 3 feita', exact: true })).toBeChecked();
  return { ...api, conclusoes };
}

const revisar = (page: Page) => page.getByRole('button', { name: 'Revisar e concluir treino', exact: true });
const proximo = (page: Page) => page.getByRole('button', { name: 'Próximo: Exercício sxe2', exact: true });

for (const largura of [390, 1280]) {
  test(`B5 ligado: tudo marcado, "Revisar e concluir treino" vem antes do "Próximo" e só abre a Folha (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirTreinoDeDois(page, true);

    // Topo e rodapé; no rodapé ele é o primário e o "Próximo" passa a secundário, logo abaixo.
    await expect(revisar(page)).toHaveCount(2);
    await expect(proximo(page)).toBeVisible();
    const [rodape, depois] = [await revisar(page).last().boundingBox(), await proximo(page).boundingBox()];
    if (!rodape || !depois) throw new Error('sem caixa');
    expect(depois.y).toBeGreaterThan(rodape.y);
    await expect(page.getByText('6 de 6 séries feitas neste treino.', { exact: true })).toBeVisible();

    // Nada é automático: o toque abre a Folha com "Fiz tudo" sugerido, e cancelar não conclui.
    await revisar(page).last().click();
    const folha = page.getByRole('dialog', { name: 'Concluir treino' });
    await expect(folha).toBeVisible();
    await expect(folha.getByLabel('Fiz tudo', { exact: true })).toHaveAttribute('aria-checked', 'true');
    await folha.getByRole('button', { name: 'Cancelar' }).click();
    await expect(folha).toHaveCount(0);
    await expect(page.getByText('Treino concluído')).toHaveCount(0);
    expect(api.conclusoes).toEqual([]);

    await semEstourar(page);
    expect(api.errosDaPagina).toEqual([]);
  });
}

for (const largura of [390, 1280]) {
  test(`B5 desligado: tudo marcado não muda nada (o "Próximo" segue o primário, sem "Revisar e concluir treino") (${largura}px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const api = await abrirTreinoDeDois(page, false);
    await expect(proximo(page)).toBeVisible();
    await expect(revisar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Concluir treino', exact: true })).toHaveCount(0);
    expect(api.pedidos.filter((p) => p.caminho === '/aluno/sessoes-concluidas')).toEqual([]);
    await semEstourar(page);
    expect(api.errosDaPagina).toEqual([]);
  });
}
