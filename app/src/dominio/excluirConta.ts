import { descreverNaoEnviados } from './treinosNaoEnviados';

/**
 * "Excluir minha conta" do aluno (App Store 5.1.1(v), LGPD). A API confere de novo a palavra e a senha
 * (`ExclusaoDeContaService`): aqui só se decide quando o botão final libera e o que a tela explica.
 */

/** A palavra que o aluno digita. Igual a `ExclusaoDeContaService.CONFIRMACAO` na API. */
export const PALAVRA_DE_CONFIRMACAO = 'EXCLUIR';

/** O mesmo teste do servidor: sem espaços nas pontas e sem diferenciar maiúsculas de minúsculas. */
export function confirmouExclusao(digitado: string): boolean {
  return digitado.trim().toLocaleUpperCase('pt-BR') === PALAVRA_DE_CONFIRMACAO;
}

/** O botão final só libera com a senha preenchida e a palavra certa; o texto diz o que falta. */
export function motivoParaNaoExcluir(senha: string, digitado: string): string | null {
  if (!senha) return 'Digite a sua senha.';
  if (!confirmouExclusao(digitado)) return `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`;
  return null;
}

/** O que acontece, em linguagem simples. Mudou a anonimização na API? Revise este texto. */
export const EXPLICACAO_DA_EXCLUSAO =
  'Isso não tem volta. Seu nome, e-mail e senha, o peso, a dieta, as respostas das atualizações e da anamnese, ' +
  'as observações dos treinos e as fotos são apagados. Os treinos e as cargas e repetições que você registrou ficam ' +
  'com a consultoria, sem o seu nome. Você sai deste e de todos os aparelhos e não consegue mais entrar com este e-mail.';

/** Registros deste aparelho que ainda não chegaram ao treinador também se perdem: avisa só quando existem. */
export function avisoDeNaoEnviados(treinos: number, diasDeMobilidade = 0, diasDeAgua = 0): string | null {
  const d = descreverNaoEnviados(treinos, diasDeMobilidade, diasDeAgua);
  if (!d) return null;
  return `Você tem ${d.texto} ainda não ${d.enviado} neste aparelho; ${d.ele} também ${d.sera}.`;
}
