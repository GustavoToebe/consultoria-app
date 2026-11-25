/**
 * Folha centralizada no PC (altura do conteúdo, no meio da janela): quando o rodapé muda de altura (erro ou status que
 * aparece, some ou cresce; motivo sob o botão), a folha cresce ou encolhe só para cima e a ação do rodapé não sai do
 * lugar (P4 de `docs/design-e-front.md`). Só a parte do crescimento que veio do rodapé é compensada: o que o corpo mudou
 * continua centralizado, e no teto de 90% (a folha não cresce, o corpo cede) não há nada a compensar.
 *
 * Devolve o novo deslocamento vertical da folha (px; negativo = para cima), preso para a folha não sair da área útil.
 */
export function ajusteDoRodape({ ajuste, deltaRodape, deltaPainel, folga }: {
  /** Deslocamento atual. */
  ajuste: number;
  /** Quanto o rodapé mudou de altura desde a última medida. */
  deltaRodape: number;
  /** Quanto a folha mudou de altura desde a última medida. */
  deltaPainel: number;
  /** Altura útil do fundo menos a altura atual da folha (o que sobra em cima e embaixo, somados). */
  folga: number;
}): number {
  const doRodape = deltaRodape * deltaPainel > 0 ? Math.sign(deltaPainel) * Math.min(Math.abs(deltaRodape), Math.abs(deltaPainel)) : 0;
  // Centralizada, a folha que cresce X desce X/2 embaixo; subir X/2 deixa o pé (e a ação) onde estava.
  const limite = Math.max(0, folga / 2);
  return Math.max(-limite, Math.min(limite, ajuste - doRodape / 2)) || 0; // `|| 0`: sem -0
}
