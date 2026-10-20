import type {
  CartoesDoPainel,
  CobrancaDoAluno,
  CobrancaResponse,
  MotivoDaConferencia,
  FiltroDeSituacao,
  FormaDePagamento,
  JurosDoParcelamento,
  Liquido,
  MesDoPainel,
  Painel,
  PeriodoDoPlano,
  RetornoDoPagamento,
  SituacaoDaCobranca,
  SituacaoDaContratacao,
  ValorEQuantidade,
} from '../api/financeiroTipos';
import { dataSemAnoCorrente } from './datasRelativas';
import { centavosParaTela, dataCurta, SEM_DADO } from './formatos';
import { contagemParaTela, rotuloDoMes, rotuloDoMesCompleto } from './numeros';

/**
 * Regras puras do financeiro do aluno ao treinador. Dinheiro em centavos inteiros; `null` da API é "sem dado" e aparece
 * como "—" (nunca zero inventado). `vencida` e `diasDeAtraso` vêm da API, calculados em Brasília: nada aqui decide
 * "vencida" pela data do aparelho. O app nunca calcula valor de cobrança.
 */

// ---- Textos fixos ----

/** Dito ao lado de inadimplência, previsto e atrasado: o painel só enxerga cobranças que já existem. */
export const NOTA_CONSIDERA_GERADAS = 'considera as cobranças já geradas';

/** Rótulo fixo do resultado do mês: não é lucro, só o que foi registrado. */
export const ROTULO_RESULTADO_DO_MES = 'Resultado do mês (entradas − saídas registradas)';

export const TEXTO_LIQUIDO_INDISPONIVEL = 'indisponível';

export const AVISO_LIQUIDO =
  'O valor líquido ainda não é calculado: nenhuma taxa é descontada nem estimada. Os valores acima são os brutos.';

/** Texto recolhível "Como calculamos estes números". */
export const COMO_CALCULAMOS: readonly string[] = [
  'Recebido: soma das cobranças pagas no período, pela data do pagamento.',
  'A receber: cobranças em aberto com vencimento de hoje em diante.',
  'Em atraso: cobranças em aberto com vencimento anterior a hoje (horário de Brasília).',
  'Inadimplência: entre as cobranças que já venceram no período e não foram canceladas, a parte do valor que segue em aberto.',
  'Receita recorrente mensal: contratações ativas, sem parcela única, com o valor dividido pelos meses da periodicidade do plano.',
  `Previsto, atrasado e inadimplência ${NOTA_CONSIDERA_GERADAS}: cobranças que ainda não foram geradas não entram.`,
  'Resultado do mês: entradas menos saídas registradas, somando o recebido das cobranças com os lançamentos avulsos. Não é um resultado contábil.',
  'Com o filtro "Meus", os lançamentos avulsos ficam de fora, porque não pertencem a um aluno.',
];

// ---- Datas ----

/** "Hoje" de Brasília (UTC−3 fixo), independente do fuso do aparelho. Use em vez de `hojeIso` nas regras do financeiro. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dias corridos entre duas datas ISO (`b - a`). */
function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

// ---- Rótulos ----

const PERIODICIDADES: Record<PeriodoDoPlano, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  PARCELA_UNICA: 'Parcela única',
};

export const OPCOES_DE_PERIODICIDADE: readonly { valor: PeriodoDoPlano; rotulo: string }[] = (
  Object.keys(PERIODICIDADES) as PeriodoDoPlano[]
).map((valor) => ({ valor, rotulo: PERIODICIDADES[valor] }));

export function rotuloDaPeriodicidade(p: PeriodoDoPlano | null | undefined): string {
  return p ? (PERIODICIDADES[p] ?? SEM_DADO) : SEM_DADO;
}

const FORMAS: Record<FormaDePagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX_DIRETO: 'Pix direto',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
  PIX: 'Pix',
  CARTAO: 'Cartão',
};

export function rotuloDaForma(f: FormaDePagamento | null | undefined): string {
  return f ? (FORMAS[f] ?? SEM_DADO) : SEM_DADO;
}

/** Só estas quatro podem ser escolhidas numa baixa manual; `PIX` e `CARTAO` só vêm do recebimento online. */
export const FORMAS_MANUAIS: readonly { valor: FormaDePagamento; rotulo: string }[] = (
  ['DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO'] as const
).map((valor) => ({ valor, rotulo: FORMAS[valor] }));

export type TomDoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

export interface SeloFinanceiro {
  tom: TomDoSelo;
  rotulo: string;
}

