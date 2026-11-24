import { codigoApi, erroDeConexao, errosPorCampo, mensagemApi } from '@plataforma/web';

import type {
  ContratarContratoRequest, EntradaDoContrato, ModoFechado, ParcelaDoContrato, PreviaDoContrato, PreviaDoContratoRequest,
} from '../api/financeiroContrato';
import type { CobrancaResponse, FormaDePagamento, ModoDeCobranca, ResumoDoContrato } from '../api/financeiroTipos';
import { atrasoParaTela, hojeEmBrasilia, rotuloDaForma } from './financeiro';
import { centavosDaTela, centavosParaTela, dataDaTela, dataParaTela } from './formatos';
import { somarMeses } from './saidaDoPlano';

/**
 * Contrato fechado (`docs/planos/contrato-fechado.md`; contrato em `api/financeiroContrato.ts`): rótulos, estados, o que
 * habilita os botões e os corpos das chamadas. REGRA DE OURO (D14): nada aqui soma, divide, subtrai nem compara dinheiro.
 * Soma, divisão do restante, "a soma fecha", saldo e limite vêm do servidor; aqui só viram texto. Contagens de cobranças
 * já separadas pela API e datas (o primeiro vencimento sugerido) são as únicas contas.
 */

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

// ---- Modos ----

export const MODOS_DE_COBRANCA: readonly { modo: ModoDeCobranca; titulo: string; descricao: string }[] = [
  { modo: 'RECORRENTE', titulo: 'Recorrente', descricao: 'Mesmo valor todo período, sem data para acabar.' },
  { modo: 'PARCELADO_FIXO', titulo: 'Entrada + parcelas fixas', descricao: 'Valor total fechado, com a data e o valor de cada parcela.' },
  { modo: 'SALDO_ABERTO', titulo: 'Entrada + saldo livre', descricao: 'Valor total fechado; o aluno paga o resto quando e quanto puder.' },
];

export const ehModoFechado = (modo: ModoDeCobranca | null | undefined): modo is ModoFechado =>
  modo === 'PARCELADO_FIXO' || modo === 'SALDO_ABERTO';

export const rotuloDoModo = (modo: ModoDeCobranca): string => MODOS_DE_COBRANCA.find((m) => m.modo === modo)?.titulo ?? 'Recorrente';

/**
 * Cobrança que pertence a um contrato fechado: a entrada e os pagamentos do saldo (AVULSA) e as parcelas (RENEGOCIACAO)
 * ligadas à contratação. Não se renegociam (D11) nem têm "Desfazer acordo" (D2), e não ganham o selo "Avulsa"/"Acordo".
 */
export const ehDoContratoFechado = (c: { contratacaoId?: string | null; tipo?: CobrancaResponse['tipo'] | null }): boolean =>
  !!c.contratacaoId && (c.tipo === 'AVULSA' || c.tipo === 'RENEGOCIACAO');

/** D11: a API recusa o modo fechado em plano cobrado pela Kiwify (422 no `modoCobranca`); a tela avisa antes. */
export const MOTIVO_PLANO_KIWIFY = 'Este plano é cobrado pela assinatura da Kiwify e só aceita cobrança recorrente.';

export const MOTIVO_COBRANCA_DO_CONTRATO ='Faz parte de um contrato fechado e não entra em renegociação.';

// ---- Formulário ----

/** Os limites da API (a tela confere antes para o erro aparecer no campo; o servidor confere de novo). */
export const LIMITES_DO_CONTRATO = { parcelas: 12, totalCentavos: 1_000_000_000, entradaCentavos: 100_000_000 } as const;

/** Primeiro vencimento sugerido: um mês depois de hoje (Brasília), em `DD/MM/AAAA`. */
export const primeiroVencimentoSugerido = (hoje: string = hojeEmBrasilia()): string => dataParaTela(somarMeses(hoje, 1));

/** O que a pessoa digitou no bloco do contrato (textos da tela, como os campos guardam). */
export interface ContratoDigitado {
  modo: ModoFechado;
  totalTexto: string;
  semEntrada: boolean;
  entradaTexto: string;
  entradaDataTexto: string;
  entradaJaPaga: boolean;
  entradaForma: FormaDePagamento | null;
  quantidade: number;
  primeiroVencimentoTexto: string;
}

/** `vencimento2`/`valor2` = a célula da terceira parcela da tabela (índice da lista de parcelas, sem a Entrada). */
export type CampoDoContrato = 'total' | 'entrada' | 'entradaData' | 'entradaForma' | 'quantidade' | 'primeiroVencimento' | 'parcelas' | 'modo'
  | `vencimento${number}` | `valor${number}`;
