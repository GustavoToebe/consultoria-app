import type { Configuracao, ExercicioPlano, Grupo, Sessao, TecnicaDeGrupo } from '../api/tipos';
import { nomeDaCombinacao } from './metodologia';
import { novoUid } from './uid';

/**
 * Grupos de exercícios da sessão (superset, agonista-antagonista, tri-set, giant set, circuito, pré e pós-exaustão):
 * `Sessao.grupos` guarda a técnica, o descanso depois do grupo e as voltas; cada exercício do grupo aponta o `uid` dele em
 * `grupoUid`, e a ordem é a da sessão (membros um ao lado do outro). Nada muda no registro: o aluno continua registrando
 * cada série de cada exercício. Mesmas regras do `ValidadorTreino` (ver `validacaoDoTreino`).
 *
 * As operações são puras e trabalham sobre `{ exercicios, grupos }` (o que a sessão tem de relevante), devolvendo o par novo
 * (ou o mesmo objeto, quando nada muda); a tela faz `{ ...sessao, ...criarGrupo(sessao, ...) }`. Regra única de movimento:
 * o grupo anda como um bloco (o ↑↓ de um exercício solto passa por cima do grupo vizinho inteiro); o ↑↓ de um membro troca
 * de lugar dentro do grupo e, na borda, tira o exercício do grupo; grupo que cai abaixo do mínimo da técnica é desfeito (um
 * tri-set nunca vira superset sozinho). O descanso por série dos membros nunca é apagado.
 */

/** Máximo de exercícios num grupo, o mesmo do servidor. */
export const MAXIMO_POR_GRUPO = 6;
/** Voltas do circuito: de 1 a 20. */
export const MAXIMO_DE_VOLTAS = 20;
/** Descanso depois do grupo: de 0 a 1 hora, em segundos. */
export const DESCANSO_MAXIMO_DO_GRUPO = 3600;

/** Mínimo de exercícios de cada técnica de grupo (pré e pós-exaustão: exatamente 2). */
export const MINIMO_POR_GRUPO: Record<TecnicaDeGrupo, number> = {
  SUPERSET: 2,
  AGONISTA_ANTAGONISTA: 2,
  TRI_SET: 3,
  GIANT_SET: 4,
  CIRCUITO: 3,
  PRE_EXAUSTAO: 2,
  POS_EXAUSTAO: 2,
};

/** Pré e pós-exaustão: exatamente 2 exercícios, cada série mantém o próprio descanso e não há descanso depois do grupo. */
export const grupoEmSequencia = (tecnica: TecnicaDeGrupo | null | undefined): boolean => tecnica === 'PRE_EXAUSTAO' || tecnica === 'POS_EXAUSTAO';

export type ExerciciosEGrupos = Pick<Sessao, 'exercicios' | 'grupos'>;

/** Um trecho da sessão: um exercício solto ou os membros de um grupo, na ordem. */
export interface GrupoDeExercicios {
  /** Posição do primeiro exercício do trecho na sessão. */
  inicio: number;
  exercicios: ExercicioPlano[];
  /** O grupo da sessão; nulo para exercício solto. */
  grupo: Grupo | null;
  /** "Superset", "Circuito"... (nome da metodologia ou o fixo); nulo para exercício solto. */
  nome: string | null;
}

interface Trecho {
  exercicios: ExercicioPlano[];
  grupoUid: string | null;
}

const gruposDe = (s: Partial<ExerciciosEGrupos>): Grupo[] => s.grupos ?? [];

/** Trechos da sessão na ordem: seguidos do mesmo grupo (que existe em `grupos`) formam um; o resto fica solto. */
function trechosDa(s: ExerciciosEGrupos): Trecho[] {
  const existentes = new Set(gruposDe(s).map((g) => g.uid));
  const trechos: Trecho[] = [];
  for (const e of s.exercicios) {
    const uid = e.grupoUid && existentes.has(e.grupoUid) ? e.grupoUid : null;
    const ultimo = trechos[trechos.length - 1];
    if (uid && ultimo && ultimo.grupoUid === uid) ultimo.exercicios.push(e);
    else trechos.push({ exercicios: [e], grupoUid: uid });
  }
  return trechos;
}

/** Quantos exercícios têm o grupo (onde estiverem). */
const membrosDo = (exercicios: readonly ExercicioPlano[], grupoUid: string) => exercicios.filter((e) => e.grupoUid === grupoUid).length;

/**
 * Trechos da sessão, na ordem: cada exercício entra em exatamente um (sozinho, quando não está num grupo). Grupo com
 * membros separados aparece em mais de um trecho (o validador recusa publicar assim). `config` dá o nome exibido.
 */