/** Verde paga; âmbar em aberto; vermelho vencida (vem da API); cinza cancelada, estornada e contestada. */
export function seloDaCobranca(c: { situacao: SituacaoDaCobranca; vencida?: boolean }): SeloFinanceiro {
  switch (c.situacao) {
    case 'PAGA':
      return { tom: 'sucesso', rotulo: 'Paga' };
    case 'ABERTA':
      return c.vencida ? { tom: 'perigo', rotulo: 'Vencida' } : { tom: 'atencao', rotulo: 'Em aberto' };
    case 'CANCELADA':
      return { tom: 'neutro', rotulo: 'Cancelada' };
    case 'ESTORNADA':
      return { tom: 'neutro', rotulo: 'Estornada' };
    case 'CONTESTADA':
      // Ainda espera o banco decidir: atenção, não encerrada.
      return { tom: 'atencao', rotulo: 'Contestada' };
    default:
      return { tom: 'neutro', rotulo: SEM_DADO };
  }
}

export function seloDaContratacao(situacao: SituacaoDaContratacao): SeloFinanceiro {
  switch (situacao) {
    case 'ATIVA':
      return { tom: 'sucesso', rotulo: 'Ativa' };
    case 'PAUSADA':
      return { tom: 'atencao', rotulo: 'Pausada' };
    case 'ENCERRADA':
      return { tom: 'neutro', rotulo: 'Encerrada' };
    default:
      return { tom: 'neutro', rotulo: SEM_DADO };
  }
}

