/** "09:05", na hora do aparelho. */
export function horaDoSalvamento(instante: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(instante.getHours())}:${dois(instante.getMinutes())}`;
}

/**
 * Texto do selo de um rascunho em dia: "Salvo às 09:05" depois de salvar nesta tela; sem salvamento nesta tela
 * (acabou de abrir) fica só o `rotulo`, porque não há hora para dizer.
 */
export function textoDoSalvo(salvoAs: Date | null, rotulo = 'Salvo'): string {
  return salvoAs ? `${rotulo} às ${horaDoSalvamento(salvoAs)}` : rotulo;
}
