import { CONFIGURACAO_PADRAO } from '../src/dominio/metodologiaPadrao';
import type { Page } from '@playwright/test';

import type { Carga, ConteudoDieta, ExercicioPlano, PainelAluno, Serie, Sessao, Tecnica, TipoSessao } from '../src/api/tipos';
import { ALUNO, erroApi, MARCA, sessao, type RespostasApi } from './api-falsa';

/**
 * Sessão de aluno com o mínimo que o layout pede: painel sem treino nem atualização, sem mobilidade (404) e fotos
 * desligadas. Cada teste soma as rotas da tela que confere.
 */
export async function sessaoDeAluno(page: Page): Promise<RespostasApi> {
  return sessaoDeAlunoComTreino(page, null);
}

const CARGA_DE_TRABALHO: Carga = { modo: 'CARGA_TRABALHO', percentualMin: null, percentualMax: null, referenciaUid: null };

/** Exercício com séries simples, só para o plano ter o que contar. */
function exercicioFalso(uid: string): ExercicioPlano {
  return {
    uid, exercicioId: null, nome: `Exercício ${uid}`, modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg',
    series: [1, 2, 3].map((n) => ({ uid: `${uid}-s${n}`, tipo: 'WORKING', repsMin: 8, repsMax: 10, carga: CARGA_DE_TRABALHO, esforco: null, descansoSegundos: null })),
  };
}

/** Divisão do plano: `diaSemana` 1 = segunda ... 7 = domingo; nulo = sem dia fixo. */
export function sessaoFalsa(uid: string, nome: string, diaSemana: number | null, exercicios = 5, tipo: TipoSessao = 'TREINO'): Sessao {
  return {
    uid, nome, diaSemana, tipo, frequenciaSemanal: null, observacao: null, cardio: null,
    exercicios: Array.from({ length: exercicios }, (_, i) => exercicioFalso(`${uid}e${i + 1}`)),
    grupos: [],
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
          conteudo: { metodologia: { id: 'metodo-ficticio', nome: 'Metodologia de teste', configuracao: CONFIGURACAO_PADRAO }, objetivo: null, orientacoes: null, sessoes },
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

const SEM_TECNICA = { pausaSegundos: null, pausaRespiracoes: null, pausas: null, blocos: null, quedas: null, reducaoPercentual: null, repsPorQueda: null };

/** Exercício fictício para conferir carga, pausas e explicações do formato atual: a técnica vai dentro da série WS. */
export function sessaoComTecnicas(): Sessao[] {
  const sessao = sessaoFalsa('tecnicas', 'Treino de técnicas', 1, 1);
  const base = { tipo: 'WORKING', repsMin: 6, repsMax: 8, descansoSegundos: null, carga: CARGA_DE_TRABALHO };
  const tecnica = (valores: Partial<Tecnica> & Pick<Tecnica, 'tipo'>): Tecnica => ({ ...SEM_TECNICA, ...valores });
  sessao.exercicios[0] = { ...sessao.exercicios[0], uid: 'exemplo', nome: 'Remada de teste', series: [
    { ...base, uid: 'ws', esforco: { rir: 1 }, tecnica: null },
    { ...base, uid: 'rest', esforco: { rir: 0 }, tecnica: tecnica({ tipo: 'REST_PAUSE', pausaSegundos: 20, pausas: 1 }) },
    { ...base, uid: 'cluster', repsMin: 6, repsMax: 6, esforco: null, tecnica: tecnica({ tipo: 'CLUSTER', blocos: [4, 2], pausaRespiracoes: 5 }) },
    { ...base, uid: 'falha', esforco: { rir: 0 }, tecnica: null },
  ] };
  return [sessao];
}

const serie = (uid: string, resto: Partial<Serie>): Serie => ({
  uid, tipo: 'WORKING', repsMin: 8, repsMax: 10, carga: CARGA_DE_TRABALHO, esforco: null, descansoSegundos: null, ...resto,
});

/**
 * Exercício com WS, Top set e Back off: o Top set sobe 5% sobre a anterior e o Back off fica 10% abaixo do Top set (a
 * referência é a série `top`). A carga do Back off só é sugerida depois de registrada a do Top set.
 */
export function sessaoComTopSetEBackOff(): Sessao[] {
  const sessao = sessaoFalsa('topo', 'Treino de top set', 1, 1);
  sessao.exercicios[0] = { ...sessao.exercicios[0], uid: 'agacho', nome: 'Agachamento de teste', series: [
    serie('ws', { repsMin: 5, repsMax: 5, esforco: { rir: 1 } }),
    serie('top', { tipo: 'TOP_SET', repsMin: 3, repsMax: 3, carga: { modo: 'ACIMA_DA_ANTERIOR', percentualMin: 5, percentualMax: 5, referenciaUid: null } }),
    serie('back', { tipo: 'BACK_OFF', repsMin: 6, repsMax: 8, carga: { modo: 'ABAIXO_DA_REFERENCIA', percentualMin: 10, percentualMax: 10, referenciaUid: 'top' } }),
  ] };
  return [sessao];
}

/** Superset de dois exercícios com 90 s de descanso depois da volta (e 60 s por série, que não deve aparecer) e um exercício solto. */
export function sessaoComGrupo(): Sessao[] {
  const sessao = sessaoFalsa('grupo', 'Treino de superset', 1, 3);
  const nomes = ['Supino de teste', 'Remada de teste', 'Abdominal de teste'];
  const uids = ['sup', 'rem', 'abd'];
  sessao.exercicios = sessao.exercicios.map((e, i) => ({
    ...e,
    uid: uids[i],
    nome: nomes[i],
    grupoUid: i < 2 ? 'g1' : null,
    series: [1, 2].map((n) => serie(`${uids[i]}-s${n}`, { descansoSegundos: 60 })),
  }));
  sessao.grupos = [{ uid: 'g1', tecnica: 'SUPERSET', descansoAposSegundos: 90, voltas: null }];
  return [sessao];
}

/** Exercício de cardio (30 min na zona 2, duas séries) depois de um exercício comum. */
export function sessaoComCardio(): Sessao[] {
  const sessao = sessaoFalsa('cardio', 'Treino com cardio', 1, 2);
  sessao.exercicios[1] = {
    ...sessao.exercicios[1],
    uid: 'esteira',
    nome: 'Esteira de teste',
    modalidade: 'CARDIO',
    unidade: 'nenhuma',
    series: [
      serie('esteira-s1', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 30, distanciaKm: null, ritmo: null, zona: 2, intervalos: null } }),
      serie('esteira-s2', { tipo: null, repsMin: null, repsMax: null, carga: null, cardio: { duracaoMin: 10, distanciaKm: 1.5, ritmo: null, zona: null, intervalos: null } }),
    ],
  };
  return [sessao];
}