/** "3 dias de atraso", "1 dia de atraso"; sem dado da API, "—". */
export function atrasoParaTela(dias: number | null | undefined): string {
  if (typeof dias !== 'number' || !Number.isFinite(dias)) return SEM_DADO;
  if (dias <= 0) return SEM_DADO;
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

/**
 * Linha curta de uma cobrança nas listas do treinador (celular e ficha): valor e a data que importa para a situação.
 * Em aberto: "vence 05/11" ou "venceu 05/10 · 14 dias de atraso"; com baixa (paga, contestada, estornada): "paga em
 * 04/09 · Pix"; cancelada: "vencia 05/07". Sem o ano quando é o ano corrente. Dado ausente vira "—", nunca zero.
 */
export function resumoDaCobranca(
  c: Pick<CobrancaResponse, 'valorCentavos' | 'situacao' | 'vencida' | 'vencimento' | 'diasDeAtraso' | 'pagoEm' | 'forma'>,
  hoje: string = hojeEmBrasilia(),
): string {
  const valor = centavosParaTela(c.valorCentavos);
  const data = (iso: string | null | undefined) => dataSemAnoCorrente(iso, hoje);
  if (c.situacao === 'ABERTA') {
    if (!c.vencida) return `${valor} · vence ${data(c.vencimento)}`;
    const atraso = atrasoParaTela(c.diasDeAtraso);
    return `${valor} · venceu ${data(c.vencimento)}${atraso === SEM_DADO ? '' : ` · ${atraso}`}`;
  }
  if (temBaixaRegistrada(c)) return `${valor} · paga em ${data(c.pagoEm)}${c.forma ? ` · ${rotuloDaForma(c.forma)}` : ''}`;
  return `${valor} · vencia ${data(c.vencimento)}`;
}

// ---- Filtros da lista de cobranças ----

export const FILTROS_DE_SITUACAO: { valor: FiltroDeSituacao; rotulo: string }[] = [
  { valor: 'TODAS', rotulo: 'Todas' },
  { valor: 'ABERTA', rotulo: 'Em aberto' },
  { valor: 'VENCIDA', rotulo: 'Vencidas' },
  { valor: 'PAGA', rotulo: 'Pagas' },
  { valor: 'CANCELADA', rotulo: 'Canceladas' },
  { valor: 'ESTORNADA', rotulo: 'Estornadas' },
  { valor: 'CONTESTADA', rotulo: 'Contestadas' },
];

// ---- O que cada botão pode fazer (a API confere de novo) ----

/** Registrar pagamento e cancelar: só cobrança em aberto (as vencidas incluídas). */
export function podeRegistrarPagamento(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'ABERTA';
}

export function podeCancelarCobranca(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'ABERTA';
}

/** Desfazer: só uma baixa manual. Pagamento de provedor não se desfaz por aqui. */
export function podeDesfazerBaixa(c: Pick<CobrancaResponse, 'situacao' | 'provedor'>): boolean {
  return c.situacao === 'PAGA' && c.provedor === 'MANUAL';
}

/**
 * Estorno e contestação só registram o que aconteceu fora do app (na InfinitePay ou no banco), qualquer que seja a forma da
 * baixa. Contestar: só paga. Estornar: paga ou contestada (contestação perdida), e não tem volta. Manter paga: só
 * contestada (contestação ganha). A API confere de novo.
 */
export function podeMarcarContestacao(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'PAGA';
}

export function podeMarcarEstorno(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'PAGA' || c.situacao === 'CONTESTADA';
}

export function podeManterPaga(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'CONTESTADA';
}

/** A baixa (data, forma, quem deu) continua guardada na contestada e na estornada: a ficha da cobrança a mostra. */
export function temBaixaRegistrada(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'PAGA' || c.situacao === 'CONTESTADA' || c.situacao === 'ESTORNADA';
}

// ---- Recebimento online (InfinitePay) ----

export const ROTULO_ONLINE = 'Online';

/** Pago pelo provedor (link de pagamento): provedor preenchido e diferente de `MANUAL`. Sem provedor não conta. */
export function ehPagamentoOnline(c: Pick<CobrancaResponse, 'provedor'>): boolean {
  return !!c.provedor && c.provedor !== 'MANUAL';
}

/** Copiar o link: só de cobrança em aberto e com o recebimento online configurado (a API confere de novo). */
export function podeCopiarLink(c: Pick<CobrancaResponse, 'situacao'>, recebimentoConfigurado: boolean): boolean {
  return c.situacao === 'ABERTA' && recebimentoConfigurado;
}

export type PlataformaDoApp = 'web' | 'ios' | 'android';

/** `Platform.OS` do React Native → a plataforma da regra. Qualquer coisa que não seja a web conta como celular (loja). */
export function plataformaDoApp(os: string): PlataformaDoApp {
  if (os === 'web') return 'web';
  return os === 'ios' ? 'ios' : 'android';
}

export const TEXTO_COMBINE_COM_O_TREINADOR = 'Seu treinador vai combinar a forma de pagamento com você e registrar quando receber.';

/** As chaves da plataforma que o `GET /eu` traz: liberam o "Pagar" no iOS e no Android. Ausente = desligada. */
export interface ChavesDePagamentoNoCelular {
  pagarNoIos?: boolean | null;
  pagarNoAndroid?: boolean | null;
}

/**
 * O "Pagar" existe nesta plataforma? A web sempre tem. No celular só se a chave da plataforma do aparelho (`pagarNoIos`
 * no iOS, `pagarNoAndroid` no Android) estiver ligada; a do outro sistema não conta. Vale para o aluno e para a Minha
 * conta do treinador.
 */
export function pagarPermitidoNaPlataforma(plataforma: PlataformaDoApp, chaves: ChavesDePagamentoNoCelular): boolean {
  if (plataforma === 'web') return true;
  return (plataforma === 'ios' ? chaves.pagarNoIos : chaves.pagarNoAndroid) === true;
}

export type ComoPagar = 'botao' | 'informar' | 'combinar';

/**
 * Como o aluno vê uma cobrança em aberto. `informar`: celular sem a chave da plataforma, só informação (nada de botão,
 * link nem frase mandando pagar). Com o "Pagar" permitido, `botao` quando a consultoria tem o recebimento online; sem
 * ele o treinador combina a forma e registra à mão (`combinar`). A plataforma vem do componente (`Platform.OS`).
 */
export function comoPagar(plataforma: PlataformaDoApp, pagamentoOnline: boolean, chaves: ChavesDePagamentoNoCelular): ComoPagar {
  if (!pagarPermitidoNaPlataforma(plataforma, chaves)) return 'informar';
  return pagamentoOnline ? 'botao' : 'combinar';
}

/** O texto da seção "Em aberto" para cada modo; `botao` e `informar` não têm texto (o botão fala por si; informar só informa). */
export function textoDeComoPagar(modo: ComoPagar): string | null {
  return modo === 'combinar' ? TEXTO_COMBINE_COM_O_TREINADOR : null;
}

/**
 * Linha de informação de uma cobrança no celular sem o "Pagar" (`informar`), com a vencida decidida pela API: aberta no
 * prazo = "Mensalidade de R$ 150,00, vence em 05/11"; aberta vencida = "Em aberto desde 05/10" (data do vencimento);
 * paga = "Paga em 19/10" (data da baixa). Qualquer outra situação (ou paga sem data) fica sem linha: só o selo.
 */
export function informacaoDaCobranca(
  c: Pick<CobrancaDoAluno, 'situacao' | 'vencida' | 'vencimento' | 'valorCentavos' | 'pagoEm'>,
): string | null {
  if (c.situacao === 'PAGA') {
    const quando = c.pagoEm ? dataCurta(c.pagoEm) : '';
    return quando ? `Paga em ${quando}` : null;
  }
  if (c.situacao !== 'ABERTA') return null;
  const vence = dataCurta(c.vencimento);
  if (!vence) return null;
  return c.vencida ? `Em aberto desde ${vence}` : `Mensalidade de ${centavosParaTela(c.valorCentavos)}, vence em ${vence}`;
}

export const TEXTO_RECEBIMENTO_ONLINE =
  'O aluno paga por Pix ou cartão por um link da InfinitePay e o dinheiro cai direto na sua conta InfinitePay. O app não recebe nem guarda dinheiro.';
export const TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO = 'Configure o recebimento online para copiar o link de pagamento.';
export const TEXTO_CHAVE_DO_RECEBIMENTO =
  'Sem a chave o link pode ser pago mais de uma vez e não vence; com a chave o link vale para um pagamento e 30 dias.';
export const TEXTO_NADA_E_BAIXADO =
  'Nada é baixado nem desfeito sozinho: se o pagamento for válido, registre-o na cobrança; se houve estorno, ajuste a cobrança à mão.';

const MOTIVOS_DA_CONFERENCIA: Record<MotivoDaConferencia, string> = {
  COBRANCA_CANCELADA: 'Cobrança já cancelada',
  COBRANCA_JA_PAGA: 'Já estava paga (pagamento em dobro?)',
  VALOR_DIFERENTE: 'Valor diferente do combinado',
  LINK_DIFERENTE: 'Link diferente do da cobrança',
  FORMA_DESCONHECIDA: 'Forma de pagamento desconhecida',
  COBRANCA_NAO_ENCONTRADA: 'Cobrança não encontrada',
  CONSULTA_FALHOU: 'Não foi possível confirmar com a InfinitePay',
  ESTORNO_INFORMADO: 'A InfinitePay informou estorno deste pagamento. Confira na sua conta e, se for o caso, ajuste a cobrança à mão.',
};

export function rotuloDoMotivoDaConferencia(m: MotivoDaConferencia | null | undefined): string {
  return (m && MOTIVOS_DA_CONFERENCIA[m]) || 'Conferir manualmente';
}

/** Limites da InfiniteTag e da API Key (a API confere de novo). */
export const TAG_MINIMO = 3;
export const TAG_MAXIMO = 40;
export const CHAVE_MINIMO = 10;
export const CHAVE_MAXIMO = 200;

/** Sem espaços nas pontas nem o cifrão do começo, em minúscula: como a API guarda e como a tela mostra. */
export function normalizarInfiniteTag(texto: string | null | undefined): string {
  let tag = (texto ?? '').trim();
  if (tag.startsWith('$')) tag = tag.slice(1).trim();
  return tag.toLowerCase();
}

export interface ErrosDoRecebimentoOnline {
  infiniteTag: string | null;
  apiKey: string | null;
}

/**
 * InfiniteTag de 3 a 40 caracteres entre letras minúsculas, números, ponto, hífen e sublinhado (depois de tirar o `$` e
 * os espaços das pontas). A chave é opcional: em branco vale "não mudar"; preenchida, de 10 a 200 caracteres sem espaço.
 * As mensagens nunca repetem o que foi digitado.
 */
export function validarRecebimentoOnline(dados: { infiniteTag: string; apiKey?: string | null }): ErrosDoRecebimentoOnline {
  const tag = normalizarInfiniteTag(dados.infiniteTag);
  let erroDaTag: string | null = null;
  if (!tag) erroDaTag = 'Informe a sua InfiniteTag.';
  else if (!/^[a-z0-9_.-]+$/.test(tag) || tag.length < TAG_MINIMO || tag.length > TAG_MAXIMO) {
    erroDaTag = `Use a InfiniteTag sem o cifrão: de ${TAG_MINIMO} a ${TAG_MAXIMO} letras, números, ponto, hífen ou sublinhado.`;
  }
  const chave = (dados.apiKey ?? '').trim();
  let erroDaChave: string | null = null;
  if (chave && (/[\s\x00-\x1f\x7f]/.test(chave) || chave.length < CHAVE_MINIMO || chave.length > CHAVE_MAXIMO)) {
    erroDaChave = `A chave precisa ter de ${CHAVE_MINIMO} a ${CHAVE_MAXIMO} caracteres, sem espaços.`;
  }
  return { infiniteTag: erroDaTag, apiKey: erroDaChave };
}

// ---- Juros do parcelamento ----

export const TITULO_JUROS_DO_PARCELAMENTO = 'Quem paga os juros do parcelamento';
export const TEXTO_JUROS_DO_PARCELAMENTO =
  'Aluno: ele paga os juros quando parcela no cartão. Você: você absorve os juros do parcelamento.';
export const MOTIVO_JUROS_SEM_CHAVE = 'Precisa da chave de API para valer.';

export const OPCOES_DE_JUROS: readonly { valor: JurosDoParcelamento; rotulo: string }[] = [
  { valor: 'ALUNO', rotulo: 'Aluno' },
  { valor: 'TREINADOR', rotulo: 'Você' },
];

/** Para quem só lê (sem permissão de alterar): a frase fala do treinador, não de "você". */
export function rotuloDosJurosParaLeitura(juros: JurosDoParcelamento | null | undefined): string {
  if (juros === 'TREINADOR') return 'O treinador absorve os juros';
  return juros === 'ALUNO' ? 'O aluno paga os juros' : SEM_DADO;
}

/**
 * Há chave de API valendo? A já configurada, ou uma digitada agora que passa na validação (assim dá para criar tag,
 * chave e "Você" no mesmo salvar). Sem chave a opção "Você" fica desabilitada e a escolha volta para Aluno.
 */
export function temChaveParaJuros(apiKeyConfigurada: boolean, chaveDigitada: string | null | undefined): boolean {
  if (apiKeyConfigurada) return true;
  const chave = (chaveDigitada ?? '').trim();
  return chave !== '' && validarRecebimentoOnline({ infiniteTag: 'valida', apiKey: chave }).apiKey === null;
}

/** A escolha que vale: "Você" só com chave; sem ela, Aluno. */
export function jurosQueValem(escolha: JurosDoParcelamento | null | undefined, temChave: boolean): JurosDoParcelamento {
  return escolha === 'TREINADOR' && temChave ? 'TREINADOR' : 'ALUNO';
}

/** A API confere de novo (422 `RECEBIMENTO_ONLINE_INVALIDO` no campo `jurosDoParcelamento`). */
export function validarJurosDoParcelamento(juros: JurosDoParcelamento, temChave: boolean): string | null {
  return juros === 'TREINADOR' && !temChave ? MOTIVO_JUROS_SEM_CHAVE : null;
}

// ---- Retorno do navegador depois do pagamento ----

/** Texto simples (UUID, NSU, slug, forma de captura): letras, números, hífen, sublinhado e ponto, de 1 a 100 caracteres. */
const TEXTO_SIMPLES = /^[A-Za-z0-9._-]{1,100}$/;

function umTexto(valor: string | string[] | undefined): string | null {
  const texto = Array.isArray(valor) ? (valor.length === 1 ? valor[0] : undefined) : valor;
  return typeof texto === 'string' && TEXTO_SIMPLES.test(texto) ? texto : null;
}

/**
 * A InfinitePay volta ao app em `/aluno/conta` com `order_nsu`, `transaction_nsu`, `slug`, `capture_method` (e
 * `receipt_url`, que não usamos) na query. `presente`: algum desses parâmetros veio (a tela limpa o endereço); `retorno`:
 * os dois NSU são válidos (só então a API é chamada). `slug` e `capture_method` inválidos são descartados; o resto da
 * query, ignorado.
 */
export function lerRetornoDoPagamento(
  params: Record<string, string | string[] | undefined>,
): { presente: boolean; retorno: RetornoDoPagamento | null } {
  const presente = ['order_nsu', 'transaction_nsu', 'slug', 'capture_method', 'receipt_url'].some((c) => params[c] !== undefined);
  const orderNsu = umTexto(params.order_nsu);
  const transactionNsu = umTexto(params.transaction_nsu);
  if (!orderNsu || !transactionNsu) return { presente, retorno: null };
  const retorno: RetornoDoPagamento = { orderNsu, transactionNsu };
  const slug = umTexto(params.slug);
  if (slug) retorno.slug = slug;
  const captureMethod = umTexto(params.capture_method);
  if (captureMethod) retorno.captureMethod = captureMethod;
  return { presente, retorno };
}

export const AVISO_RETORNO_DO_PAGAMENTO = 'Recebemos o retorno do pagamento. A confirmação pode levar alguns instantes.';
export const AVISO_RETORNO_SEM_CONFIRMAR = 'Não foi possível conferir o retorno agora. Se você pagou, a confirmação pode levar alguns instantes.';

/**
 * Aviso do painel de Pausar e de Encerrar: as cobranças abertas (as vencidas incluídas) continuam valendo. `null` quando
 * não há nenhuma (o painel não mostra linha vazia).
 */
export function textoDeAbertasQueContinuam(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return 'Há 1 cobrança aberta; ela continua valendo. Cancele-a se precisar.';
  return `Há ${n} cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.`;
}

/** Cobranças em situação ABERTA de uma contratação (`vencida` é só um sinal de uma ABERTA, então entra). */
export function abertasDaContratacao(
  cobrancas: readonly Pick<CobrancaResponse, 'contratacaoId' | 'situacao'>[] | null | undefined,
  contratacaoId: string,
): number {
  return (cobrancas ?? []).filter((c) => c.contratacaoId === contratacaoId && c.situacao === 'ABERTA').length;
}

// ---- Período do painel ----

export type AtalhoDePeriodo = '3m' | '6m' | '12m' | 'ano';

export const ATALHOS_DE_PERIODO: { valor: AtalhoDePeriodo; rotulo: string }[] = [
  { valor: '3m', rotulo: '3 meses' },
  { valor: '6m', rotulo: '6 meses' },
  { valor: '12m', rotulo: '12 meses' },
  { valor: 'ano', rotulo: 'Este ano' },
];

/**
 * `de` = primeiro dia do mês inicial; `ate` = último dia do mês final. Os atalhos de meses terminam no mês corrente;
 * "Este ano" vai de 1º de janeiro a 31 de dezembro (os meses futuros trazem o previsto).
 */
export function periodoDoPainel(atalho: AtalhoDePeriodo, hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number);
  if (atalho === 'ano') return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  const meses = atalho === '3m' ? 3 : atalho === '6m' ? 6 : 12;
  const inicio = new Date(Date.UTC(ano, mes - 1 - (meses - 1), 1));
  const ia = inicio.getUTCFullYear();
  const im = inicio.getUTCMonth() + 1;
  return {
    de: `${ia}-${doisDigitos(im)}-01`,
    ate: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDiaDoMes(ano, mes))}`,
  };
}

/** O mês de `hoje`, do dia 1 ao último dia (resultado do mês corrente). */
export function periodoDoMes(hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number);
  return { de: `${ano}-${doisDigitos(mes)}-01`, ate: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDiaDoMes(ano, mes))}` };
}

