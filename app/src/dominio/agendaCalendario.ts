import type { AgendaPessoal, Compromisso, CorDaAgenda, DiaDoResumo, OcorrenciaDeEvento } from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import { dataEmBrasilia, horaEmBrasilia, instanteDeBrasilia, situacaoDoCompromisso, sobrepoe, nomesDosParticipantes } from './agendaPresencial';
import type { Intervalo } from './agendaPresencial';
import { diaDaSemanaIso, somarDias } from './formatos';
import { LARGURA_DUAS_COLUNAS } from './grade';
import { AGENDAS_OCULTAS_MAXIMO } from './preferencias';

/**
 * Regra pura do calendário da Agenda (visões Dia, Semana, Mês e Ano, mini calendário, grade de horários e mescla das três
 * fontes: compromissos com aluno, eventos pessoais e atualizações). Sem React e sem `new Date()` com o fuso do aparelho:
 * tudo é data civil de Brasília em texto `AAAA-MM-DD` e instante ISO; o "hoje" e o "agora" chegam por parâmetro. A semana é
 * de segunda a domingo (P1/P2). Quem expande a repetição dos eventos é a API; o app nunca expande.
 */

// ---- Datas ----

/** A API aceita datas de evento entre estes anos (`RecorrenciaDeEvento`). */
export const ANO_MINIMO = 2000;
export const ANO_MAXIMO = 2100;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;
const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'] as const;
/** Segunda a domingo, como o cabeçalho do Mês e do mini calendário. */
export const DIAS_DA_SEMANA_CURTOS = ['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.'] as const;
export const DIAS_DA_SEMANA_POR_EXTENSO = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'] as const;

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const isoDe = (ano: number, mes: number, dia: number) => `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/** `AAAA-MM-DD` que existe de verdade (31/02 não) e que a API aceita (anos 2000 a 2100). */
export function ehDataDoCalendario(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = partes(valor);
  return a >= ANO_MINIMO && a <= ANO_MAXIMO && m >= 1 && m <= 12 && d >= 1 && d <= diasNoMes(a, m);
}

/** Segunda-feira da semana da data (a semana vai de segunda a domingo). */
export const segundaDaSemana = (iso: string): string => somarDias(iso, -(diaDaSemanaIso(iso) - 1));
export const domingoDaSemana = (iso: string): string => somarDias(iso, 6 - (diaDaSemanaIso(iso) - 1));
export const primeiroDiaDoMes = (iso: string): string => `${iso.slice(0, 7)}-01`;

/** Soma meses e leva o dia junto, limitado ao último do mês de chegada (31/03 → 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = partes(iso);
  const indice = a * 12 + (m - 1) + meses;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return isoDe(ano, mes, Math.min(d, diasNoMes(ano, mes)));
}

/** Soma anos (29/02 vira 28/02 em ano que não é bissexto). */
export const somarAnos = (iso: string, anos: number): string => somarMeses(iso, anos * 12);

/** Os dias de `de` a `ate`, inclusive. */
export function diasDoPeriodo(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

// ---- Visões, endereço e navegação ----

export type VisaoDoCalendario = 'dia' | 'semana' | 'mes' | 'ano';
export const VISOES_DO_CALENDARIO: readonly VisaoDoCalendario[] = ['dia', 'semana', 'mes', 'ano'];
export const ROTULOS_DAS_VISOES: Record<VisaoDoCalendario, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' };
/** Atalhos de teclado da web (D1); a tela os ignora com foco em campo, `Folha` aberta ou Ctrl/Alt/Meta. */
export const ATALHOS_DAS_VISOES: Record<string, VisaoDoCalendario> = { d: 'dia', w: 'semana', m: 'mes', y: 'ano' };

/** Janelas da API: a listagem de compromissos e de eventos aceita até 62 dias; o resumo e as atualizações, até 366. */
export const JANELA_DA_LISTAGEM = 62;
export const JANELA_DO_RESUMO = 366;
/** O Mês mostra sempre 6 semanas (42 dias), que cabem na janela da listagem. */
export const DIAS_DO_MES_NA_GRADE = 42;

const primeiro = (v: string | readonly string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) as string | null | undefined;

/** `visao` do endereço; ausente ou desconhecida = o padrão (D16). */
export function lerVisaoDoCalendario(valor: string | readonly string[] | null | undefined, padrao: VisaoDoCalendario = 'semana'): VisaoDoCalendario {
  const v = primeiro(valor);
  return VISOES_DO_CALENDARIO.find((x) => x === v) ?? padrao;
}

/** `data` do endereço; ausente, impossível (31/02) ou fora de 2000 a 2100 = hoje. */
export function lerDataDoCalendario(valor: string | readonly string[] | null | undefined, hoje: string): string {
  const v = primeiro(valor);
  return ehDataDoCalendario(v) ? v : hoje;
}

/** Visão e data do endereço, já validadas, com padrão seguro para qualquer valor inválido. */
export function lerEnderecoDoCalendario(params: { visao?: string | readonly string[] | null; data?: string | readonly string[] | null }, hoje: string,
  largura: number): { visao: VisaoDoCalendario; data: string } {
  return { visao: lerVisaoDoCalendario(params.visao, visaoPadrao(largura)), data: lerDataDoCalendario(params.data, hoje) };
}

/**
 * Visão de quem abre a tela sem `visao` no endereço. No celular (< 760 px, o corte do `ui/Grade`) Dia e Semana são a lista
 * por dia de hoje; no PC são a grade de horários. A visão é a mesma (Semana) nos dois: o que muda é o modo ({@link modoDaVisao}).
 */
export function visaoPadrao(_largura: number): VisaoDoCalendario {
  return 'semana';
}

export type ModoDaVisao = 'grade' | 'lista' | 'mes' | 'mesCompacto' | 'ano';

/** Como a visão se desenha na largura dada: Dia e Semana em grade de horários no PC e em lista por dia no celular. */
export function modoDaVisao(visao: VisaoDoCalendario, largura: number): ModoDaVisao {
  const celular = largura < LARGURA_DUAS_COLUNAS;
  if (visao === 'ano') return 'ano';
  if (visao === 'mes') return celular ? 'mesCompacto' : 'mes';
  return celular ? 'lista' : 'grade';
}

/**
 * O período a buscar de cada visão. Dia: o dia. Semana: segunda a domingo. Mês: 6 semanas (42 dias) a partir da segunda da
 * semana do dia 1, que é exatamente a grade desenhada ({@link celulasDoMes}). Ano: 1/jan a 31/dez, só para o resumo.
 */
export function periodoDoCalendario(visao: VisaoDoCalendario, data: string): { de: string; ate: string } {
  if (visao === 'dia') return { de: data, ate: data };
  if (visao === 'semana') return { de: segundaDaSemana(data), ate: domingoDaSemana(data) };
  if (visao === 'mes') {
    const de = segundaDaSemana(primeiroDiaDoMes(data));
    return { de, ate: somarDias(de, DIAS_DO_MES_NA_GRADE - 1) };
  }
  const ano = data.slice(0, 4);
  return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}

/**
 * Anterior (-1) ou próximo (1) da visão: um dia, uma semana, um mês (o dia limitado ao fim do mês) ou um ano. Quem passaria
 * de 2000 a 2100 fica onde está.
 */
export function deslocarCalendario(visao: VisaoDoCalendario, data: string, sentido: 1 | -1): string {
  const destino = visao === 'dia' ? somarDias(data, sentido) : visao === 'semana' ? somarDias(data, 7 * sentido)
    : visao === 'mes' ? somarMeses(data, sentido) : somarAnos(data, sentido);
  return ehDataDoCalendario(destino) ? destino : data;
}

/** "29 de outubro de 2026", sem o dia da semana. */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = partes(iso);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** "quinta-feira, 29 de outubro de 2026" (para o leitor de tela e o título do dia). */
export const dataComDiaDaSemana = (iso: string): string => `${DIAS_DA_SEMANA_POR_EXTENSO[diaDaSemanaIso(iso) - 1]}, ${dataPorExtenso(iso)}`;

export const nomeDoMes = (mes: number): string => MESES[mes - 1] ?? '';

/**
 * Título do período em pt-BR, sem `Intl` (a saída muda entre o Jest e o Hermes): Dia "29 de outubro de 2026"; Semana
 * "26 de out. – 1 de nov. de 2026" (no mesmo mês "2 – 8 de nov. de 2026"; entre anos "28 de dez. de 2026 – 3 de jan. de 2027");
 * Mês "outubro de 2026"; Ano "2026".
 */
export function tituloDoCalendario(visao: VisaoDoCalendario, data: string): string {
  if (visao === 'dia') return dataPorExtenso(data);
  if (visao === 'mes') return `${MESES[partes(data)[1] - 1]} de ${partes(data)[0]}`;
  if (visao === 'ano') return String(partes(data)[0]);
  const { de, ate } = periodoDoCalendario('semana', data);
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  if (a1 !== a2) return `${d1} de ${MESES_CURTOS[m1 - 1]} de ${a1} – ${d2} de ${MESES_CURTOS[m2 - 1]} de ${a2}`;
  if (m1 !== m2) return `${d1} de ${MESES_CURTOS[m1 - 1]} – ${d2} de ${MESES_CURTOS[m2 - 1]} de ${a2}`;
  return `${d1} – ${d2} de ${MESES_CURTOS[m2 - 1]} de ${a2}`;
}

// ---- Células do Mês, os 12 meses do Ano e o mini calendário ----

export interface CelulaDoDia {
  data: string;
  /** Número do dia no mês (1 a 31). */
  dia: number;
  /** `false` nos dias da semana de fora do mês (esmaecidos). */
  doMes: boolean;
  hoje: boolean;
  /** É a data aberta no calendário. */
  selecionado: boolean;
  /** Cai no período da visão aberta (a semana, ou o mês na visão Mês) — só no mini calendário. */
  destaque: boolean;
  fimDeSemana: boolean;
}

interface Selecao {
  data?: string;
  destaque?: { de: string; ate: string } | null;
}

/** As 42 células (6 semanas de segunda a domingo) do mês da data, marcando os dias de fora do mês. */
export function celulasDoMes(dataNoMes: string, hoje: string, selecao: Selecao = {}): CelulaDoDia[] {
  const mes = dataNoMes.slice(0, 7);
  const inicio = segundaDaSemana(primeiroDiaDoMes(dataNoMes));
  return diasDoPeriodo(inicio, somarDias(inicio, DIAS_DO_MES_NA_GRADE - 1)).map((data) => ({
    data,
    dia: partes(data)[2],
    doMes: data.slice(0, 7) === mes,
    hoje: data === hoje,
    selecionado: data === selecao.data,
    destaque: !!selecao.destaque && data >= selecao.destaque.de && data <= selecao.destaque.ate,
    fimDeSemana: diaDaSemanaIso(data) >= 6,
  }));
}

/** As mesmas células em 6 linhas de 7 dias. */
export function semanasDoMes(dataNoMes: string, hoje: string, selecao: Selecao = {}): CelulaDoDia[][] {
  const celulas = celulasDoMes(dataNoMes, hoje, selecao);
  return Array.from({ length: 6 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
}

export interface MesDoAno {
  /** 1 a 12. */
  mes: number;
  nome: string;
  /** `AAAA-MM-01`: para onde o toque no título do mês leva. */
  primeiroDia: string;
  semanas: CelulaDoDia[][];
}

/** Os 12 mini meses do Ano (cada um com as 6 semanas de {@link semanasDoMes}). */
export function mesesDoAno(ano: number, hoje: string, selecao: Selecao = {}): MesDoAno[] {
  return Array.from({ length: 12 }, (_, i) => {
    const primeiroDia = isoDe(ano, i + 1, 1);
    return { mes: i + 1, nome: MESES[i], primeiroDia, semanas: semanasDoMes(primeiroDia, hoje, selecao) };
  });
}

export interface MiniCalendario {
  /** "outubro de 2026". */
  titulo: string;
  cabecalho: readonly string[];
  semanas: CelulaDoDia[][];
  anterior: string;
  proximo: string;
}

/**
 * O mini calendário do painel: o mês de `mesVisivel` (qualquer data dele; as setas do mini mudam só isso) com a data aberta
 * marcada e o período da visão (Dia, Semana ou o mês inteiro) em destaque. No Ano, só o dia marcado.
 */
export function miniCalendario(mesVisivel: string, visao: VisaoDoCalendario, data: string, hoje: string): MiniCalendario {
  const destaque = visao === 'dia' || visao === 'semana' ? periodoDoCalendario(visao, data)
    : visao === 'mes' ? { de: primeiroDiaDoMes(data), ate: somarDias(somarMeses(primeiroDiaDoMes(data), 1), -1) } : null;
  const trocar = (sentido: 1 | -1) => {
    const destino = somarMeses(primeiroDiaDoMes(mesVisivel), sentido);
    return ehDataDoCalendario(destino) ? destino : primeiroDiaDoMes(mesVisivel);
  };
  return {
    titulo: tituloDoCalendario('mes', mesVisivel),
    cabecalho: DIAS_DA_SEMANA_CURTOS,
    semanas: semanasDoMes(mesVisivel, hoje, { data, destaque }),
    anterior: trocar(-1),
    proximo: trocar(1),
  };
}

// ---- Agendas: as duas fixas e as pessoais ----

export const AGENDA_COMPROMISSOS = 'compromissos';
export const AGENDA_ATUALIZACOES = 'atualizacoes';

/** Cor de cada agenda fixa (a pessoal usa a que a pessoa escolheu). */
export const COR_DOS_COMPROMISSOS: CorDaAgenda = 'INDIGO';
export const COR_DAS_ATUALIZACOES: CorDaAgenda = 'ARDOSIA';

export interface AgendaDoPainel {
  /** `compromissos`, `atualizacoes` ou o id da agenda pessoal: é o que fica em `agendasOcultas`. */
  chave: string;
  nome: string;
  cor: CorDaAgenda;
  fixa: boolean;
  visivel: boolean;
  /** Só nas pessoais: a `versao` para renomear, recolorir e apagar. */
  versao?: number;
}

/**
 * As agendas do painel lateral, na ordem: as fixas que a permissão deixa ver (compromissos com `AGENDA_LER`; atualizações
 * com `ATUALIZACAO_LER` e `ALUNO_SENSIVEL_LER`) e depois as pessoais, como a API as manda (por nome).
 */
export function agendasDoPainel(pessoais: readonly AgendaPessoal[], ocultas: readonly string[],
  fixas: { compromissos: boolean; atualizacoes: boolean }): AgendaDoPainel[] {
  const escondida = new Set(ocultas);
  const lista: AgendaDoPainel[] = [];
  if (fixas.compromissos) {
    lista.push({ chave: AGENDA_COMPROMISSOS, nome: 'Compromissos com alunos', cor: COR_DOS_COMPROMISSOS, fixa: true, visivel: !escondida.has(AGENDA_COMPROMISSOS) });
  }
  if (fixas.atualizacoes) {
    lista.push({ chave: AGENDA_ATUALIZACOES, nome: 'Atualizações', cor: COR_DAS_ATUALIZACOES, fixa: true, visivel: !escondida.has(AGENDA_ATUALIZACOES) });
  }
  for (const a of pessoais) lista.push({ chave: a.id, nome: a.nome, cor: a.cor, fixa: false, visivel: !escondida.has(a.id), versao: a.versao });
  return lista;
}

/**
 * A preferência sem os ids de agendas pessoais que não existem mais (apagadas em outro aparelho). Só chamar com a lista de
 * agendas lida com sucesso e **sem gravar** o resultado de volta quando a leitura falhou. As duas fixas sempre valem.
 */
export function agendasOcultasValidas(ocultas: readonly string[], idsDasPessoais: readonly string[]): string[] {
  const existentes = new Set([AGENDA_COMPROMISSOS, AGENDA_ATUALIZACOES, ...idsDasPessoais]);
  return ocultas.filter((o) => existentes.has(o));
}

/** Esconde ou mostra uma agenda (devolve a lista nova; no teto de itens, esconder mais uma não faz nada). */
export function alternarAgendaOculta(ocultas: readonly string[], chave: string, teto = AGENDAS_OCULTAS_MAXIMO): string[] {
  if (ocultas.includes(chave)) return ocultas.filter((o) => o !== chave);
  return ocultas.length >= teto ? [...ocultas] : [...ocultas, chave];
}

export interface EscolhaDeAgendasParaBuscar {
  /** O filtro `agendas` de `GET /agenda/eventos` e do resumo: vazio = todas as minhas. */
  ids: string[];
  /** Nada de evento a mostrar (sem agendas pessoais ou todas escondidas): não buscar eventos e zerar os do resumo. */
  semEventos: boolean;
}

/**
 * Quais agendas pessoais pedir à API. Nenhuma escondida: sem filtro (vazio = todas, inclusive a criada em outra aba). Algumas
 * escondidas: só os ids das visíveis. Todas escondidas ou nenhuma agenda: `semEventos` (a API leria "todas" com a lista vazia,
 * então o app não pede). Chamar só com a lista de agendas lida com sucesso.
 */
export function agendasParaBuscar(pessoais: readonly AgendaPessoal[], ocultas: readonly string[]): EscolhaDeAgendasParaBuscar {
  if (pessoais.length === 0) return { ids: [], semEventos: true };
  const escondida = new Set(ocultas);
  const visiveis = pessoais.filter((a) => !escondida.has(a.id));
  if (visiveis.length === 0) return { ids: [], semEventos: true };
  return { ids: visiveis.length === pessoais.length ? [] : visiveis.map((a) => a.id), semEventos: false };
}

// ---- Itens do calendário (a mescla das três fontes) ----

export type OrigemDoItem = 'COMPROMISSO' | 'EVENTO' | 'ATUALIZACAO';

/** O dado original do item, para a tela abrir a folha ou a rota da fonte sem buscar de novo. */
export type FonteDoItem =
  | { origem: 'COMPROMISSO'; compromisso: Compromisso }
  | { origem: 'EVENTO'; ocorrencia: OcorrenciaDeEvento }
  | { origem: 'ATUALIZACAO'; atualizacao: AtualizacaoDaLista };

/**
 * Um item na agenda, qualquer que seja a fonte. `inicio`/`fim` são instantes ISO (o dia inteiro e a atualização ocupam o
 * dia de Brasília, do começo ao começo do seguinte); `data`/`dataFim` são o primeiro e o último dia que ele toca.
 */
export interface ItemDoCalendario {
  /** Estável e único: `compromisso:<id>`, `evento:<eventoId>:<dataOriginal>`, `atualizacao:<id>` (sem linha: a pasta ou o aluno). */
  chave: string;
  origem: OrigemDoItem;
  /** Id do compromisso ou do evento (a regra); o da atualização, nulo quando a pasta vencida ainda não tem linha. */
  refId: string | null;
  /** O compromisso, a ocorrência ou a atualização como vieram da API (a folha de compromisso precisa de participantes e `versao`). */
  fonte: FonteDoItem;
  /** `dataOriginal` da ocorrência do evento (a chave de `?ocorrencia=`); nulo nas outras fontes. */
  ocorrencia: string | null;
  /** `compromissos`, `atualizacoes` ou o id da agenda pessoal. */
  agendaId: string;
  cor: CorDaAgenda;
  /** Nomes dos alunos (compromisso), título (evento) ou nome do aluno (atualização). */
  titulo: string;
  local: string | null;
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  data: string;
  dataFim: string;
  recorrente: boolean;
  /** Compromisso cancelado: aparece esmaecido e nunca conta no conflito. */
  cancelado: boolean;
}

const diaDoFim = (fim: string) => dataEmBrasilia(new Date(Date.parse(fim) - 1));

export function itemDeCompromisso(c: Compromisso): ItemDoCalendario {
  return {
    chave: `compromisso:${c.id}`, origem: 'COMPROMISSO', refId: c.id, fonte: { origem: 'COMPROMISSO', compromisso: c }, ocorrencia: null, agendaId: AGENDA_COMPROMISSOS,
    cor: COR_DOS_COMPROMISSOS, titulo: nomesDosParticipantes(c), local: c.local, inicio: c.inicio, fim: c.fim, diaInteiro: false,
    data: dataEmBrasilia(c.inicio), dataFim: diaDoFim(c.fim), recorrente: !!c.serieId, cancelado: situacaoDoCompromisso(c) === 'CANCELADO',
  };
}

/** `agendas` dá a cor; evento de agenda desconhecida (acabou de ser apagada) usa a cor neutra. */
export function itemDeEvento(o: OcorrenciaDeEvento, agendas: readonly Pick<AgendaPessoal, 'id' | 'cor'>[] = []): ItemDoCalendario {
  return {
    chave: `evento:${o.eventoId}:${o.dataOriginal}`, origem: 'EVENTO', refId: o.eventoId, fonte: { origem: 'EVENTO', ocorrencia: o }, ocorrencia: o.dataOriginal, agendaId: o.agendaId,
    cor: agendas.find((a) => a.id === o.agendaId)?.cor ?? 'ARDOSIA', titulo: o.titulo, local: o.local, inicio: o.inicio, fim: o.fim,
    diaInteiro: o.diaInteiro, data: dataEmBrasilia(o.inicio), dataFim: diaDoFim(o.fim), recorrente: o.recorrente, cancelado: false,
  };
}

/** A data civil da atualização (a API pode mandar com hora); `null` sem data válida. */
export function dataDaAtualizacao(a: Pick<AtualizacaoDaLista, 'dataAtualizacao'>): string | null {
  const data = a.dataAtualizacao?.slice(0, 10);
  return ehDataDoCalendario(data) ? data : null;
}

/** A atualização vira um item de dia inteiro no dia do prazo; sem data, `null` (a tela a mostra em "Sem data"). */
export function itemDeAtualizacao(a: AtualizacaoDaLista): ItemDoCalendario | null {
  const data = dataDaAtualizacao(a);
  if (!data) return null;
  // Pasta vencida sem linha ainda não tem `id`: o `refId` fica nulo e a chave cai na pasta (ou no aluno).
  return {
    chave: `atualizacao:${a.id ?? a.pastaId ?? a.alunoId}`, origem: 'ATUALIZACAO', refId: a.id, fonte: { origem: 'ATUALIZACAO', atualizacao: a }, ocorrencia: null, agendaId: AGENDA_ATUALIZACOES, cor: COR_DAS_ATUALIZACOES,
    titulo: a.nomeAluno ?? 'Aluno', local: null, inicio: instanteDeBrasilia(data, '00:00'), fim: instanteDeBrasilia(somarDias(data, 1), '00:00'),
    diaInteiro: true, data, dataFim: data, recorrente: false, cancelado: false,
  };
}

/** As atualizações sem data válida, para o grupo "Sem data". */
export const atualizacoesSemData = (lista: readonly AtualizacaoDaLista[]): AtualizacaoDaLista[] => lista.filter((a) => !dataDaAtualizacao(a));

/** Por dia, dia inteiro primeiro, depois por horário (quem começou antes vem antes), fim, título e chave. */
export function compararItensDoCalendario(a: ItemDoCalendario, b: ItemDoCalendario): number {
  return a.data.localeCompare(b.data) || Number(b.diaInteiro) - Number(a.diaInteiro) || Date.parse(a.inicio) - Date.parse(b.inicio)
    || Date.parse(a.fim) - Date.parse(b.fim) || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.chave.localeCompare(b.chave);
}

/** Tira os itens das agendas escondidas. */
export const filtrarAgendasOcultas = (itens: readonly ItemDoCalendario[], ocultas: readonly string[]): ItemDoCalendario[] =>
  ocultas.length ? itens.filter((i) => !ocultas.includes(i.agendaId)) : [...itens];

interface Fontes {
  compromissos?: readonly Compromisso[];
  eventos?: readonly OcorrenciaDeEvento[];
  atualizacoes?: readonly AtualizacaoDaLista[];
  agendas?: readonly AgendaPessoal[];
  ocultas?: readonly string[];
}

/** Junta as três fontes num só tipo, tira as agendas escondidas e ordena ({@link compararItensDoCalendario}). */
export function mesclarItens(f: Fontes): ItemDoCalendario[] {
  const itens: ItemDoCalendario[] = [
    ...(f.compromissos ?? []).map(itemDeCompromisso),
    ...(f.eventos ?? []).map((o) => itemDeEvento(o, f.agendas)),
    ...(f.atualizacoes ?? []).flatMap((a) => itemDeAtualizacao(a) ?? []),
  ];
  return filtrarAgendasOcultas(itens, f.ocultas ?? []).sort(compararItensDoCalendario);
}

/** Os dias que o item toca (um compromisso de 23:30 de 60 min toca dois). */
export const diasDoItem = (i: Pick<ItemDoCalendario, 'data' | 'dataFim'>): string[] => diasDoPeriodo(i.data, i.dataFim);

export interface DiaDoCalendario {
  data: string;
  /** Os itens que tocam o dia: dia inteiro primeiro, depois por horário. */
  itens: ItemDoCalendario[];
}

/** Todos os dias de `de` a `ate` (o vazio também), cada um com os itens que o tocam. */
export function agruparPorDia(itens: readonly ItemDoCalendario[], de: string, ate: string): DiaDoCalendario[] {
  const dias = new Map<string, ItemDoCalendario[]>(diasDoPeriodo(de, ate).map((d) => [d, []]));
  for (const item of [...itens].sort(compararItensDoCalendario)) {
    for (const d of diasDoItem(item)) dias.get(d)?.push(item);
  }
  return [...dias].map(([data, lista]) => ({ data, itens: lista }));
}

/** Quantos itens tocam cada dia (dia sem item não aparece). */
export function contagemPorDia(itens: readonly ItemDoCalendario[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const item of itens) for (const d of diasDoItem(item)) contagem.set(d, (contagem.get(d) ?? 0) + 1);
  return contagem;
}

interface OpcoesDaSobreposicao {
  /** Quais fontes contam (padrão: só eventos pessoais, P5). */
  origens?: readonly OrigemDoItem[];
  /** Ao editar um evento: todas as ocorrências dele ficam fora (ele não conflita consigo). */
  ignorarEventoId?: string | null;
  /** Ou só uma ocorrência (`ESTA`): a `chave` do item. */
  ignorarChave?: string | null;
}

/**
 * Os itens que sobrepõem o intervalo (aviso P5 "você já tem um evento neste horário": só aviso, nunca bloqueia). Dia inteiro
 * não entra (D5), nem compromisso cancelado; encostar (um termina às 10:00 e o outro começa às 10:00) não é sobrepor. Vale
 * para o que a tela carregou: pode estar velho ou filtrado, e quem decide é a API.
 */
export function itensQueSobrepoem(itens: readonly ItemDoCalendario[], intervalo: Intervalo, opcoes: OpcoesDaSobreposicao = {}): ItemDoCalendario[] {
  const origens = opcoes.origens ?? ['EVENTO'];
  return itens.filter((i) => origens.includes(i.origem) && !i.diaInteiro && !i.cancelado && i.chave !== opcoes.ignorarChave
    && !(opcoes.ignorarEventoId && i.origem === 'EVENTO' && i.refId === opcoes.ignorarEventoId) && sobrepoe(i, intervalo));
}

/** "Você já tem um evento neste horário." / "… 3 eventos …"; sem item, `null`. Nunca traz o título (texto livre). */
export function textoDoAvisoDeSobreposicao(quantos: number): string | null {
  if (quantos <= 0) return null;
  return `Você já tem ${quantos === 1 ? 'um evento' : `${quantos} eventos`} neste horário. Dá para salvar mesmo assim.`;
}

// ---- Contagem do Ano ----

export interface ContagemDoDia {
  compromissos: number;
  eventos: number;
  atualizacoes: number;
  total: number;
}

/**
 * A contagem por dia do Ano: o resumo da API (compromissos e eventos) mais as atualizações da lista de 366 dias, sem o que
 * está escondido. A API não tem chave para esconder compromissos nem para "nenhum evento": o app zera aqui. Dia sem nada fica de fora.
 */
export function contagemDoAno(resumo: readonly DiaDoResumo[], atualizacoes: readonly AtualizacaoDaLista[],
  opcoes: { ocultas: readonly string[]; semEventos: boolean }): Map<string, ContagemDoDia> {
  const semCompromissos = opcoes.ocultas.includes(AGENDA_COMPROMISSOS);
  const semAtualizacoes = opcoes.ocultas.includes(AGENDA_ATUALIZACOES);
  const mapa = new Map<string, ContagemDoDia>();
  const dia = (data: string) => {
    let c = mapa.get(data);
    if (!c) { c = { compromissos: 0, eventos: 0, atualizacoes: 0, total: 0 }; mapa.set(data, c); }
    return c;
  };
  for (const r of resumo) {
    const c = dia(r.data);
    c.compromissos = semCompromissos ? 0 : r.compromissos;
    c.eventos = opcoes.semEventos ? 0 : r.eventos;
  }
  if (!semAtualizacoes) {
    for (const a of atualizacoes) {
      const data = dataDaAtualizacao(a);
      if (data) dia(data).atualizacoes += 1;
    }
  }
  for (const [data, c] of mapa) {
    c.total = c.compromissos + c.eventos + c.atualizacoes;
    if (c.total === 0) mapa.delete(data);
  }
  return mapa;
}

// ---- Grade de horários (Dia e Semana no PC) ----

const MINUTOS_DO_DIA = 1440;
const MS_DO_MINUTO = 60_000;
/** Altura mínima de um evento na grade, em px (padrão; a tela pode passar `ALVO_TOQUE`). */
export const ALTURA_MINIMA_DA_GRADE = 24;

export interface OpcoesDaGrade {
  /** Altura de uma hora, em px. */
  alturaPorHora: number;
  /** Altura mínima de cada item (toque); o intervalo mostrado já conta com ela na hora de achar sobrepostos. */
  alturaMinima?: number;
}

export interface SegmentoNaGrade {
  /** `<item.chave>@<data>`: único mesmo quando o item é cortado em dois dias. */
  chave: string;
  item: ItemDoCalendario;
  data: string;
  /** Minutos desde 00:00 de Brasília, já cortados no dia (0 a 1440). */
  minutoInicio: number;
  minutoFim: number;
  topo: number;
  altura: number;
  /** Coluna dentro do grupo de sobrepostos (0 a `colunas` - 1). */
  coluna: number;
  colunas: number;
  /** Fração da largura do dia: `esquerda = coluna / colunas`, `largura = 1 / colunas`. */
  esquerda: number;
  largura: number;
  continuaDeOntem: boolean;
  continuaAmanha: boolean;
}

export interface ColunaDoDia {
  data: string;
  /** A faixa de "dia inteiro" do topo (inclui as atualizações), separada da grade. */
  diaInteiro: ItemDoCalendario[];
  segmentos: SegmentoNaGrade[];
}

/** Altura total da grade das 24 horas. */
export const alturaDaGrade = (alturaPorHora: number): number => 24 * alturaPorHora;

/** Os rótulos das horas da lateral: "00:00" a "23:00". */
export const ROTULOS_DAS_HORAS: readonly string[] = Array.from({ length: 24 }, (_, h) => `${doisDigitos(h)}:00`);

/** Minutos desde 00:00 de Brasília de um instante (a linha do "agora"). */
export function minutoDoDiaEmBrasilia(instante: string | Date): number {
  const [h, m] = horaEmBrasilia(instante).split(':').map(Number);
  return h * 60 + m;
}

/** Posição de um minuto do dia na grade, em px. */
export const posicaoDoMinuto = (minuto: number, alturaPorHora: number): number => (minuto / 60) * alturaPorHora;

/**
 * Onde cada item do dia fica na grade. Dia inteiro vai para a faixa do topo. Item com horário é cortado no dia (o que
 * atravessa a meia-noite tem um pedaço em cada dia). Sobrepostos formam grupos conectados que dividem a largura, como no
 * Google Agenda: dentro do grupo cada item ocupa a primeira coluna livre. O grupo é achado nos intervalos **mostrados**
 * (com a altura mínima), para um item curto nunca se pintar por cima do vizinho.
 */
export function colunaDoDia(itens: readonly ItemDoCalendario[], data: string, opcoes: OpcoesDaGrade): ColunaDoDia {
  const minima = opcoes.alturaMinima ?? ALTURA_MINIMA_DA_GRADE;
  const totalPx = alturaDaGrade(opcoes.alturaPorHora);
  const inicioDoDia = Date.parse(instanteDeBrasilia(data, '00:00'));
  const fimDoDia = inicioDoDia + MINUTOS_DO_DIA * MS_DO_MINUTO;
  const diaInteiro: ItemDoCalendario[] = [];
  const brutos: Omit<SegmentoNaGrade, 'coluna' | 'colunas' | 'esquerda' | 'largura'>[] = [];
  for (const item of [...itens].sort(compararItensDoCalendario)) {
    if (item.diaInteiro) {
      if (item.data <= data && data <= item.dataFim) diaInteiro.push(item);
      continue;
    }
    const ini = Date.parse(item.inicio);
    const fim = Date.parse(item.fim);
    if (ini >= fimDoDia || fim <= inicioDoDia) continue;
    const minutoInicio = Math.max(0, (ini - inicioDoDia) / MS_DO_MINUTO);
    const minutoFim = Math.min(MINUTOS_DO_DIA, (fim - inicioDoDia) / MS_DO_MINUTO);
    const altura = Math.max(posicaoDoMinuto(minutoFim - minutoInicio, opcoes.alturaPorHora), minima);
    brutos.push({
      chave: `${item.chave}@${data}`, item, data, minutoInicio, minutoFim, altura,
      topo: Math.min(posicaoDoMinuto(minutoInicio, opcoes.alturaPorHora), Math.max(0, totalPx - altura)),
      continuaDeOntem: ini < inicioDoDia, continuaAmanha: fim > fimDoDia,
    });
  }
  brutos.sort((a, b) => a.topo - b.topo || b.altura - a.altura || a.chave.localeCompare(b.chave));
  const segmentos: SegmentoNaGrade[] = [];
  let grupo: SegmentoNaGrade[] = [];
  let colunasOcupadasAte: number[] = [];
  let fimDoGrupo = -Infinity;
  const fecharGrupo = () => {
    for (const s of grupo) {
      s.colunas = colunasOcupadasAte.length;
      s.esquerda = s.coluna / s.colunas;
      s.largura = 1 / s.colunas;
    }
    grupo = [];
    colunasOcupadasAte = [];
    fimDoGrupo = -Infinity;
  };
  for (const bruto of brutos) {
    if (grupo.length > 0 && bruto.topo >= fimDoGrupo) fecharGrupo();
    let coluna = colunasOcupadasAte.findIndex((ate) => ate <= bruto.topo);
    if (coluna < 0) {
      coluna = colunasOcupadasAte.length;
      colunasOcupadasAte.push(0);
    }
    colunasOcupadasAte[coluna] = bruto.topo + bruto.altura;
    fimDoGrupo = Math.max(fimDoGrupo, bruto.topo + bruto.altura);
    const segmento: SegmentoNaGrade = { ...bruto, coluna, colunas: 1, esquerda: 0, largura: 1 };
    grupo.push(segmento);
    segmentos.push(segmento);
  }
  fecharGrupo();
  return { data, diaInteiro, segmentos };
}

/** Uma {@link ColunaDoDia} por dia (a Semana tem 7; o Dia, uma). */
export const colunasDaGrade = (itens: readonly ItemDoCalendario[], dias: readonly string[], opcoes: OpcoesDaGrade): ColunaDoDia[] =>
  dias.map((d) => colunaDoDia(itens, d, opcoes));

/**
 * Minuto em que a grade abre rolada: 07:00, ou uma hora antes do primeiro item com horário se ele for mais cedo. A tela pode
 * preferir a hora de agora quando o dia é hoje.
 */
export function minutoInicialDaGrade(itens: readonly ItemDoCalendario[], dias: readonly string[], padrao = 7 * 60): number {
  let cedo = Infinity;
  for (const d of dias) {
    const inicioDoDia = Date.parse(instanteDeBrasilia(d, '00:00'));
    for (const i of itens) {
      if (i.diaInteiro || i.data > d || i.dataFim < d) continue;
      cedo = Math.min(cedo, Math.max(0, (Date.parse(i.inicio) - inicioDoDia) / MS_DO_MINUTO));
    }
  }
  return Number.isFinite(cedo) ? Math.max(0, Math.min(padrao, cedo - 60)) : padrao;
}
