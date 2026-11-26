import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi, somenteDigitos } from '@plataforma/web';

import type { MeusDadosRequest, MeusDadosResponse } from '../api/tipos';
import {
  CAMPOS_DO_ENDERECO, CPF_EM_USO, enderecoParaEnvio, enderecoParaForm, erroDoCpf, erroDoTelefone, errosDoEndereco, MENSAGEM_CPF_EM_USO,
  mascaraCpf, mascaraTelefone, type CampoDoEndereco, type EnderecoNoForm,
} from './cadastroDoAluno';
import { erroDaRedeDigitada, REDES_SOCIAIS_DO_ALUNO, usuarioDaRede, valoresDasRedesDoAluno, type RedeSocialDoAluno, type ValoresDasRedes } from './redesSociais';
import { sexoDoCampo } from './sexo';

/**
 * "Meus dados" do aluno (Conta): telefone, endereço, sexo e, só se estiver vazio, o CPF. Regras puras do formulário; as
 * de formato e de endereço são as de `cadastroDoAluno` (iguais às da API, que decide de verdade). Dado pessoal: nada
 * daqui vai para log, aviso ou mensagem de erro, e nada fica no aparelho.
 */

/** Nome, e-mail do cadastro e e-mail de acesso são só leitura; a mensagem é a mesma para os três. */
export const TEXTO_SO_LEITURA = 'Para mudar, fale com o seu treinador.';

/**
 * E-mail único na leitura: o de acesso é o principal (é com ele que o aluno entra); sem ele, o do cadastro. A nota só
 * aparece quando os dois existem e são diferentes (sem diferenciar maiúsculas).
 */
export function emailParaLeitura(resp: Pick<MeusDadosResponse, 'email' | 'emailDeAcesso'>): { rotulo: string; valor: string | null; nota: string | null } {
  const acesso = resp.emailDeAcesso?.trim() || null;
  const cadastro = resp.email?.trim() || null;
  const diferente = !!acesso && !!cadastro && acesso.toLowerCase() !== cadastro.toLowerCase();
  return { rotulo: acesso ? 'E-mail de acesso' : 'E-mail do cadastro', valor: acesso ?? cadastro, nota: diferente && cadastro ? notaDoOutroEmail(cadastro) : null };
}

/** Conta do aluno reorganizada (23/11): a nota diz qual é o outro e-mail e quem muda. */
export const notaDoOutroEmail = (cadastro: string) => `E-mail no cadastro do seu treinador: ${cadastro}. Para mudar, fale com ele.`;

/** Formulário: tudo texto; sexo vazio = "Não informado". */
export interface FormMeusDados {
  telefone: string;
  cpf: string;
  endereco: EnderecoNoForm;
  sexo: string;
  /** Como digitado (`@usuario`, usuário ou link). Chave presente (também `''`) = rede adicionada na peça; ausente = não adicionada. */
  redes: ValoresDasRedes<RedeSocialDoAluno>;
}

/** Erros por campo (do formulário ou do servidor); o endereço tem uma chave por campo e cada rede, a sua. */
export type ErrosMeusDados = Partial<Record<RedeSocialDoAluno, string>> & {
  telefone?: string;
  cpf?: string;
  sexo?: string;
  endereco: Partial<Record<CampoDoEndereco, string>>;
};

/** Form inicial, com as máscaras do que a API devolveu; só as redes com valor entram (Instagram e TikTok com o `@` na frente). */
export function formDeMeusDados(resp: MeusDadosResponse): FormMeusDados {
  return {
    telefone: resp.telefone?.trim() ? mascaraTelefone(resp.telefone) : '',
    cpf: resp.cpf?.trim() ? mascaraCpf(resp.cpf) : '',
    endereco: enderecoParaForm(resp.endereco),
    sexo: sexoDoCampo(resp.sexo) ?? '',
    redes: valoresDasRedesDoAluno(resp),
  };
}

/** O aluno só preenche o CPF se estiver vazio no cadastro; preenchido é só leitura (o treinador corrige pela ficha). */
export const cpfEditavel = (resp: MeusDadosResponse): boolean => !resp.cpf?.trim();

/**
 * Corpo do `PUT`: telefone, endereço, sexo e as seis redes substituem (vazio apaga); `cpf` só vai se o campo é editável e
 * está preenchido, senão `null` (sem efeito). A `versao` é a da resposta que a tela mostra.
 */
