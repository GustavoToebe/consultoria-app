import { dataParaTela, somarDias } from './formatos';

/**
 * Período sugerido para uma pasta nova: começa em `hoje` e dura `dias` dias contando o primeiro (15/02 + 30 dias =
 * 16/03). Sem prazo no cadastro do aluno, só o início vem preenchido.
 */
export function periodoInicial(hoje: string, dias: number | null | undefined): { inicio: string; fim: string } {
  const inicio = dataParaTela(hoje);
  if (!dias || dias < 1) return { inicio, fim: '' };
  return { inicio, fim: dataParaTela(somarDias(hoje, dias - 1)) };
}
