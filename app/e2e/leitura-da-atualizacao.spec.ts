import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Atualizacao, ConteudoQuestionario } from '../src/api/tipos';
import { sessaoDeAluno } from './aluno';
import { ALUNO, PERMISSOES_TREINADOR, sessao, simularApi, TREINADOR } from './api-falsa';

/**
 * Leitura das respostas da atualização (bloco B de `docs/planos/atualizacao-pasta-e-questionarios.md`): a mesma peça para
 * o aluno (atualização já enviada) e o treinador. Cada pergunta é uma linha com divisória; a seção diz quantas perguntas
 * tem; nota "4/10" com a escala só fora de 0 a 10; notas por dia numa tabelinha; Sim/Não em selo; vazio "Não respondeu".
 * Em 390, 1280 e 1920, claro e escuro. `CAPTURAS_LEITURA` grava as capturas numa pasta de fora do repositório.
 */

// `ALTURA_LEITURA` alto (ex.: 3200) põe a leitura inteira numa captura: a tela do aluno rola por dentro, não a página.
const ALTURA = Number(process.env.ALTURA_LEITURA ?? 900);
const ATUALIZACAO_ID = 'e0000000-0000-4000-8000-0000000000b1';
const ALUNO_ID = 'a0000000-0000-4000-8000-000000000002';

const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: ['Responda pensando no período da pasta.'],
  secoes: [
    {
      uid: 's1', titulo: 'Treino e rotina', perguntas: [
        { id: 'data', tipo: 'DATA_AUTOMATICA', rotulo: 'Data da atualização', obrigatoria: false },
        { id: 'dias', tipo: 'NUMERO', rotulo: 'Quantos dias por semana você conseguiu treinar?', obrigatoria: true, min: 0, max: 7, casas: 0 },
        { id: 'energia', tipo: 'NOTA', rotulo: 'Como está sua energia?', obrigatoria: true },
        { id: 'sono', tipo: 'NOTA', rotulo: 'Qualidade do sono', obrigatoria: false, min: 1, max: 5 },
        { id: 'dores', tipo: 'SIM_NAO', rotulo: 'Sentiu dores nos treinos?', obrigatoria: true },
        { id: 'onde', tipo: 'TEXTO', rotulo: 'Onde doeu?', obrigatoria: false, mostrarSe: { perguntaId: 'dores', valores: ['sim'] } },
        { id: 'cansaco', tipo: 'NOTAS_POR_DIA', rotulo: 'Cansaço em cada dia de treino', obrigatoria: false, dias: [1, 2, 3, 4, 5, 6] },
      ],
    },
    {
      uid: 's2', titulo: 'Alimentação', perguntas: [
        { id: 'info', tipo: 'INFORMATIVO', rotulo: 'Sobre a dieta', obrigatoria: false, texto: 'Pense na última semana.' },
        { id: 'peso', tipo: 'PESO', rotulo: 'Peso em jejum', obrigatoria: true },
        { id: 'fome', tipo: 'ESCOLHA_UNICA', rotulo: 'Momento em que mais sentiu fome', obrigatoria: false, opcoes: [
          { id: 'manha', rotulo: 'Manhã' }, { id: 'tarde', rotulo: 'Tarde' }, { id: 'noite', rotulo: 'Noite' }] },
        { id: 'substituir', tipo: 'SIM_NAO', rotulo: 'Algum alimento que gostaria de substituir?', obrigatoria: false },
        { id: 'qual', tipo: 'TEXTO', rotulo: 'Qual alimento?', obrigatoria: false, mostrarSe: { perguntaId: 'substituir', valores: ['sim'] } },
        { id: 'obs', tipo: 'TEXTO_LONGO', rotulo: 'Quer contar mais alguma coisa ao treinador?', obrigatoria: false },
      ],
    },
    {
      uid: 's3', titulo: 'Hábitos', perguntas: [
        { id: 'grade', tipo: 'GRADE', rotulo: 'Com que frequência você…', obrigatoria: false,
          linhas: [{ id: 'agua', rotulo: 'Bebeu água ao longo do dia' }, { id: 'alongou', rotulo: 'Alongou depois do treino' }],
          colunas: [{ id: 'nunca', rotulo: 'Nunca' }, { id: 'as-vezes', rotulo: 'Às vezes' }, { id: 'sempre', rotulo: 'Sempre' }] },
      ],
    },
    {
      uid: 's5', titulo: 'Semana inteira', perguntas: [
        { id: 'semana', tipo: 'NOTAS_POR_DIA', rotulo: 'Disposição em cada dia da semana', obrigatoria: false, dias: [1, 2, 3, 4, 5, 6, 7] },
        { id: 'aceite', tipo: 'ACEITE', rotulo: 'Combinado do acompanhamento', obrigatoria: true, texto: 'Envio as respostas no prazo.', declaracao: 'Li e concordo.' },
        // Tipo que esta versão do app ainda não conhece (vem de uma API mais nova).
        { id: 'futuro', tipo: 'TIPO_DO_FUTURO' as ConteudoQuestionario['secoes'][number]['perguntas'][number]['tipo'], rotulo: 'Pergunta de uma versão nova', obrigatoria: false },
      ],
    },
    { uid: 's4', titulo: 'Sem dores', mostrarSe: { perguntaId: 'dores', valores: ['nao'] }, perguntas: [
      { id: 'bem', tipo: 'TEXTO', rotulo: 'O que ajudou?', obrigatoria: false }] },
  ],
};

