import type { Carga, Esforco, ExercicioPlano, Grupo, Serie, Sessao, Tecnica } from '../api/tipos';

/** Fábricas de teste (nunca importadas pelo app): dados fictícios no formato novo de séries, grupos e cargas. */

export const carga = (modo: Carga['modo'], percentualMin: number | null = null, percentualMax: number | null = null, referenciaUid: string | null = null): Carga => ({
  modo,
  percentualMin,
  percentualMax,
  referenciaUid,
});

export const rir = (valor: number): Esforco => ({ rir: valor, rpe: null });
export const rpe = (valor: number): Esforco => ({ rir: null, rpe: valor });

/** Série de trabalho (`WORKING`, 6 repetições, carga de trabalho) com os campos mudados por `extra`. */
export function serie(uid: string, extra: Partial<Serie> = {}): Serie {
  return {
    uid,
    tipo: 'WORKING',
    repsMin: 6,
    repsMax: 6,
    amrap: null,
    carga: carga('CARGA_TRABALHO'),
    esforco: null,
    descansoSegundos: null,
    tecnica: null,
    cardio: null,
    alvoExtra: null,
    ...extra,
  };
}

export function exercicio(uid: string, extra: Partial<ExercicioPlano> = {}): ExercicioPlano {
  return {
    uid,
    exercicioId: null,
    nome: `Exercício ${uid}`,
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
    grupoUid: null,
    ...extra,
  };
}

export function sessao(uid: string, exercicios: ExercicioPlano[] = [], grupos: Grupo[] = [], extra: Partial<Sessao> = {}): Sessao {
  return { uid, nome: `Sessão ${uid}`, diaSemana: null, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, exercicios, grupos, ...extra };
}

export const grupo = (uid: string, tecnica: Grupo['tecnica'] = 'SUPERSET', extra: Partial<Grupo> = {}): Grupo => ({ uid, tecnica, descansoAposSegundos: null, voltas: null, ...extra });

export const tecnica = (tipo: Tecnica['tipo'], extra: Partial<Tecnica> = {}): Tecnica => ({ tipo, ...extra });
