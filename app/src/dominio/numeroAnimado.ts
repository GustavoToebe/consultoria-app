/** Interpolação apenas visual: não modifica valores gravados ou cálculos da dieta. */
export function interpolarNumero(anterior: number | null, novo: number | null, passo: number, casas = 0): number | null {
 if (novo === null || anterior === null) return novo;
 const fator = Math.min(1, Math.max(0, passo));
 const escala = 10 ** casas;
 return Math.round((anterior + (novo - anterior) * fator) * escala) / escala;
}