const RESPOSTAS = {
  dias: 3, energia: 4, sono: 3, dores: true, onde: 'Ombro direito no supino.',
  cansaco: { '1': 8, '2': 7, '3': null, '4': 6, '5': 9, '6': 5 },
  peso: 80.5, fome: 'tarde', substituir: false,
  grade: { agua: 'sempre' },
  semana: { '1': 7, '2': 8, '3': 6, '4': 9, '5': 7, '6': 5, '7': 10 }, aceite: true, futuro: 'x',
};

const ATUALIZACAO: Atualizacao = {
  id: ATUALIZACAO_ID, pastaId: 'f0000000-0000-4000-8000-0000000000b1', alunoId: ALUNO_ID, nomeAluno: ALUNO.nome,
  dataAtualizacao: '2026-10-20', fase: 'ENVIADA', diasParaData: -6, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null,
  questionarioVersaoNumero: 1, questionarioVersaoId: 'q0000000-0000-4000-8000-0000000000b1', questionarioNome: 'Padrão',
  modelo: MODELO, respostas: RESPOSTAS, enviadaEm: '2026-10-20T12:00:00Z', feedback: null, versao: 1,
  resumo: { diasComTreino: 0, mediaDiasPorSemana: 0, pesoAnterior: null },
};

async function capturar(page: Page, nome: string) {
  const pasta = process.env.CAPTURAS_LEITURA;
  if (!pasta) return;
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });
}

async function tema(page: Page, usuarioId: string, escuro: boolean) {
  await page.addInitScript(([id, t]) => localStorage.setItem(`treinos:${id}:preferencias`, JSON.stringify({ tema: t })), [usuarioId, escuro ? 'ESCURO' : 'CLARO'] as const);
}