export function gruposDaSessao(sessao: Pick<Sessao, 'exercicios'> & Partial<Pick<Sessao, 'grupos'>>, config?: Configuracao | null): GrupoDeExercicios[] {
  const porUid = new Map(gruposDe(sessao).map((g) => [g.uid, g]));
  let inicio = 0;
  return trechosDa({ exercicios: sessao.exercicios, grupos: gruposDe(sessao) }).map((t) => {
    const grupo = (t.grupoUid && porUid.get(t.grupoUid)) || null;
    const bloco: GrupoDeExercicios = {
      inicio,
      exercicios: t.exercicios,
      grupo,
      nome: grupo && t.exercicios.length >= 2 ? nomeDaCombinacao(config, grupo.tecnica) : null,
    };
    inicio += t.exercicios.length;
    return bloco;
  });
}

export interface PosicaoNoGrupo {
  nome: string;
  tecnica: TecnicaDeGrupo;
  /** 1 = primeiro do grupo. */
  posicao: number;
  tamanho: number;
  grupo: GrupoDeExercicios;
  /** O que vem depois dentro do grupo; nulo no último. */
  proximo: ExercicioPlano | null;
  /** Descanso depois de cada volta do grupo; nulo em pré/pós-exaustão (cada série mantém o seu) ou sem valor. */
  descansoAposSegundos: number | null;
  /** Voltas do circuito; nulo nos demais. */
  voltas: number | null;
  /** O descanso vem de cada série (pré e pós-exaustão) e não do grupo. */
  descansoPorSerie: boolean;
}

/** Onde o exercício `indice` está no grupo dele; nulo quando é feito sozinho. */
export function posicaoNoGrupo(
  sessao: Pick<Sessao, 'exercicios'> & Partial<Pick<Sessao, 'grupos'>>,
  indice: number,
  config?: Configuracao | null,
): PosicaoNoGrupo | null {
  const bloco = gruposDaSessao(sessao, config).find((g) => indice >= g.inicio && indice < g.inicio + g.exercicios.length);
  if (!bloco?.nome || !bloco.grupo) return null;
  const posicao = indice - bloco.inicio + 1;
  const emSequencia = grupoEmSequencia(bloco.grupo.tecnica);
  return {
    nome: bloco.nome,
    tecnica: bloco.grupo.tecnica,
    posicao,
    tamanho: bloco.exercicios.length,
    grupo: bloco,
    proximo: bloco.exercicios[posicao] ?? null,
    descansoAposSegundos: emSequencia ? null : (bloco.grupo.descansoAposSegundos ?? null),
    voltas: bloco.grupo.tecnica === 'CIRCUITO' ? (bloco.grupo.voltas ?? null) : null,
    descansoPorSerie: emSequencia,
  };
}

/**
 * Faixa do exercício na tela do aluno: "Superset 1 de 2 · em seguida: Remada". No último, "volte para <primeiro> e
 * repita" enquanto o grupo ainda tiver séries a fazer; sem séries pendentes, só a posição.
 */
export function textoDaFaixa(p: PosicaoNoGrupo, haSeriesPendentes: boolean): string {
  const base = `${p.nome} ${p.posicao} de ${p.tamanho}`;
  if (p.proximo) return `${base} · em seguida: ${p.proximo.nome || 'próximo exercício'}`;
  if (haSeriesPendentes) return `${base} · volte para ${p.grupo.exercicios[0].nome || 'o primeiro'} e repita`;
  return base;
}

// ---- Operações (puras) ----

const montar = (trechos: Trecho[], grupos: Grupo[]): ExerciciosEGrupos => ({ exercicios: trechos.flatMap((t) => t.exercicios), grupos });

function trocar<T>(lista: T[], a: number, b: number): void {
  [lista[a], lista[b]] = [lista[b], lista[a]];
}

/** Tira o grupo da sessão e solta os membros (os exercícios ficam onde estão). */
export function desfazerGrupo(s: ExerciciosEGrupos, grupoUid: string): ExerciciosEGrupos {
  if (!gruposDe(s).some((g) => g.uid === grupoUid) && !s.exercicios.some((e) => e.grupoUid === grupoUid)) return s;
  return {
    exercicios: s.exercicios.map((e) => (e.grupoUid === grupoUid ? { ...e, grupoUid: null } : e)),
    grupos: gruposDe(s).filter((g) => g.uid !== grupoUid),
  };
}

/** Depois de perder um membro: o grupo abaixo do mínimo da técnica (ou vazio) é desfeito. */
function conferirMinimo(s: ExerciciosEGrupos, grupoUid: string | null | undefined): ExerciciosEGrupos {
  if (!grupoUid) return s;
  const grupo = gruposDe(s).find((g) => g.uid === grupoUid);
  const membros = membrosDo(s.exercicios, grupoUid);
  if (!grupo) return membros ? desfazerGrupo(s, grupoUid) : s;
  return membros < MINIMO_POR_GRUPO[grupo.tecnica] ? desfazerGrupo(s, grupoUid) : s;
}

