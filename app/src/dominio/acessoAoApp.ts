import { codigoApi, emailValido, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { AlunoDetalhe } from '../api/tipos';
import { dataEmBrasilia, hojeEmBrasilia, horaEmBrasilia } from './agendaPresencial';
import { dataSemAnoCorrente } from './datasRelativas';
import { dataParaTela } from './formatos';

/**
 * Linha do último login no cartão Acesso ao app (24/11; plano `docs/planos/ficha-acesso-ao-app.md`). O rótulo segue a
 * regra da ficha: `LOGIN` é "Último login" e só `ACESSO` é "Último acesso ao app" (login nunca é chamado de acesso). O
 * texto é curto, no fuso de Brasília qualquer que seja o do aparelho: "Hoje, 18:38", "Ontem, 18:38", senão "17/10 18:38"
 * (com o ano só se for outro). A data completa vai na dica. Nunca entrou, instante malformado ou tipo desconhecido: rótulo
 * "Último login" e texto `null` (a linha mostra "—").
 */
export function ultimoLoginNaLinha(
  u: AlunoDetalhe['ultimoAcesso'], agora: Date = new Date(),
): { rotulo: string; texto: string | null; exata: string | null } {
  const rotulo = u?.tipo === 'ACESSO' ? 'Último acesso ao app' : 'Último login';
  if (!u?.em || Number.isNaN(Date.parse(u.em)) || (u.tipo !== 'LOGIN' && u.tipo !== 'ACESSO')) return { rotulo: 'Último login', texto: null, exata: null };
  const dia = dataEmBrasilia(u.em);
  const hoje = hojeEmBrasilia(agora);
  const hora = horaEmBrasilia(u.em);
  const dias = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86_400_000);
  const texto = dias === 0 ? `Hoje, ${hora}` : dias === -1 ? `Ontem, ${hora}` : `${dataSemAnoCorrente(dia, hoje)} ${hora}`;
  return { rotulo, texto, exata: `${dataParaTela(dia)} às ${hora}` };
}

/** Conta existe e a equipe desativou o acesso (25/11; o aluno não entra, nada foi apagado). */
export const acessoDesativado = (aluno: Pick<AlunoDetalhe, 'temAcesso' | 'acessoDesativadoEm'>): boolean =>
  aluno.temAcesso && !!aluno.acessoDesativadoEm;

/**
 * Texto da Situação no cartão quando o acesso está desativado: "Sem acesso (desativado em 20/11)", a data de Brasília e o
 * ano só se for outro. Instante ausente ou malformado: só "Sem acesso" (nunca uma data inventada).
 */
export function textoDoDesativado(acessoDesativadoEm: string | null | undefined, agora: Date = new Date()): string {
  if (!acessoDesativadoEm || Number.isNaN(Date.parse(acessoDesativadoEm))) return 'Sem acesso';
  return `Sem acesso (desativado em ${dataSemAnoCorrente(dataEmBrasilia(acessoDesativadoEm), hojeEmBrasilia(agora))})`;
}

/** Limite do e-mail (o mesmo `maxLength` do formulário de definir acesso). */
export const LIMITE_DO_EMAIL = 254;
export type ErrosDoNovoEmail = { email?: string; confirmacao?: string };

/** Folha "Alterar e-mail de acesso": formato, os dois iguais e diferente do atual (sem diferença de caixa nem espaços). */
export function errosDoNovoEmail(novo: string, confirmacao: string, atual: string | null | undefined): ErrosDoNovoEmail {
  const erros: ErrosDoNovoEmail = {};
  const email = novo.trim();
  if (!email) erros.email = 'Informe o novo e-mail.';
  else if (email.length > LIMITE_DO_EMAIL || !emailValido(email)) erros.email = 'Informe um e-mail válido, como nome@exemplo.com.';
  else if (atual && email.toLowerCase() === atual.trim().toLowerCase()) erros.email = 'Este já é o e-mail de acesso do aluno. Informe outro.';
  const repetido = confirmacao.trim();
  if (!repetido) erros.confirmacao = 'Repita o novo e-mail.';
  else if (email && repetido.toLowerCase() !== email.toLowerCase()) erros.confirmacao = 'Os dois e-mails não são iguais.';
  return erros;
}

/** Recusas do acesso pelo código (nunca pelo texto da API); o que é do campo vai para `campos.email`. */
const MENSAGENS_DO_ACESSO: Record<string, string> = {
  ACESSO_DESATIVADO: 'O acesso deste aluno está desativado. Reative o acesso antes de mudar o e-mail, a senha ou o convite.',
  ALUNO_SEM_ACESSO: 'Este aluno ainda não tem conta no app. Gere um convite ou defina o e-mail e a senha.',
  ALUNO_INATIVO: 'Aluno inativo: reative pelo menu ⋯ para mudar o acesso.',
  ALUNO_ANONIMIZADO: 'Aluno anonimizado: o acesso não muda mais.',
};
export const MENSAGEM_EMAIL_EM_USO = 'Este e-mail já é usado por outra conta.';

export function traduzirErroDoAcesso(e: unknown): { campos: { email?: string }; mensagem: string | null } {
  const codigo = codigoApi(e);
  if (codigo === 'EMAIL_EM_USO') return { campos: { email: MENSAGEM_EMAIL_EM_USO }, mensagem: null };
  if (codigo && MENSAGENS_DO_ACESSO[codigo]) return { campos: {}, mensagem: MENSAGENS_DO_ACESSO[codigo] };
  const email = errosPorCampo(e).email;
  if (email) return { campos: { email }, mensagem: null };
  return { campos: {}, mensagem: mensagemApi(e, 'Algo deu errado. Tente de novo.') };
}
