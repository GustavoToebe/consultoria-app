import type {
  Configuracao,
  ConteudoTreino,
  ExercicioPlano,
  Intensidade,
  ModoIntensidade,
  Serie,
  Sessao,
  TipoSessao,
} from '../api/tipos';
import type { GrupoDeSeries } from './agrupamento';
import { novoUid } from './uid';

/**
 * Operações do editor de treino. Todas puras (devolvem cópia), para o "Desfazer" e os testes. Nenhuma inventa carga
 * nem repetição: séries novas nascem sem faixa; os percentuais só vêm da regra de preparação da própria consultoria.
 */

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const TIPOS_SESSAO: { valor: TipoSessao; rotulo: string }[] = [
  { valor: 'TREINO', rotulo: 'Treino' },
  { valor: 'DESCANSO_ATIVO', rotulo: 'Descanso ativo' },
  { valor: 'DESCANSO', rotulo: 'Descanso' },
  { valor: 'ACESSORIOS', rotulo: 'Acessórios' },
];

export const MODOS: { valor: ModoIntensidade; rotulo: string }[] = [
  { valor: 'CARGA_TRABALHO', rotulo: 'Carga de trabalho' },
  { valor: 'PERCENTUAL_WS', rotulo: '% da trabalho' },
  { valor: 'RIR', rotulo: 'RIR' },
  { valor: 'RPE', rotulo: 'RPE' },
  { valor: 'LIVRE', rotulo: 'Texto livre' },
  { valor: 'NENHUMA', rotulo: 'Sem intensidade' },
];

export function novaSessao(diaSemana: number | null): Sessao {
  return {
    uid: novoUid(),
    nome: diaSemana ? DIAS_SEMANA[diaSemana - 1] : '',
    diaSemana,
    tipo: 'TREINO',
    frequenciaSemanal: null,
    observacao: null,
    cardio: null,
    exercicios: [],
  };
}

export function novoExercicio(): ExercicioPlano {
  return {
    uid: novoUid(),
    exercicioId: null,
    nome: '',
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
  };
}

/** Série nova do tipo de trabalho da consultoria, sem faixa de repetições (o treinador preenche). */
export function novaSerie(config: Configuracao | null): Serie {
  return {
    uid: novoUid(),
    tipo: config?.tipoTrabalho ?? 'Série',
    repsMin: null,
    repsMax: null,
    alvoTexto: null,
    intensidade: { modo: 'CARGA_TRABALHO' },
    descansoSegundos: null,
  };
}

/** Troca um item de lugar com o vizinho (setas ↑↓). Fora dos limites devolve a mesma lista. */
export function mover<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function substituir<T>(lista: T[], indice: number, item: T): T[] {
  return lista.map((x, i) => (i === indice ? item : x));
}

export function remover<T>(lista: T[], indice: number): T[] {
  return lista.filter((_, i) => i !== indice);
}

/** Percentuais da regra de preparação para `n` séries, se a consultoria tiver regra para esse número. */
export function percentuaisDaRegra(config: Configuracao | null, n: number): number[] | null {
  const regra = config?.regraPreparacao?.[String(n)];
  return regra && regra.length === n ? regra : null;
}

function comPercentuais(series: Serie[], percentuais: number[]): Serie[] {
  return series.map((s, i) => ({ ...s, intensidade: { modo: 'PERCENTUAL_WS', percentual: percentuais[i] } }));
}

function trocarGrupo(series: Serie[], grupo: GrupoDeSeries, novas: Serie[]): Serie[] {
  return [...series.slice(0, grupo.inicio), ...novas, ...series.slice(grupo.inicio + grupo.series.length)];
}

/**
 * Muda a quantidade de séries de um grupo: acrescenta cópias da última (uids novos) ou tira do fim. Se o grupo é de
 * preparação em % (FS) e a consultoria tem regra para a nova quantidade, os percentuais são preenchidos por ela
 * (3 FS = 50/70/85; 2 FS = 70/85). Depois cada série pode ser editada.
 */
export function mudarQuantidade(series: Serie[], grupo: GrupoDeSeries, n: number, config: Configuracao | null): Serie[] {
  if (n < 1 || n > 30) return series;
  const ultima = grupo.series[grupo.series.length - 1];
  let novas =
    n <= grupo.series.length
      ? grupo.series.slice(0, n)
      : [...grupo.series, ...Array.from({ length: n - grupo.series.length }, () => ({ ...ultima, uid: novoUid() }))];
  const regra = percentuaisDaRegra(config, n);
  if (regra && ultima.tipo === config?.tipoPreparacao && ultima.intensidade?.modo === 'PERCENTUAL_WS') {
    novas = comPercentuais(novas, regra);
  }
  return trocarGrupo(series, grupo, novas);
}

export interface AlteracaoDeGrupo {
  tipo?: string;
  repsMin?: number | null;
  repsMax?: number | null;
  alvoTexto?: string | null;
  modo?: ModoIntensidade;
  /** Valor da intensidade para todas as séries do grupo (RIR, RPE, texto ou um % único). */
  intensidade?: Partial<Intensidade>;
}

function intensidadeDoModo(modo: ModoIntensidade): Intensidade {
  return { modo };
}

/**
 * Aplica a mudança a todas as séries do grupo. Trocar o tipo para o de trabalho (WS) põe "carga de trabalho"; para o
 * de preparação (FS) põe "% da trabalho" com a regra da consultoria. Tudo continua editável.
 */
