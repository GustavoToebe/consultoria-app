import { codigoApi, emailValido, errosPorCampo, formatarTelefone, somenteDigitos, telefoneValido } from '@plataforma/web';

import type {
  DuplicidadeInscricao,
  FiltroInscricoes,
  InscricaoPublicaRequest,
  PagamentoInscricao,
  SituacaoInscricao,
} from '../api/inscricoesTipos';
import { SEM_DADO } from './formatos';

/**
 * Regras puras da inscrição por link e da fila de interessados. As validações espelham a API (`InscricaoPublicaRequest`
 * e `Formatos.telefone`), que decide de verdade; o telefone e o e-mail usam as regras do `@plataforma/web`, iguais ao
 * `web/Formatos.java`.
 */

export type TipoDeSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** Limites dos campos (mesmos do `@Size` da API). */
export const LIMITES_INSCRICAO = { nome: 120, email: 254, objetivo: 500, observacao: 1000, texto: 2000, nota: 2000 } as const;

const SITUACOES: Record<SituacaoInscricao, { texto: string; tipo: TipoDeSelo }> = {
  NOVA: { texto: 'Nova', tipo: 'atencao' },
  EM_CONTATO: { texto: 'Em contato', tipo: 'atencao' },
  EM_NEGOCIACAO: { texto: 'Em negociação', tipo: 'atencao' },
  ACEITA: { texto: 'Aceita', tipo: 'sucesso' },
  RECUSADA: { texto: 'Recusada', tipo: 'neutro' },
  DESISTIU: { texto: 'Desistiu', tipo: 'neutro' },
};

const PAGAMENTOS: Record<PagamentoInscricao, { texto: string; tipo: TipoDeSelo }> = {
  NAO_CONTROLADO: { texto: 'Não controlado', tipo: 'neutro' },
  AGUARDANDO: { texto: 'Aguardando', tipo: 'atencao' },
  CONFIRMADO_MANUAL: { texto: 'Confirmado (manual)', tipo: 'sucesso' },
};

/** Selo da situação comercial: âmbar enquanto em atendimento, verde aceita, cinza encerrada (nunca a cor da marca). */
export function seloDaSituacao(s: SituacaoInscricao): { texto: string; tipo: TipoDeSelo } {
  return SITUACOES[s];
}

export function seloDoPagamento(p: PagamentoInscricao): { texto: string; tipo: TipoDeSelo } {
  return PAGAMENTOS[p];
}

/** Filtros da lista, na ordem da tela. */
export const FILTROS_INSCRICOES: { valor: FiltroInscricoes; rotulo: string }[] = [
  { valor: 'ABERTAS', rotulo: 'Em atendimento' },
  { valor: 'NOVA', rotulo: 'Novas' },
  { valor: 'EM_CONTATO', rotulo: 'Em contato' },
  { valor: 'EM_NEGOCIACAO', rotulo: 'Em negociação' },
  { valor: 'ACEITA', rotulo: 'Aceitas' },
  { valor: 'RECUSADA', rotulo: 'Recusadas' },
  { valor: 'DESISTIU', rotulo: 'Desistiram' },
  { valor: 'TODAS', rotulo: 'Todas' },
];

export const OPCOES_PAGAMENTO: { valor: PagamentoInscricao; rotulo: string }[] = [
  { valor: 'NAO_CONTROLADO', rotulo: 'Não controlado' },
  { valor: 'AGUARDANDO', rotulo: 'Aguardando' },
  { valor: 'CONFIRMADO_MANUAL', rotulo: 'Confirmado' },
];

/**
 * Situações que a pessoa pode escolher no andamento. Aceitar e recusar têm botão próprio (a API recusa as duas no
 * andamento); aceita não muda mais; recusada pode voltar ao atendimento.
 */
export function situacoesDoAndamento(atual: SituacaoInscricao): { valor: SituacaoInscricao; rotulo: string }[] {
  if (atual === 'ACEITA') return [{ valor: 'ACEITA', rotulo: SITUACOES.ACEITA.texto }];
  const base: SituacaoInscricao[] = ['NOVA', 'EM_CONTATO', 'EM_NEGOCIACAO', 'DESISTIU'];
  const lista = atual === 'RECUSADA' ? [...base, 'RECUSADA' as const] : base;
  return lista.map((valor) => ({ valor, rotulo: SITUACOES[valor].texto }));
}

export const podeAceitar = (s: SituacaoInscricao) => s !== 'ACEITA';
export const podeRecusar = (s: SituacaoInscricao) => s !== 'ACEITA' && s !== 'RECUSADA';

