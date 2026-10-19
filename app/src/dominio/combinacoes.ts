import type { Combinacao, ExercicioPlano } from '../api/tipos';

/**
 * Agrupamento de exercícios (pesquisa de técnicas de 19/10): exercícios seguidos da sessão ligados por
 * `juntoComAnterior` são feitos em sequência, sem descanso entre eles. O nome vem do tamanho (2 = bi-set, 3 = tri-set,
 * 4 ou mais = circuito); num grupo de 2 o treinador pode chamar de supersérie (`combinacao` no primeiro). Nada muda no
 * registro: o aluno continua registrando cada série de cada exercício. Mesmas regras do `ValidadorTreino`.
 */

/** Máximo de exercícios num grupo, o mesmo do servidor. */
export const MAXIMO_POR_GRUPO = 6;

export interface GrupoDeExercicios {
  /** Posição do primeiro exercício do grupo na sessão. */
  inicio: number;
  exercicios: ExercicioPlano[];
  /** "Bi-set", "Supersérie", "Tri-set" ou "Circuito"; nulo para exercício sozinho. */
  nome: string | null;
}

/** Nome do grupo pelo tamanho; a supersérie só vale para 2. */
export function nomeDoGrupo(tamanho: number, combinacao: Combinacao | null | undefined): string | null {
  if (tamanho < 2) return null;
  if (tamanho === 2) return combinacao === 'SUPERSERIE' ? 'Supersérie' : 'Bi-set';
  return tamanho === 3 ? 'Tri-set' : 'Circuito';
}

/**
 * Grupos da sessão, na ordem: cada exercício entra em exatamente um (sozinho, quando não está ligado). A marca no
 * primeiro exercício da sessão é ignorada, como no servidor (que recusa publicar assim).
 */
export function gruposDaSessao(exercicios: readonly ExercicioPlano[]): GrupoDeExercicios[] {
  const grupos: { inicio: number; exercicios: ExercicioPlano[] }[] = [];
  exercicios.forEach((e, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && e.juntoComAnterior) ultimo.exercicios.push(e);
    else grupos.push({ inicio: i, exercicios: [e] });
  });
  return grupos.map((g) => ({ ...g, nome: nomeDoGrupo(g.exercicios.length, g.exercicios[0].combinacao) }));
}

export interface PosicaoNoGrupo {
  nome: string;
  /** 1 = primeiro do grupo. */
  posicao: number;
  tamanho: number;
  grupo: GrupoDeExercicios;
  /** O que vem depois dentro do grupo; nulo no último. */
  proximo: ExercicioPlano | null;
}

/** Onde o exercício `indice` está no grupo dele; nulo quando é feito sozinho. */
export function posicaoNoGrupo(exercicios: readonly ExercicioPlano[], indice: number): PosicaoNoGrupo | null {
  const grupo = gruposDaSessao(exercicios).find((g) => indice >= g.inicio && indice < g.inicio + g.exercicios.length);
  if (!grupo?.nome) return null;
  const posicao = indice - grupo.inicio + 1;
  return {
    nome: grupo.nome,
    posicao,
    tamanho: grupo.exercicios.length,
    grupo,
    proximo: grupo.exercicios[posicao] ?? null,
  };
}

/**
 * Faixa do exercício na tela do aluno: "Bi-set 1 de 2 · em seguida: Remada". No último, "volte para <primeiro> e
 * repita" enquanto o grupo ainda tiver séries a fazer; sem séries pendentes, só a posição.
 */
export function textoDaFaixa(p: PosicaoNoGrupo, haSeriesPendentes: boolean): string {
  const base = `${p.nome} ${p.posicao} de ${p.tamanho}`;
  if (p.proximo) return `${base} · em seguida: ${p.proximo.nome || 'próximo exercício'}`;
  if (haSeriesPendentes) return `${base} · volte para ${p.grupo.exercicios[0].nome || 'o primeiro'} e repita`;
  return base;
}

/** Pode ligar o exercício `indice` ao anterior sem passar do máximo do grupo (e sem ser o primeiro da sessão)? */
export function podeJuntar(exercicios: readonly ExercicioPlano[], indice: number): boolean {
  if (indice <= 0 || indice >= exercicios.length) return false;
  const ligado = exercicios.map((e, i) => (i === indice ? { ...e, juntoComAnterior: true } : e));
  const grupo = gruposDaSessao(ligado).find((g) => indice >= g.inicio && indice < g.inicio + g.exercicios.length);
  return !!grupo && grupo.exercicios.length <= MAXIMO_POR_GRUPO;
}
