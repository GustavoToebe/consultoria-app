import { centavosParaTela } from './formatos';

/**
 * Regras puras do Checkout Transparente (Pix imediato + Cartão de crédito) e do acompanhamento de abatimento por Split.
 * Nenhum dado sensível de cartão (número, validade, CVV) é persistido ou logado aqui.
 */

export type JurosCheckout = 'ALUNO' | 'TREINADOR';

export type ModoSplitCentral = 'ISENTO' | 'ABATER_MENSALIDADE' | 'TAXA_PLATAFORMA' | 'TAXA_PERCENTUAL';

export interface OpcaoParcelamento {
  parcelas: number;
  valorParcelaCentavos: number;
  semAcrescimo: boolean;
  detalheJuros: string;
  rotulo: string;
}

export interface DadosFormularioCartao {
  nomeImpresso: string;
  numero: string;
  validade: string;
  cvv: string;
  cpfCnpj: string;
  cep: string;
  numeroEndereco?: string;
  email?: string;
  telefone?: string;
}

export interface ErrosFormularioCartao {
  nomeImpresso: string | null;
  numero: string | null;
  validade: string | null;
  cvv: string | null;
  cpfCnpj: string | null;
  cep: string | null;
  email: string | null;
  telefone: string | null;
}

export interface PoliticaSplitEntrada {
  modo?: string | null;
  percentualBps?: number | null;
  metaMensalCentavos?: number | null;
  abatidoMesCentavos?: number | null;
  restanteAbaterCentavos?: number | null;
  cobrancaCentralId?: string | null;
}

export interface ResumoAbatimentoSplit {
  modo: ModoSplitCentral;
  tituloModo: string;
  descricaoModo: string;
  percentualFormatado: string;
  metaMensalCentavos: number;
  abatidoMesCentavos: number;
  restanteAbaterCentavos: number;
  progressoPercentual: number;
  quitadoNoMes: boolean;
}

export function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