// ---- Contas do painel ----

/** `12.5` → `12,5%`; nulo → "—" (nada venceu no período). */
export function percentualParaTela(p: number | null | undefined): string {
  if (typeof p !== 'number' || !Number.isFinite(p)) return SEM_DADO;
  const texto = Number.isInteger(p) ? String(p) : p.toFixed(1).replace('.', ',');
  return `${texto}%`;
}

/** Valor e quantidade: `R$ 300,00 (2 cobranças)`; sem valor, "—". */
export function valorEQuantidadeParaTela(v: ValorEQuantidade | null | undefined): string {
  if (!v || v.valorCentavos === null || v.valorCentavos === undefined) return SEM_DADO;
  const n = v.cobrancas;
  const quantidade = n === 1 ? '1 cobrança' : `${n} cobranças`;
  return `${centavosParaTela(v.valorCentavos)} (${quantidade})`;
}

export interface CartaoDoPainel {
  chave: string;
  titulo: string;
  valor: string;
  /** Linha pequena sob o valor. */
  detalhe?: string;
}

/** Os seis cartões, na ordem da tela. */
export function cartoesDoPainel(c: CartoesDoPainel): CartaoDoPainel[] {
  return [
    { chave: 'recebido', titulo: 'Recebido no período', valor: centavosParaTela(c.recebidoCentavos) },
    {
      chave: 'aReceber',
      titulo: 'A receber',
      valor: centavosParaTela(c.aReceberCentavos),
      detalhe: NOTA_CONSIDERA_GERADAS,
    },
    {
      chave: 'emAtraso',
      titulo: 'Em atraso',
      valor: centavosParaTela(c.emAtraso?.valorCentavos),
      detalhe:
        c.emAtraso && c.emAtraso.valorCentavos !== null
          ? `${contagemParaTela(c.emAtraso.cobrancas)} ${c.emAtraso.cobrancas === 1 ? 'cobrança' : 'cobranças'} · ${NOTA_CONSIDERA_GERADAS}`
          : NOTA_CONSIDERA_GERADAS,
    },
    {
      chave: 'recorrente',
      titulo: 'Receita recorrente mensal',
      valor: centavosParaTela(c.receitaRecorrenteMensalCentavos),
    },
    { chave: 'pagantes', titulo: 'Alunos pagantes', valor: contagemParaTela(c.alunosPagantes) },
    {
      chave: 'medio',
      titulo: 'Valor médio por aluno',
      valor: centavosParaTela(c.valorMedioPorAlunoCentavos),
    },
  ];
}