export type ErrosDoContrato = Partial<Record<CampoDoContrato, string>>;

const MENSAGEM_VALOR = 'Informe um valor maior que zero, por exemplo 3.000,00.';
const MENSAGEM_DATA = 'Informe a data no formato DD/MM/AAAA.';

/**
 * Confere o que não é dinheiro: os campos preenchidos e as datas legíveis. Total e entrada só precisam ser valores
 * válidos; se a entrada passa do total quem diz é o servidor (422 no campo `entrada`).
 */
export function validarContrato(d: ContratoDigitado): { erros: ErrosDoContrato; totalCentavos: number | null; entrada: EntradaDoContrato | null; primeiroVencimento: string | null } {
  const erros: ErrosDoContrato = {};
  const totalCentavos = centavosDaTela(d.totalTexto);
  if (totalCentavos === null) erros.total = MENSAGEM_VALOR;
  else if (totalCentavos > LIMITES_DO_CONTRATO.totalCentavos) erros.total = 'O valor total vai até R$ 10.000.000,00.';
  let entrada: EntradaDoContrato | null = null;
  if (!d.semEntrada) {
    const valor = centavosDaTela(d.entradaTexto);
    const data = dataDaTela(d.entradaDataTexto);
    if (valor === null) erros.entrada = 'Informe o valor da entrada ou marque "Sem entrada".';
    else if (valor > LIMITES_DO_CONTRATO.entradaCentavos) erros.entrada = 'A entrada vai até R$ 1.000.000,00.';
    if (!data) erros.entradaData = MENSAGEM_DATA;
    if (d.entradaJaPaga && !d.entradaForma) erros.entradaForma = 'Escolha como a entrada foi paga.';
    if (valor !== null && data) entrada = { valorCentavos: valor, data, jaPaga: d.entradaJaPaga, ...(d.entradaJaPaga ? { forma: d.entradaForma } : {}) };
  }
  let primeiroVencimento: string | null = null;
  if (d.modo === 'PARCELADO_FIXO') {
    const iso = dataDaTela(d.primeiroVencimentoTexto);
    if (!iso) erros.primeiroVencimento = MENSAGEM_DATA;
    else primeiroVencimento = iso;
    if (!Number.isInteger(d.quantidade) || d.quantidade < 1 || d.quantidade > LIMITES_DO_CONTRATO.parcelas) erros.parcelas = 'As parcelas vão de 1 a 12.';
  }
  return { erros, totalCentavos, entrada, primeiroVencimento };
}

/** Uma parcela editada na tabela, como os campos guardam. */
export interface ParcelaDigitada { vencimentoTexto: string; valorTexto: string }

/**
 * A ordem em que a API vê as parcelas editadas: por vencimento, estável (a API ordena antes de conferir e de rotular
 * "Parcela k/n"). `ordem[k]` = a linha da tela que é a parcela k. A tela mantém a ordem digitada (reordenar enquanto a
 * pessoa digita tiraria o foco do campo); o corpo vai ordenado e o erro e o rótulo voltam para a linha por este mapa.
 * Data ilegível fica no fim (sem ela não há prévia).
 */
export function ordemPorVencimento(editadas: readonly ParcelaDigitada[]): number[] {
  const chave = editadas.map((p) => dataDaTela(p.vencimentoTexto) ?? '9999-99-99');
  return editadas.map((_, i) => i).sort((a, b) => chave[a].localeCompare(chave[b]) || a - b);
}

/** As parcelas editadas viram o corpo, ordenadas por vencimento; `null` se alguma está ilegível (a prévia não é pedida até corrigir). */
export function parcelasDoCorpo(editadas: readonly ParcelaDigitada[]): ParcelaDoContrato[] | null {
  const lista: ParcelaDoContrato[] = [];
  for (const i of ordemPorVencimento(editadas)) {
    const vencimento = dataDaTela(editadas[i].vencimentoTexto);
    const valorCentavos = centavosDaTela(editadas[i].valorTexto);
    if (!vencimento || valorCentavos === null) return null;
    lista.push({ vencimento, valorCentavos });
  }
  return lista;
}

