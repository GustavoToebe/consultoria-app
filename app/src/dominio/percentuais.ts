import { numeroParaTela } from './formatos';

/**
 * Formatador único dos percentuais da série: o editor (`descreverGrupo`, `previaDoGrupo`), o PDF e a meta do aluno
 * (`metaDaSerie`) importam daqui, para a mesma faixa ter o mesmo texto em todo lugar. Só texto: nenhum valor gravado
 * muda. O percentual é sempre da carga de trabalho, nunca do 1RM.
 */

export interface FaixaDePercentual {
  min?: number | null;
  max?: number | null;
}

/** "85%" ou "85% a 90%" (o "%" em cada ponta); "—" sem mínimo. */
export function textoDaFaixa(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null) return '—';
  return max == null || max === min ? `${numeroParaTela(min)}%` : `${numeroParaTela(min)}% a ${numeroParaTela(max)}%`;
}

/**
 * As faixas de várias séries na ordem, "50% · 70% · 85% a 90%"; se todas forem iguais, o texto aparece uma vez só
 * ("85% a 90%"), porque o número de séries já está no "3x".
 */
export function textoDosPercentuais(faixas: readonly FaixaDePercentual[]): string {
  const textos = faixas.map((f) => textoDaFaixa(f.min, f.max));
  if (textos.length === 0) return '—';
  return textos.every((t) => t === textos[0]) ? textos[0] : textos.join(' · ');
}
