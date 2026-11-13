/**
 * Cor de destaque do número de um indicador (`docs/planos/cores-de-destaque.md`, D1 a D6). A função diz o que o número
 * mede, nunca a marca: **situação** (verde concluído, âmbar pendente, vermelho atraso ou erro) ou **indicador** (azul,
 * ciano, violeta: medida, sem dizer se é bom ou ruim). Os valores de cada uma ficam em `tema/tokens.coresDeDestaque`.
 */
export type FuncaoDeDestaque = 'azul' | 'ciano' | 'verde' | 'ambar' | 'vermelho' | 'violeta';

export const FUNCOES_DE_DESTAQUE: readonly FuncaoDeDestaque[] = ['azul', 'ciano', 'verde', 'ambar', 'vermelho', 'violeta'];

/**
 * Como o número aparece: na cor da função, `neutro` (texto comum), `zero` ("0" em `textoSuave`) ou `indisponivel`
 * ("—" em `textoSuave` com o motivo escrito embaixo). Zero e indisponível são neutros e nunca têm o mesmo aspecto (D14).
 */
export type EnfaseDoNumero = FuncaoDeDestaque | 'neutro' | 'zero' | 'indisponivel';

/** Motivo padrão do número indisponível, escrito sob o "—" (o "—" sozinho parecia um zero apagado). */
export const MOTIVO_SEM_DADOS = 'Sem dados';

/**
 * D5 e D14: zero e dado indisponível ficam sem cor de função ("0 atrasadas" não é alerta, "—" não é sucesso) e
 * distintos entre si; "Sem dados" nunca vira zero. Só valor positivo leva a cor; sem função (ou negativo, cujo sentido a
 * cor não diz) fica neutro.
 */
export function enfaseDoNumero(funcao: FuncaoDeDestaque | null, valor: number | null | undefined): EnfaseDoNumero {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'indisponivel';
  if (valor === 0) return 'zero';
  return valor > 0 && funcao ? funcao : 'neutro';
}

/**
 * Medida calculada (mediana, média, conversão): com base válida, o zero é um resultado e mantém a cor da função (0 dias,
 * 0%); a neutralização do zero de `enfaseDoNumero` vale só para contagem e soma. Sem base (nulo, NaN) segue
 * `indisponivel` ("—" com o motivo); negativo fica neutro, como lá.
 */
export function enfaseDaMedida(funcao: FuncaoDeDestaque | null, valor: number | null | undefined): EnfaseDoNumero {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'indisponivel';
  return valor >= 0 && funcao ? funcao : 'neutro';
}
