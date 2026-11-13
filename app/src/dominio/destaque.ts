/**
 * Cor de destaque do número de um indicador (`docs/planos/cores-de-destaque.md`, D1 a D6). A função diz o que o número
 * mede, nunca a marca: **situação** (verde concluído, âmbar pendente, vermelho atraso ou erro) ou **indicador** (azul,
 * ciano, violeta: medida, sem dizer se é bom ou ruim). Os valores de cada uma ficam em `tema/tokens.coresDeDestaque`.
 */
export type FuncaoDeDestaque = 'azul' | 'ciano' | 'verde' | 'ambar' | 'vermelho' | 'violeta';

export const FUNCOES_DE_DESTAQUE: readonly FuncaoDeDestaque[] = ['azul', 'ciano', 'verde', 'ambar', 'vermelho', 'violeta'];

/** Como o número aparece: na cor da função, `neutro` (texto comum) ou `apagado` (`textoSuave`: zero ou sem dado). */
export type EnfaseDoNumero = FuncaoDeDestaque | 'neutro' | 'apagado';

/**
 * D5: zero ou dado indisponível ficam apagados, sem cor de função ("0 atrasadas" não é alerta, "—" não é sucesso). Só
 * valor positivo leva a cor; sem função (ou negativo, cujo sentido a cor não diz) fica neutro.
 */
export function enfaseDoNumero(funcao: FuncaoDeDestaque | null, valor: number | null | undefined): EnfaseDoNumero {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor === 0) return 'apagado';
  return valor > 0 && funcao ? funcao : 'neutro';
}
