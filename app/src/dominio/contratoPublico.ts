import { codigoApi, cpfValido, erroDeConexao } from '@plataforma/web';

import { ORIGEM_PUBLICA_DO_APP } from './loja';

/**
 * Página pública do contrato do responsável (`/contrato#codigo=...`, passo 4 de `docs/planos/contrato-digital.md`, D11 e
 * D28): o link que a equipe envia, o texto do WhatsApp, as conferências do formulário antes de enviar e a leitura dos erros
 * da API pública. O código vai no fragmento (não chega ao servidor, ao log de acesso nem ao Referer) e a tela o tira do
 * endereço; CPF e nome vão só no corpo dos POST. Nada daqui guarda dado no aparelho.
 */

/** `APP_URL/contrato#codigo=<codigo>`. Na web a tela passa a própria origem; no celular vale a de produção. */
export const linkDoContrato = (codigo: string, origem: string = ORIGEM_PUBLICA_DO_APP): string =>
  `${origem.replace(/\/+$/, '')}/contrato#codigo=${encodeURIComponent(codigo)}`;

/** O texto fixo da mensagem do WhatsApp: só o link, sem nome, CPF nem título. */
export const mensagemDoWhatsAppDoContrato = (link: string): string => `Olá! Segue o link para assinar o contrato: ${link}`;

/**
 * `wa.me` com o texto pronto, aberto fora do app (sem token nosso). Sem telefone (o app não tem o do responsável à mão na
 * ficha) a pessoa escolhe o contato no WhatsApp: `https://wa.me/?text=`.
 */
export const linkDoWhatsAppDoContrato = (link: string): string =>
  `https://wa.me/?text=${encodeURIComponent(mensagemDoWhatsAppDoContrato(link))}`;

// ---- formulário ----

/** Sem espaços nas pontas nem repetidos: é o que vai à API e o que o comprovante imprime. */
export const normalizarNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ');

/** Nome do responsável: obrigatório e com ao menos duas palavras (S4: registrado como digitado, sem comparar ao cadastro). */
export function erroDoNomeDoResponsavel(nome: string): string | undefined {
  const limpo = normalizarNome(nome);
  if (!limpo) return 'Escreva o nome completo do responsável.';
  if (limpo.split(' ').length < 2) return 'Escreva o nome e o sobrenome.';
  return undefined;
}

/** CPF conferido no app antes do envio: o CPF que não confere na API gasta uma tentativa do limite. */
export function erroDoCpfDoResponsavel(cpf: string): string | undefined {
  if (!cpf.trim()) return 'Digite o CPF do responsável.';
  if (!cpfValido(cpf)) return 'CPF inválido. Confira os números.';
  return undefined;
}

export interface FormularioDaAssinatura {
  nome: string;
  aceite: boolean;
  declaroResponsavelLegal: boolean;
}

export type CampoDaAssinatura = keyof FormularioDaAssinatura;

/** Os erros do formulário, pelos nomes dos campos da API (`nome`, `aceite`, `declaroResponsavelLegal`); vazio = pode enviar. */
export function errosDaAssinatura(f: FormularioDaAssinatura): Partial<Record<CampoDaAssinatura, string>> {
  const erros: Partial<Record<CampoDaAssinatura, string>> = {};
  const nome = erroDoNomeDoResponsavel(f.nome);
  if (nome) erros.nome = nome;
  if (!f.aceite) erros.aceite = 'Marque que leu e concorda com o contrato.';
  if (!f.declaroResponsavelLegal) erros.declaroResponsavelLegal = 'Marque que você é o responsável legal do aluno.';
  return erros;
}

// ---- erros da API pública ----

export const TEXTO_LINK_INDISPONIVEL = {
  titulo: 'Este link não está mais disponível',
  texto: 'O link venceu, já foi usado ou o contrato foi cancelado. Peça um novo link a quem enviou.',
} as const;

// shortcut: o cliente da API não repassa o Retry-After, então o texto não diz quantos minutos; trocar quando o ErroApi trouxer o cabeçalho.
export const TEXTO_MUITAS_TENTATIVAS = 'Muitas tentativas. Tente de novo em alguns minutos.';
export const TEXTO_SEM_INTERNET = 'Confira a internet e tente de novo.';
export const TEXTO_CPF_NAO_CONFERE = 'Este CPF não confere com o do responsável cadastrado.';
export const TEXTO_CONTRATO_ALTERADO = 'O contrato mudou desde que você abriu. Leia de novo antes de assinar.';

/**
 * Como a tela trata o erro de uma rota pública. Qualquer 404 (código inexistente, vencido, usado ou de contrato cancelado,
 * a API não distingue) é o mesmo "link indisponível"; o 503 da chave desligada também.
 */
export type ErroDoContratoPublico = 'indisponivel' | 'limite' | 'sem-internet' | 'cpf' | 'alterado' | 'assinatura' | 'outro';

export function tipoDoErroPublico(erro: unknown): ErroDoContratoPublico {
  if (erroDeConexao(erro)) return 'sem-internet';
  const status = typeof erro === 'object' && erro !== null && 'status' in erro ? (erro as { status: unknown }).status : null;
  const codigo = codigoApi(erro);
  if (status === 404 || codigo === 'CONTRATOS_INDISPONIVEL') return 'indisponivel';
  if (status === 429) return 'limite';
  if (codigo === 'CPF_NAO_CONFERE') return 'cpf';
  if (codigo === 'CONTRATO_ALTERADO') return 'alterado';
  if (codigo === 'ASSINATURA_INVALIDA') return 'assinatura';
  return 'outro';
}