/** Os erros de célula da API (`vencimento{k}`/`valor{k}`, índice da lista ordenada) levados para a linha da tela. */
export function errosNaLinha(campos: ErrosDoContrato, ordem: readonly number[] | null): ErrosDoContrato {
  if (!ordem) return campos;
  const saida: ErrosDoContrato = {};
  for (const [campo, mensagem] of Object.entries(campos) as [CampoDoContrato, string][]) {
    const celula = /^(vencimento|valor)(\d+)$/.exec(campo);
    const linha = celula ? ordem[Number(celula[2])] : undefined;
    saida[celula && linha !== undefined ? (`${celula[1]}${linha}` as CampoDoContrato) : campo] = mensagem;
  }
  return saida;
}

/** Só as parcelas da prévia: a API devolve a Entrada como primeira linha (`numero` nulo). */
export const parcelasDaPrevia = (previa: Pick<PreviaDoContrato, 'parcelas'>) => previa.parcelas.filter((p) => p.numero !== null);

/** As parcelas da prévia como a tabela edita (o texto do campo). */
export const parcelasParaEditar = (previa: Pick<PreviaDoContrato, 'parcelas'>): ParcelaDigitada[] =>
  parcelasDaPrevia(previa).map((p) => ({ vencimentoTexto: dataParaTela(p.vencimento), valorTexto: centavosParaTela(p.valorCentavos) }));

/**
 * O corpo da prévia: `null` sem o que pedir (campos com erro ou parcela ilegível). Saldo livre: só o total e a entrada (a
 * API diz se a entrada cabe no total). Parcelas fixas sem `editadas`: o servidor divide; com elas, só confere a soma.
 */
export function corpoDaPreviaDoContrato(
  d: ContratoDigitado,
  validado: ReturnType<typeof validarContrato>,
  editadas: readonly ParcelaDigitada[] | null,
): PreviaDoContratoRequest | null {
  if (validado.totalCentavos === null) return null;
  if (validado.erros.total || validado.erros.entrada || validado.erros.entradaData || validado.erros.primeiroVencimento || validado.erros.parcelas) return null;
  // Sem plano nem início: a parcela pode vencer depois do fim da vigência (3 meses em 6x é venda normal).
  const base = { modoCobranca: d.modo, valorTotalCentavos: validado.totalCentavos, entrada: validado.entrada };
  if (d.modo === 'SALDO_ABERTO') return base;
  if (!editadas) return { ...base, quantidade: d.quantidade, primeiroVencimento: validado.primeiroVencimento as string };
  const parcelas = parcelasDoCorpo(editadas);
  return parcelas ? { ...base, parcelas } : null;
}

/** O corpo do contratar no modo fechado, com as parcelas da prévia que fechou (sem a linha da Entrada). */
export function corpoDoContrato(base: { planoComercialId: string; inicio: string }, d: ContratoDigitado,
  validado: ReturnType<typeof validarContrato>, previa: PreviaDoContrato | null): ContratarContratoRequest | null {
  if (validado.totalCentavos === null || Object.keys(validado.erros).length > 0) return null;
  if (!previa?.fecha) return null;
  return {
    ...base, modoCobranca: d.modo, valorTotalCentavos: validado.totalCentavos, entrada: validado.entrada,
    ...(d.modo === 'PARCELADO_FIXO' && previa ? { parcelas: parcelasDaPrevia(previa).map((p) => ({ vencimento: p.vencimento, valorCentavos: p.valorCentavos })) } : {}),
  };
}

// ---- Conferência e resumo ----

export interface Conferencia { fecha: boolean; titulo: string; detalhe: string }

/**
 * A linha de conferência, só com os números da prévia ("A soma fecha com o valor total · Soma R$ 3.000,00 de R$ 3.000,00").
 * Saldo livre: a entrada que cabe no total, sem número de saldo (entrada acima do total é 422 no campo, não chega aqui).
 */
export function linhaDaConferencia(previa: Pick<PreviaDoContrato, 'fecha' | 'somaCentavos' | 'diferencaCentavos' | 'parcelas'>, totalCentavos: number,
  modo: ModoFechado = 'PARCELADO_FIXO'): Conferencia {
  if (modo === 'SALDO_ABERTO') {
    if (previa.parcelas.length === 0) return { fecha: previa.fecha, titulo: 'Sem entrada', detalhe: 'Todo o valor total fica como saldo, pago aos poucos.' };
    const entrada = `Entrada ${centavosParaTela(previa.somaCentavos)} de ${centavosParaTela(totalCentavos)}`;
    return { fecha: previa.fecha, titulo: 'A entrada cabe no valor total', detalhe: `${entrada}. O resto fica como saldo.` };
  }
  const soma = `Soma ${centavosParaTela(previa.somaCentavos)} de ${centavosParaTela(totalCentavos)}`;
  if (previa.fecha) return { fecha: true, titulo: 'A soma fecha com o valor total', detalhe: soma };
  return {
    fecha: false,
    titulo: 'A soma não fecha com o valor total',
    detalhe: `${soma} · diferença de ${centavosParaTela(Math.abs(previa.diferencaCentavos))}. Ajuste as parcelas ou toque em "Dividir o restante igual".`,
  };
}

