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

/**
 * Normalização única do endereço (a mesma da API, na ficha e na anamnese): cada campo perde os espaços das pontas e o que
 * sobrar em branco fica vazio. O tamanho de cada campo conta depois disso.
 */
export function normalizarEndereco(e: Partial<Record<CampoDoEndereco, string | null | undefined>> | null | undefined): EnderecoNoForm {
  return Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, (e?.[c] ?? '').trim()])) as EnderecoNoForm;
}

/**
 * Preenche rua, bairro, cidade e UF com o que a busca de CEP achou. Só entra o que veio preenchido (CEP geral de cidade
 * vem sem rua: o que a pessoa já digitou fica) e a UF só se for uma sigla válida; CEP, número e complemento nunca mudam.
 */
export function enderecoComCep(atual: EnderecoNoForm, achado: { logradouro: string; bairro: string; cidade: string; uf: string }): EnderecoNoForm {
  const preencher = (campo: 'logradouro' | 'bairro' | 'cidade', max: number) => {
    const valor = achado[campo].trim().slice(0, max);
    return valor ? valor : atual[campo];
  };
  return {
    ...atual,
    logradouro: preencher('logradouro', LIMITES_ENDERECO.logradouro),
    bairro: preencher('bairro', LIMITES_ENDERECO.bairro),
    cidade: preencher('cidade', LIMITES_ENDERECO.cidade),
    uf: ufValida(achado.uf) ? achado.uf.toUpperCase() : atual.uf,
  };
}

/** Endereço vazio (todos os campos em branco) é válido: o endereço é opcional. */
export const enderecoEmBranco = (e: Partial<Record<CampoDoEndereco, string | null | undefined>> | null | undefined) =>
  CAMPOS_DO_ENDERECO.every((c) => normalizarEndereco(e)[c] === '');

/** Preenchido qualquer campo, estes cinco são obrigatórios (o número aceita "s/n"); complemento e bairro são opcionais. */
export const CAMPOS_OBRIGATORIOS_DO_ENDERECO: readonly CampoDoEndereco[] = ['cep', 'logradouro', 'numero', 'cidade', 'uf'];

const FALTA_NO_ENDERECO: Partial<Record<CampoDoEndereco, string>> = {
  cep: 'Informe o CEP.', logradouro: 'Informe a rua ou avenida.', numero: 'Informe o número (ou s/n).', cidade: 'Informe a cidade.', uf: 'Escolha a UF.',
};

/**
 * Corpo do envio: campo vazio vira `null`; tudo vazio vira `null` (sem endereço). Normalizado (sem espaços nas pontas),
 * CEP com a máscara e UF em maiúsculas.
 */
export function enderecoParaEnvio(e: EnderecoNoForm): EnderecoDoAluno | null {
  const n = normalizarEndereco(e);
  const texto = (c: CampoDoEndereco) => n[c] || null;
  const envio: EnderecoDoAluno = {
    cep: n.cep ? formatarCep(n.cep) : null, logradouro: texto('logradouro'), numero: texto('numero'),
    complemento: texto('complemento'), bairro: texto('bairro'), cidade: texto('cidade'), uf: n.uf ? n.uf.toUpperCase() : null,
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

/**
 * Regra única do endereço (a mesma da API): vazio é válido; com qualquer campo preenchido, CEP, logradouro, número, cidade
 * e UF são obrigatórios, o CEP tem 8 dígitos, a UF é uma das 27 e cada campo cabe no limite (contado sem os espaços das pontas).
 */
export function errosDoEndereco(e: Partial<Record<CampoDoEndereco, string | null | undefined>>): Partial<Record<CampoDoEndereco, string>> {
  const n = normalizarEndereco(e);
  const erros: Partial<Record<CampoDoEndereco, string>> = {};
  if (enderecoEmBranco(n)) return erros;
  for (const c of CAMPOS_DO_ENDERECO) {
    if (n[c].length > LIMITES_ENDERECO[c]) erros[c] = `Use no máximo ${LIMITES_ENDERECO[c]} caracteres.`;
    else if (!n[c]) { if (CAMPOS_OBRIGATORIOS_DO_ENDERECO.includes(c)) erros[c] = FALTA_NO_ENDERECO[c]; }
    else if (c === 'cep' && !cepValido(n.cep)) erros.cep = 'CEP inválido. Use 8 dígitos.';
    else if (c === 'uf' && !ufValida(n.uf.toUpperCase())) erros.uf = 'Escolha a UF.';
  }
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