export function alterarGrupo(
  series: Serie[],
  grupo: GrupoDeSeries,
  mudanca: AlteracaoDeGrupo,
  config: Configuracao | null,
): Serie[] {
  let modo = mudanca.modo;
  if (mudanca.tipo !== undefined && modo === undefined && config) {
    if (mudanca.tipo === config.tipoTrabalho) modo = 'CARGA_TRABALHO';
    else if (mudanca.tipo === config.tipoPreparacao) modo = 'PERCENTUAL_WS';
  }
  let novas = grupo.series.map((s) => {
    const nova: Serie = { ...s };
    if (mudanca.tipo !== undefined) nova.tipo = mudanca.tipo;
    if (mudanca.repsMin !== undefined) nova.repsMin = mudanca.repsMin;
    if (mudanca.repsMax !== undefined) nova.repsMax = mudanca.repsMax;
    if (mudanca.alvoTexto !== undefined) nova.alvoTexto = mudanca.alvoTexto || null;
    if (modo !== undefined && modo !== (s.intensidade?.modo ?? 'NENHUMA')) nova.intensidade = intensidadeDoModo(modo);
    if (mudanca.intensidade) {
      nova.intensidade = { ...(nova.intensidade ?? { modo: 'NENHUMA' }), ...mudanca.intensidade };
    }
    return nova;
  });
  const virouPercentual = modo === 'PERCENTUAL_WS' && grupo.series[0].intensidade?.modo !== 'PERCENTUAL_WS';
  const regra = percentuaisDaRegra(config, novas.length);
  if (virouPercentual && regra) {
    novas = comPercentuais(novas, regra);
  }
  return trocarGrupo(series, grupo, novas);
}

/** Percentual de uma série só (o grupo expandido). */
export function alterarPercentual(series: Serie[], indice: number, percentual: number | null): Serie[] {
  return series.map((s, i) => (i === indice ? { ...s, intensidade: { modo: 'PERCENTUAL_WS', percentual } } : s));
}

export function removerGrupo(series: Serie[], grupo: GrupoDeSeries): Serie[] {
  return trocarGrupo(series, grupo, []);
}

/** Séries de uma receita (sem uids) aplicadas no exercício: substituem as atuais, cada uma com uid novo. */
export function seriesDaReceita(conteudo: unknown): Serie[] {
  const lista = (conteudo as { series?: Partial<Serie>[] } | null)?.series ?? [];
  return lista.map((s) => ({
    uid: novoUid(),
    tipo: s.tipo ?? '',
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    alvoTexto: s.alvoTexto ?? null,
    intensidade: s.intensidade ?? null,
    descansoSegundos: s.descansoSegundos ?? null,
  }));
}

/** Séries prontas para virar receita (sem uids: eles nascem ao aplicar). */
export function seriesParaReceita(series: Serie[]): { series: Omit<Serie, 'uid'>[] } {
  return { series: series.map(({ uid: _uid, ...resto }) => resto) };
}

/** Cópia profunda com uids novos (receita de semana, cópia de plano). */
export function comUidsNovos(conteudo: ConteudoTreino): ConteudoTreino {
  return {
    ...conteudo,
    sessoes: (conteudo.sessoes ?? []).map((s) => ({
      ...s,
      uid: novoUid(),
      exercicios: (s.exercicios ?? []).map((e) => ({
        ...e,
        uid: novoUid(),
        series: (e.series ?? []).map((x) => ({ ...x, uid: novoUid() })),
      })),
    })),
  };
}

/** Receita de semana: troca as sessões do plano pelas da receita (o objetivo e as orientações ficam). */
export function aplicarReceitaDePlano(atual: ConteudoTreino, receita: unknown): ConteudoTreino {
  const daReceita = comUidsNovos(normalizarTreino(receita));
  return { ...atual, sessoes: daReceita.sessoes };
}

/** Garante listas e campos que o editor espera (rascunho antigo, receita parcial). */
export function normalizarTreino(conteudo: unknown): ConteudoTreino {
  const c = (conteudo ?? {}) as Partial<ConteudoTreino>;
  return {
    objetivo: c.objetivo ?? null,
    orientacoes: c.orientacoes ?? null,
    sessoes: (c.sessoes ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      nome: s.nome ?? '',
      diaSemana: s.diaSemana ?? null,
      tipo: s.tipo ?? 'TREINO',
      frequenciaSemanal: s.frequenciaSemanal ?? null,
      observacao: s.observacao ?? null,
      cardio: s.cardio ?? null,
      exercicios: (s.exercicios ?? []).map((e) => ({
        uid: e.uid ?? novoUid(),
        exercicioId: e.exercicioId ?? null,
        nome: e.nome ?? '',
        modalidade: e.modalidade ?? null,
        videoUrl: e.videoUrl ?? null,
        observacao: e.observacao ?? null,
        progressao: e.progressao ?? true,
        unidade: e.unidade === 'nenhuma' ? 'nenhuma' : 'kg',
        series: (e.series ?? []).map((x) => ({
          uid: x.uid ?? novoUid(),
          tipo: x.tipo ?? '',
          repsMin: x.repsMin ?? null,
          repsMax: x.repsMax ?? null,
          alvoTexto: x.alvoTexto ?? null,
          intensidade: x.intensidade ?? null,
          descansoSegundos: x.descansoSegundos ?? null,
        })),
      })),
    })),
  };
}

/** Unidade sugerida ao escolher da biblioteca: elástico, peso corporal e cardio não têm campo de carga. */
export function unidadeDaModalidade(modalidade: string | null): 'kg' | 'nenhuma' {
  return modalidade === 'ELASTICO' || modalidade === 'PESO_CORPORAL' || modalidade === 'CARDIO' ? 'nenhuma' : 'kg';
}