export function corpoDoPut(form: FormMeusDados, resp: MeusDadosResponse): MeusDadosRequest {
  return {
    telefone: form.telefone.trim() ? mascaraTelefone(form.telefone) : null,
    cpf: cpfEditavel(resp) && form.cpf.trim() ? mascaraCpf(form.cpf) : null,
    endereco: enderecoParaEnvio(form.endereco),
    sexo: sexoDoCampo(form.sexo),
    ...corpoDasRedesDoAluno(form.redes),
    versao: resp.versao,
  };
}

/**
 * As seis redes sempre: o `PUT` substitui, então rede removida ou nunca adicionada vai `''` (apaga) e a preenchida vai como
 * digitada, aparada (a API aceita `@usuario`, usuário ou link e normaliza).
 */
const corpoDasRedesDoAluno = (redes: ValoresDasRedes<RedeSocialDoAluno>): Record<RedeSocialDoAluno, string> =>
  Object.fromEntries(REDES_SOCIAIS_DO_ALUNO.map((r) => [r, (redes[r] ?? '').trim()])) as Record<RedeSocialDoAluno, string>;

/** Há algum erro (de campo, de rede ou de endereço)? */
export const temErros = (erros: ErrosMeusDados): boolean =>
  !!erros.telefone || !!erros.cpf || !!erros.sexo || REDES_SOCIAIS_DO_ALUNO.some((r) => !!erros[r]) || Object.values(erros.endereco).some(Boolean);

/** Erros que o formulário já sabe achar (os mesmos validadores da ficha); o CPF só conta quando é editável. */
export function errosDoForm(form: FormMeusDados, resp: MeusDadosResponse): ErrosMeusDados {
  const erros: ErrosMeusDados = { endereco: errosDoEndereco(form.endereco) };
  const telefone = erroDoTelefone(form.telefone);
  if (telefone) erros.telefone = telefone;
  const cpf = cpfEditavel(resp) ? erroDoCpf(form.cpf) : undefined;
  if (cpf) erros.cpf = cpf;
  // Só as redes adicionadas: rede ausente vai em branco e não tem o que conferir.
  for (const rede of REDES_SOCIAIS_DO_ALUNO) {
    const erro = form.redes[rede] === undefined ? undefined : erroDaRedeDigitada(rede, form.redes[rede]);
    if (erro) erros[rede] = erro;
  }
  return erros;
}

/** Algo foi mexido em relação ao que o servidor tem (habilita o "Salvar")? Espaços e máscaras não contam. */
export function houveMudanca(form: FormMeusDados, resp: MeusDadosResponse): boolean {
  const inicial = formDeMeusDados(resp);
  if (somenteDigitos(form.telefone) !== somenteDigitos(inicial.telefone)) return true;
  if (cpfEditavel(resp) && somenteDigitos(form.cpf) !== '') return true;
  if (sexoDoCampo(form.sexo) !== sexoDoCampo(inicial.sexo)) return true;
  // Rede ausente e rede adicionada em branco são a mesma coisa (as duas vão `''`).
  if (REDES_SOCIAIS_DO_ALUNO.some((r) => redeOuTexto(r, form.redes[r] ?? '') !== redeOuTexto(r, inicial.redes[r] ?? ''))) return true;
  const atual = enderecoParaEnvio(form.endereco);
  const antes = enderecoParaEnvio(inicial.endereco);
  return CAMPOS_DO_ENDERECO.some((c) => (atual?.[c] ?? null) !== (antes?.[c] ?? null));
}

/**
 * Instagram e TikTok: "@fulano", "fulano" e o link do perfil são a mesma coisa; o que não se entende conta pelo texto. As
 * outras redes contam pelo texto aparado (a API as normaliza).
 */
const redeOuTexto = (rede: RedeSocialDoAluno, texto: string): string | null => {
  if (rede !== 'instagram' && rede !== 'tiktok') return texto.trim();
  const usuario = usuarioDaRede(rede, texto);
  return usuario === undefined ? texto.trim() : usuario;
};

/** Erros por campo devolvidos pelo servidor (422 `ALUNO_INVALIDO`: `telefone`, `cpf`, `sexo`, as seis redes, `endereco.<campo>`). */
export function errosDoServidor(erro: unknown): ErrosMeusDados {
  const campos = errosPorCampo(erro);
  const erros: ErrosMeusDados = { endereco: {} };
  if (campos.telefone) erros.telefone = campos.telefone;
  if (campos.cpf) erros.cpf = campos.cpf;
  if (campos.sexo) erros.sexo = campos.sexo;
  for (const r of REDES_SOCIAIS_DO_ALUNO) if (campos[r]) erros[r] = campos[r];
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
