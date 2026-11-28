import type { ConteudoTreino, Problema, Sessao } from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { textoDosProblemas } from './problemasDoPlano';
import { descansoSoDoGrupo } from './textoDoGrupo';

/**
 * Pontos para revisar do editor de treino: avisos que não travam publicar (os erros bloqueantes vêm de `Problema`).
 * Hoje só a série sem descanso: `descansoSegundos` nulo ("Falta o descanso"); 0 é descanso informado. Cluster segue a
 * mesma regra (`camposDaSerie.descansoDoClusterPendente`, aviso âmbar que não trava o salvar). Ficam fora o cardio e o
 * membro de grupo cujo descanso é só do grupo (superset, circuito e afins); pré e pós-exaustão contam, porque cada série mantém o seu descanso.
 */

export const TEXTO_FALTA_DESCANSO = 'Falta o descanso';

export interface PontoParaRevisar {
  sessaoUid: string;
  sessaoIndice: number;
  exercicioUid: string;
  exercicioNome: string;
  /** 1ª série do bloco (a aba a abrir). */
  serieUid: string;
  /** Índice base 0 do bloco (de `agrupar`), o mesmo da tabela de séries do editor. */
  bloco: number;
  /** "Agachamento livre · Série 5 sem descanso": o número é o do bloco. */
  texto: string;
  /** Campo da 1ª série do bloco sem descanso: `sessoes[i].exercicios[j].series[k].descansoSegundos`. */
  caminho: string;
}

const semDescanso = (s: GrupoDeSeries['series'][number]) => !s.cardio && s.descansoSegundos == null;

/** O bloco tem alguma série (fora do cardio) sem descanso. */
export function blocoSemDescanso(grupo: GrupoDeSeries): boolean {
  return grupo.series.some(semDescanso);
}

export function pontosDaSessao(s: Sessao, indice: number): PontoParaRevisar[] {
  const grupos = new Map((s.grupos ?? []).map((g) => [g.uid, g]));
  return s.exercicios.flatMap((e, j) => {
    const grupo = e.grupoUid ? grupos.get(e.grupoUid) : undefined;
    if (e.modalidade === 'CARDIO' || (grupo && descansoSoDoGrupo(grupo))) return [];
    const nome = e.nome?.trim() || `Exercício ${j + 1}`;
    return agrupar(e.series).flatMap((g, b) => {
      const k = g.series.findIndex(semDescanso);
      if (k < 0) return [];
      return [{
        sessaoUid: s.uid, sessaoIndice: indice, exercicioUid: e.uid, exercicioNome: nome,
        serieUid: g.series[0].uid, bloco: b,
        texto: `${nome} · Série ${b + 1} sem descanso`,
        caminho: `sessoes[${indice}].exercicios[${j}].series[${g.inicio + k}].descansoSegundos`,
      }];
    });
  });
}

export function pontosDoPlano(c: Pick<ConteudoTreino, 'sessoes'>): PontoParaRevisar[] {
  return c.sessoes.flatMap((s, i) => pontosDaSessao(s, i));
}

export function textoDosPontos(n: number): string {
  return `${n} ${n === 1 ? 'ponto' : 'pontos'} para revisar`;
}

export interface ResumoDasPendencias {
  total: number;
  tom: 'sucesso' | 'atencao' | 'perigo';
  /** Sem o "· Ir à primeira pendência": quem mostra acrescenta quando há `alvo`. */
  texto: string;
  /** Erro bloqueante primeiro (o editor usa `primeiraPendencia`); sem erro, o 1º ponto; nulo sem nada. */
  alvo: { tipo: 'erro' } | { tipo: 'ponto'; ponto: PontoParaRevisar } | null;
}

/**
 * O selo das Sessões. Modelo: "N pendências" (erros + pontos; vermelho com erro, âmbar só com pontos) ou "Sem pendências".
 * Plano do aluno: "N problemas para publicar" (só os erros) quando há erro, senão "N pontos para revisar" ou "Pronto para publicar".
 */
export function resumoDasPendencias(p: { erros: readonly Problema[]; pontos: readonly PontoParaRevisar[]; modelo: boolean }): ResumoDasPendencias {
  const erros = p.erros.length;
  const total = erros + p.pontos.length;
  if (total === 0) return { total, tom: 'sucesso', texto: p.modelo ? 'Sem pendências' : 'Pronto para publicar', alvo: null };
  const tom = erros > 0 ? 'perigo' : 'atencao';
  const alvo = erros > 0 ? { tipo: 'erro' as const } : { tipo: 'ponto' as const, ponto: p.pontos[0] };
  const texto = p.modelo
    ? `${total} ${total === 1 ? 'pendência' : 'pendências'}`
    : erros > 0 ? textoDosProblemas(erros) : textoDosPontos(p.pontos.length);
  return { total, tom, texto, alvo };
}
