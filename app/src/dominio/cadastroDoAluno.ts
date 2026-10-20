import { cepValido, cpfValido, formatarCep, formatarCpf, formatarTelefone, somenteDigitos, telefoneValido, ufValida } from '@plataforma/web';

import type { EnderecoDoAluno } from '../api/tipos';
import { enderecoParaTela } from './minhaConta';

/**
 * CPF, endereço e telefone do cadastro do aluno. As regras de formato são as do `@plataforma/web` (iguais às do
 * `web/Formatos` da API, que decide de verdade); aqui só o que o formulário precisa: máscara enquanto digita,
 * erro por campo e o corpo do envio. Nada disto vai para log nem para mensagem de erro: é dado sensível (LGPD).
 */

/** Tamanhos do endereço (os mesmos de `V015` e de `LimitesQuestionario.ENDERECO_*` na API). */
export const LIMITES_ENDERECO = {
  cep: 9, logradouro: 200, numero: 20, complemento: 100, bairro: 100, cidade: 100, uf: 2,
} as const;

export type CampoDoEndereco = keyof EnderecoDoAluno;
export const CAMPOS_DO_ENDERECO: readonly CampoDoEndereco[] = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

/** Endereço do formulário: tudo texto, vazio quando não preenchido. */
export type EnderecoNoForm = Record<CampoDoEndereco, string>;

export const ENDERECO_VAZIO: EnderecoNoForm = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };

/** Do que a API devolveu para o que o formulário edita (nulo e ausente viram vazio). */
export function enderecoParaForm(e: Partial<EnderecoDoAluno> | null | undefined): EnderecoNoForm {
  return Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, e?.[c] ?? ''])) as EnderecoNoForm;
}

/** Corpo do envio: campo vazio vira `null`; tudo vazio vira `null` (sem endereço). CEP sai com a máscara, UF em maiúsculas. */
export function enderecoParaEnvio(e: EnderecoNoForm): EnderecoDoAluno | null {
  const texto = (v: string) => v.trim() || null;
  const envio: EnderecoDoAluno = {
    cep: texto(e.cep) && formatarCep(e.cep), logradouro: texto(e.logradouro), numero: texto(e.numero),
    complemento: texto(e.complemento), bairro: texto(e.bairro), cidade: texto(e.cidade), uf: texto(e.uf)?.toUpperCase() ?? null,
  };
  return CAMPOS_DO_ENDERECO.every((c) => envio[c] === null) ? null : envio;
}

/**
 * Resposta da pergunta ENDERECO: só as chaves preenchidas (texto como foi digitado, para não comer o espaço entre
 * palavras); nada preenchido = sem resposta (`null`). A API confere e normaliza (CEP com máscara, UF em maiúsculas).
 */
export function respostaDeEndereco(e: EnderecoNoForm): Record<string, string> | null {
  const preenchidos = CAMPOS_DO_ENDERECO.filter((c) => e[c] !== '');
  return preenchidos.length ? Object.fromEntries(preenchidos.map((c) => [c, e[c]])) : null;
}

/** Endereço de uma resposta ENDERECO (objeto campo → texto) para a leitura; texto em branco vira `null`, outro formato = sem endereço. */
export function enderecoDaResposta(valor: unknown): EnderecoDoAluno | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null;
  const o = valor as Record<string, unknown>;
  return Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, typeof o[c] === 'string' && o[c].trim() ? o[c].trim() : null])) as unknown as EnderecoDoAluno;
}

/** Erro de cada campo do endereço preenchido (CEP de 8 dígitos e UF da lista); vazio é válido. */
export function errosDoEndereco(e: EnderecoNoForm): Partial<Record<CampoDoEndereco, string>> {
  const erros: Partial<Record<CampoDoEndereco, string>> = {};
  if (e.cep.trim() && !cepValido(e.cep)) erros.cep = 'CEP inválido. Use 8 dígitos.';
  if (e.uf.trim() && !ufValida(e.uf.trim().toUpperCase())) erros.uf = 'Escolha a UF.';
  return erros;
}

/** Máscara do CPF enquanto digita (só dígitos, até 11). */
export const mascaraCpf = (v: string) => formatarCpf(somenteDigitos(v).slice(0, 11));
/** Máscara do CEP enquanto digita (só dígitos, até 8). */
export const mascaraCep = (v: string) => formatarCep(somenteDigitos(v).slice(0, 8));
/** Máscara do telefone enquanto digita. */
export const mascaraTelefone = (v: string) => formatarTelefone(v);

/** Vazio é válido (campo opcional); preenchido precisa de CPF válido (dígitos verificadores). */
export const erroDoCpf = (v: string) => (v.trim() && !cpfValido(v) ? 'CPF inválido.' : undefined);
/** Vazio é válido; preenchido precisa de DDD e número. */
export const erroDoTelefone = (v: string) => (v.trim() && !telefoneValido(v) ? 'Telefone inválido. Informe o DDD e o número.' : undefined);

/** Endereço para a leitura da ficha: até duas linhas, sem partes vazias (`Rua Exemplo, 100 - Centro` / `Cidade/UF - CEP`). */
export const enderecoParaLeitura = (e: EnderecoDoAluno | null | undefined): string | null => {
  const linhas = enderecoParaTela(e);
  return linhas.length ? linhas.join('\n') : null;
};

/** Nota do telefone de quem ainda não criou o acesso (o telefone mora no usuário do aluno). */
export const NOTA_TELEFONE_SEM_ACESSO = 'O telefone entra depois que o aluno criar o acesso.';
/** Código do 409 de CPF que já está no cadastro de outro aluno (a API não repete o valor). */
export const CPF_EM_USO = 'ALUNO_CPF_EM_USO';
export const MENSAGEM_CPF_EM_USO = 'Este CPF já está no cadastro de outro aluno.';
