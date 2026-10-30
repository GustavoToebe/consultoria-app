import { somarDias } from './formatos';

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

/** Linha de um dia na ficha do treinador. */
export interface DiaDeAgua {
  data: string;
  /** Nulo = não registrou ("—"). */
  aguaMl: number | null;
}

/** Os últimos `quantos` dias até `hoje`, do mais novo ao mais antigo, com o que o aluno registrou (ou nulo). */
export function ultimosDiasDeAgua(registros: readonly AguaDeUmDia[], hoje: string, quantos = DIAS_DA_AGUA): DiaDeAgua[] {
  const porDia = new Map(registros.map((r) => [r.data, r.aguaMl]));
  return diasDaAgua(hoje, quantos)
    .reverse()
    .map((data) => ({ data, aguaMl: porDia.has(data) ? porDia.get(data)! : null }));
}

/** "Registrou 5 de 7 dias" (dias com registro, zero incluído: o aluno marcou que não tomou). */
export function resumoDosDias(dias: readonly DiaDeAgua[]): string {
  const com = dias.filter((d) => d.aguaMl !== null).length;
  if (com === 0) return `Nenhum registro nos últimos ${dias.length} dias`;
  return `Registrou ${com} de ${dias.length} dias`;
}
