import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi, somenteDigitos } from '@plataforma/web';

import type { MeusDadosRequest, MeusDadosResponse } from '../api/tipos';
import {
  CAMPOS_DO_ENDERECO, CPF_EM_USO, enderecoParaEnvio, enderecoParaForm, erroDoCpf, erroDoTelefone, errosDoEndereco, MENSAGEM_CPF_EM_USO,
  mascaraCpf, mascaraTelefone, type CampoDoEndereco, type EnderecoNoForm,
} from './cadastroDoAluno';
import { sexoDoCampo } from './sexo';

/**
 * "Meus dados" do aluno (Conta): telefone, endereço, sexo e, só se estiver vazio, o CPF. Regras puras do formulário; as
 * de formato e de endereço são as de `cadastroDoAluno` (iguais às da API, que decide de verdade). Dado pessoal: nada
 * daqui vai para log, aviso ou mensagem de erro, e nada fica no aparelho.
 */

/** Nome, e-mail do cadastro e e-mail de acesso são só leitura; a mensagem é a mesma para os três. */
export const TEXTO_SO_LEITURA = 'Para mudar, fale com o seu treinador.';

/** Formulário: tudo texto; sexo vazio = "Não informado". */
export interface FormMeusDados {
  telefone: string;
  cpf: string;
  endereco: EnderecoNoForm;
  sexo: string;
}

/** Erros por campo (do formulário ou do servidor); o endereço tem uma chave por campo. */
export interface ErrosMeusDados {
  telefone?: string;
  cpf?: string;
  sexo?: string;
  endereco: Partial<Record<CampoDoEndereco, string>>;
}

/** Form inicial, com as máscaras do que a API devolveu. */
export function formDeMeusDados(resp: MeusDadosResponse): FormMeusDados {
  return {
    telefone: resp.telefone?.trim() ? mascaraTelefone(resp.telefone) : '',
    cpf: resp.cpf?.trim() ? mascaraCpf(resp.cpf) : '',
    endereco: enderecoParaForm(resp.endereco),
    sexo: sexoDoCampo(resp.sexo) ?? '',
  };
}

/** O aluno só preenche o CPF se estiver vazio no cadastro; preenchido é só leitura (o treinador corrige pela ficha). */
export const cpfEditavel = (resp: MeusDadosResponse): boolean => !resp.cpf?.trim();

/**
 * Corpo do `PUT`: telefone, endereço e sexo substituem (vazio apaga); `cpf` só vai se o campo é editável e está
 * preenchido, senão `null` (sem efeito). A `versao` é a da resposta que a tela mostra.
 */
export function corpoDoPut(form: FormMeusDados, resp: MeusDadosResponse): MeusDadosRequest {
  return {
    telefone: form.telefone.trim() ? mascaraTelefone(form.telefone) : null,
    cpf: cpfEditavel(resp) && form.cpf.trim() ? mascaraCpf(form.cpf) : null,
    endereco: enderecoParaEnvio(form.endereco),
    sexo: sexoDoCampo(form.sexo),
    versao: resp.versao,
  };
}

/** Há algum erro (de campo ou de endereço)? */
export const temErros = (erros: ErrosMeusDados): boolean =>
  !!erros.telefone || !!erros.cpf || !!erros.sexo || Object.values(erros.endereco).some(Boolean);

/** Erros que o formulário já sabe achar (os mesmos validadores da ficha); o CPF só conta quando é editável. */
export function errosDoForm(form: FormMeusDados, resp: MeusDadosResponse): ErrosMeusDados {
  const erros: ErrosMeusDados = { endereco: errosDoEndereco(form.endereco) };
  const telefone = erroDoTelefone(form.telefone);
  if (telefone) erros.telefone = telefone;
  const cpf = cpfEditavel(resp) ? erroDoCpf(form.cpf) : undefined;
  if (cpf) erros.cpf = cpf;
  return erros;
}

/** Algo foi mexido em relação ao que o servidor tem (habilita o "Salvar")? Espaços e máscaras não contam. */
export function houveMudanca(form: FormMeusDados, resp: MeusDadosResponse): boolean {
  const inicial = formDeMeusDados(resp);
  if (somenteDigitos(form.telefone) !== somenteDigitos(inicial.telefone)) return true;
  if (cpfEditavel(resp) && somenteDigitos(form.cpf) !== '') return true;
  if (sexoDoCampo(form.sexo) !== sexoDoCampo(inicial.sexo)) return true;
  const atual = enderecoParaEnvio(form.endereco);
  const antes = enderecoParaEnvio(inicial.endereco);
  return CAMPOS_DO_ENDERECO.some((c) => (atual?.[c] ?? null) !== (antes?.[c] ?? null));
}

/** Erros por campo devolvidos pelo servidor (422 `ALUNO_INVALIDO`: `telefone`, `cpf`, `sexo`, `endereco.<campo>`). */
export function errosDoServidor(erro: unknown): ErrosMeusDados {
  const campos = errosPorCampo(erro);
  const erros: ErrosMeusDados = { endereco: {} };
  if (campos.telefone) erros.telefone = campos.telefone;
  if (campos.cpf) erros.cpf = campos.cpf;
  if (campos.sexo) erros.sexo = campos.sexo;
  for (const c of CAMPOS_DO_ENDERECO) {
    const mensagem = campos[`endereco.${c}`];
    if (mensagem) erros.endereco[c] = mensagem;
  }
  return erros;
}

export const CONFLITO_EDICAO = 'CONFLITO_EDICAO';
export const CPF_SO_PELO_TREINADOR = 'CPF_SO_PELO_TREINADOR';
export const ALUNO_ANONIMIZADO = 'ALUNO_ANONIMIZADO';

/** O treinador salvou antes: a tela recarrega os dados e mostra o aviso neutro. */
export const ehConflitoDeEdicao = (erro: unknown): boolean => codigoApi(erro) === CONFLITO_EDICAO;

export const MENSAGEM_CONFLITO = 'Seus dados foram atualizados por outra pessoa. Mostramos os dados mais recentes.';
export const MENSAGEM_CPF_SO_PELO_TREINADOR = 'Este CPF só pode ser alterado pelo seu treinador.';
export const MENSAGEM_ANONIMIZADO = 'Esta conta foi encerrada e os dados não podem mais ser alterados.';
export const MENSAGEM_CAMPOS_INVALIDOS = 'Confira os campos destacados.';
const MENSAGEM_PADRAO = 'Não foi possível salvar seus dados. Tente de novo.';

/**
 * Texto para o aviso depois de uma falha ao salvar: os códigos conhecidos têm texto daqui, sem conexão usa o texto
 * padrão de "sem conexão" e o resto cai numa frase fixa. Nunca repete o que a pessoa digitou nem a mensagem do servidor.
 */
export function mensagemDeErroMeusDados(erro: unknown): string {
  switch (codigoApi(erro)) {
    case CONFLITO_EDICAO: return MENSAGEM_CONFLITO;
    case CPF_EM_USO: return MENSAGEM_CPF_EM_USO;
    case CPF_SO_PELO_TREINADOR: return MENSAGEM_CPF_SO_PELO_TREINADOR;
    case ALUNO_ANONIMIZADO: return MENSAGEM_ANONIMIZADO;
    case 'ALUNO_INVALIDO': return MENSAGEM_CAMPOS_INVALIDOS;
    default: return erroDeConexao(erro) ? mensagemApi(erro, MENSAGEM_PADRAO) : MENSAGEM_PADRAO;
  }
}