/** Formata CPF (`000.000.000-00`), limitando a 11 dígitos. */
export function mascaraCpf(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata CPF (até 11 dígitos) ou CNPJ (12 a 14 dígitos). */
export function mascaraCpfCnpj(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 14);
  if (d.length <= 11) return mascaraCpf(d);
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Formata número do cartão em blocos de 4 dígitos (até 19 dígitos). */
export function mascaraCartao(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Formata validade do cartão (`MM/AA` até 4 dígitos ou `MM/AAAA` até 6 dígitos). */
export function mascaraValidadeCartao(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Mantém apenas 3 ou 4 dígitos do CVV. */
export function mascaraCvv(texto: string): string {
  return somenteDigitos(texto).slice(0, 4);
}

/** Formata CEP (`00000-000`). */
export function mascaraCep(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Formata telefone brasileiro com DDD (`(11) 99999-9999` ou `(11) 3333-4444`). */
export function mascaraTelefone(texto: string): string {
  const d = somenteDigitos(texto).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valida CPF (11 dígitos, rejeitando sequências repetidas e conferindo os dois dígitos verificadores). */
export function validarCpf(texto: string | null | undefined): boolean {
  const d = somenteDigitos(texto);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(d[i]) * (10 - i);
  const d1 = (soma * 10) % 11 === 10 ? 0 : (soma * 10) % 11;
  if (d1 !== Number(d[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(d[i]) * (11 - i);
  const d2 = (soma * 10) % 11 === 10 ? 0 : (soma * 10) % 11;
  return d2 === Number(d[10]);
}

/** Valida CNPJ (14 dígitos, rejeitando sequências repetidas e conferindo os dois dígitos verificadores). */
export function validarCnpj(texto: string | null | undefined): boolean {
  const d = somenteDigitos(texto);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: readonly number[]) => {
    const soma = pesos.reduce((acc, peso, idx) => acc + Number(base[idx]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(d[12])) return false;
  const d2 = calc(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === Number(d[13]);
}

/** Aceita CPF (11 dígitos) ou CNPJ (14 dígitos) válidos. */
export function validarCpfCnpj(texto: string | null | undefined): boolean {
  const d = somenteDigitos(texto);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

export function erroCpfPagador(texto: string): string | null {
  const d = somenteDigitos(texto);
  if (!d) return 'Informe o CPF do pagador.';
  return validarCpf(d) ? null : 'Informe um CPF válido com 11 dígitos.';
}

export function erroCpfCnpjPagador(texto: string): string | null {
  const d = somenteDigitos(texto);
  if (!d) return 'Informe o CPF ou CNPJ.';
  return validarCpfCnpj(d) ? null : 'Informe um CPF ou CNPJ válido.';
}

/** Algoritmo de Luhn para números de cartão. */
export function validarLuhn(digitos: string): boolean {
  if (!/^\d+$/.test(digitos)) return false;
  let soma = 0;
  let dobrar = false;
  for (let i = digitos.length - 1; i >= 0; i -= 1) {
    let n = Number(digitos[i]);
    if (dobrar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

/** Valida cartão de crédito: de 13 a 19 dígitos e aprovado no algoritmo de Luhn. */
export function validarNumeroCartao(texto: string | null | undefined): boolean {
  const d = somenteDigitos(texto);
  return d.length >= 13 && d.length <= 19 && validarLuhn(d);
}

/** Interpreta `MM/AA` ou `MM/AAAA` em mês (`01`..`12`) e ano de 4 dígitos (`2028`). */
export function parsearValidadeCartao(texto: string | null | undefined): { mes: string; ano: string } | null {
  const limpo = (texto ?? '').trim();
  const match = /^(\d{2})\/(\d{2}|\d{4})$/.exec(limpo);
  if (!match) return null;
  const mesNum = Number(match[1]);
  if (mesNum < 1 || mesNum > 12) return null;
  const anoStr = match[2].length === 2 ? `20${match[2]}` : match[2];
  const anoNum = Number(anoStr);
  if (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > 2199) return null;
  return { mes: match[1], ano: anoStr };
}

/** Validade válida e não expirada em relação ao mês/ano atual. */
export function validarValidadeCartao(texto: string | null | undefined, agora: Date = new Date()): boolean {
  const parsed = parsearValidadeCartao(texto);
  if (!parsed) return false;
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const ano = Number(parsed.ano);
  const mes = Number(parsed.mes);
  if (ano < anoAtual) return false;
  if (ano === anoAtual && mes < mesAtual) return false;
  return true;
}

/** CVV válido: 3 ou 4 dígitos. */
export function validarCvv(texto: string | null | undefined): boolean {
  const d = somenteDigitos(texto);
  return d.length === 3 || d.length === 4;
}

/** CEP válido: 8 dígitos. */
export function validarCep(texto: string | null | undefined): boolean {
  return somenteDigitos(texto).length === 8;
}

/** Validação simples de e-mail quando preenchido. */
export function validarEmailOpcional(texto: string | null | undefined): boolean {
  const limpo = (texto ?? '').trim();
  if (!limpo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo);
}

/** Valida todos os campos do formulário de cartão transparente. */
export function validarFormularioCartao(
  dados: DadosFormularioCartao,
  opcoes: { aceitarCnpj?: boolean; exigirEmail?: boolean; exigirTelefone?: boolean; agora?: Date } = {},
): ErrosFormularioCartao {
  const nome = dados.nomeImpresso.trim();
  const email = (dados.email ?? '').trim();
  const telefoneDigitos = somenteDigitos(dados.telefone);
  return {
    nomeImpresso: nome.length >= 3 ? null : 'Informe o nome impresso no cartão.',
    numero: validarNumeroCartao(dados.numero) ? null : 'Informe um número de cartão válido.',
    validade: validarValidadeCartao(dados.validade, opcoes.agora) ? null : 'Informe uma validade válida (MM/AA ou MM/AAAA).',
    cvv: validarCvv(dados.cvv) ? null : 'Informe o código de segurança (3 ou 4 dígitos).',
    cpfCnpj: opcoes.aceitarCnpj ? erroCpfCnpjPagador(dados.cpfCnpj) : erroCpfPagador(dados.cpfCnpj),
    cep: validarCep(dados.cep) ? null : 'Informe um CEP válido com 8 dígitos.',
    email: opcoes.exigirEmail && !email
      ? 'Informe o e-mail do titular.'
      : validarEmailOpcional(email) ? null : 'Informe um e-mail válido.',
    telefone: opcoes.exigirTelefone && telefoneDigitos.length < 10
      ? 'Informe o telefone do titular com DDD.'
      : telefoneDigitos.length > 0 && telefoneDigitos.length < 10 ? 'Informe um telefone válido com DDD.' : null,
  };
}

export function formularioCartaoTemErros(erros: ErrosFormularioCartao): boolean {
  return Object.values(erros).some((e) => e !== null);
}

/**
 * Calcula opções de parcelamento de `1x` até `maxParcelas` (limitado entre 1 e 12).
 * Em `1x` ou quando `juros === 'TREINADOR'`, indica "sem acréscimo".
 * Quando `juros === 'ALUNO'` e `parcelas > 1`, indica "com acréscimo da operadora".
 */
export function opcoesDeParcelamento(
  valorCentavos: number,
  maxParcelas = 12,
  juros: JurosCheckout = 'ALUNO',
): OpcaoParcelamento[] {
  const valorSeguro = Math.max(0, Math.round(valorCentavos));
  const limite = Math.max(1, Math.min(12, Math.floor(maxParcelas || 1)));
  const lista: OpcaoParcelamento[] = [];
  for (let parcelas = 1; parcelas <= limite; parcelas += 1) {
    const semAcrescimo = parcelas === 1 || juros === 'TREINADOR';
    const valorParcelaCentavos = Math.round(valorSeguro / parcelas);
    const detalheJuros = semAcrescimo ? 'sem acréscimo' : 'com acréscimo da operadora';
    const valorFormatado = centavosParaTela(valorParcelaCentavos);
    const rotulo = parcelas === 1
      ? `1x de ${valorFormatado} (à vista, sem acréscimo)`
      : `${parcelas}x de ${valorFormatado} (${detalheJuros})`;
    lista.push({ parcelas, valorParcelaCentavos, semAcrescimo, detalheJuros, rotulo });
  }
  return lista;
}

/** Formata basis points (`1000` -> `10%`, `250` -> `2,5%`, `200` -> `2%`). */
export function formatarPercentualBps(bps: number | null | undefined): string {
  if (typeof bps !== 'number' || !Number.isFinite(bps) || bps <= 0) return '0%';
  const percentual = bps / 100;
  const texto = Number.isInteger(percentual) ? String(percentual) : percentual.toFixed(2).replace(/0+$/, '').replace('.', ',');
  return `${texto}%`;
}

/** Normaliza o modo de Split vindo da Central. */
export function normalizarModoSplit(modo: string | null | undefined): ModoSplitCentral {
  if (modo === 'ABATER_MENSALIDADE') return 'ABATER_MENSALIDADE';
  if (modo === 'TAXA_PLATAFORMA' || modo === 'TAXA_PERCENTUAL') return 'TAXA_PLATAFORMA';
  return 'ISENTO';
}

/**
 * Calcula o resumo de exibição do Split na tela `Minha conta` da consultoria.
 * Retorna `null` quando não há política ou quando o modo é `ISENTO` (sem retenção).
 */
export function calcularResumoAbatimentoSplit(politica: PoliticaSplitEntrada | null | undefined): ResumoAbatimentoSplit | null {
  if (!politica?.modo) return null;
  const modo = normalizarModoSplit(politica.modo);
  if (modo === 'ISENTO') return null;

  const percentualFormatado = formatarPercentualBps(politica.percentualBps);
  const metaMensalCentavos = Math.max(0, Math.round(politica.metaMensalCentavos ?? 0));
  const abatidoMesCentavos = Math.max(0, Math.round(politica.abatidoMesCentavos ?? 0));
  const restanteCalculado = Math.max(0, metaMensalCentavos - abatidoMesCentavos);
  const restanteAbaterCentavos = politica.restanteAbaterCentavos != null
    ? Math.max(0, Math.round(politica.restanteAbaterCentavos))
    : restanteCalculado;
  const progressoPercentual = metaMensalCentavos > 0
    ? Math.min(100, Math.round((abatidoMesCentavos / metaMensalCentavos) * 100))
    : 0;
  const quitadoNoMes = metaMensalCentavos > 0 && restanteAbaterCentavos === 0;

  if (modo === 'ABATER_MENSALIDADE') {
    return {
      modo,
      tituloModo: 'Abatimento automático da mensalidade',
      descricaoModo: `Retenção de ${percentualFormatado} por cobrança liquidada dos alunos até quitar a fatura mensal da plataforma.`,
      percentualFormatado,
      metaMensalCentavos,
      abatidoMesCentavos,
      restanteAbaterCentavos,
      progressoPercentual,
      quitadoNoMes,
    };
  }

  return {
    modo: 'TAXA_PLATAFORMA',
    tituloModo: 'Taxa de plataforma por cobrança',
    descricaoModo: `Retenção fixa de ${percentualFormatado} por cobrança liquidada pelo Overtraining Pay.`,
    percentualFormatado,
    metaMensalCentavos,
    abatidoMesCentavos,
    restanteAbaterCentavos,
    progressoPercentual,
    quitadoNoMes: false,
  };
}

/** Converte base64 cru ou data URI em URI pronta para `<Image source={{ uri }} />`. */
export function dataUriQrCodeBase64(base64: string | null | undefined): string | null {
  const limpo = (base64 ?? '').trim();
  if (!limpo) return null;
  if (limpo.startsWith('data:image/')) return limpo;
  return `data:image/png;base64,${limpo}`;
}