/**
 * Link do WhatsApp sem texto pré-preenchido (nada de dado da pessoa na URL): `https://wa.me/55<DDD+número>`. Telefone
 * fora do padrão (sem DDD, curto) não vira link.
 */
export function linkDoWhatsApp(whatsapp: string | null | undefined): string | null {
  if (!whatsapp || !telefoneValido(whatsapp)) return null;
  let d = somenteDigitos(whatsapp);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return `https://wa.me/55${d}`;
}

/** Objetivo curto para a linha da lista; ausente é "—". */
export function resumoDoObjetivo(texto: string | null | undefined, maximo = 80): string {
  const limpo = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) return SEM_DADO;
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/** Aviso de possível duplicidade (só aviso: nada é fundido); `null` sem duplicidade. */
export function textoDaDuplicidade(d: DuplicidadeInscricao | null | undefined): string | null {
  if (!d) return null;
  const partes: string[] = [];
  if (d.alunoExistente) partes.push('Já existe um aluno com este e-mail.');
  if (d.outrasInscricoesAbertas === 1) partes.push('Há outra inscrição em atendimento com o mesmo e-mail ou WhatsApp.');
  if (d.outrasInscricoesAbertas > 1) {
    partes.push(`Há outras ${d.outrasInscricoesAbertas} inscrições em atendimento com o mesmo e-mail ou WhatsApp.`);
  }
  return partes.length ? partes.join(' ') : null;
}

/** Campos da página pública, como a pessoa digita. */
export interface DadosDaInscricao {
  nome: string;
  whatsapp: string;
  email: string;
  objetivo: string;
  observacao: string;
}

export const INSCRICAO_VAZIA: DadosDaInscricao = { nome: '', whatsapp: '', email: '', objetivo: '', observacao: '' };

/** Máscara do WhatsApp enquanto digita: `(11) 98765-4321`. */
export const mascaraWhatsapp = (texto: string) => formatarTelefone(texto);

/** Erros por campo antes de enviar (vazio = pode enviar). `exigeCiencia` quando a consultoria tem texto. */
export function errosDaInscricao(d: DadosDaInscricao, exigeCiencia: boolean, ciencia: boolean): Record<string, string> {
  const erros: Record<string, string> = {};
  const nome = d.nome.trim();
  if (!nome) erros.nome = 'Informe seu nome.';
  else if (nome.length > LIMITES_INSCRICAO.nome) erros.nome = `Use até ${LIMITES_INSCRICAO.nome} caracteres.`;
  if (!d.whatsapp.trim()) erros.whatsapp = 'Informe o WhatsApp com DDD.';
  else if (!telefoneValido(d.whatsapp)) erros.whatsapp = 'WhatsApp inválido. Informe o DDD e o número.';
  const email = d.email.trim();
  if (email && (!emailValido(email) || email.length > LIMITES_INSCRICAO.email)) erros.email = 'E-mail inválido.';
  if (d.objetivo.trim().length > LIMITES_INSCRICAO.objetivo) erros.objetivo = `Use até ${LIMITES_INSCRICAO.objetivo} caracteres.`;
  if (d.observacao.trim().length > LIMITES_INSCRICAO.observacao) {
    erros.observacao = `Use até ${LIMITES_INSCRICAO.observacao} caracteres.`;
  }
  if (exigeCiencia && !ciencia) erros.cienciaPrivacidade = 'Marque que você leu o texto acima.';
  return erros;
}

/** Corpo do envio: textos sem espaços nas pontas e vazio = nulo. O token só vai quando há. */
export function corpoDaInscricao(d: DadosDaInscricao, ciencia: boolean, token: string | null): InscricaoPublicaRequest {
  const opcional = (t: string) => (t.trim() ? t.trim() : null);
  const corpo: InscricaoPublicaRequest = {
    nome: d.nome.trim(),
    whatsapp: d.whatsapp.trim(),
    email: opcional(d.email),
    objetivo: opcional(d.objetivo),
    observacao: opcional(d.observacao),
    cienciaPrivacidade: ciencia,
  };
  if (token) corpo.turnstileToken = token;
  return corpo;
}

/**
 * Aluno apontado por um 409 do aceite: `ALUNO_JA_EXISTE` (e-mail de um aluno que já existe) ou `INSCRICAO_JA_ACEITA`
 * (aceite repetido). A API manda o id em `fieldErrors` (`alunoId`); `null` em qualquer outro erro.
 */
export function alunoDoConflito(erro: unknown): string | null {
  const codigo = codigoApi(erro);
  if (codigo !== 'ALUNO_JA_EXISTE' && codigo !== 'INSCRICAO_JA_ACEITA') return null;
  return errosPorCampo(erro).alunoId ?? null;
}