/** Linha de inadimplência: `12,5%` e `R$ 300,00 em aberto de R$ 2.400,00 que já venceram · considera...`. */
export function inadimplenciaParaTela(i: Painel['inadimplencia'] | null | undefined): {
  percentual: string;
  detalhe: string;
} {
  if (!i) return { percentual: SEM_DADO, detalhe: NOTA_CONSIDERA_GERADAS };
  const percentual = percentualParaTela(i.percentual);
  if (i.percentual === null || i.vencidoCentavos === null || i.cobradoCentavos === null) {
    return { percentual, detalhe: `Nada venceu no período · ${NOTA_CONSIDERA_GERADAS}` };
  }
  return {
    percentual,
    detalhe: `${centavosParaTela(i.vencidoCentavos)} em aberto de ${centavosParaTela(i.cobradoCentavos)} que já venceram · ${NOTA_CONSIDERA_GERADAS}`,
  };
}

/** Líquido: sempre "indisponível" na Fase 1; nunca um desconto inventado. Mostra o bruto, quando houver. */
export function liquidoParaTela(l: Liquido | null | undefined): { valor: string; detalhe: string } {
  if (!l || !l.disponivel) {
    const bruto = l && l.brutoCentavos !== null && l.brutoCentavos !== undefined ? ` Bruto: ${centavosParaTela(l.brutoCentavos)}.` : '';
    return {
      valor: TEXTO_LIQUIDO_INDISPONIVEL,
      detalhe: `${l?.motivo ?? AVISO_LIQUIDO}${bruto}`,
    };
  }
  // Fases futuras: com taxa conhecida a API passa a mandar `disponivel`; até lá, o app não calcula nada.
  return { valor: centavosParaTela(l.brutoCentavos), detalhe: l.motivo ?? '' };
}