/** Marca de grupo que não existe mais em `grupos` sai dos exercícios; grupo sem nenhum exercício sai da lista. */
export function limparGrupos(s: ExerciciosEGrupos): ExerciciosEGrupos {
  const existentes = new Set(gruposDe(s).map((g) => g.uid));
  const usados = new Set(s.exercicios.map((e) => e.grupoUid).filter((u): u is string => !!u && existentes.has(u)));
  const exercicios = s.exercicios.map((e) => (e.grupoUid && !existentes.has(e.grupoUid) ? { ...e, grupoUid: null } : e));
  const grupos = gruposDe(s).filter((g) => usados.has(g.uid));
  return { exercicios, grupos };
}

/**
 * Cria um grupo com os exercícios `indices` (seguidos, soltos e de 2 a 6). Circuito nasce sem voltas e sem descanso (a
 * publicação cobra as voltas); o grupo pode nascer abaixo do mínimo da técnica (tri-set com 2) e o validador cobra o resto.
 * Fora dessas condições, nada muda.
 */
export function criarGrupo(s: ExerciciosEGrupos, indices: readonly number[], tecnica: TecnicaDeGrupo, uid: string = novoUid()): ExerciciosEGrupos {
  const ordenados = [...indices].sort((a, b) => a - b);
  if (ordenados.length < 2 || ordenados.length > MAXIMO_POR_GRUPO) return s;
  if (ordenados.some((i, k) => i < 0 || i >= s.exercicios.length || (k > 0 && i !== ordenados[k - 1] + 1))) return s;
  const solto = (e: ExercicioPlano) => !e.grupoUid || !gruposDe(s).some((g) => g.uid === e.grupoUid);
  if (ordenados.some((i) => !solto(s.exercicios[i]))) return s;
  const marcados = new Set(ordenados);
  return {
    exercicios: s.exercicios.map((e, i) => (marcados.has(i) ? { ...e, grupoUid: uid } : e)),
    grupos: [...gruposDe(s), { uid, tecnica, descansoAposSegundos: null, voltas: null }],
  };
}

/**
 * Liga o exercício `indice` ao anterior: entra no grupo do anterior (se ele tem e há lugar) ou cria um grupo de 2 com a
 * `tecnica` dada. Nada muda se o exercício já está num grupo, é o primeiro da sessão, o grupo está cheio ou é de pré/pós-exaustão
 * (exatamente 2).
 */
export function juntarComAnterior(s: ExerciciosEGrupos, indice: number, tecnica: TecnicaDeGrupo = 'SUPERSET'): ExerciciosEGrupos {
  if (indice <= 0 || indice >= s.exercicios.length) return s;
  const anterior = s.exercicios[indice - 1];
  const grupo = anterior.grupoUid ? gruposDe(s).find((g) => g.uid === anterior.grupoUid) : undefined;
  if (!grupo) return criarGrupo(s, [indice - 1, indice], tecnica);
  return juntarAoGrupo(s, indice, grupo.uid);
}

/** Põe o exercício `indice`, solto e ao lado do grupo (logo antes do primeiro ou logo depois do último), dentro dele. */
export function juntarAoGrupo(s: ExerciciosEGrupos, indice: number, grupoUid: string): ExerciciosEGrupos {
  const grupo = gruposDe(s).find((g) => g.uid === grupoUid);
  const e = s.exercicios[indice];
  if (!grupo || !e || (e.grupoUid && gruposDe(s).some((g) => g.uid === e.grupoUid))) return s;
  const posicoes = s.exercicios.flatMap((x, i) => (x.grupoUid === grupoUid ? [i] : []));
  const membros = posicoes.length;
  if (membros === 0 || membros >= MAXIMO_POR_GRUPO || (grupoEmSequencia(grupo.tecnica) && membros >= 2)) return s;
  if (indice !== posicoes[0] - 1 && indice !== posicoes[membros - 1] + 1) return s;
  return { exercicios: s.exercicios.map((x, i) => (i === indice ? { ...x, grupoUid } : x)), grupos: gruposDe(s) };
}

/**
 * Tira o exercício `indice` do grupo. Na ponta, ele fica onde está; no meio, vai para logo depois do grupo (os membros
 * continuam seguidos). Grupo que cai abaixo do mínimo é desfeito.
 */