/** O que as duas leituras (aluno e treinador) precisam mostrar, nas duas larguras. */
async function conferirLeitura(page: Page, largura: number) {
  const linha = (rotulo: string) => page.getByRole('listitem').filter({ has: page.getByText(rotulo, { exact: true }) });
  await expect(page.getByText('Não respondeu', { exact: true })).toBeVisible();
  // Nota: "4/10" sem escala (0 a 10); a de 1 a 5 diz a escala embaixo.
  await expect(linha('Como está sua energia?').getByText('4/10', { exact: true })).toBeVisible();
  await expect(page.getByText('Escala de 1 a 5', { exact: true })).toBeVisible();
  await expect(page.getByText('Escala de 0 a 10')).toHaveCount(0);
  await expect(page.getByText(/de 0 a 10/)).toHaveCount(0);
  // Notas por dia (6 dias): chips "Dia 1 · 8", sem "Dia 1: 8 de 0 a 10" repetido.
  for (const dia of [1, 2, 3, 4, 5, 6]) await expect(linha('Cansaço em cada dia de treino').getByText(`Dia ${dia} ·`, { exact: true })).toBeVisible();
  // Sim/Não no texto normal da resposta (nunca mais fraco que a pergunta); condição não atendida = "Não se aplica".
  const sim = linha('Sentiu dores nos treinos?').getByText('Sim', { exact: true });
  await expect(sim).toBeVisible();
  const estilo = (l: typeof sim) => l.evaluate((e) => { const s = getComputedStyle(e); return { tamanho: parseFloat(s.fontSize), cor: s.color }; });
  const [resposta, pergunta] = [await estilo(sim), await estilo(linha('Sentiu dores nos treinos?').getByText('Sentiu dores nos treinos?', { exact: true }))];
  expect(resposta.tamanho).toBeGreaterThanOrEqual(pergunta.tamanho);
  expect(resposta.cor).not.toBe(pergunta.cor);
  await expect(linha('Algum alimento que gostaria de substituir?').getByText('Não', { exact: true })).toBeVisible();
  await expect(linha('Qual alimento?').getByText('Não se aplica', { exact: true })).toBeVisible();
  // Seção escondida pela condição: o motivo aparece uma vez, no corpo (a faixa não repete "Não se aplica").
  await expect(page.getByText('Seção que não se aplica, pelas respostas anteriores.', { exact: true })).toBeVisible();
  await expect(page.getByText('Não se aplica', { exact: true })).toHaveCount(1);
  // A data automática e o texto informativo não são perguntas: 6 na primeira seção, 5 na segunda.
  await expect(page.getByText('6 perguntas', { exact: true })).toBeVisible();
  await expect(page.getByText('5 perguntas', { exact: true })).toBeVisible();
  await expect(page.getByText('1 pergunta', { exact: true })).toBeVisible();
  await expect(page.getByText('3 perguntas', { exact: true })).toBeVisible();
  // Sete dias: tabelinha de uma linha que rola dentro do cartão (sem vazar a página em 390).
  await expect(linha('Disposição em cada dia da semana').getByText('Dia 1', { exact: true })).toBeVisible();
  await expect(linha('Disposição em cada dia da semana').getByText('Dia 7', { exact: true })).toBeAttached();
  await expect(page.getByText('Aceito: “Li e concordo.”', { exact: true })).toBeVisible();
  await expect(linha('Pergunta de uma versão nova').getByText('Atualize o app para ver esta resposta.', { exact: true })).toBeVisible();
  // Cartão a partir de 760 px: pergunta à esquerda (até 320) e resposta à direita, pelo topo; abaixo, resposta embaixo.
  const cartao = await page.getByTestId('cartao').filter({ has: page.getByText('Como está sua energia?', { exact: true }) }).boundingBox();
  const rotulo = await linha('Como está sua energia?').getByText('Como está sua energia?', { exact: true }).boundingBox();
  const valor = await linha('Como está sua energia?').getByText('4/10', { exact: true }).boundingBox();
  if ((cartao?.width ?? 0) >= 760) {
    expect(Math.abs((valor?.y ?? 0) - (rotulo?.y ?? 0))).toBeLessThan(12);
    expect((valor?.x ?? 0) - (rotulo?.x ?? 0)).toBeLessThanOrEqual(320 + 16 + 1);
  } else expect(valor?.y ?? 0).toBeGreaterThan((rotulo?.y ?? 0) + (rotulo?.height ?? 0) - 1);
  if (largura < 768) expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
  return cartao?.width ?? 0;
}

for (const largura of [390, 1280, 1920]) {
  for (const escuro of [false, true]) {
    const nomeDoTema = escuro ? 'escuro' : 'claro';

    test(`treinador lê as respostas da atualização (${largura}px, ${nomeDoTema})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: ALTURA });
      await tema(page, TREINADOR.id, escuro);
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessao(page, TREINADOR, { permissoes: [...PERMISSOES_TREINADOR, 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER'] })),
        [`GET /atualizacoes/${ATUALIZACAO_ID}`]: { corpo: ATUALIZACAO },
      });
      await page.goto(`/treinador/atualizacoes/${ATUALIZACAO_ID}`);
      await expect(page.getByText('Como está sua energia?', { exact: true })).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, `treinador-${largura}-${nomeDoTema}`);
      const cartao = await conferirLeitura(page, largura);
      // Em 1920 a coluna das respostas do treinador passa de 760: o arranjo lado a lado é conferido de fato.
      if (largura === 1920) expect(cartao).toBeGreaterThanOrEqual(760);
      expect(errosDaPagina).toEqual([]);
    });

    test(`aluno relê a atualização enviada (${largura}px, ${nomeDoTema})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: ALTURA });
      await tema(page, ALUNO.id, escuro);
      const { errosDaPagina } = await simularApi(page, {
        ...(await sessaoDeAluno(page)),
        'GET /aluno/atualizacao': { corpo: { ...ATUALIZACAO, nomeAluno: null, questionarioNome: null } },
      });
      await page.goto('/aluno/atualizacao');
      await expect(page.getByText('Como está sua energia?', { exact: true })).toBeVisible();
      await page.waitForTimeout(400);
      await capturar(page, `aluno-${largura}-${nomeDoTema}`);
      // O arranjo segue a largura do cartão (o teto da tela do aluno decide); `conferirLeitura` confere os dois.
      await conferirLeitura(page, largura);
      // Média do app pelo resumo, com o plural certo. No treinador o cartão "Resumo do período" já a mostra: a linha não vai lá.
      await expect(page.getByText(/0 dias de treino por semana/)).toBeVisible();
      await expect(page.getByText(/\b0 dia\b/)).toHaveCount(0);
      expect(errosDaPagina).toEqual([]);
    });
  }
}