/** "3 × R$ 800,00"; com a sobra na última, "2 × R$ 333,33 + 1 × R$ 333,34" (agrupa iguais seguidas, sem somar). */
export function parcelasResumidas(parcelas: readonly Pick<ParcelaDoContrato, 'valorCentavos'>[]): string {
  if (parcelas.length === 0) return '—';
  const grupos: { valor: number; n: number }[] = [];
  for (const p of parcelas) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.valor === p.valorCentavos) ultimo.n += 1;
    else grupos.push({ valor: p.valorCentavos, n: 1 });
  }
  return grupos.map((g) => `${g.n} × ${centavosParaTela(g.valor)}`).join(' + ');
}

/** "4 cobranças (entrada + 3 parcelas)"; saldo livre: só a entrada, e cada pagamento depois vira uma cobrança. */
export function cobrancasCriadas(modo: ModoFechado, temEntrada: boolean, parcelas: number | null): string {
  if (modo === 'SALDO_ABERTO') {
    return temEntrada ? '1 cobrança (a entrada). Cada pagamento do saldo vira outra.' : 'Nenhuma agora. Cada pagamento do saldo vira uma cobrança.';
  }
  if (parcelas === null) return '—';
  const total = parcelas + (temEntrada ? 1 : 0);
  return `${plural(total, 'cobrança', 'cobranças')} (${temEntrada ? 'entrada + ' : ''}${plural(parcelas, 'parcela', 'parcelas')})`;
}

export const NOTA_DO_RESUMO = 'O aluno vê as cobranças na Conta dele.';
export const LEGENDA_DAS_PARCELAS = 'Cada parcela vira uma cobrança normal: pode ser paga pelo link da InfinitePay ou com baixa manual. Ajuste a data e o valor de qualquer uma.';

export type EstadoDoCriar = { habilitado: true } | { habilitado: false; motivo: string };

/** O "Criar contrato": só com os campos certos e a conferência da API em dia dizendo que fecha (nos dois modos). */
export function estadoDoCriar(modo: ModoFechado, temErros: boolean, previa: { emDia: boolean; dados: PreviaDoContrato | null; erro: boolean; pedida: boolean }): EstadoDoCriar {
  if (temErros) return { habilitado: false, motivo: 'Preencha os campos destacados.' };
  if (!previa.pedida) return { habilitado: false, motivo: modo === 'SALDO_ABERTO' ? 'Preencha o valor total e a entrada.' : 'Corrija as parcelas para conferir a soma.' };
  if (!previa.emDia) return { habilitado: false, motivo: 'Conferindo a soma no servidor…' };
  if (previa.erro || !previa.dados) return { habilitado: false, motivo: 'Sem a conferência do servidor não dá para criar o contrato.' };
  if (!previa.dados.fecha) return { habilitado: false, motivo: 'A soma das cobranças precisa fechar com o valor total.' };
  return { habilitado: true };
}

// ---- Erros do contratar ----

export interface ErroDoContrato { mensagem: string; campos: ErrosDoContrato }

const CAMPO_DA_API: Record<string, CampoDoContrato> = {
  valorTotalCentavos: 'total', entrada: 'entrada', 'entrada.valorCentavos': 'entrada', 'entrada.data': 'entradaData',
  'entrada.forma': 'entradaForma', parcelas: 'parcelas', modoCobranca: 'modo', quantidade: 'quantidade', primeiroVencimento: 'primeiroVencimento',
};

