/**
 * Kcal do alimento = proteína × 4 + carboidrato × 4 + gordura × 9, em 2 casas. É uma conta sobre os macros que o
 * treinador escreveu, não valor inventado. Espelha `BibliotecaService.kcalDosMacros` (API): a API é quem grava.
 * Nulo se qualquer macro faltar (ausência não vira zero).
 */
export function kcalDosMacros(proteina: number | null, carboidrato: number | null, gordura: number | null): number | null {
  const macros = [proteina, carboidrato, gordura];
  // Macro negativo é inválido (a API recusa com 400): sem kcal "calculada", a pendência da tela segura o Salvar.
  if (macros.some((m) => m === null || Number.isNaN(m) || (m as number) < 0)) return null;
  // Em centésimos inteiros, para 0,9 × 4 + 12,3 × 4 + 0,1 × 9 não sair com ruído de ponto flutuante.
  const [p, c, g] = macros.map((m) => Math.round((m as number) * 100));
  return (p * 4 + c * 4 + g * 9) / 100;
}

/**
 * D15: macros são opcionais. Os três preenchidos recalculam a kcal; com um, dois ou nenhum fica a `gravada` (a da fonte,
 * como no Batel Grill; nula se não havia). Zero digitado é valor (0/0/0 dá 0). Espelha `BibliotecaService.kcalDoAlimento`.
 */
export function kcalDoAlimento(
  proteina: number | null, carboidrato: number | null, gordura: number | null, gravada: number | null,
): number | null {
  return kcalDosMacros(proteina, carboidrato, gordura) ?? gravada;
}
