import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Atualizacao, ConteudoDieta, ConteudoQuestionario, DiaDeTreino, ItemDieta, PerguntaAtualizacao, Sessao } from '../src/api/tipos';
import { fixarHoje, sessaoDeAlunoComTreino, sessaoFalsa } from './aluno';
import { ALUNO, erroApi, json, simularApi, type RespostasApi } from './api-falsa';

/**
 * Atualização do aluno com o questionário que o `scripts/questionario/atualizacao-saraiva.mjs` monta (bloco C de
 * `docs/planos/atualizacao-pasta-e-questionarios.md`): Sim/Não que abre a lista de itens do plano (alimentos da dieta,
 * exercícios do treino, dias treinados), motivo com o rótulo da pergunta e a foto do aparelho. O aluno responde tudo e
 * envia; o corpo leva `{id, motivo}` sem o nome e sem as perguntas escondidas. Também: o 422 do dia que o servidor não
 * reconhece (resposta mantida, explicação no campo), a lista vazia e a semana sem treino registrado. 390 e 1280, claro e
 * escuro; capturas em `E2E_CAPTURAS`. Só dados fictícios.
 */

const CAPTURAS = process.env.E2E_CAPTURAS;
const PASTA_ID = 'f0000000-0000-4000-8000-0000000000c1';
const VERSAO_ID = 'q0000000-0000-4000-8000-0000000000c1';

