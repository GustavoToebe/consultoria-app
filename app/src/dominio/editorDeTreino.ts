import type { Carga, Configuracao, ConteudoTreino, Problema, Serie, Sessao } from '../api/tipos';
import { agrupar, tituloDoGrupoDeSeries, type GrupoDeSeries } from './agrupamento';
import { rotuloDescanso } from './descanso';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { textoDasRepeticoesDaSerie } from './resumoDaSerie';

/**
 * Regras puras da tabela de blocos, do caminho até a primeira pendência e do vazio da sessão no editor de treino.
 * Só lê as regras que já existem (`agrupar`, `contarSessao`, `validarTreino`, `linhaDoExercicio`): nada aqui muda
 * contagem, definição de bloco nem validação. "Bloco" é o `GrupoDeSeries` de `agrupar`, as abas "Série N · tipo".
 * O resumo curto de um exercício para a lateral é `linhaDoExercicio` (inspetorDoTreino.ts), sem versão nova.
 */

export type CampoComVariacao = 'repeticoes' | 'descanso' | 'esforco' | 'carga';

export interface ResumoDoBloco {
  /** "Trabalho · WS + Rest pause": tipo como o treinador lê, mais a técnica. */
  nome: string;
  /** Séries do bloco (não confundir com a quantidade de blocos do exercício). */
  quantidade: number;
  /** "3 a 6 reps", "8 reps", "AMRAP", "por tempo"; "—" no cardio. Se as séries diferem, cada uma em ordem. */
  repeticoes: string;
  /** "1 min 30 s"; "—" sem descanso. Se as séries diferem, cada uma em ordem, sem resumir a um valor só. */
  descanso: string;
  /** Campos cujo valor muda entre as séries do bloco (descanso, RIR e carga não separam blocos em `agrupar`). */
  variacao: CampoComVariacao[];
}

/** Um valor se todos iguais; senão cada um em ordem ("1 min, 2 min"): nunca uma média nem a faixa que esconde o meio. */
function juntar(textos: string[]): { texto: string; varia: boolean } {
  if (textos.every((t) => t === textos[0])) return { texto: textos[0] ?? '—', varia: false };
  return { texto: textos.join(', '), varia: true };
}

const chaveDaCarga = (c: Carga | null) => [c?.modo ?? 'NENHUMA', c?.percentualMin ?? '', c?.percentualMax ?? '', c?.valorKg ?? ''].join('|');
const chaveDoEsforco = (s: Serie) => `${s.esforco?.rir ?? ''}|${s.esforco?.rpe ?? ''}`;

/** Linha da tabela de blocos. `grupo` vem de `agrupar` (ou qualquer lista de séries: a variação é conferida série a série). */
export function resumoDoBloco(grupo: GrupoDeSeries, config: Configuracao | null): ResumoDoBloco {
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const { series } = grupo;
  const cardio = series.some((s) => s.cardio);
  const reps = cardio ? { texto: '—', varia: false } : juntar(series.map(textoDasRepeticoesDaSerie));
  const descanso = juntar(series.map((s) => (s.descansoSegundos == null ? '—' : rotuloDescanso(s.descansoSegundos))));
  const variacao: CampoComVariacao[] = [];
  if (reps.varia) variacao.push('repeticoes');
  if (descanso.varia) variacao.push('descanso');
  if (new Set(series.map(chaveDoEsforco)).size > 1) variacao.push('esforco');
  if (new Set(series.map((s) => chaveDaCarga(s.carga))).size > 1) variacao.push('carga');
  return { nome: tituloDoGrupoDeSeries(grupo, cfg), quantidade: series.length, repeticoes: reps.texto, descanso: descanso.texto, variacao };
}

/** Blocos de um exercício (`agrupar`) e total de séries cadastradas (a mesma soma de `contarSessao`, cardio incluído). */
export function blocosESeries(series: Serie[]): { blocos: number; series: number } {
  return { blocos: agrupar(series).length, series: series.length };
}

/** "2 blocos · 7 séries": a diferença entre quantidade de blocos e total de séries à vista. */
export function textoDeBlocosESeries(c: { blocos: number; series: number }): string {
  return `${c.blocos} ${c.blocos === 1 ? 'bloco' : 'blocos'} · ${c.series} ${c.series === 1 ? 'série' : 'séries'}`;
}

