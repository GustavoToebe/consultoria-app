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

/** Motivo da desativação (25/11 e 26/11): `MANUAL` = a equipe desativou (o aluno não entra); `ATRASO` = pausado até quitar. */
export type MotivoDoAcesso = 'MANUAL' | 'ATRASO';
export const motivoDoAcesso = (aluno: Pick<AlunoDetalhe, 'acessoDesativadoMotivo'>): MotivoDoAcesso | null => aluno.acessoDesativadoMotivo ?? null;

/**
 * As mesmas palavras no cartão Acesso ao app, no cabeçalho da ficha e na lista de alunos (26/11, pedido do Gustavo). O
 * pausado é âmbar (alguém precisa agir: o aluno quitar, 4.5); o desativado é neutro com o "●" (encerrado pela equipe, e o
 * ponto o separa do "Sem acesso" de quem nunca teve conta).
 */
export const TEXTO_ACESSO_PAUSADO = 'Acesso pausado';
export const TEXTO_ACESSO_DESATIVADO = 'Acesso desativado';
export function seloDoMotivo(motivo: MotivoDoAcesso | null | undefined): { texto: string; tipo: 'atencao' | 'neutro'; ponto?: true } | null {
  if (motivo === 'ATRASO') return { texto: TEXTO_ACESSO_PAUSADO, tipo: 'atencao' };
  if (motivo === 'MANUAL') return { texto: TEXTO_ACESSO_DESATIVADO, tipo: 'neutro', ponto: true };
  return null;
}

/**
 * Nota da Situação no cartão: a data (Brasília, o ano só se for outro) e o que vale para o aluno. A data fica na nota,
 * nunca no selo (o selo tem as mesmas palavras nos três lugares). Instante ausente ou malformado: só a frase, sem data.
 * O pausado "vê só as cobranças em aberto": no celular com a chave da loja desligada não há tela de pagamento.
 */
export function notaDoAcessoDesativado(motivo: MotivoDoAcesso, em: string | null | undefined, agora: Date = new Date()): string {
  const data = em && !Number.isNaN(Date.parse(em)) ? dataSemAnoCorrente(dataEmBrasilia(em), hojeEmBrasilia(agora)) : null;
  if (motivo === 'ATRASO') {
    return `${data ? `Pausado em ${data} por cobrança vencida. ` : ''}O aluno entra e vê só as cobranças em aberto; o acesso volta sozinho quando ele quitar as vencidas.`;
  }
  return `${data ? `Desativado em ${data}. ` : ''}O aluno não entra até o acesso ser reativado. Nada foi apagado.`;
}

export const MOTIVO_SEM_COBRANCA_VENCIDA = 'Sem cobrança vencida';

/**
 * O que o cartão oferece (26/11). Duas permissões independentes: `convite` (`ALUNO_CONVITE`: desativar e o "Reativar" do
 * MANUAL, pela `/acesso/reativar`) e `financeiro` (`FINANCEIRO_ALTERAR`: pausar e o "Reativar" do ATRASO, pela
 * `/reativar-acesso`). `pausarVisivel` também pede o financeiro ligado (é de lá que vem a cobrança vencida). `emAtraso`:
 * `true`/`false` de `GET /financeiro/alunos-em-atraso`; `null` = não se sabe (carregando, falhou ou a lista veio truncada),
 * e o item fica habilitado: a API decide com o 409 `SEM_COBRANCA_VENCIDA`. Inativo ou anonimizado: nada (reativar primeiro).
 * Sem conta não há o que pausar nem desativar (a API recusa desativar com `ALUNO_SEM_ACESSO`).
 */
export interface AcoesDoAcesso {
  /** Rota do "Reativar acesso" da Situação: `pausa` (`/reativar-acesso`), `desativacao` (`/acesso/reativar`) ou sem botão. */
  reativar: 'pausa' | 'desativacao' | null;
  /** "Pausar acesso até quitar" no ⋯: `null` não aparece; `motivo` não nulo = desabilitado com ele. */
  pausar: { motivo: string | null } | null;
  /** "Desativar acesso" no ⋯ (em ATRASO também: troca para MANUAL). */
  desativar: boolean;
}

export function acoesDoAcesso(
  aluno: Pick<AlunoDetalhe, 'ativo' | 'anonimizado' | 'temAcesso' | 'acessoDesativadoMotivo'>,
  pode: { convite: boolean; financeiro: boolean; pausarVisivel: boolean },
  emAtraso: boolean | null,
): AcoesDoAcesso {
  if (!aluno.ativo || aluno.anonimizado) return { reativar: null, pausar: null, desativar: false };
  const motivo = motivoDoAcesso(aluno);
  const reativar = motivo === 'MANUAL' && pode.convite ? 'desativacao' : motivo === 'ATRASO' && pode.financeiro ? 'pausa' : null;
  const pausar = !motivo && aluno.temAcesso && pode.financeiro && pode.pausarVisivel
    ? { motivo: emAtraso === false ? MOTIVO_SEM_COBRANCA_VENCIDA : null } : null;
  return { reativar, pausar, desativar: pode.convite && aluno.temAcesso && motivo !== 'MANUAL' };
}

/** Aviso depois de trocar o e-mail de acesso: `emailEnviado` é o da API (aviso entregue ao provedor para o e-mail novo). */
export const textoDoEmailAlterado = (emailEnviado: boolean): string =>
  `E-mail de acesso alterado. As sessões do aluno foram encerradas. ${emailEnviado ? 'Avisamos o aluno no e-mail novo.' : 'O envio de e-mails está desligado; avise o aluno.'}`;

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
  ALUNO_INATIVO: 'Aluno inativo: reative pelo menu ⋯ do aluno, no topo da ficha, para mudar o acesso.',
  // O mesmo texto fixo da API (26/11): pausar ou o "Reativar" do Financeiro em quem a equipe desativou.
  ACESSO_JA_DESATIVADO: 'O acesso deste aluno foi desativado pela equipe. Só "Reativar acesso", em Acesso ao app, o libera.',
  SEM_COBRANCA_VENCIDA: 'Este aluno não tem cobrança vencida em aberto: o acesso só pausa com uma cobrança vencida.',
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
