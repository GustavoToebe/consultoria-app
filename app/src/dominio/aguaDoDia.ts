import { dataCurta, somarDias } from './formatos';

/**
 * Água do dia (docs/planos/agua-do-aluno.md): o aluno marca copos de 250 ml e vê quanto tomou contra a "Água por dia"
 * que o treinador escreveu na dieta. O servidor guarda mililitros. Nada é calculado nem comemorado: o app só mostra os
 * dois números e uma barra. Dia sem registro é "—", nunca zero; zero é zero (o aluno tirou os copos).
 */

export const COPO_ML = 250;
/** Teto do servidor (20 L), o mesmo da meta da dieta. */
export const AGUA_MAXIMA_ML = 20_000;
/** Quantos dias a tela oferece: hoje e os 6 anteriores. */
export const DIAS_DA_AGUA = 7;

/** Água de um dia como a tela usa, venha do aparelho ou do servidor. */
export interface AguaDeUmDia {
  data: string;
  aguaMl: number;
}

/** Registro do aparelho: o que falhou (recusado pelo servidor) não vale e deixa valer o do servidor, se houver. */
export interface AguaLocal extends AguaDeUmDia {
  situacao: 'LOCAL' | 'ENVIADO' | 'FALHOU';
}

/** Um copo a mais, sem passar do teto. */
export function maisUmCopo(ml: number): number {
  return Math.min(ml + COPO_ML, AGUA_MAXIMA_ML);
}

/** Um copo a menos, sem ficar negativo. */
export function menosUmCopo(ml: number): number {
  return Math.max(ml - COPO_ML, 0);
}

/** Copos inteiros (um valor livre no futuro que não feche em 250 ml conta os copos cheios). */
export function coposDe(ml: number): number {
  return Math.floor(ml / COPO_ML);
}

/** "1 copo", "6 copos", "Nenhum copo". */
export function textoDosCopos(ml: number): string {
  const n = coposDe(ml);
  if (n === 0) return 'Nenhum copo';
  return n === 1 ? '1 copo' : `${n} copos`;
}

/** Litros com vírgula: uma casa quando basta ("1,5 L", "3,0 L"), duas quando o copo pede ("0,25 L", "1,75 L"). */
export function litrosParaTela(ml: number): string {
  const litros = ml / 1000;
  const casas = Math.round(litros * 100) % 10 === 0 ? 1 : 2;
  return `${litros.toFixed(casas).replace('.', ',')} L`;
}

/** "1,5 L de 3,0 L"; sem meta, só o que tomou; sem registro, "—". */
export function textoDaAguaDoDia(ml: number | null, metaLitros: number | null | undefined): string {
  if (ml === null) return '—';
  const tomou = litrosParaTela(ml);
  return metaLitros == null ? tomou : `${tomou} de ${litrosParaTela(Math.round(metaLitros * 1000))}`;
}

/** Mililitros da meta da dieta (a barra compara com ela); sem meta, `null` e a água nem aparece. */
export function metaEmMl(metaLitros: number | null | undefined): number | null {
  return metaLitros == null || Number.isNaN(metaLitros) || metaLitros <= 0 ? null : Math.round(metaLitros * 1000);
}

/**
 * A água que a tela usa: a do servidor e a do aparelho; no mesmo dia, a do aparelho ganha (é a mais recente e ainda
 * pode estar na fila), menos a que falhou.
 */
export function fundirAgua(locais: readonly AguaLocal[], doServidor: readonly AguaDeUmDia[]): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const a of doServidor) porDia.set(a.data, a.aguaMl);
  for (const a of locais) if (a.situacao !== 'FALHOU') porDia.set(a.data, a.aguaMl);
  return porDia;
}

/** Dias que a tela oferece, do mais antigo ao de hoje (como os chips da mobilidade). `hoje` é o de Brasília. */
export function diasDaAgua(hoje: string, quantos = DIAS_DA_AGUA): string[] {
  const dias: string[] = [];
  for (let i = quantos - 1; i >= 0; i--) dias.push(somarDias(hoje, -i));
  return dias;
}

/** Um dia na ficha do treinador. */
export interface DiaDeAgua {
  data: string;
  /** Nulo = não registrou (coluna vazia, nunca zero). */
  aguaMl: number | null;
}

/** Os últimos `quantos` dias até `hoje`, do mais antigo ao de hoje (a ordem do gráfico), com o que o aluno registrou (ou nulo). */
export function ultimosDiasDeAgua(registros: readonly AguaDeUmDia[], hoje: string, quantos = DIAS_DA_AGUA): DiaDeAgua[] {
  const porDia = new Map(registros.map((r) => [r.data, r.aguaMl]));
  return diasDaAgua(hoje, quantos).map((data) => ({ data, aguaMl: porDia.get(data) ?? null }));
}

/** Litros com uma casa ("0,0 L", "1,3 L"): a média, que não fecha em copos. */
const litrosComUmaCasa = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/**
 * Linha do topo do cartão Água: "Registrou 1 de 7 dias · média 0,0 L por dia · meta 5,0 L". A média é só dos dias com
 * registro (dia sem registro não é zero); sem nenhum, "Nenhum registro nos últimos 7 dias". A meta só com a "Água por
 * dia" da dieta. Só mostra: não compara nem diz se bateu.
 */
export function resumoDaAgua(dias: readonly DiaDeAgua[], metaLitros: number | null): string {
  const ml = dias.flatMap((d) => (d.aguaMl === null ? [] : [d.aguaMl]));
  const partes = ml.length === 0 ? [`Nenhum registro nos últimos ${dias.length} dias`]
    : [`Registrou ${ml.length} de ${dias.length} dias`, `média ${litrosComUmaCasa(ml.reduce((t, v) => t + v, 0) / ml.length)} por dia`];
  const meta = metaEmMl(metaLitros);
  if (meta !== null) partes.push(`meta ${litrosParaTela(meta)}`);
  return partes.join(' · ');
}

/** Uma coluna do gráfico: `fracao` da altura (0 a 1; nula sem registro), o rótulo curto e o texto do dia. */
export interface ColunaDaAgua {
  data: string;
  /** "19/11" ou "Hoje". */
  rotulo: string;
  fracao: number | null;
  /** "18/11: 0,0 L de 5,0 L", "18/11: sem registro" (dica e leitor de tela). */
  texto: string;
}

/**
 * Mini gráfico dos 7 dias, na ordem dos dias: a altura é proporcional aos litros, na escala do maior entre a meta e o
 * maior registro; a meta é uma linha na `metaFracao` (nula sem meta). Zero tem fração 0 (a tela dá a altura mínima).
 */
export function graficoDaAgua(dias: readonly DiaDeAgua[], hoje: string, metaLitros: number | null): { colunas: ColunaDaAgua[]; metaFracao: number | null } {
  const meta = metaEmMl(metaLitros);
  const escala = Math.max(meta ?? 0, ...dias.map((d) => d.aguaMl ?? 0));
  const fracao = (ml: number) => (escala > 0 ? ml / escala : 0);
  return {
    metaFracao: meta === null ? null : fracao(meta),
    colunas: dias.map((d) => ({
      data: d.data,
      rotulo: d.data === hoje ? 'Hoje' : dataCurta(d.data),
      fracao: d.aguaMl === null ? null : fracao(d.aguaMl),
      texto: `${dataCurta(d.data)}: ${d.aguaMl === null ? 'sem registro' : textoDaAguaDoDia(d.aguaMl, meta === null ? null : metaLitros)}`,
    })),
  };
}