export interface ResultadoDoMesNaTela {
  rotulo: string;
  mes: string;
  recebido: string;
  entradas: string;
  saidas: string;
  resultado: string;
}

export function resultadoDoMesParaTela(r: Painel['resultadoDoMes'] | null | undefined): ResultadoDoMesNaTela {
  return {
    rotulo: ROTULO_RESULTADO_DO_MES,
    mes: rotuloDoMes(r?.mes),
    recebido: centavosParaTela(r?.recebidoCentavos),
    entradas: centavosParaTela(r?.entradasAvulsasCentavos),
    saidas: centavosParaTela(r?.saidasAvulsasCentavos),
    resultado: centavosParaTela(r?.resultadoCentavos),
  };
}

// ---- Gráfico mês a mês ----

export interface BarraDoMes {
  rotulo: string;
  realizado: number | null;
  previsto: number | null;
}

/** Série do painel em barras: realizado (recebido) e previsto. Valor ausente continua `null` (sem barra, "—" na tabela). */
export function serieDoGrafico(serie: readonly MesDoPainel[] | null | undefined): BarraDoMes[] {
  return (serie ?? []).map((m) => ({
    rotulo: rotuloDoMesCompleto(m),
    realizado: typeof m.recebidoCentavos === 'number' ? m.recebidoCentavos : null,
    previsto: typeof m.previstoCentavos === 'number' ? m.previstoCentavos : null,
  }));
}

