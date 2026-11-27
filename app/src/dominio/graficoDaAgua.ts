import { coposDe, litrosParaTela, metaEmMl, type DiaDeAgua } from './aguaDoDia';
import { dataCurta } from './formatos';

/**
 * Gráfico da Água na ficha do treinador (27/11, Gustavo): sete barras do mais antigo a "Hoje", na altura proporcional ao
 * maior entre a meta e o maior registro, com o valor em cima ("0,8 L"), o ✓ do dia que chegou à meta e a linha da meta
 * ("Meta 5,0 L"). Dia sem registro não tem fração nem valor (coluna vazia, nunca zero). O texto de cada barra é a dica da
 * web e o nome para o leitor de tela: "25/11 · 0,8 L de 5,0 L (3 copos)".
 */
export interface BarraDaAgua {
  data: string;
  /** "19/11" ou "Hoje". */
  rotulo: string;
  hoje: boolean;
  /** 0 a 1 da altura útil; nula sem registro. Zero é zero (a tela dá um traço mínimo). */
  fracao: number | null;
  /** "0,8 L" em cima da barra; nulo sem registro. */
  valor: string | null;
  /** Chegou à meta da dieta (só com meta e com registro acima de zero). */
  bateuMeta: boolean;
  /** "25/11 · 0,8 L de 5,0 L (3 copos)", "25/11 · 0,8 L (3 copos)" sem meta, "25/11 · sem registro". */
  texto: string;
}

export interface GraficoDaAgua {
  barras: BarraDaAgua[];
  /** Altura da linha da meta (0 a 1); nula sem meta. */
  metaFracao: number | null;
  /** "Meta 5,0 L"; nulo sem meta. */
  rotuloDaMeta: string | null;
}

/** Litros com uma casa ("0,8 L", "5,0 L"): o valor em cima da barra; os copos da dica dão a medida exata. */
export const litrosDaBarra = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/** "(3 copos)", "(1 copo)", "(nenhum copo)". */
function coposEntreParenteses(ml: number): string {
  const n = coposDe(ml);
  return `(${n === 0 ? 'nenhum copo' : n === 1 ? '1 copo' : `${n} copos`})`;
}

export function barrasDaAgua(dias: readonly DiaDeAgua[], hoje: string, metaLitros: number | null): GraficoDaAgua {
  const meta = metaEmMl(metaLitros);
  const escala = Math.max(meta ?? 0, ...dias.map((d) => d.aguaMl ?? 0));
  const fracao = (ml: number) => (escala > 0 ? ml / escala : 0);
  const deMeta = meta === null ? '' : ` de ${litrosParaTela(meta)}`;
  return {
    metaFracao: meta === null ? null : fracao(meta),
    rotuloDaMeta: meta === null ? null : `Meta ${litrosParaTela(meta)}`,
    barras: dias.map((d) => {
      const ml = d.aguaMl;
      return {
        data: d.data,
        rotulo: d.data === hoje ? 'Hoje' : dataCurta(d.data),
        hoje: d.data === hoje,
        fracao: ml === null ? null : fracao(ml),
        valor: ml === null ? null : litrosDaBarra(ml),
        bateuMeta: meta !== null && ml !== null && ml > 0 && ml >= meta,
        texto: `${dataCurta(d.data)} · ${ml === null ? 'sem registro' : `${litrosDaBarra(ml)}${deMeta} ${coposEntreParenteses(ml)}`}`,
      };
    }),
  };
}
