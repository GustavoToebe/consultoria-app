import type { ExercicioPlano, MelhoresDoExercicio, RecordesDoPacote, Serie } from '../api/tipos';
import { numeroParaTela } from './formatos';

/**
 * Recordes pessoais (frente Engajamento, passo 0.2, decisões P3 e P10). A regra é o espelho de
 * `api/.../recordes/RecordesPessoais.java` (mudou uma, mude a outra; os testes dos dois lados usam os mesmos casos):
 * - só série simples conta: sem técnica nenhuma (cluster, rest-pause, drop-set, descritivas...), sem etapas, com carga
 *   em kg e repetições maiores que zero, feita, e exercício que não é cardio;
 * - três tipos, contra o melhor de antes: maior carga do exercício, mais repetições com a MESMA carga e maior volume de
 *   uma série (carga × repetições);
 * - sem nada antes não há recorde: o primeiro dia do exercício não conta; empate não é recorde;
 * - sem 1RM (P7): nada além de carga × repetições.
 *
 * O pacote traz os melhores de antes de `recordes.ate` (hoje de Brasília quando foi baixado). O app soma o que conhece
 * depois disso (aparelho e servidor) e compara as séries do dia na ordem do plano, sem internet. Na dúvida (um registro
 * de outra versão do plano, de técnica desconhecida) ele entra na base: só pode impedir um recorde, nunca inventar.
 */

export type TipoDeRecorde = 'MAIOR_CARGA' | 'MAIS_REPETICOES' | 'MAIOR_VOLUME';

/** Série simples feita: carga (kg, > 0) e repetições (> 0). */
export interface Marca {
  carga: number;
  repeticoes: number;
}

export interface Recorde {
  tipo: TipoDeRecorde;
  carga: number;
  repeticoes: number;
  /** O que bateu: a carga, as repetições ou o volume. */
  valor: number;
}

/** O mesmo valor em kg (70 e 70,00 são a mesma carga); a diferença de ponto flutuante não vira recorde. */
const EPSILON = 1e-9;
const igual = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const maior = (a: number, b: number) => a - b > EPSILON;
/** Volume com 3 casas: 0,1 × 3 não pode dar 0,30000000000000004 e passar do 0,3 que veio do servidor. */
const volume = (m: Marca) => Math.round(m.carga * m.repeticoes * 1000) / 1000;

/** A série entra na conta? Carga e repetições presentes, finitas e maiores que zero. */
export function conta(carga: number | null | undefined, repeticoes: number | null | undefined): boolean {
  return carga != null && repeticoes != null && Number.isFinite(carga) && Number.isFinite(repeticoes) && carga > 0 && repeticoes > 0;
}

/** Os melhores de um conjunto de séries (a ordem não importa); vazio = `null`. */
export function melhores(marcas: readonly Marca[]): MelhoresDoExercicio | null {
  return marcas.reduce<MelhoresDoExercicio | null>((m, marca) => acumular(m, marca), null);
}

/** Os melhores depois de mais uma série. */
export function acumular(base: MelhoresDoExercicio | null, marca: Marca): MelhoresDoExercicio {
  if (!base) {
    return { maiorCarga: marca.carga, maiorVolume: volume(marca), repeticoesPorCarga: [{ carga: marca.carga, repeticoes: marca.repeticoes }] };
  }
  const porCarga = base.repeticoesPorCarga.map((r) => ({ ...r }));
  const atual = porCarga.find((r) => igual(r.carga, marca.carga));
  if (!atual) porCarga.push({ carga: marca.carga, repeticoes: marca.repeticoes });
  else if (marca.repeticoes > atual.repeticoes) atual.repeticoes = marca.repeticoes;
  porCarga.sort((a, b) => a.carga - b.carga);
  return {
    maiorCarga: maior(marca.carga, base.maiorCarga) ? marca.carga : base.maiorCarga,
    maiorVolume: maior(volume(marca), base.maiorVolume) ? volume(marca) : base.maiorVolume,
    repeticoesPorCarga: porCarga,
  };
}

/** Os recordes que a série bate contra `base`, na ordem dos tipos. `base` nulo = nenhum (primeiro registro). */
export function recordes(base: MelhoresDoExercicio | null, marca: Marca): Recorde[] {
  if (!base) return [];
  const lista: Recorde[] = [];
  if (maior(marca.carga, base.maiorCarga)) lista.push({ tipo: 'MAIOR_CARGA', carga: marca.carga, repeticoes: marca.repeticoes, valor: marca.carga });
  const naCarga = base.repeticoesPorCarga.find((r) => igual(r.carga, marca.carga));
  if (naCarga && marca.repeticoes > naCarga.repeticoes) {
    lista.push({ tipo: 'MAIS_REPETICOES', carga: marca.carga, repeticoes: marca.repeticoes, valor: marca.repeticoes });
  }
  if (maior(volume(marca), base.maiorVolume)) lista.push({ tipo: 'MAIOR_VOLUME', carga: marca.carga, repeticoes: marca.repeticoes, valor: volume(marca) });
  return lista;
}

/**
 * Os recordes de cada série do dia, na ordem do plano: cada uma compara com o histórico e as anteriores do mesmo dia.
 * Série que não conta (`null`) não tem recorde nem muda a base. Sem histórico, nenhuma série do dia é recorde.
 */
export function doDia(base: MelhoresDoExercicio | null, emOrdem: readonly (Marca | null)[]): Recorde[][] {
  let atual = base;
  return emOrdem.map((marca) => {
    if (!marca) return [];
    const r = base ? recordes(atual, marca) : [];
    atual = acumular(atual, marca);
    return r;
  });
}