export interface PrimeiraPendencia {
  /** Quantas pendências (erros que impedem publicar), a mesma conta de `textoDosProblemas`. */
  total: number;
  caminho: string;
  mensagem: string;
  /** Índice e uid da sessão; nulos quando o erro não é de uma sessão (período, plano sem sessão). */
  sessao: number | null;
  sessaoUid: string | null;
  exercicio: number | null;
  exercicioUid: string | null;
  /** Série apontada pelo erro e o bloco (de `agrupar`) que a contém; nulos se o erro é do exercício ou da sessão. */
  serie: number | null;
  serieUid: string | null;
  bloco: number | null;
  /** O campo: `carga.modo`, `tipo`, `nome`, `series`, `exercicios`, `grupos[0].tecnica`...; o caminho inteiro se não é de uma sessão. */
  campo: string;
}

const CAMINHO_DA_SESSAO = /^sessoes\[(\d+)\](?:\.exercicios\[(\d+)\])?(?:\.(.+))?$/;
const CAMINHO_DA_SERIE = /^series\[(\d+)\](?:\.(.+))?$/;

/**
 * Onde fica a primeira pendência de `erros` (na ordem em que a validação os devolve, a mesma que `ir ao primeiro` usa) para
 * selecionar sessão, exercício e bloco e focar o campo. Sem erro, `null`. Índice que não existe mais no conteúdo vira `null`.
 */
export function primeiraPendencia(conteudo: Pick<ConteudoTreino, 'sessoes'>, erros: readonly Problema[]): PrimeiraPendencia | null {
  const erro = erros[0];
  if (!erro) return null;
  const base: PrimeiraPendencia = {
    total: erros.length, caminho: erro.caminho, mensagem: erro.mensagem, campo: erro.caminho,
    sessao: null, sessaoUid: null, exercicio: null, exercicioUid: null, serie: null, serieUid: null, bloco: null,
  };
  const m = CAMINHO_DA_SESSAO.exec(erro.caminho);
  const sessao = m ? conteudo.sessoes[Number(m[1])] : undefined;
  if (!m || !sessao) return base;
  base.sessao = Number(m[1]);
  base.sessaoUid = sessao.uid;
  base.campo = m[3] ?? 'sessao';
  const exercicio = m[2] === undefined ? undefined : sessao.exercicios[Number(m[2])];
  if (!exercicio) return base;
  base.exercicio = Number(m[2]);
  base.exercicioUid = exercicio.uid;
  base.campo = m[3] ?? 'exercicio';
  const s = m[3] ? CAMINHO_DA_SERIE.exec(m[3]) : null;
  const serie = s ? exercicio.series[Number(s[1])] : undefined;
  if (!s || !serie) return base;
  base.serie = Number(s[1]);
  base.serieUid = serie.uid;
  base.bloco = agrupar(exercicio.series).findIndex((g) => g.series.some((x) => x.uid === serie.uid));
  base.campo = s[2] ?? 'serie';
  return base;
}

export type EstadoDaSessao = 'vazia' | 'descanso' | 'preenchida';

/**
 * Para decidir o convite "Monte esta sessão". Com exercício, `preenchida`; sem exercício, dia de descanso (`DESCANSO`,
 * `DESCANSO_ATIVO`) é `descanso`, nunca vazio nem erro; o resto (`TREINO` e `ACESSORIOS`) é `vazia`. Só o treino sem
 * exercício é erro na validação ("Sessão de treino sem exercício."); acessórios vazios são só o convite.
 */
export function estadoDaSessao(sessao: Pick<Sessao, 'tipo' | 'exercicios'>): EstadoDaSessao {
  if (sessao.exercicios.length > 0) return 'preenchida';
  return sessao.tipo === 'DESCANSO' || sessao.tipo === 'DESCANSO_ATIVO' ? 'descanso' : 'vazia';
}

const NOME_DA_VARIACAO: Record<CampoComVariacao, string> = { repeticoes: 'repetições', descanso: 'descanso', esforco: 'RIR', carga: 'carga' };

/**
 * "Varia entre as séries: RIR e carga": só o que a linha da tabela não mostra série a série (repetições e descanso já
 * aparecem em ordem, "8, 10, 12"). Vazio quando nada mais varia.
 */
export function textoDaVariacao(variacao: readonly CampoComVariacao[]): string {
  const ocultos = variacao.filter((v) => v === 'esforco' || v === 'carga').map((v) => NOME_DA_VARIACAO[v]);
  return ocultos.length ? `Varia entre as séries: ${ocultos.join(' e ')}` : '';
}

/** Nome acessível da linha da tabela de blocos: "Série 2 · WS, 3 séries, repetições 8 a 12, descanso 2 min, ...". */
export function textoAcessivelDoBloco(rotulo: string, r: ResumoDoBloco): string {
  return [
    rotulo,
    `${r.quantidade} ${r.quantidade === 1 ? 'série' : 'séries'}`,
    `repetições ${r.repeticoes}`,
    `descanso ${r.descanso}`,
    textoDaVariacao(r.variacao),
  ].filter(Boolean).join(', ');
}