/** 422 `CONTRATO_INVALIDO` por campo; o resto, o texto da API (sem conexão, 403, 409) ou uma frase fixa. */
export function traduzirErroDoContrato(erro: unknown): ErroDoContrato {
  if (codigoApi(erro) === 'CONTRATO_INVALIDO' || codigoApi(erro) === 'PLANO_INVALIDO') {
    const campos: ErrosDoContrato = {};
    const fora: string[] = [];
    for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
      // `parcelas[i].vencimento` / `parcelas[i].valorCentavos` vão para a célula da parcela; outro campo da parcela, para o grupo.
      const celula = /^parcelas\[(\d+)\]\.(vencimento|valorCentavos)$/.exec(campo);
      const daTela: CampoDoContrato | undefined = celula
        ? (celula[2] === 'vencimento' ? `vencimento${Number(celula[1])}` : `valor${Number(celula[1])}`)
        : CAMPO_DA_API[campo] ?? (campo.startsWith('parcelas[') ? 'parcelas' : undefined);
      if (daTela) campos[daTela] = campos[daTela] ?? mensagem;
      else fora.push(mensagem);
    }
    return { mensagem: fora.join(' ') || mensagemApi(erro, 'Confira os campos destacados.'), campos };
  }
  return { mensagem: mensagemApi(erro, 'Não foi possível criar o contrato. Tente de novo.'), campos: {} };
}

// ---- Cartão "Plano contratado" ----

/**
 * As cobranças do contrato (entrada, parcelas e pagamentos do saldo: AVULSA/RENEGOCIACAO da contratação; a multa SAIDA fica
 * fora, como na API), da que vence antes para a que vence depois. Filtro por id e tipo, não é conta de dinheiro.
 */
export const cobrancasDoContrato = <T extends Pick<CobrancaResponse, 'contratacaoId' | 'vencimento' | 'tipo'>>(lista: readonly T[] | null | undefined, contratacaoId: string): T[] =>
  (lista ?? []).filter((c) => c.contratacaoId === contratacaoId && ehDoContratoFechado(c)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));

/** "Entrada + 3 parcelas fixas · de 24/08/2026 a 24/11/2026" (o fim é o da vigência da API). */
export function subtituloDoContrato(modo: ModoFechado, cobrancas: readonly Pick<CobrancaResponse, 'tipo'>[], inicio: string, termino: string | null | undefined): string {
  const parcelas = cobrancas.filter((c) => c.tipo === 'RENEGOCIACAO').length;
  const comEntrada = modo === 'PARCELADO_FIXO' ? `Entrada + ${plural(parcelas, 'parcela fixa', 'parcelas fixas')}` : 'Entrada + saldo livre';
  return `${comEntrada} · de ${dataParaTela(inicio)}${termino ? ` a ${dataParaTela(termino)}` : ''}`;
}