/** Maior valor da série (para a escala do gráfico); 0 quando não há nenhum dado. */
export function maiorValorDoGrafico(barras: readonly BarraDoMes[]): number {
  let max = 0;
  for (const b of barras) {
    if (b.realizado !== null && b.realizado > max) max = b.realizado;
    if (b.previsto !== null && b.previsto > max) max = b.previsto;
  }
  return max;
}

/** A série tem algum valor para desenhar? */
export function graficoTemDados(barras: readonly BarraDoMes[]): boolean {
  return barras.some((b) => b.realizado !== null || b.previsto !== null);
}

/** Uma frase por mês, para leitor de tela e para quem prefere texto. */
export function descricaoDoGrafico(barras: readonly BarraDoMes[]): string {
  if (!graficoTemDados(barras)) return 'Sem valores recebidos ou previstos no período.';
  return barras
    .map((b) => {
      const partes = [`recebido ${centavosParaTela(b.realizado)}`];
      if (b.previsto !== null) partes.push(`previsto ${centavosParaTela(b.previsto)}`);
      return `${b.rotulo}: ${partes.join(', ')}`;
    })
    .join('. ');
}

/** Rótulo curto do eixo, a partir de reais (não centavos): 500 → `R$ 500`; 1.200 → `R$ 1,2 mil`; 2.500.000 → `R$ 2,5 mi`. */
export function reaisCompactos(reais: number): string {
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? '-' : '';
  const curto = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (abs >= 1_000_000) return `${sinal}R$ ${curto(abs / 1_000_000)} mi`;
  if (abs >= 1000) return `${sinal}R$ ${curto(abs / 1000)} mil`;
  return `${sinal}R$ ${curto(abs)}`;
}

/** Linhas da tabela alternativa ao gráfico (celular ou gráficos desligados). */
export function linhasDaTabelaDoGrafico(barras: readonly BarraDoMes[]): {
  rotulo: string;
  realizado: string;
  previsto: string;
}[] {
  return barras.map((b) => ({
    rotulo: b.rotulo,
    realizado: centavosParaTela(b.realizado),
    previsto: centavosParaTela(b.previsto),
  }));
}