export function tirarDoGrupo(s: ExerciciosEGrupos, indice: number): ExerciciosEGrupos {
  const e = s.exercicios[indice];
  if (!e?.grupoUid) return s;
  const grupoUid = e.grupoUid;
  const posicoes = s.exercicios.flatMap((x, i) => (x.grupoUid === grupoUid ? [i] : []));
  const ultimo = posicoes[posicoes.length - 1];
  const solto = { ...e, grupoUid: null };
  let exercicios: ExercicioPlano[];
  if (indice === ultimo || indice === posicoes[0]) {
    exercicios = s.exercicios.map((x, i) => (i === indice ? solto : x));
  } else {
    exercicios = [...s.exercicios.slice(0, indice), ...s.exercicios.slice(indice + 1, ultimo + 1), solto, ...s.exercicios.slice(ultimo + 1)];
  }
  return conferirMinimo({ exercicios, grupos: gruposDe(s) }, grupoUid);
}

export interface MudancaDoGrupo {
  tecnica?: TecnicaDeGrupo;
  descansoAposSegundos?: number | null;
  voltas?: number | null;
}

/**
 * Altera o grupo. Trocar para pré ou pós-exaustão zera o descanso depois do grupo (cada série mantém o seu); as voltas só
 * existem no circuito e saem em qualquer outra técnica. O descanso por série dos membros nunca é tocado.
 */
export function alterarGrupoDaSessao(s: ExerciciosEGrupos, grupoUid: string, mudanca: MudancaDoGrupo): ExerciciosEGrupos {
  if (!gruposDe(s).some((g) => g.uid === grupoUid)) return s;
  const grupos = gruposDe(s).map((g) => {
    if (g.uid !== grupoUid) return g;
    const novo: Grupo = { ...g, ...mudanca, tecnica: mudanca.tecnica ?? g.tecnica };
    if (grupoEmSequencia(novo.tecnica)) novo.descansoAposSegundos = null;
    if (novo.tecnica !== 'CIRCUITO') novo.voltas = null;
    return novo;
  });
  return { exercicios: s.exercicios, grupos };
}

/**
 * Sobe ou desce um exercício. Solto: passa por cima do vizinho (se o vizinho é um grupo, por cima dele inteiro). Membro de
 * grupo: troca de lugar com o vizinho do grupo; na borda sai do grupo (e então se move como solto). O grupo que perde o
 * membro e cai abaixo do mínimo é desfeito.
 */
export function moverExercicio(s: ExerciciosEGrupos, indice: number, delta: -1 | 1): ExerciciosEGrupos {
  const destino = indice + delta;
  if (indice < 0 || indice >= s.exercicios.length || destino < 0 || destino >= s.exercicios.length) return s;
  const trechos = trechosDa(s);
  let acumulado = 0;
  let t = 0;
  while (acumulado + trechos[t].exercicios.length <= indice) acumulado += trechos[t++].exercicios.length;
  const posicao = indice - acumulado;
  const trecho = trechos[t];
  if (trecho.grupoUid && trecho.exercicios.length >= 2) {
    const alvo = posicao + delta;
    if (alvo >= 0 && alvo < trecho.exercicios.length) {
      trocar(trecho.exercicios, posicao, alvo);
      return montar(trechos, gruposDe(s));
    }
    // Na borda do grupo: o exercício sai e se move como solto.
    const [saiu] = trecho.exercicios.splice(posicao, 1);
    const novo: Trecho = { exercicios: [{ ...saiu, grupoUid: null }], grupoUid: null };
    const lugar = delta < 0 ? t : t + 1;
    trechos.splice(lugar, 0, novo);
    trocar(trechos, lugar, lugar + delta);
    return conferirMinimo(montar(trechos, gruposDe(s)), trecho.grupoUid);
  }
  trocar(trechos, t, t + delta);
  return montar(trechos, gruposDe(s));
}

/** Sobe ou desce o grupo inteiro (como bloco) por cima do trecho vizinho. */
export function moverGrupoDeExercicios(s: ExerciciosEGrupos, grupoUid: string, delta: -1 | 1): ExerciciosEGrupos {
  const trechos = trechosDa(s);
  const t = trechos.findIndex((x) => x.grupoUid === grupoUid);
  if (t < 0 || t + delta < 0 || t + delta >= trechos.length) return s;
  trocar(trechos, t, t + delta);
  return montar(trechos, gruposDe(s));
}

/** Remove um exercício; o grupo que cai abaixo do mínimo da técnica é desfeito (os outros membros ficam soltos). */
export function removerExercicio(s: ExerciciosEGrupos, indice: number): ExerciciosEGrupos {
  const e = s.exercicios[indice];
  if (!e) return s;
  const restante = { exercicios: s.exercicios.filter((_, i) => i !== indice), grupos: gruposDe(s) };
  return conferirMinimo(restante, e.grupoUid);
}
