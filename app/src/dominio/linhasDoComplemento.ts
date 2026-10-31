/**
 * Dose, horário e observação de um item de "Medicação e ergogênicos" (Outros) ou da suplementação na dieta do aluno (A10
 * da reunião de 30/10): antes saíam numa linha só, "2 cápsulas · 08:00 · Com água", e o aluno não sabia o que era cada
 * parte. Agora cada um é uma linha com o rótulo, só os preenchidos, na ordem. O texto é o que o treinador escreveu, sem
 * conta nem interpretação; nada preenchido = lista vazia (a tela mostra "—").
 */
export function linhasDoComplemento(item: { dose?: string | null; horario?: string | null; observacao?: string | null }): string[] {
  const linhas: string[] = [];
  const dose = item.dose?.trim();
  const horario = item.horario?.trim();
  const observacao = item.observacao?.trim();
  if (dose) linhas.push(`Dose: ${dose}`);
  if (horario) linhas.push(`Horário: ${horario}`);
  if (observacao) linhas.push(`Observação: ${observacao}`);
  return linhas;
}
