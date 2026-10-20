import type { Page } from '@playwright/test';

import type { ConteudoDieta, ExercicioPlano, PainelAluno, Sessao, TipoSessao } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, sessao, type RespostasApi } from './api-falsa';

/**
 * Sessão de aluno com o mínimo que o layout pede: painel sem treino nem atualização, sem mobilidade (404) e fotos
 * desligadas. Cada teste soma as rotas da tela que confere.
 */
export async function sessaoDeAluno(page: Page): Promise<RespostasApi> {
  return sessaoDeAlunoComTreino(page, null);
}

/** Exercício com séries simples, só para o plano ter o que contar. */
function exercicioFalso(uid: string): ExercicioPlano {
  return {
    uid, exercicioId: null, nome: `Exercício ${uid}`, modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg',
    series: [1, 2, 3].map((n) => ({ uid: `${uid}-s${n}`, tipo: 'WS', repsMin: 8, repsMax: 10, alvoTexto: null, intensidade: null, descansoSegundos: null })),
  };
}

/** Divisão do plano: `diaSemana` 1 = segunda ... 7 = domingo; nulo = sem dia fixo. */
export function sessaoFalsa(uid: string, nome: string, diaSemana: number | null, exercicios = 5, tipo: TipoSessao = 'TREINO'): Sessao {
  return {
    uid, nome, diaSemana, tipo, frequenciaSemanal: null, observacao: null, cardio: null,
    exercicios: Array.from({ length: exercicios }, (_, i) => exercicioFalso(`${uid}e${i + 1}`)),
  };
}

/** Plano com segunda (A), quarta (B) e sexta (C). Na segunda-feira de 19/10 o treino de hoje é o A. */
export const SESSOES_COM_DIAS = [
  sessaoFalsa('sa', 'Peito e tríceps', 1, 5),
  sessaoFalsa('sb', 'Costas e bíceps', 3, 4),
  sessaoFalsa('sc', 'Pernas', 5, 6),
];

/** Dieta publicada com `refeicoes` refeições e a água dada (nulo = o treinador não escreveu). */
export function dietaFalsa(refeicoes: number, aguaLitros: number | null) {
  const conteudo: ConteudoDieta = {
    objetivo: null, dataInicio: null, profissional: null, observacoes: null, orientacoes: [], suplementacao: [], ergogenicos: null, aguaLitros,
    refeicoes: Array.from({ length: refeicoes }, (_, i) => ({ uid: `r${i}`, nome: `Refeição ${i + 1}`, horario: null, observacao: null, opcoes: [] })),
  };
  return {
    dieta: { id: 'd0000000-0000-4000-8000-000000000001', planoId: 'd0000000-0000-4000-8000-000000000002', numero: 1, titulo: 'Dieta', inicio: '2026-10-05', fim: '2026-11-01', publicadoEm: '2026-10-05T12:00:00Z', conteudo },
  };
}

/**
 * Como `sessaoDeAluno`, mas com o plano de treino publicado (período de 5/10 a 1/11/2026). Com `sessoes` nulo o painel
 * vem sem treino. Quem confere o início também fixa o relógio em 19/10/2026 (`fixarHoje`).
 */
export async function sessaoDeAlunoComTreino(page: Page, sessoes: Sessao[] | null): Promise<RespostasApi> {
  const painel: PainelAluno = {
    atualizacao: null,
    marca: MARCA,
    aluno: { nome: ALUNO.nome },
    treino: sessoes
      ? {
          planoId: 't0000000-0000-4000-8000-000000000001',
          versaoId: 't0000000-0000-4000-8000-000000000002',
          numero: 1,
          titulo: 'Treino de outubro',
          inicio: '2026-10-05',
          fim: '2026-11-01',
          publicadoEm: '2026-10-05T12:00:00Z',
          conteudo: { objetivo: null, orientacoes: null, sessoes },
        }
      : null,
    ultimasCargas: {},
    configuracao: { arredondamentoKg: 1, tipoTrabalho: 'WS' },
    geradoEm: '2026-10-19T12:00:00Z',
  };
  return {
    ...(await sessao(page, ALUNO)),
    'GET /aluno/painel': { corpo: painel },
    'GET /aluno/mobilidade': erroApi(404, 'Sem mobilidade publicada.'),
    'GET /aluno/pastas': { corpo: [] },
    'GET /aluno/fotos/configuracao': { corpo: { habilitado: false, maximoPorPergunta: 6, bytesMaximo: 1_000_000, porDia: 12 } },
  };
}

/** Segunda-feira, 19/10/2026, meio-dia em São Paulo: o "hoje" do aparelho. Os temporizadores seguem reais. */
export async function fixarHoje(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00-03:00'));
}
