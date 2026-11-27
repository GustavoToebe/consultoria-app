/**
 * Regras puras do pagamento no app (Pix e a situação da cobrança) e do acompanhamento de abatimento por Split. O cartão não
 * passa pelo app: abre a página de pagamento do Asaas, então nenhum dado de cartão existe aqui.
 */

export type ModoSplitCentral = 'ISENTO' | 'ABATER_MENSALIDADE' | 'TAXA_PLATAFORMA' | 'TAXA_PERCENTUAL';

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
