import { codigoApi, emailValido, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type { ResponsavelFinanceiro, ResponsavelFinanceiroRequest } from '../api/financeiroResponsavel';
import { erroDoCpf, erroDoTelefone, mascaraCpf, mascaraTelefone, NAO_INFORMADO } from './cadastroDoAluno';

/**
 * Responsável financeiro do aluno (D15): regras da ficha (leitura, formulário, corpo do PUT e erros). A validação espelha
 * `ResponsavelFinanceiroService.validar` (mesmos limites, contados depois de tirar os espaços das pontas, e as mesmas
 * mensagens fixas): mudou uma, mude a outra. O e-mail daqui é mais permissivo que o da API, cujo 422 cai no campo.
 * Nenhuma mensagem repete o que foi digitado (dado de outra pessoa).
 */

export const LIMITES_DO_RESPONSAVEL = { nome: 120, parentesco: 30, email: 254 } as const;

export type CampoDoResponsavel = 'nome' | 'parentesco' | 'cpf' | 'telefone' | 'email';
/** Na ordem da Folha (o foco vai ao primeiro com erro). */
export const CAMPOS_DO_RESPONSAVEL: readonly CampoDoResponsavel[] = ['nome', 'parentesco', 'telefone', 'email', 'cpf'];

export type FormDoResponsavel = Record<CampoDoResponsavel, string>;
export type ErrosDoResponsavel = Partial<Record<CampoDoResponsavel, string>>;

export const TITULO_DO_RESPONSAVEL = 'Responsável financeiro';
export const AJUDA_DO_RESPONSAVEL = 'É dado de outra pessoa: o app usa só nos lembretes de pagamento. O lembrete por e-mail vai ao e-mail do '
  + 'responsável e o WhatsApp, ao telefone dele; o que faltar continua indo ao aluno. O aluno segue vendo e pagando as cobranças.';
export const SEM_RESPONSAVEL = 'Nenhum responsável financeiro. Os lembretes de pagamento vão ao próprio aluno.';
export const LINHA_DOS_LEMBRETES = 'Os lembretes vão ao responsável.';

/** `versao` nula = o aluno não tem responsável (o GET responde 200 com tudo nulo). */
export const temResponsavel = (r: ResponsavelFinanceiro | null | undefined): r is ResponsavelFinanceiro => r?.versao != null;

export const SEM_RESPONSAVEL_NA_RESPOSTA: ResponsavelFinanceiro = {
  nome: null, parentesco: null, cpf: null, telefone: null, email: null, versao: null, atualizadoEm: null,
};

export interface ParDeLeitura { rotulo: string; valor: string; numerico?: boolean }

/**
 * Os pares da leitura em linhas de duas colunas (a mesma borda do cartão "Acesso ao app"): quem é, o contato que os lembretes
 * usam e o CPF. O CPF só entra quando a pessoa pode vê-lo (`veCpf`): sem a permissão a API o manda nulo mesmo gravado, e
 * "Não informado" ali seria falso (a linha fica vazia e quem desenha a pula).
 */
export function leituraDoResponsavel(r: ResponsavelFinanceiro, veCpf: boolean): ParDeLeitura[][] {
  const ou = (v: string | null) => (v?.trim() ? v : NAO_INFORMADO);
  return [
    [{ rotulo: 'Nome', valor: ou(r.nome) }, { rotulo: 'Parentesco', valor: ou(r.parentesco) }],
    [{ rotulo: 'Telefone', valor: ou(r.telefone), numerico: true }, { rotulo: 'E-mail', valor: ou(r.email) }],
    veCpf ? [{ rotulo: 'CPF', valor: ou(r.cpf), numerico: true }] : [],
  ];
}

/** O formulário com tudo o que o GET trouxe: o PUT substitui tudo, então um campo vazio aqui apagaria o gravado. */
export function formDoResponsavel(r: ResponsavelFinanceiro | null | undefined): FormDoResponsavel {
  return {
    nome: r?.nome ?? '', parentesco: r?.parentesco ?? '', cpf: mascaraCpf(r?.cpf ?? ''),
    telefone: mascaraTelefone(r?.telefone ?? ''), email: r?.email ?? '',
  };
}

export const houveMudanca = (form: FormDoResponsavel, r: ResponsavelFinanceiro | null | undefined): boolean => {
  const antes = formDoResponsavel(r);
  return CAMPOS_DO_RESPONSAVEL.some((c) => form[c].trim() !== antes[c].trim());
};

/** Erros por campo (chaves do `fieldErrors` da API). Sem `veCpf` o CPF nem é conferido: o campo não aparece e a API o ignora. */
export function errosDoResponsavel(form: FormDoResponsavel, veCpf: boolean): ErrosDoResponsavel {
  const erros: ErrosDoResponsavel = {};
  const nome = form.nome.trim();
  if (!nome) erros.nome = 'Informe o nome do responsável.';
  else if (nome.length > LIMITES_DO_RESPONSAVEL.nome) erros.nome = `O nome pode ter até ${LIMITES_DO_RESPONSAVEL.nome} caracteres.`;
  if (form.parentesco.trim().length > LIMITES_DO_RESPONSAVEL.parentesco) {
    erros.parentesco = `O parentesco pode ter até ${LIMITES_DO_RESPONSAVEL.parentesco} caracteres.`;
  }
  const cpf = veCpf ? erroDoCpf(form.cpf) : undefined;
  if (cpf) erros.cpf = cpf;
  const telefone = erroDoTelefone(form.telefone);
  if (telefone) erros.telefone = telefone;
  const email = form.email.trim();
  if (email && (email.length > LIMITES_DO_RESPONSAVEL.email || !emailValido(email))) erros.email = 'E-mail inválido.';
  return erros;
}

const ouNulo = (v: string) => v.trim() || null;

/** Corpo do PUT: tudo aparado, vazio = nulo (apaga). Sem `veCpf` o CPF vai nulo (a API o ignora e o gravado fica). */
export function corpoDoResponsavel(form: FormDoResponsavel, versao: number | null, veCpf: boolean): ResponsavelFinanceiroRequest {
  return {
    nome: form.nome.trim(), parentesco: ouNulo(form.parentesco), cpf: veCpf ? ouNulo(form.cpf) : null,
    telefone: ouNulo(form.telefone), email: ouNulo(form.email), versao,
  };
}

/** O que o cartão oferece: só com `FINANCEIRO_ALTERAR` e aluno não anonimizado (quem chama junta os dois em `podeAlterar`). */
export function acoesDoResponsavel(podeAlterar: boolean, r: ResponsavelFinanceiro | null | undefined): { editar: string | null; remover: boolean } {
  if (!podeAlterar || !r) return { editar: null, remover: false };
  return temResponsavel(r) ? { editar: 'Editar responsável', remover: true } : { editar: 'Adicionar responsável', remover: false };
}

export const MENSAGEM_CONFIRA = 'Confira os campos destacados.';
export const MENSAGEM_CONFLITO = 'O responsável financeiro foi alterado em outro lugar. Recarregamos para você conferir.';
export const MENSAGEM_ANONIMIZADO = 'O aluno foi anonimizado e não tem mais responsável financeiro.';
export const MENSAGEM_NAO_ENCONTRADO = 'Aluno não encontrado. Atualize a página.';
export const MENSAGEM_SEM_CONEXAO = 'Sem conexão com o servidor. Nada foi salvo; tente de novo.';

export interface ErroDoResponsavel {
  /** Vai ao alerta da Folha (ou ao aviso, quando `recarregar`). */
  mensagem: string;
  campos: ErrosDoResponsavel;
  /** Outra pessoa mudou o responsável (ou o aluno mudou): fecha a Folha, busca de novo e avisa. */
  recarregar: boolean;
  /** O Financeiro foi desligado no servidor: a seção some, como o resto do Financeiro. */
  esconder: boolean;
}

/**
 * Tradução do erro do PUT e do DELETE: 422 `RESPONSAVEL_INVALIDO` por campo (o que a tela não mostra vai ao texto geral),
 * 409 `CONFLITO_EDICAO` e `ALUNO_ANONIMIZADO` recarregam, 404, 503 `FINANCEIRO_INDISPONIVEL` esconde, sem conexão e o resto
 * com o texto da API (que nunca repete o valor). `veCpf` diz se o campo CPF está na tela.
 */
export function traduzirErroDoResponsavel(erro: unknown, veCpf: boolean): ErroDoResponsavel {
  const base = { campos: {}, recarregar: false, esconder: false };
  const codigo = codigoApi(erro);
  if (codigo === 'RESPONSAVEL_INVALIDO') {
    const campos: ErrosDoResponsavel = {};
    const fora: string[] = [];
    for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
      const nosso = CAMPOS_DO_RESPONSAVEL.find((c) => c === campo && (c !== 'cpf' || veCpf));
      if (nosso) campos[nosso] ??= mensagem;
      else fora.push(mensagem);
    }
    return { ...base, campos, mensagem: fora.length ? fora.join(' ') : MENSAGEM_CONFIRA };
  }
  if (codigo === 'CONFLITO_EDICAO') return { ...base, mensagem: MENSAGEM_CONFLITO, recarregar: true };
  if (codigo === 'ALUNO_ANONIMIZADO') return { ...base, mensagem: MENSAGEM_ANONIMIZADO, recarregar: true };
  if (codigo === 'FINANCEIRO_INDISPONIVEL') return { ...base, mensagem: mensagemApi(erro, 'O Financeiro está desligado.'), esconder: true };
  if (codigo === 'NAO_ENCONTRADO' || statusDoErro(erro) === 404) return { ...base, mensagem: MENSAGEM_NAO_ENCONTRADO };
  if (erroDeConexao(erro)) return { ...base, mensagem: MENSAGEM_SEM_CONEXAO };
  return { ...base, mensagem: mensagemApi(erro, 'Não foi possível salvar o responsável. Tente de novo.') };
}

function statusDoErro(erro: unknown): number | null {
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  return typeof status === 'number' ? status : null;
}