// ---- Validações dos formulários (a API confere de novo) ----

export const LIMITES = {
  nomeDoPlano: 80,
  observacao: 300,
  motivo: 300,
  motivoDoValor: 200,
  descricaoDoLancamento: 120,
  categoria: 60,
} as const;

/** Mesmo teto da API: R$ 10 milhões em centavos. */
export const VALOR_MAXIMO_CENTAVOS = 1_000_000_000;

export function validarValor(centavos: number | null): string | null {
  if (centavos === null) return 'Informe um valor maior que zero, por exemplo 150,00.';
  if (centavos > VALOR_MAXIMO_CENTAVOS) return 'Esse valor passa do máximo permitido (R$ 10.000.000,00).';
  return null;
}

/** Baixa manual: data obrigatória e nunca no futuro (Brasília). A forma vem de uma lista fixa. */
export function validarBaixa(dados: { data: string | null | undefined; forma: string | null }, hoje: string): string | null {
  if (!dados.data) return 'Informe a data do pagamento.';
  if (dados.data > hoje) return 'A data do pagamento não pode ser no futuro.';
  if (!dados.forma || !FORMAS_MANUAIS.some((f) => f.valor === dados.forma)) return 'Escolha a forma de pagamento.';
  return null;
}

export function validarPlano(dados: { nome: string; valorCentavos: number | null }): string | null {
  const nome = dados.nome.trim();
  if (!nome) return 'Informe o nome do plano.';
  if (nome.length > LIMITES.nomeDoPlano) return `O nome pode ter até ${LIMITES.nomeDoPlano} caracteres.`;
  return validarValor(dados.valorCentavos);
}

/**
 * Valor diferente do plano exige o motivo. Valor igual (ou em branco) usa o do plano. Sem o valor do plano à mão (plano
 * arquivado, ao alterar), a API decide.
 */
export function validarContratacao(dados: {
  planoId: string | null;
  valorCentavos: number | null;
  valorDoPlanoCentavos: number | null;
  motivoValor: string;
  inicio: string | null | undefined;
  diaVencimento: number | null | undefined;
}): string | null {
  if (!dados.planoId) return 'Escolha o plano.';
  if (!dados.inicio) return 'Informe a data de início.';
  const dia = dados.diaVencimento;
  if (typeof dia !== 'number' || !Number.isInteger(dia) || dia < 1 || dia > 31) return 'O dia de vencimento vai de 1 a 31.';
  if (dados.valorCentavos !== null) {
    const erro = validarValor(dados.valorCentavos);
    if (erro) return erro;
    if (dados.valorDoPlanoCentavos !== null && dados.valorCentavos !== dados.valorDoPlanoCentavos && !dados.motivoValor.trim()) {
      return 'Explique por que o valor é diferente do plano.';
    }
  }
  if (dados.motivoValor.length > LIMITES.motivoDoValor) return `O motivo pode ter até ${LIMITES.motivoDoValor} caracteres.`;
  return null;
}

export function validarLancamento(dados: {
  data: string | null | undefined;
  descricao: string;
  valorCentavos: number | null;
  categoria: string;
}): string | null {
  if (!dados.data) return 'Informe a data do lançamento.';
  const descricao = dados.descricao.trim();
  if (!descricao) return 'Descreva o lançamento.';
  if (descricao.length > LIMITES.descricaoDoLancamento) return `A descrição pode ter até ${LIMITES.descricaoDoLancamento} caracteres.`;
  if (dados.categoria.trim().length > LIMITES.categoria) return `A categoria pode ter até ${LIMITES.categoria} caracteres.`;
  return validarValor(dados.valorCentavos);
}

// ---- Aluno ----

/** Dias de antecedência a partir dos quais uma cobrança em aberto vira pendência no Início do aluno. */
export const DIAS_DE_AVISO_DO_PAGAMENTO = 3;

/**
 * Cobrança que merece aviso ao aluno: vencida (decidido pela API) ou que vence em até 3 dias. Cobrança só vence
 * "em breve" se ainda está aberta; paga ou cancelada nunca aparece.
 */
export function pagamentoPendente(abertas: readonly CobrancaDoAluno[] | null | undefined, hoje: string): CobrancaDoAluno[] {
  return (abertas ?? []).filter(
    (c) => c.situacao === 'ABERTA' && (c.vencida || diasEntre(hoje, c.vencimento) <= DIAS_DE_AVISO_DO_PAGAMENTO),
  );
}

// ---- Exportação ----

/** `financeiro-2026-01-a-2026-06.csv`: o nome é montado aqui porque a requisição não expõe o cabeçalho da resposta. */
export function nomeDoCsv(de: string, ate: string): string {
  return `financeiro-${de}-a-${ate}.csv`;
}