// ---- O questionário: o padrão de hoje (V001) com as 8 trocas do script, copiadas dele sem mudar rótulo nem regra. ----
// O script roda a API ao ser importado; por isso a cópia. O teste abaixo confere que cada rótulo ainda está no script.
const p = (id: string, tipo: PerguntaAtualizacao['tipo'], rotulo: string, extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao =>
  ({ id, tipo, rotulo, obrigatoria: false, ...extra });
const opcoes = (...pares: [string, string][]) => pares.map(([id, rotulo]) => ({ id, rotulo }));
const quando = (perguntaId: string, valor: 'sim' | 'nao') => ({ mostrarSe: { perguntaId, valores: [valor] } });
const itens = (id: string, rotulo: string, fonte: PerguntaAtualizacao['fonte'], max: number, extra: Partial<PerguntaAtualizacao> = {}) =>
  p(id, 'ITENS_DO_PLANO', rotulo, { fonte, max, motivo: 'OPCIONAL', ...extra });
const DIAS_DA_SEMANA = opcoes(['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado'], ['dom', 'Domingo']);

const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: ['O feedback deve ser enviado no dia da atualização. Caso ocorram atrasos, avise previamente.', 'Atualização de peso e fotos em jejum'],
  secoes: [
    { uid: 'secao-1', titulo: 'Atualização', perguntas: [
      p('data', 'DATA_AUTOMATICA', 'Atualização'),
      p('peso', 'PESO', 'Peso (em jejum)', { obrigatoria: true }),
      p('fotos', 'FOTOS', 'Fotos em jejum'),
      p('psicologico', 'TEXTO_LONGO', 'Como foi o seu psicológico durante o mês?'),
      p('sono', 'NOTA', 'De 0 a 10, como foi o seu sono?', { destaque: true, obrigatoria: true, rotuloCurto: 'Sono' }),
      p('estresse', 'TEXTO_LONGO', 'Passou algum momento de estresse?'),
    ] },
    { uid: 'secao-2', titulo: 'Alimentar', perguntas: [
      p('alim_desempenho', 'NOTA', 'Desempenho (0 a 10)', { destaque: true, obrigatoria: true, rotuloCurto: 'Alimentar' }),
      p('alim_faltou', 'TEXTO_LONGO', 'Sentiu que faltou algo durante a dieta?'),
      p('alim_livre', 'TEXTO_LONGO', 'O que comeu em cada refeição livre e em qual quantidade?'),
      p('alim_digestao', 'TEXTO', 'Como está sua digestão?'),
      p('alim_fome_periodo', 'MULTIPLA_ESCOLHA', 'Momento que mais ficou com fome', {
        opcoes: opcoes(['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['madrugada', 'Madrugada'], ['normal', 'Não senti mais fome que o normal']) }),
      p('alim_enjoou_sn', 'SIM_NAO', 'Algum alimento que enjoou ou gostaria de substituir?'),
      itens('alim_enjoou_itens', 'Quais alimentos você quer substituir?', 'ALIMENTOS_DA_DIETA', 10, quando('alim_enjoou_sn', 'sim')),
      p('alim_incluir', 'TEXTO_LONGO', 'Gostaria de comer algo durante as refeições (e em qual refeição)?'),
    ] },
    { uid: 'secao-3', titulo: 'Treino', perguntas: [
      p('treino_dias_faltou', 'ESCOLHA_UNICA', 'Quantos dias por semana está conseguindo treinar?', {
        opcoes: opcoes(['todos', 'Todos os prescritos'], ['faltei-1', 'Faltei 1 dia'], ['faltei-2-ou-mais', 'Faltei 2 ou mais']) }),
      p('treino_desempenho', 'NOTA', 'Desempenho (0 a 10)', { destaque: true, obrigatoria: true, rotuloCurto: 'Treino' }),
      p('treino_dores_sn', 'SIM_NAO', 'Sentiu dores ou dificuldades?'),
      itens('treino_dores_itens', 'Em quais exercícios?', 'EXERCICIOS_DO_TREINO', 10, { rotuloMotivo: 'Onde e como doeu?', ...quando('treino_dores_sn', 'sim') }),
      p('treino_descanso_sn', 'SIM_NAO', 'Precisou fazer descanso no meio da semana?'),
      p('treino_descanso_dias', 'MULTIPLA_ESCOLHA', 'Qual dia?', { opcoes: DIAS_DA_SEMANA, ...quando('treino_descanso_sn', 'sim') }),
      p('treino_acrescentar', 'TEXTO_LONGO', 'Algo a acrescentar?'),
    ] },
    { uid: 'secao-4', titulo: 'Feedbacks dos treinos durante esse período', perguntas: [
      p('fb_recuperacao', 'TEXTO_LONGO', 'De 0 a 10, como foi a recuperação de cada dia?'),
      p('fb_dores', 'TEXTO_LONGO', 'Sentiu dores durante a semana?'),
      p('fb_fadiga', 'TEXTO_LONGO', 'Sentiu muita fadiga durante a semana?'),
      itens('fb_desgastante_dia', 'Qual dia foi mais desgastante?', 'DIAS_TREINADOS', 1),
      p('fb_substituiu_sn', 'SIM_NAO', 'Teve algum exercício que substituiu por não ter o maquinário?'),
      itens('fb_substituiu_itens', 'Quais exercícios você substituiu?', 'EXERCICIOS_DO_TREINO', 10, { rotuloMotivo: 'O que usou no lugar?', ...quando('fb_substituiu_sn', 'sim') }),
      p('fb_substituiu_foto', 'FOTOS', 'Foto do aparelho que você usou', { max: 2, ...quando('fb_substituiu_sn', 'sim') }),
      p('fb_recuperou_sn', 'SIM_NAO', 'Seu músculo recuperou até a próxima sessão?'),
      itens('fb_recuperou_dias', 'Em quais treinos você ainda estava dolorido?', 'DIAS_TREINADOS', 10, quando('fb_recuperou_sn', 'nao')),
      p('fb_pos_treino', 'NOTAS_POR_DIA', 'De 0 a 10, como você se sentiu pós-treino nos dias abaixo', { dias: [1, 2, 3, 4, 5, 6] }),
      p('fb_mes', 'TEXTO_LONGO', 'Me diz brevemente um feedback desse mês ou alguma observação relevante para o seu desenvolvimento'),
    ] },
  ],
};

// ---- O plano do aluno (fictício). ----
const nomes = (s: Sessao, lista: string[]): Sessao => ({ ...s, exercicios: s.exercicios.slice(0, lista.length).map((e, i) => ({ ...e, nome: lista[i] })) });
const SESSOES = [
  nomes(sessaoFalsa('sa', 'Peito e tríceps', 1, 3), ['Supino reto', 'Crucifixo', 'Tríceps corda']),
  nomes(sessaoFalsa('sb', 'Costas e bíceps', 3, 3), ['Remada baixa', 'Puxada frontal', 'Rosca direta']),
  nomes(sessaoFalsa('sc', 'Pernas', 5, 3), ['Leg press horizontal', 'Agachamento livre', 'Cadeira extensora']),
];
const item = (uid: string, nome: string): ItemDieta => ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'g', kcal: null, proteina: null, carboidrato: null, gordura: null, manual: true });
const CONTEUDO_DIETA: ConteudoDieta = {
  objetivo: null, dataInicio: null, profissional: null, observacoes: null, orientacoes: [], suplementacao: [], ergogenicos: null, aguaLitros: null, variacoes: [],
  refeicoes: [
    { uid: 'r1', nome: 'Café da manhã', horario: '07:00', observacao: null, opcoes: [{ uid: 'o1', rotulo: 'Opção A', itens: [item('i1', 'Ovos mexidos'), item('i2', 'Pão integral'), item('i3', 'Banana')] }] },
    { uid: 'r2', nome: 'Almoço', horario: '12:00', observacao: null, opcoes: [
      { uid: 'o2', rotulo: 'Opção A', itens: [item('i4', 'Frango grelhado'), item('i5', 'Arroz branco'), item('i6', 'Feijão carioca')] },
      // "Frango grelhado" de novo na outra opção: o aluno vê um só.
      { uid: 'o3', rotulo: 'Opção B', itens: [item('i7', 'Frango grelhado'), item('i8', 'Batata-doce'), item('i9', 'Brócolis')] },
    ] },
  ],
};
const DIETA = { id: 'd0000000-0000-4000-8000-0000000000c1', planoId: 'd0000000-0000-4000-8000-0000000000c2', numero: 1, titulo: 'Dieta', inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z', conteudo: CONTEUDO_DIETA };

/** Séries concluídas no servidor: segunda 12/10 (A), quarta 14/10 (B) e sexta 16/10 (C). */
const diaTreinado = (data: string, sessao: Sessao): DiaDeTreino => ({
  data, sessoes: [{ sessaoUid: sessao.uid, sessao: sessao.nome, planoVersaoId: 't0000000-0000-4000-8000-000000000002', exercicios: [{
    exercicioUid: sessao.exercicios[0].uid, exercicioId: null, nome: sessao.exercicios[0].nome,
    series: [{ id: `x-${data}`, serieUid: sessao.exercicios[0].series[0].uid, tipo: 'WORKING', trabalho: true, carga: 40, unidade: 'kg', repeticoes: 10, concluida: true, observacao: null }],
  }] }],
});
const DIAS_TREINADOS = [diaTreinado('2026-10-12', SESSOES[0]), diaTreinado('2026-10-14', SESSOES[1]), diaTreinado('2026-10-16', SESSOES[2])];

const ABERTA: Atualizacao = {
  id: null, pastaId: PASTA_ID, alunoId: ALUNO.id, nomeAluno: null, dataAtualizacao: '2026-10-20', fase: 'ABERTA', diasParaData: 1, diasDeAtraso: 0,
  atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 3, questionarioVersaoId: VERSAO_ID, questionarioNome: null, modelo: MODELO,
  respostas: null, enviadaEm: null, feedback: null, versao: null, resumo: { diasComTreino: 3, mediaDiasPorSemana: 1.5, pesoAnterior: 81 },
};

interface Abertura { largura: number; escuro?: boolean; altura?: number; extra?: RespostasApi; semDieta?: boolean; semTreinos?: boolean }

async function abrir(page: Page, { largura, escuro = false, altura = 900, extra = {}, semDieta, semTreinos }: Abertura) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [ALUNO.id, escuro ? 'ESCURO' : 'CLARO'] as const);
  await fixarHoje(page);
  const api = await simularApi(page, {
    ...(await sessaoDeAlunoComTreino(page, SESSOES)),
    'GET /aluno/atualizacao': { corpo: ABERTA },
    'GET /aluno/dieta': { corpo: { dieta: semDieta ? null : DIETA } },
    'GET /aluno/execucoes': { corpo: semTreinos ? [] : DIAS_TREINADOS },
    ...extra,
  });
  await page.goto('/aluno/atualizacao');
  await expect(page.getByText('Instruções', { exact: true })).toBeVisible();
  return api;
}

const grupo = (page: Page, nome: string) => page.getByRole('radiogroup', { name: nome, exact: true });
const escolher = (page: Page, nome: string, opcao: string) => grupo(page, nome).getByRole('radio', { name: opcao, exact: true }).click();
const caixa = (page: Page, nome: string) => page.getByRole('checkbox', { name: nome, exact: true });
const cartao = (page: Page, titulo: string): Locator => page.getByTestId('cartao').filter({ has: page.getByText(titulo, { exact: true }) });

async function capturar(alvo: Locator | Page, nome: string) {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  await alvo.screenshot({ path: join(CAPTURAS, `${nome}.png`) });
}

/** Responde o questionário inteiro como o aluno faria (sem foto: o recurso de fotos está desligado na sessão de teste). */
async function responderTudo(page: Page) {
  await page.getByLabel('Peso (em jejum) *').fill('80,5');
  await page.getByLabel('Como foi o seu psicológico durante o mês?').fill('Tranquilo, com uma semana mais corrida.');
  await escolher(page, 'De 0 a 10, como foi o seu sono? *', '8 de 10');
  await page.getByLabel('Passou algum momento de estresse?').fill('Prova no trabalho.');
  await grupo(page, 'Desempenho (0 a 10) *').nth(0).getByRole('radio', { name: '7 de 10', exact: true }).click();
  await page.getByLabel('Sentiu que faltou algo durante a dieta?').fill('Não.');
  await page.getByLabel('O que comeu em cada refeição livre e em qual quantidade?').fill('Uma pizza média no sábado.');
  await page.getByLabel('Como está sua digestão?').fill('Boa.');
  await caixa(page, 'Tarde').click();
  await caixa(page, 'Noite').click();
  await escolher(page, 'Algum alimento que enjoou ou gostaria de substituir?', 'Sim');
  await caixa(page, 'Batata-doce').click();
  await page.getByLabel('Motivo (opcional) — Batata-doce').fill('Enjoei');
  await caixa(page, 'Banana').click();
  await page.getByLabel('Gostaria de comer algo durante as refeições (e em qual refeição)?').fill('Iogurte no lanche.');
  await escolher(page, 'Quantos dias por semana está conseguindo treinar?', 'Faltei 1 dia');
  await grupo(page, 'Desempenho (0 a 10) *').nth(1).getByRole('radio', { name: '9 de 10', exact: true }).click();
  await escolher(page, 'Sentiu dores ou dificuldades?', 'Sim');
  await cartao(page, 'Treino').getByRole('checkbox', { name: 'Agachamento livre', exact: true }).click();
  await page.getByLabel('Onde e como doeu? (opcional) — Agachamento livre').fill('Joelho direito na descida.');
  await escolher(page, 'Precisou fazer descanso no meio da semana?', 'Não');
  await page.getByLabel('Algo a acrescentar?').fill('Nada.');
  await page.getByLabel('De 0 a 10, como foi a recuperação de cada dia?').fill('Entre 7 e 8.');
  await page.getByLabel('Sentiu dores durante a semana?').fill('Só no joelho.');
  await page.getByLabel('Sentiu muita fadiga durante a semana?').fill('Na sexta.');
  await escolher(page, 'Qual dia foi mais desgastante?', 'Sex 16/10 · Pernas');
  await page.getByLabel('Motivo (opcional) — Sex 16/10 · Pernas').fill('Dormi pouco.');
  await escolher(page, 'Teve algum exercício que substituiu por não ter o maquinário?', 'Sim');
  await cartao(page, 'Feedbacks dos treinos durante esse período').getByRole('checkbox', { name: 'Leg press horizontal', exact: true }).click();
  await page.getByLabel('O que usou no lugar? (opcional) — Leg press horizontal').fill('Agachamento no hack.');
  await escolher(page, 'Seu músculo recuperou até a próxima sessão?', 'Não');
  await caixa(page, 'Seg 12/10 · Peito e tríceps').click();
  await page.getByLabel(/^Dia 1\. Toque/).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByLabel('Me diz brevemente um feedback desse mês ou alguma observação relevante para o seu desenvolvimento').fill('Mês bom.');
}

test('os rótulos copiados do script continuam iguais aos dele', () => {
  const script = readFileSync(join(process.cwd(), '..', 'scripts', 'questionario', 'atualizacao-saraiva.mjs'), 'utf8');
  const novas = ['alim_fome_periodo', 'alim_enjoou_sn', 'alim_enjoou_itens', 'treino_dias_faltou', 'treino_dores_sn', 'treino_dores_itens',
    'treino_descanso_sn', 'treino_descanso_dias', 'fb_desgastante_dia', 'fb_substituiu_sn', 'fb_substituiu_itens', 'fb_substituiu_foto', 'fb_recuperou_sn', 'fb_recuperou_dias'];
  const perguntas = MODELO.secoes.flatMap((s) => s.perguntas).filter((q) => novas.includes(q.id));
  expect(perguntas).toHaveLength(novas.length);
  for (const q of perguntas) {
    expect(script).toContain(`'${q.id}'`);
    expect(script).toContain(`'${q.rotulo}'`);
    if (q.rotuloMotivo) expect(script).toContain(`'${q.rotuloMotivo}'`);
  }
  expect(script).toContain("const MOTIVO_DO_DIA_DESGASTANTE = 'OPCIONAL'");
});

for (const largura of [390, 1280]) {
  test(`aluno responde o questionário inteiro e envia: itens com o motivo, sem nome e sem as escondidas (${largura}px)`, async ({ page }) => {
    let corpo: { respostas: Record<string, unknown> } | null = null;
    const { errosDaPagina } = await abrir(page, { largura, extra: {
      'POST /aluno/atualizacao/enviar': (pedido, route) => {
        corpo = pedido.corpo as typeof corpo;
        return json(route, { ...ABERTA, id: 'e0000000-0000-4000-8000-0000000000c1', fase: 'ENVIADA', enviadaEm: '2026-10-19T15:00:00Z', versao: 1, respostas: corpo?.respostas });
      },
    } });
    // Sim/Não fecha a lista: sem o "Sim", nada de exercícios na tela.
    await expect(page.getByText('Quais exercícios você substituiu?', { exact: true })).toHaveCount(0);
    // A média de dias não vale na escolha única (decisão de 27/11): a pergunta fica sem ela.
    await expect(page.getByText(/dias de treino por semana/)).toHaveCount(0);
    await responderTudo(page);
    // Lista do plano: exercícios do treino (com busca, são 9), alimentos sem repetir, dias treinados com a sessão.
    await expect(page.getByLabel('Buscar exercício').first()).toBeVisible();
    await expect(caixa(page, 'Frango grelhado')).toHaveCount(1);
    await expect(page.getByText('1 de 10 escolhidos', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Enviar atualização' }).click();
    await expect(page.getByText('Atualização enviada', { exact: true })).toBeVisible();
    const r = corpo!.respostas;
    expect(r.fb_substituiu_itens).toEqual([{ id: 'sce1', motivo: 'Agachamento no hack.' }]);
    expect(r.alim_enjoou_itens).toEqual([{ id: 'i8', motivo: 'Enjoei' }, { id: 'i3' }]);
    expect(r.treino_dores_itens).toEqual([{ id: 'sce2', motivo: 'Joelho direito na descida.' }]);
    expect(r.fb_desgastante_dia).toEqual([{ id: '2026-10-16', motivo: 'Dormi pouco.' }]);
    expect(r.fb_recuperou_dias).toEqual([{ id: '2026-10-12' }]);
    expect(r.treino_descanso_sn).toBe(false);
    expect('treino_descanso_dias' in r).toBe(false);
    expect(r.peso).toBe(80.5);
    expect(r.sono).toBe(8);
    expect(errosDaPagina).toEqual([]);
  });

  test(`dia que o servidor não reconhece: a resposta fica e o campo explica (${largura}px)`, async ({ page }) => {
    let envios = 0;
    const recusa = erroApi(422, 'Confira os campos.', 'ATUALIZACAO_INVALIDA', [{ field: 'fb_desgastante_dia', message: 'Item que não está na lista.' }]);
    await abrir(page, { largura, extra: {
      'POST /aluno/atualizacao/enviar': (_pedido, route) => { envios++; return json(route, recusa.corpo, recusa.status); },
    } });
    await page.getByLabel('Peso (em jejum) *').fill('80,5');
    await escolher(page, 'De 0 a 10, como foi o seu sono? *', '8 de 10');
    await grupo(page, 'Desempenho (0 a 10) *').nth(0).getByRole('radio', { name: '7 de 10', exact: true }).click();
    await grupo(page, 'Desempenho (0 a 10) *').nth(1).getByRole('radio', { name: '9 de 10', exact: true }).click();
    await escolher(page, 'Qual dia foi mais desgastante?', 'Qua 14/10 · Costas e bíceps');
    await page.getByLabel('Motivo (opcional) — Qua 14/10 · Costas e bíceps').fill('Muito volume.');
    await page.getByRole('button', { name: 'Enviar atualização' }).click();
    await expect(page.getByText(/A lista de dias mudou depois que seus treinos chegaram ao servidor/)).toBeVisible();
    expect(envios).toBeGreaterThan(0);
    // Nada se perdeu: o dia segue marcado e o motivo escrito.
    await expect(grupo(page, 'Qual dia foi mais desgastante?').getByRole('radio', { name: 'Qua 14/10 · Costas e bíceps', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Motivo (opcional) — Qua 14/10 · Costas e bíceps')).toHaveValue('Muito volume.');
    await expect(page.getByText('Atualização enviada', { exact: true })).toHaveCount(0);
  });

  test(`sem dieta a lista diz por que está vazia; sem treino registrado os dias são os da semana (${largura}px)`, async ({ page }) => {
    await abrir(page, { largura, semDieta: true, semTreinos: true });
    await escolher(page, 'Algum alimento que enjoou ou gostaria de substituir?', 'Sim');
    await expect(page.getByText(/^Sua dieta não tem alimentos para escolher/)).toBeVisible();
    await expect(grupo(page, 'Qual dia foi mais desgastante?').getByRole('radio', { name: 'Segunda-feira', exact: true })).toBeVisible();
    await expect(grupo(page, 'Qual dia foi mais desgastante?').getByRole('radio', { name: 'Domingo', exact: true })).toBeVisible();
  });

  test(`limite de itens e motivo obrigatório (${largura}px)`, async ({ page }) => {
    const modelo: ConteudoQuestionario = { formato: 2, instrucoes: [], secoes: [{ uid: 's', titulo: 'Treino', perguntas: [
      itens('dois', 'Quais exercícios incomodaram?', 'EXERCICIOS_DO_TREINO', 2, { motivo: 'OBRIGATORIO', rotuloMotivo: 'O que sentiu?', obrigatoria: true }),
    ] }] };
    await abrir(page, { largura, extra: { 'GET /aluno/atualizacao': { corpo: { ...ABERTA, modelo } } } });
    await expect(page.getByText('Quais exercícios incomodaram? *', { exact: true })).toBeVisible();
    await caixa(page, 'Supino reto').click();
    await caixa(page, 'Remada baixa').click();
    await expect(caixa(page, 'Crucifixo')).toBeDisabled();
    await expect(page.getByText(/Você chegou ao limite/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Enviar atualização' }).click();
    await expect(page.getByText('Informe o motivo de cada item.', { exact: true })).toBeVisible();
    await expect(page.getByText('Escreva o motivo.', { exact: true })).toHaveCount(2);
    await caixa(page, 'Remada baixa').click();
    await expect(caixa(page, 'Crucifixo')).toBeEnabled();
  });

  for (const escuro of [false, true]) {
    const tema = escuro ? 'escuro' : 'claro';
    test(`capturas do campo de itens do plano (${largura}px, ${tema})`, async ({ page }) => {
      await abrir(page, { largura, escuro, altura: 3800 });
      await escolher(page, 'Teve algum exercício que substituiu por não ter o maquinário?', 'Sim');
      await cartao(page, 'Feedbacks dos treinos durante esse período').getByRole('checkbox', { name: 'Leg press horizontal', exact: true }).click();
      await page.getByLabel('O que usou no lugar? (opcional) — Leg press horizontal').fill('Agachamento no hack.');
      await escolher(page, 'Qual dia foi mais desgastante?', 'Sex 16/10 · Pernas');
      await escolher(page, 'Seu músculo recuperou até a próxima sessão?', 'Não');
      await caixa(page, 'Seg 12/10 · Peito e tríceps').click();
      await page.waitForTimeout(300);
      await capturar(cartao(page, 'Feedbacks dos treinos durante esse período'), `itens-feedbacks-${largura}-${tema}`);
      await escolher(page, 'Algum alimento que enjoou ou gostaria de substituir?', 'Sim');
      await caixa(page, 'Batata-doce').click();
      await capturar(cartao(page, 'Alimentar'), `itens-alimentar-${largura}-${tema}`);
      if (largura < 768) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
    });
  }
}

test('aluno relê a atualização enviada: cada item com o nome gravado pelo servidor e o motivo (390px)', async ({ page }) => {
  const enviada: Atualizacao = { ...ABERTA, id: 'e0000000-0000-4000-8000-0000000000c1', fase: 'ENVIADA', enviadaEm: '2026-10-19T15:00:00Z', versao: 1, respostas: {
    peso: 80.5, sono: 8, alim_desempenho: 7, treino_desempenho: 9, fb_substituiu_sn: true,
    fb_substituiu_itens: [{ id: 'sce1', nome: 'Leg press horizontal', motivo: 'Agachamento no hack.' }] as unknown as string[],
    fb_desgastante_dia: [{ id: '2026-10-16', nome: 'Sex 16/10 · Pernas' }] as unknown as string[],
  } };
  await abrir(page, { largura: 390, altura: 2600, extra: { 'GET /aluno/atualizacao': { corpo: enviada } } });
  await expect(page.getByText('Leg press horizontal', { exact: true })).toBeVisible();
  await expect(page.getByText('O que usou no lugar? Agachamento no hack.', { exact: true })).toBeVisible();
  await expect(page.getByText('Sex 16/10 · Pernas', { exact: true })).toBeVisible();
  await capturar(cartao(page, 'Feedbacks dos treinos durante esse período'), 'leitura-itens-390');
});
