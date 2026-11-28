import type { Tema } from '../api/tipos';
import { PALETAS } from '../tema/tokens';

/** O modo da paleta que a prévia mostra ("Ver em: Escuro · Claro"). */
export type ModoDaPrevia = 'ESCURO' | 'CLARO';

/**
 * Paleta que a prévia da Marca desenha em cada modo do "Ver em": no modo do tema padrão escolhido, ele mesmo; no outro,
 * a paleta base desse modo (Escuro ou Claro), que é o que o aluno vê ao trocar o tema em Aparência e preferências.
 */
export function temaDaPrevia(temaPadrao: Tema, modo: ModoDaPrevia): Tema {
  return PALETAS[temaPadrao].modo === modo ? temaPadrao : modo;
}

/** O modo em que a prévia começa: o do tema padrão escolhido. */
export const modoDoTema = (tema: Tema): ModoDaPrevia => PALETAS[tema].modo;

/**
 * Nome que aparece como remetente dos e-mails do app: o "Nome que aparece nos e-mails" de Contato
 * (`emailRemetenteNome`) e, vazio, o nome da consultoria (a mesma regra do `RemetenteDaConsultoria` da API).
 */
export function remetenteDosEmails(nomeDoRemetente: string | null | undefined, nomeDaConsultoria: string): string {
  return nomeDoRemetente?.trim() || nomeDaConsultoria.trim();
}