/** Série simples pela prescrição: sem técnica, sem cardio e com carga (o exercício não é "sem carga"). */
export function serieSimples(e: Pick<ExercicioPlano, 'modalidade' | 'unidade'>, s: Pick<Serie, 'tecnica' | 'cardio'>): boolean {
  return e.modalidade !== 'CARDIO' && e.unidade !== 'nenhuma' && !s.cardio && !s.tecnica?.tipo;
}

/** O pedaço de um registro (aparelho ou servidor) que a regra usa. */
export interface RegistroParaRecorde {
  planoVersaoId: string;
  exercicioUid: string;
  serieUid: string;
  exercicioId: string | null;
  data: string;
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  etapas: readonly unknown[] | null;
}

/** A marca do registro, se ele conta: feito, sem etapas, com carga e repetições maiores que zero. */
export function marcaDoRegistro(r: Pick<RegistroParaRecorde, 'concluida' | 'etapas' | 'carga' | 'repeticoes'> | undefined): Marca | null {
  if (!r || !r.concluida || (r.etapas != null && r.etapas.length > 0) || !conta(r.carga, r.repeticoes)) return null;
  return { carga: r.carga as number, repeticoes: r.repeticoes as number };
}

export interface EntradaDoExercicio {
  /** Do pacote; ausente com "Concluir treino" desligado (então nada é recorde). */
  recordes: RecordesDoPacote | null | undefined;
  /** O exercício na versão em uso e a versão. */
  exercicio: ExercicioPlano;
  versaoId: string;
  /** Data da sessão na tela. */
  data: string;
  /** Registros conhecidos, do aparelho e do servidor, de qualquer exercício. */
  registros: readonly RegistroParaRecorde[];
  /**
   * A prescrição de uma série da versão em uso (exercício e série) ou `null` se o registro é de outra versão: aí não se
   * sabe se é simples e ele entra na base.
   */
  serieDaVersao: (planoVersaoId: string, serieUid: string) => { exercicio: ExercicioPlano; serie: Serie } | null;
  /** A marcação que acabou de ser feita, ainda não gravada (ela vale no lugar do registro daquela série no dia). */
  marcacao?: { serieUid: string } & Pick<RegistroParaRecorde, 'carga' | 'repeticoes' | 'concluida'>;
}

/**
 * Recordes de cada série do exercício na data (por `serieUid`; só as que têm algum). Nada antes de `recordes.ate`
 * (dia que o pacote já cobre) e nada sem o exercício da biblioteca.
 */
export function recordesDoExercicio(entrada: EntradaDoExercicio): Record<string, Recorde[]> {
  const { recordes: doPacote, exercicio, versaoId, data } = entrada;
  const resultado: Record<string, Recorde[]> = {};
  if (!doPacote || !exercicio.exercicioId || data < doPacote.ate) return resultado;
  const simplesNaVersao = (r: RegistroParaRecorde) => {
    const achada = entrada.serieDaVersao(r.planoVersaoId, r.serieUid);
    return achada ? serieSimples(achada.exercicio, achada.serie) : true;
  };
  const doDiaNaTela = (r: RegistroParaRecorde) => r.data === data && r.planoVersaoId === versaoId && r.exercicioUid === exercicio.uid;
  // Base: o pacote mais o que o app conhece depois do corte e antes desta linha do treino (dias anteriores, e no mesmo
  // dia o mesmo exercício em outra linha ou outra versão: na dúvida conta como anterior).
  let base: MelhoresDoExercicio | null = doPacote.exercicios[exercicio.exercicioId] ?? null;
  for (const r of entrada.registros) {
    if (r.exercicioId !== exercicio.exercicioId || r.data < doPacote.ate || r.data > data || doDiaNaTela(r)) continue;
    const marca = marcaDoRegistro(r);
    if (marca && simplesNaVersao(r)) base = acumular(base, marca);
  }
  const marcas = exercicio.series.map((s) => {
    if (!serieSimples(exercicio, s)) return null;
    if (entrada.marcacao?.serieUid === s.uid) return marcaDoRegistro({ ...entrada.marcacao, etapas: null });
    return marcaDoRegistro(entrada.registros.find((r) => doDiaNaTela(r) && r.serieUid === s.uid));
  });
  doDia(base, marcas).forEach((r, i) => {
    if (r.length) resultado[exercicio.series[i]!.uid] = r;
  });
  return resultado;
}

/** "Maior carga · 70 kg", "Mais repetições · 12 com 60 kg", "Maior volume · 700 kg". */
export function textoDoRecorde(r: Recorde): string {
  if (r.tipo === 'MAIOR_CARGA') return `Maior carga · ${numeroParaTela(r.carga)} kg`;
  if (r.tipo === 'MAIS_REPETICOES') return `Mais repetições · ${r.repeticoes} com ${numeroParaTela(r.carga)} kg`;
  return `Maior volume · ${numeroParaTela(r.valor)} kg`;
}

/** Quantas séries do dia têm recorde (a medalha). */
export function seriesComRecorde(porSerie: readonly Record<string, Recorde[]>[]): number {
  return porSerie.reduce((n, m) => n + Object.keys(m).length, 0);
}

/** Texto da contagem no resumo do dia; vazio sem recorde. */
export function textoDaContagem(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 recorde pessoal' : `${n} recordes pessoais`;
}