/** Detalhe do "Falta pagar": "1 vencida · 1 a vencer" (contagens das abertas do contrato). */
export function detalheDaFalta(cobrancas: readonly Pick<CobrancaResponse, 'situacao' | 'vencida'>[]): string | null {
  const abertas = cobrancas.filter((c) => c.situacao === 'ABERTA');
  const vencidas = abertas.filter((c) => c.vencida).length;
  const aVencer = abertas.length - vencidas;
  const partes = [vencidas > 0 ? plural(vencidas, 'vencida', 'vencidas') : null, aVencer > 0 ? `${aVencer} a vencer` : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/** O alerta de atraso do cartão, com os números da API (`vencidas`, `valorVencidoCentavos`, `maisAntigaVencida`). */
export function alertaDeAtraso(c: Pick<ResumoDoContrato, 'vencidas' | 'valorVencidoCentavos' | 'maisAntigaVencida'>): { titulo: string; texto: string } | null {
  if (c.vencidas <= 0) return null;
  const antiga = c.maisAntigaVencida;
  const quantas = plural(c.vencidas, 'cobrança vencida', 'cobranças vencidas');
  const titulo = antiga ? `${quantas} · a mais antiga há ${atrasoParaTela(antiga.diasDeAtraso).replace(' de atraso', '')}` : quantas;
  const total = `${centavosParaTela(c.valorVencidoCentavos)} em atraso`;
  return { titulo, texto: antiga ? `${total} (${antiga.descricao}, venceu em ${dataParaTela(antiga.vencimento)}).` : `${total}.` };
}

/** A linha sob o selo na tabela do contrato: dias de atraso, a forma e a data do pagamento, ou o prazo (neutro). */
export function situacaoNoContrato(c: Pick<CobrancaResponse, 'situacao' | 'vencida' | 'diasDeAtraso' | 'forma' | 'pagoEm' | 'vencimento'>, hoje: string = hojeEmBrasilia()): string | null {
  if (c.situacao === 'ABERTA' && c.vencida) return atrasoParaTela(c.diasDeAtraso);
  if (c.situacao === 'ABERTA') return c.vencimento === hoje ? 'Vence hoje' : null;
  if (c.situacao === 'PAGA' && c.pagoEm) return `${c.forma ? `${rotuloDaForma(c.forma)} · ` : ''}${dataParaTela(c.pagoEm)}`;
  return null;
}

// ---- Pagamento do saldo ----

/**
 * Por que não há o que lançar (o limite da API é zero): o contrato está quitado, ou o que falta já está em cobranças
 * abertas (D5: a aberta reserva saldo). `null` = dá para lançar.
 */
export function motivoSemSaldo(c: Pick<ResumoDoContrato, 'saldoCentavos' | 'limiteDeLancamentoCentavos'>): string | null {
  if (c.limiteDeLancamentoCentavos > 0) return null;
  if (c.saldoCentavos <= 0) return 'O contrato está quitado: não há saldo a receber.';
  return 'O que falta já está em cobranças em aberto. Receba ou cancele uma delas antes de lançar outro pagamento.';
}

export interface ErroDoSaldo {
  mensagem: string | null; campoValor: string | null; recarregar: boolean;
  /** 409 `PEDIDO_JA_USADO`: o próximo envio leva um `pedidoId` novo (a pessoa mudou o pedido de propósito). */
  novoPedido?: true;
}

/**
 * 422 `SALDO_INVALIDO` no campo do valor (e recarrega o cartão: o saldo pode ter mudado); 422 `CONTRATO_INVALIDO` nos
 * outros campos, como mensagem; 409 (`CONTRATO_NAO_ACEITA_SALDO`, `CONTRATACAO_ENCERRADA`, `PEDIDO_JA_USADO`) recarrega o
 * cartão com o texto da API (`PEDIDO_JA_USADO` também pede um `pedidoId` novo); o resto, o texto da API ou uma frase fixa.
 */
export function traduzirErroDoSaldo(erro: unknown): ErroDoSaldo {
  const codigo = codigoApi(erro);
  if (codigo === 'SALDO_INVALIDO') {
    const campo = errosPorCampo(erro).valorCentavos ?? null;
    return { mensagem: campo ? null : mensagemApi(erro, 'Confira o valor.'), campoValor: campo, recarregar: true };
  }
  if (codigo === 'CONTRATO_INVALIDO') {
    const { valorCentavos, ...outros } = errosPorCampo(erro);
    const fora = Object.values(outros).join(' ');
    return { mensagem: fora || (valorCentavos ? null : mensagemApi(erro, 'Confira os campos.')), campoValor: valorCentavos ?? null, recarregar: false };
  }
  const status = typeof erro === 'object' && erro !== null ? (erro as { status?: unknown }).status : null;
  if (codigo === 'PEDIDO_JA_USADO') {
    return { mensagem: mensagemApi(erro, 'Este pedido já foi usado em outra cobrança. Confira o contrato antes de lançar de novo.'), campoValor: null, recarregar: true, novoPedido: true };
  }
  if (status === 409) return { mensagem: mensagemApi(erro, 'O contrato mudou. Mostramos os dados mais recentes.'), campoValor: null, recarregar: true };
  const daApi = erroDeConexao(erro) || status === 403 || codigo === 'FINANCEIRO_INDISPONIVEL';
  return { mensagem: daApi ? mensagemApi(erro, 'Não foi possível registrar o pagamento. Tente de novo.') : 'Não foi possível registrar o pagamento. Tente de novo.', campoValor: null, recarregar: false };
}

// ---- Encerrar o contrato ----

/** "Ao encerrar: o contrato fica Encerrado, 1 cobrança futura é cancelada e é criada 1 cobrança de multa rescisória de R$ 300,00 com vencimento em 01/12/2026." */
export function textoAoEncerrar(aCancelar: number, multa: { valorCentavos: number; vencimento: string } | null): string {
  const partes = ['o contrato fica Encerrado'];
  if (aCancelar > 0) partes.push(aCancelar === 1 ? '1 cobrança futura é cancelada' : `${aCancelar} cobranças futuras são canceladas`);
  if (multa) partes.push(`é criada 1 cobrança de multa rescisória de ${centavosParaTela(multa.valorCentavos)} com vencimento em ${dataParaTela(multa.vencimento)}`);
  const ultima = partes.pop() as string;
  return `Ao encerrar: ${partes.length ? `${partes.join(', ')} e ${ultima}` : ultima}.`;
}

export const NOTA_DA_MULTA = 'O valor é você quem define, como combinado no contrato. O app não calcula multa nem juros.';
