import type {
  AlunoOcupado, Compromisso, CompromissoDoAluno, CompromissoRequest, DiaDaSemana, EscopoDaSerie, FiltroAlunosOcupados, Repeticao,
  SituacaoCompromisso, TipoDeRepeticao,
} from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import type { TipoSelo } from '../ui/Selo';
import { compararItens, rotuloDoDia } from './agenda';
import { dataSemAnoCorrente } from './datasRelativas';
import { naOrdem } from './filtrosComuns';
import { dataNaFaixa, mensagemDaFaixa } from './datasValidas';
import { dataDaTela, dataParaTela, diaDaSemanaIso, somarDias } from './formatos';

/**
 * Agenda presencial do consultório (compromissos marcados pela equipe com um aluno) e a tela Agenda, que mostra os
 * compromissos junto das atualizações. Regras puras: o "agora" chega por parâmetro.
 *
 * Fuso: tudo em Brasília (America/Sao_Paulo), nunca o fuso do aparelho. O Brasil não tem horário de verão desde 2019,
 * então Brasília é sempre UTC−3 (a mesma conta de `hojeEmBrasilia` do financeiro); a API manda `data`/`hora` já em
 * Brasília e o app só converte o fim (para o compromisso que atravessa a meia-noite).
 */

/**
 * Limites da API (`AgendaDtos`; `agendaPresencialParidade.test.ts` confere as constantes contra o Java). Máximo de alunos
 * num compromisso (D11) e de ocorrências de uma série, a primeira contando (D4/D17).
 */
export const ALUNOS_MAXIMO = 20;
export const OCORRENCIAS_MAXIMO = 52;
export const OCORRENCIAS_MINIMO = 2;
export const LIMITES_COMPROMISSO = {
  duracaoMinima: 5, duracaoMaxima: 480, local: 120, observacao: 500, janelaDias: 62,
  alunos: ALUNOS_MAXIMO, ocorrenciasMinimo: OCORRENCIAS_MINIMO, ocorrenciasMaximo: OCORRENCIAS_MAXIMO,
} as const;
/** Duração sugerida num compromisso novo. */
export const DURACAO_PADRAO = 60;
/** Durações oferecidas como atalho no formulário (o campo aceita qualquer valor de 5 a 480). */
export const DURACOES_SUGERIDAS = [15, 30, 45, 60, 90] as const;

const OFFSET_BRASILIA_MS = -3 * 3600 * 1000;

/** Data civil (AAAA-MM-DD) de Brasília de um instante ISO. */
export function dataEmBrasilia(instante: string | Date): string {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante.getTime();
  return new Date(ms + OFFSET_BRASILIA_MS).toISOString().slice(0, 10);
}

/** Hora (HH:MM) de Brasília de um instante ISO. */
export function horaEmBrasilia(instante: string | Date): string {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante.getTime();
  return new Date(ms + OFFSET_BRASILIA_MS).toISOString().slice(11, 16);
}

/** Hoje em Brasília, qualquer que seja o fuso do aparelho. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return dataEmBrasilia(agora);
}

/** Instante ISO de uma data e hora de Brasília (`2026-11-10`, `23:30` → `2026-11-11T02:30:00.000Z`). */
export function instanteDeBrasilia(data: string, hora: string): string {
  const [a, m, d] = data.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return new Date(Date.UTC(a, m - 1, d, h, min) - OFFSET_BRASILIA_MS).toISOString();
}

// ---- Sobreposição ----

export interface Intervalo { inicio: string; fim: string }

/**
 * Dois intervalos se sobrepõem quando um começa antes de o outro terminar (mesma regra da API): encostar (um termina às
 * 10:00 e o outro começa às 10:00) não é sobrepor.
 */
export function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(a.fim) > Date.parse(b.inicio);
}

/**
 * Aviso antes de salvar: o compromisso já carregado do mesmo responsável, não cancelado e que não é o próprio, que se
 * sobrepõe ao horário escolhido. Só um aviso (a lista na tela pode estar filtrada ou velha): quem decide é a API (409
 * `HORARIO_OCUPADO`).
 */
export function conflitoNaLista(lista: readonly Compromisso[], pedido: { id?: string | null; responsavelId: string; inicio: string; fim: string }): Compromisso | null {
  return lista.find((c) => c.id !== pedido.id && c.responsavelId === pedido.responsavelId && !c.cancelado
    && sobrepoe(c, pedido)) ?? null;
}

// ---- Participantes (vários alunos no mesmo compromisso, D11) ----

const SEM_NOME = 'Aluno';
const nomeDe = (p: { nome: string | null }) => p.nome?.trim() || SEM_NOME;

/**
 * Confere a lista de alunos do compromisso (mesmas regras da API): de 1 a {@link ALUNOS_MAXIMO}, sem repetir. `null` =
 * válida.
 */
export function erroDosParticipantes(alunoIds: readonly string[]): string | null {
  if (alunoIds.length === 0) return 'Escolha ao menos um aluno.';
  if (alunoIds.length > ALUNOS_MAXIMO) return `Escolha até ${ALUNOS_MAXIMO} alunos.`;
  if (new Set(alunoIds).size !== alunoIds.length) return 'Há aluno repetido na lista.';
  return null;
}

/** Quantos alunos ainda cabem no compromisso. */
export const vagasNoCompromisso = (alunoIds: readonly string[]): number => Math.max(0, ALUNOS_MAXIMO - alunoIds.length);

/** Acrescenta o aluno ao fim da lista; quem já está, ou além do máximo, não entra (a lista volta igual). */
export function adicionarParticipante(alunoIds: readonly string[], id: string): string[] {
  if (!id || alunoIds.includes(id) || alunoIds.length >= ALUNOS_MAXIMO) return [...alunoIds];
  return [...alunoIds, id];
}

export const removerParticipante = (alunoIds: readonly string[], id: string): string[] => alunoIds.filter((a) => a !== id);

/** Nomes para o título da linha: "Ana", "Ana e Bruno", "Ana, Bruno +2" (sem nome, "Aluno"). */
export function nomesDosParticipantes(c: Pick<Compromisso, 'participantes'>): string {
  const nomes = c.participantes.map(nomeDe);
  if (nomes.length === 0) return SEM_NOME;
  if (nomes.length <= 2) return nomes.join(' e ');
  return `${nomes[0]}, ${nomes[1]} +${nomes.length - 2}`;
}

/** Todos os nomes, separados por vírgula, sem o "+2": o rótulo que aparece ao passar o mouse ou focar o compromisso. */
export const nomesCompletos = (c: Pick<Compromisso, 'participantes'>): string => (c.participantes.length ? c.participantes.map(nomeDe).join(', ') : SEM_NOME);

/** Os mesmos nomes para o leitor de tela, sem o "+2": "Ana, Bruno e mais 2". */
export function nomesPorExtenso(c: Pick<Compromisso, 'participantes'>): string {
  const nomes = c.participantes.map(nomeDe);
  if (nomes.length <= 2) return nomesDosParticipantes(c);
  return `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;
}

/**
 * A situação do compromisso inteiro, derivada dos participantes: `CANCELADO` só quando o compromisso está cancelado ou
 * todos os participantes estão (a API cancela o compromisso junto com o último); senão, entre os que não cancelaram,
 * `AGENDADO` se algum ainda está agendado, `REALIZADO` se algum foi realizado, `FALTOU` se só houve falta. Sem
 * participantes (não acontece pela API), `AGENDADO`.
 */
export function situacaoDoCompromisso(c: Pick<Compromisso, 'cancelado' | 'participantes'>): SituacaoCompromisso {
  if (c.cancelado) return 'CANCELADO';
  if (c.participantes.length === 0) return 'AGENDADO';
  const ativos = c.participantes.filter((p) => p.situacao !== 'CANCELADO');
  if (ativos.length === 0) return 'CANCELADO';
  if (ativos.some((p) => p.situacao === 'AGENDADO')) return 'AGENDADO';
  if (ativos.some((p) => p.situacao === 'REALIZADO')) return 'REALIZADO';
  return 'FALTOU';
}

const plural = (n: number, singular: string, pluralTexto: string) => `${n} ${n === 1 ? singular : pluralTexto}`;

/**
 * A situação em texto: com um aluno, a dele ("Agendado"); com vários, a contagem ("2 de 3 realizados · 1 faltou");
 * cancelado só quando todos estão cancelados.
 */
export function resumoDosParticipantes(c: Pick<Compromisso, 'cancelado' | 'participantes'>): string {
  const geral = situacaoDoCompromisso(c);
  const total = c.participantes.length;
  if (geral === 'CANCELADO' || total <= 1) return seloDaSituacao(geral).texto;
  const quantos = (s: SituacaoCompromisso) => c.participantes.filter((p) => p.situacao === s).length;
  const partes: string[] = [];
  if (quantos('AGENDADO')) partes.push(plural(quantos('AGENDADO'), 'agendado', 'agendados'));
  if (quantos('REALIZADO')) partes.push(`${quantos('REALIZADO')} de ${total} realizados`);
  if (quantos('FALTOU')) partes.push(quantos('FALTOU') === 1 ? '1 faltou' : `${quantos('FALTOU')} faltaram`);
  if (quantos('CANCELADO')) partes.push(plural(quantos('CANCELADO'), 'cancelado', 'cancelados'));
  return partes.join(' · ');
}

/** O selo da linha do compromisso: texto do {@link resumoDosParticipantes} e cor da situação derivada. */
export function seloDoCompromisso(c: Pick<Compromisso, 'cancelado' | 'participantes'>): { texto: string; tipo: TipoSelo } {
  return { texto: resumoDosParticipantes(c), tipo: seloDaSituacao(situacaoDoCompromisso(c)).tipo };
}

/** "Ocorrência 3 de 10" numa série; `null` no compromisso avulso. */
export function textoDaOcorrencia(c: Pick<Compromisso, 'serieId' | 'ocorrenciaDaSerie' | 'totalDaSerie'>): string | null {
  if (!c.serieId || c.ocorrenciaDaSerie == null || c.totalDaSerie == null) return null;
  return `Ocorrência ${c.ocorrenciaDaSerie} de ${c.totalDaSerie}`;
}

/**
 * Aviso de aluno ocupado (D11), só aviso: "Ana já tem outro compromisso nesse horário." Até 3 nomes; mais que isso,
 * "Ana, Bruno, Carla e mais 2". Sem ninguém, `null`. Nunca diz com quem nem quando é o outro compromisso.
 */
export function textoDeAlunosOcupados(ocupados: readonly Pick<AlunoOcupado, 'nome'>[]): string | null {
  if (ocupados.length === 0) return null;
  const nomes = ocupados.map(nomeDe);
  const quem = nomes.length <= 3
    ? (nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`)
    : `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`;
  return `${quem} ${ocupados.length === 1 ? 'já tem' : 'já têm'} outro compromisso nesse horário. Dá para salvar mesmo assim.`;
}

/**
 * As datas (AAAA-MM-DD, já de Brasília) do 409 `HORARIO_OCUPADO`: o `ErroApi` traz um item `datasEmConflito` por data em
 * `campos`. Não usar `errosPorCampo`: ele guarda um valor só por campo. Outro erro, ou sem datas, devolve vazio.
 */
export function datasEmConflito(erro: unknown): string[] {
  const e = erro as { codigo?: unknown; campos?: unknown } | null;
  if (!e || e.codigo !== 'HORARIO_OCUPADO' || !Array.isArray(e.campos)) return [];
  return e.campos
    .filter((c): c is { field: string; message: string } => !!c && c.field === 'datasEmConflito' && typeof c.message === 'string')
    .map((c) => c.message).sort();
}

const DATAS_NO_TEXTO = 5;

/**
 * Conflito do responsável por data: "O responsável já tem compromisso nesse horário em 05/11." (uma data) ou "… nestas
 * datas: 05/11, 12/11 e 19/11." (o ano só aparece quando não é o corrente). Sem datas, o texto geral. As datas já são
 * civis de Brasília: formatadas direto, sem passar por instante.
 */
export function textoDoConflitoPorData(datas: readonly string[], hoje: string): string {
  const base = 'O responsável já tem compromisso nesse horário';
  if (datas.length === 0) return `${base}. Escolha outro horário.`;
  const mostradas = datas.slice(0, DATAS_NO_TEXTO).map((d) => dataSemAnoCorrente(d, hoje));
  if (datas.length === 1) return `${base} em ${mostradas[0]}. Escolha outro horário.`;
  const resto = datas.length - mostradas.length;
  const lista = resto > 0
    ? `${mostradas.join(', ')} e mais ${resto}`
    : `${mostradas.slice(0, -1).join(', ')} e ${mostradas[mostradas.length - 1]}`;
  return `${base} nestas datas: ${lista}. Escolha outro horário.`;
}

// ---- Série de compromissos (repetição, D4) ----

export const DIAS_DA_SEMANA: readonly DiaDaSemana[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export const OPCOES_DE_DIA_DA_SEMANA: readonly { valor: DiaDaSemana; rotulo: string; completo: string }[] = [
  { valor: 'MONDAY', rotulo: 'Seg', completo: 'Segunda-feira' },
  { valor: 'TUESDAY', rotulo: 'Ter', completo: 'Terça-feira' },
  { valor: 'WEDNESDAY', rotulo: 'Qua', completo: 'Quarta-feira' },
  { valor: 'THURSDAY', rotulo: 'Qui', completo: 'Quinta-feira' },
  { valor: 'FRIDAY', rotulo: 'Sex', completo: 'Sexta-feira' },
  { valor: 'SATURDAY', rotulo: 'Sáb', completo: 'Sábado' },
  { valor: 'SUNDAY', rotulo: 'Dom', completo: 'Domingo' },
];

export const OPCOES_DE_REPETICAO: readonly { valor: TipoDeRepeticao | 'NENHUMA'; rotulo: string }[] = [
  { valor: 'NENHUMA', rotulo: 'Não se repete' },
  { valor: 'DIARIA', rotulo: 'Todo dia' },
  { valor: 'DIAS_UTEIS', rotulo: 'Dias úteis (segunda a sexta)' },
  { valor: 'SEMANAL', rotulo: 'Toda semana' },
  { valor: 'MENSAL', rotulo: 'Todo mês' },
  { valor: 'ANUAL', rotulo: 'Todo ano' },
];

/** Os dias da semana por extenso, curtos, para frases ("segunda, quarta e sexta"). */
export const DIAS_NO_TEXTO: Record<DiaDaSemana, string> = {
  MONDAY: 'segunda', TUESDAY: 'terça', WEDNESDAY: 'quarta', THURSDAY: 'quinta', FRIDAY: 'sexta', SATURDAY: 'sábado', SUNDAY: 'domingo',
};
/** "a", "a e b", "a, b e c". */
export const juntarComE = (itens: readonly string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);

/** Valor especial do seletor de repetição: a tela abre o formulário completo. Não é um tipo da API. */
export const PERSONALIZAR_REPETICAO = 'PERSONALIZAR';
export type ValorDaOpcaoDeRepeticao = TipoDeRepeticao | 'NENHUMA' | typeof PERSONALIZAR_REPETICAO;

const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** A data ISO (AAAA-MM-DD) como ano, mês e dia; `null` se não existir no calendário. */
function partesDaDataIso(iso: string | null): { mes: number; dia: number } | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(ano, mes) ? { mes, dia } : null;
}

/** "quarta-feira", "sábado": o dia por extenso, em minúsculas. */
const diaPorExtenso = (dia: DiaDaSemana) => (OPCOES_DE_DIA_DA_SEMANA.find((o) => o.valor === dia)?.completo ?? '').toLowerCase();

/**
 * As opções do seletor de repetição no estilo Google, para a data do compromisso (AAAA-MM-DD): "Não se repete", "Todos os
 * dias", "Semanal: cada quarta-feira", "Mensal no dia 18", "Anual em 18 de novembro", "Todos os dias da semana (segunda a
 * sexta-feira)" e "Personalizar…". Sem data (ou inválida): "Semanal", "Mensal", "Anual". O mensal é sempre o mesmo dia do
 * mês (`mesmoDiaDoMes`), por isso "no dia N" e não "na terceira quarta-feira". A data da tela chega como DD/MM/AAAA: converta
 * com `dataDaTela` antes.
 */
export function opcoesDaRepeticao(dataIso: string | null): { valor: ValorDaOpcaoDeRepeticao; rotulo: string }[] {
  const data = partesDaDataIso(dataIso);
  const dia = data && dataIso ? diaDaSemanaDaData(dataIso) : null;
  return [
    { valor: 'NENHUMA', rotulo: 'Não se repete' },
    { valor: 'DIARIA', rotulo: 'Todos os dias' },
    { valor: 'SEMANAL', rotulo: dia ? `Semanal: cada ${diaPorExtenso(dia)}` : 'Semanal' },
    { valor: 'MENSAL', rotulo: data ? `Mensal no dia ${data.dia}` : 'Mensal' },
    { valor: 'ANUAL', rotulo: data ? `Anual em ${data.dia} de ${MESES_POR_EXTENSO[data.mes - 1]}` : 'Anual' },
    { valor: 'DIAS_UTEIS', rotulo: 'Todos os dias da semana (segunda a sexta-feira)' },
    { valor: PERSONALIZAR_REPETICAO, rotulo: 'Personalizar…' },
  ];
}

/**
 * O texto do botão "Repetição: …" para o que o formulário tem: o rótulo de {@link opcoesDaRepeticao} e, no semanal, os dias
 * marcados ("Semanal: cada quarta-feira" com um dia; "Semanal: segunda, quarta e sexta" com vários). Serve ao compromisso e
 * ao evento (só usa `tipo` e `dias`).
 */
export function rotuloDaRepeticaoAtual(r: { tipo: TipoDeRepeticao | 'NENHUMA'; dias: readonly DiaDaSemana[] }, dataIso: string | null): string {
  if (r.tipo === 'SEMANAL') {
    const dias = DIAS_DA_SEMANA.filter((d) => r.dias.includes(d));
    if (dias.length === 1) return `Semanal: cada ${diaPorExtenso(dias[0])}`;
    if (dias.length > 1) return `Semanal: ${juntarComE(dias.map((d) => DIAS_NO_TEXTO[d]))}`;
  }
  return opcoesDaRepeticao(dataIso).find((o) => o.valor === r.tipo)?.rotulo ?? '';
}

/** Ajuda do "Dias úteis" (segunda a sexta, sem feriados): vale no compromisso e no evento. */
export const AJUDA_DIAS_UTEIS = 'Feriados não são pulados: cancele só a ocorrência do feriado.';

/** O dia da semana (nome de `DayOfWeek`) de uma data ISO. */
export const diaDaSemanaDaData = (iso: string): DiaDaSemana => DIAS_DA_SEMANA[diaDaSemanaIso(iso) - 1];

export type CampoDaRepeticao = 'tipo' | 'dias' | 'fim' | 'ate' | 'vezes';
export interface ErroDaRepeticao { campo: CampoDaRepeticao; mensagem: string }

export interface PrevisaoDaSerie {
  /** Os dias das ocorrências (AAAA-MM-DD), em ordem, a primeira incluída; vazio quando há erro. */
  datas: string[];
  erro: ErroDaRepeticao | null;
}

const ehFimDeSemana = (iso: string) => diaDaSemanaIso(iso) >= 6;
const doisDigitos = (n: number) => String(n).padStart(2, '0');
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const isoDe = (ano: number, mes: number, dia: number) => `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;

function diaUtilDepoisDe(iso: string): string {
  let proximo = somarDias(iso, 1);
  while (ehFimDeSemana(proximo)) proximo = somarDias(proximo, 1);
  return proximo;
}

function proximoDiaEscolhido(iso: string, dias: ReadonlySet<DiaDaSemana>): string {
  let proximo = somarDias(iso, 1);
  while (!dias.has(diaDaSemanaDaData(proximo))) proximo = somarDias(proximo, 1);
  return proximo;
}

/** O mesmo dia do mês seguinte; o mês que não tem o dia (31, 30, 29/02) é pulado. */
function mesmoDiaDoMes(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  let a = ano;
  let m = mes + 1;
  for (;;) {
    if (m > 12) { m = 1; a += 1; }
    if (dia <= diasNoMes(a, m)) return isoDe(a, m, dia);
    m += 1;
  }
}

/** O mesmo dia e mês no ano seguinte; 29/02 pula para o próximo bissexto. */
function mesmoDiaDoAno(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  let a = ano + 1;
  while (dia > diasNoMes(a, mes)) a += 1;
  return isoDe(a, mes, dia);
}

const erroDaSerie = (campo: CampoDaRepeticao, mensagem: string): PrevisaoDaSerie => ({ datas: [], erro: { campo, mensagem } });

/**
 * Os dias da série, espelho de `RepeticaoDeCompromisso.expandir` da API (a regra é a mesma; quem decide é a API). A
 * primeira ocorrência é `primeira` (AAAA-MM-DD) e conta. O fim é obrigatório e exatamente um de `ate` (depois da primeira
 * data) ou `vezes` (2 a 52); com `ate` que passe de 52 ocorrências a série é recusada, nunca cortada. Semanal precisa dos
 * dias da semana, incluindo o da primeira data; dias úteis não começam no fim de semana; `diasDaSemana` só vale no
 * semanal. Mês sem o dia (31) é pulado e 29/02 só cai em ano bissexto. Sem feriados.
 */
export function previsaoDaSerie(primeira: string, r: Repeticao): PrevisaoDaSerie {
  if (!r.tipo) return erroDaSerie('tipo', 'Escolha como o compromisso se repete.');
  const temAte = !!r.ate;
  const temVezes = r.vezes != null;
  if (temAte === temVezes) return erroDaSerie('fim', 'Informe o fim da repetição: uma data final ou o número de vezes.');
  const vezes = r.vezes ?? 0;
  if (temVezes && (!Number.isInteger(vezes) || vezes < OCORRENCIAS_MINIMO || vezes > OCORRENCIAS_MAXIMO)) {
    return erroDaSerie('vezes', `O número de vezes precisa ser de ${OCORRENCIAS_MINIMO} a ${OCORRENCIAS_MAXIMO}.`);
  }
  const ate = r.ate ?? '';
  if (temAte && ate <= primeira) return erroDaSerie('ate', 'A data final precisa ser depois da data do compromisso.');
  const escolhidos = r.diasDaSemana ?? [];
  if (escolhidos.some((d) => !DIAS_DA_SEMANA.includes(d))) return erroDaSerie('dias', 'Dia da semana inválido.');
  const dias = new Set<DiaDaSemana>(escolhidos);
  if (r.tipo === 'SEMANAL') {
    if (dias.size === 0) return erroDaSerie('dias', 'Escolha os dias da semana.');
    if (!dias.has(diaDaSemanaDaData(primeira))) return erroDaSerie('dias', 'Os dias da semana precisam incluir o dia do compromisso.');
  } else {
    if (r.tipo === 'DIAS_UTEIS' && ehFimDeSemana(primeira)) {
      return erroDaSerie('tipo', 'O compromisso precisa cair de segunda a sexta para repetir nos dias úteis.');
    }
    if (dias.size > 0) return erroDaSerie('dias', 'Os dias da semana só valem para a repetição semanal.');
  }
  // Com data final gera até uma a mais que o máximo, só para saber que passou.
  const limite = temAte ? OCORRENCIAS_MAXIMO + 1 : vezes;
  const datas = [primeira];
  while (datas.length < limite) {
    const ultima = datas[datas.length - 1];
    let proxima: string;
    switch (r.tipo) {
      case 'DIARIA': proxima = somarDias(ultima, 1); break;
      case 'DIAS_UTEIS': proxima = diaUtilDepoisDe(ultima); break;
      case 'SEMANAL': proxima = proximoDiaEscolhido(ultima, dias); break;
      case 'MENSAL': proxima = mesmoDiaDoMes(ultima); break;
      default: proxima = mesmoDiaDoAno(ultima);
    }
    if (temAte && proxima > ate) break;
    datas.push(proxima);
  }
  if (datas.length > OCORRENCIAS_MAXIMO) {
    return erroDaSerie('ate', `A série pode ter no máximo ${OCORRENCIAS_MAXIMO} compromissos. Escolha uma data final mais próxima.`);
  }
  if (datas.length < OCORRENCIAS_MINIMO) {
    return erroDaSerie(temAte ? 'ate' : 'vezes', `A repetição precisa ter pelo menos ${OCORRENCIAS_MINIMO} compromissos.`);
  }
  return { datas, erro: null };
}

/** "6 compromissos, de 05/11 a 10/12" (o ano só aparece quando não é o corrente); com erro, a mensagem. */
export function textoDaPrevisao(p: PrevisaoDaSerie, hoje: string): string {
  if (p.erro) return p.erro.mensagem;
  return `${p.datas.length} compromissos, de ${dataSemAnoCorrente(p.datas[0], hoje)} a ${dataSemAnoCorrente(p.datas[p.datas.length - 1], hoje)}`;
}

export const ROTULOS_DO_ESCOPO: Record<EscopoDaSerie, string> = {
  ESTA: 'Somente este',
  SEGUINTES: 'Este e os seguintes',
  TODAS: 'Todos da série',
};

interface RestricoesDoEscopo {
  /** Editar mudando a data: só em `ESTA` (400 `DATA_SO_NESTA_OCORRENCIA`). */
  mudouData?: boolean;
  /** Situação de um aluno: realizado e falta valem para uma ocorrência só (400 `SITUACAO_SO_NESTA_OCORRENCIA`). */
  situacao?: SituacaoCompromisso;
}

/**
 * Os escopos que a API aceita agora: compromisso avulso, só `ESTA`; numa série, os três, menos nas restrições acima. A API
 * ainda pode responder 409 `SERIE_SEM_OCORRENCIAS` (nenhuma ocorrência a alterar: as que já passaram nunca mudam).
 */
export function escoposPermitidos(c: Pick<Compromisso, 'serieId'>, restricoes: RestricoesDoEscopo = {}): EscopoDaSerie[] {
  if (!c.serieId || restricoes.mudouData || restricoes.situacao === 'REALIZADO' || restricoes.situacao === 'FALTOU') return ['ESTA'];
  return ['ESTA', 'SEGUINTES', 'TODAS'];
}

export const escopoPermitido = (c: Pick<Compromisso, 'serieId'>, escopo: EscopoDaSerie, restricoes: RestricoesDoEscopo = {}): boolean =>
  escoposPermitidos(c, restricoes).includes(escopo);

/**
 * O que cada escopo alcança, para a pergunta "só este, os seguintes ou todos" (mesma regra da API, D4): os que já
 * passaram nunca mudam. `data` é a da ocorrência aberta (AAAA-MM-DD).
 */
export function explicacaoDoEscopo(escopo: EscopoDaSerie, data: string, hoje: string): string {
  if (escopo === 'ESTA') return `Só o compromisso de ${dataSemAnoCorrente(data, hoje)}.`;
  if (escopo === 'SEGUINTES') return `O de ${dataSemAnoCorrente(data, hoje)} e os seguintes da série que ainda não terminaram.`;
  return 'Todos os da série que ainda não começaram. Os que já passaram não mudam.';
}

/** A data do formulário é outra que a do compromisso gravado (numa série, só vale para esta ocorrência). */
export const mudouAData = (f: Pick<FormularioDoCompromisso, 'data'>, c: Pick<Compromisso, 'data'>): boolean => dataDaTela(f.data) !== c.data;

// ---- Visões Dia e Semana ----

export type VisaoDaAgenda = 'dia' | 'semana';
/** A semana é o dia de referência e os 7 seguintes (oito dias, como a agenda das atualizações sempre mostrou). */
export const DIAS_DA_SEMANA_DA_AGENDA = 8;

export function lerVisao(valor: string | null | undefined): VisaoDaAgenda {
  return valor === 'dia' ? 'dia' : 'semana';
}

/** Data de referência do endereço; inválida ou ausente = hoje. */
export function lerDataDeReferencia(valor: string | null | undefined, hoje: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && dataDaTela(dataParaTela(valor)) === valor ? valor : hoje;
}

/** Período pedido à API: o dia, ou o dia e os 7 seguintes. */
export function periodoDaVisao(visao: VisaoDaAgenda, referencia: string): { de: string; ate: string } {
  return { de: referencia, ate: visao === 'dia' ? referencia : somarDias(referencia, DIAS_DA_SEMANA_DA_AGENDA - 1) };
}

/** Anterior/próximo: um dia na visão Dia, sete na Semana (o último dia de uma é o primeiro da seguinte). */
export function deslocarReferencia(visao: VisaoDaAgenda, referencia: string, sentido: 1 | -1): string {
  return somarDias(referencia, sentido * (visao === 'dia' ? 1 : DIAS_DA_SEMANA_DA_AGENDA - 1));
}

/** "Segunda-feira, 03/11" (dia) ou "03/11 a 10/11" (semana). */
export function tituloDoPeriodo(visao: VisaoDaAgenda, referencia: string, hoje: string): string {
  const { de, ate } = periodoDaVisao(visao, referencia);
  if (visao === 'dia') return `${rotuloDoDia(de, hoje)}, ${dataSemAnoCorrente(de, hoje)}`;
  return `${dataSemAnoCorrente(de, hoje)} a ${dataSemAnoCorrente(ate, hoje)}`;
}

/** Datas de Brasília que o compromisso toca: o das 23:30 de 60 minutos aparece no dia e no seguinte. */
export function diasDoCompromisso(c: Pick<Compromisso, 'inicio' | 'fim'>): string[] {
  const primeiro = dataEmBrasilia(c.inicio);
  const ultimo = dataEmBrasilia(new Date(Date.parse(c.fim) - 1));
  const dias = [primeiro];
  while (dias[dias.length - 1] < ultimo) dias.push(somarDias(dias[dias.length - 1], 1));
  return dias;
}

export interface DiaDaAgendaPresencial {
  /** Data civil; `null` no grupo das atualizações sem data. */
  data: string | null;
  titulo: string;
  compromissos: Compromisso[];
  atualizacoes: AtualizacaoDaLista[];
}

/**
 * Os dias do período, todos (dia vazio aparece com a faixa "Nada marcado"), com os compromissos que tocam o dia (por
 * hora de início; o que começou na véspera vem primeiro) e as atualizações que vencem nele (por nome). Atualização sem
 * data só entra quando o período inclui hoje (a lista `PROXIMAS` é de hoje em diante), num grupo no fim.
 */
export function diasDaAgenda(de: string, ate: string, hoje: string, compromissos: readonly Compromisso[],
  atualizacoes: readonly AtualizacaoDaLista[]): DiaDaAgendaPresencial[] {
  const dias = new Map<string, DiaDaAgendaPresencial>();
  for (let data = de; data <= ate; data = somarDias(data, 1)) {
    dias.set(data, { data, titulo: `${rotuloDoDia(data, hoje)}, ${dataSemAnoCorrente(data, hoje)}`, compromissos: [], atualizacoes: [] });
  }
  for (const c of compromissos) {
    for (const data of diasDoCompromisso(c)) dias.get(data)?.compromissos.push(c);
  }
  const semData: AtualizacaoDaLista[] = [];
  for (const a of atualizacoes) {
    const data = a.dataAtualizacao?.slice(0, 10);
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) semData.push(a);
    else dias.get(data)?.atualizacoes.push(a);
  }
  const lista = [...dias.values()];
  for (const dia of lista) {
    dia.compromissos.sort((x, y) => Date.parse(x.inicio) - Date.parse(y.inicio) || x.id.localeCompare(y.id));
    dia.atualizacoes.sort(compararItens);
  }
  if (semData.length && de <= hoje && hoje <= ate) {
    lista.push({ data: null, titulo: 'Sem data', compromissos: [], atualizacoes: semData.sort(compararItens) });
  }
  return lista;
}

/** Resumo na faixa do dia: "Nada marcado", "1 compromisso", "2 compromissos · 1 atualização". */
export function resumoDoDia(compromissos: number, atualizacoes: number, eventos = 0): string {
  const partes: string[] = [];
  if (compromissos > 0) partes.push(`${compromissos} ${compromissos === 1 ? 'compromisso' : 'compromissos'}`);
  if (eventos > 0) partes.push(`${eventos} ${eventos === 1 ? 'evento' : 'eventos'}`);
  if (atualizacoes > 0) partes.push(`${atualizacoes} ${atualizacoes === 1 ? 'atualização' : 'atualizações'}`);
  return partes.length ? partes.join(' · ') : 'Nada marcado';
}

// ---- Textos ----

const SITUACOES: Record<SituacaoCompromisso, { texto: string; tipo: TipoSelo }> = {
  AGENDADO: { texto: 'Agendado', tipo: 'atencao' },
  REALIZADO: { texto: 'Realizado', tipo: 'sucesso' },
  FALTOU: { texto: 'Faltou', tipo: 'perigo' },
  CANCELADO: { texto: 'Cancelado', tipo: 'neutro' },
};

/** Selo da situação (status sempre com texto; nunca a cor da marca). */
export function seloDaSituacao(situacao: SituacaoCompromisso): { texto: string; tipo: TipoSelo } {
  return SITUACOES[situacao] ?? { texto: situacao, tipo: 'neutro' };
}

/** As situações do filtro, na ordem fixa da tela. Nada marcado = todas (padrão da `SelecaoMultiplaSuspensa`). */
export const OPCOES_SITUACAO: { valor: SituacaoCompromisso; rotulo: string }[] = [
  { valor: 'AGENDADO', rotulo: 'Agendados' },
  { valor: 'REALIZADO', rotulo: 'Realizados' },
  { valor: 'FALTOU', rotulo: 'Faltas' },
  { valor: 'CANCELADO', rotulo: 'Cancelados' },
];

/**
 * Lê `?situacao=AGENDADO,FALTOU` (vírgula; o Expo Router também entrega `situacao` repetida como lista). Valor desconhecido e
 * repetido é ignorado e o resultado sai na ordem de {@link OPCOES_SITUACAO}; vazio = todas.
 */
export function lerSituacoes(param: string | string[] | undefined): SituacaoCompromisso[] {
  const partes = (Array.isArray(param) ? param : param ? [param] : []).flatMap((p) => p.split(',')).map((p) => p.trim());
  return naOrdem(new Set(partes), OPCOES_SITUACAO);
}

/** O inverso de {@link lerSituacoes}, na ordem fixa: `AGENDADO,FALTOU`; lista vazia = `undefined` (sem parâmetro). */
export function parametroDasSituacoes(situacoes: readonly SituacaoCompromisso[]): string | undefined {
  const marcadas = naOrdem(new Set<string>(situacoes), OPCOES_SITUACAO);
  return marcadas.length ? marcadas.join(',') : undefined;
}

/** "09:00–10:00", ou "23:30–00:30 (termina no dia seguinte)" quando atravessa a meia-noite. */
export function textoDoHorario(c: Pick<Compromisso, 'inicio' | 'fim' | 'hora' | 'horaFim'>): string {
  const vira = dataEmBrasilia(c.inicio) !== dataEmBrasilia(new Date(Date.parse(c.fim) - 1));
  return `${c.hora}–${c.horaFim}${vira ? ' (termina no dia seguinte)' : ''}`;
}

/** "1 h 30 min", "45 min", "2 h". */
export function textoDaDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---- Início e fim (estilo Google Agenda) ----
//
// O formulário continua guardando `hora` + `duracao` (o contrato com a API não muda); o fim é sempre derivado deles. O
// compromisso e o evento podem atravessar a meia-noite (ver `textoDoHorario` e o cabeçalho do arquivo), então o fim "volta"
// no relógio: 23:30 + 1 h = 00:30 do dia seguinte. Quem barra o excesso é o máximo de duração do tipo
// (`LIMITES_COMPROMISSO` ou `LIMITES_DO_EVENTO`), nunca as 23:59.

const MINUTOS_NO_DIA = 24 * 60;
/** De quanto em quanto tempo o Google oferece início e fim. */
export const PASSO_DO_HORARIO = 15;

/** `{ duracaoMinima, duracaoMaxima }` de `LIMITES_COMPROMISSO` ou de `LIMITES_DO_EVENTO`. */
export interface LimitesDeDuracao { duracaoMinima: number; duracaoMaxima: number }

/** "09:30" → 570; `null` se não for uma hora válida (00:00 a 23:59). */
export function minutosDaHora(hora: string): number | null {
  if (!horaValida(hora)) return null;
  const [h, m] = hora.trim().split(':').map(Number);
  return h * 60 + m;
}

/** 570 → "09:30". Passou de 24 h, volta ao relógio (1470 → "00:30"). */
export function horaDosMinutos(minutos: number): string {
  const n = ((Math.round(minutos) % MINUTOS_NO_DIA) + MINUTOS_NO_DIA) % MINUTOS_NO_DIA;
  return `${doisDigitos(Math.floor(n / 60))}:${doisDigitos(n % 60)}`;
}

/** A duração do formulário (texto de inteiros) ou número inteiro positivo; senão `null`. */
function minutosDeDuracao(duracao: string | number): number | null {
  const n = typeof duracao === 'number' ? duracao : /^\d+$/.test(duracao.trim()) ? Number(duracao.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Hora do fim (HH:MM) de um início e uma duração; passou da meia-noite, é a hora do dia seguinte. `null` se a entrada é inválida. */
export function fimDaHora(hora: string, duracao: string | number): string | null {
  const inicio = minutosDaHora(hora);
  const minutos = minutosDeDuracao(duracao);
  return inicio === null || minutos === null ? null : horaDosMinutos(inicio + minutos);
}

/** O fim cai no dia seguinte? Terminar à meia-noite em ponto ainda é o mesmo dia (como em {@link textoDoHorario}). */
export function terminaNoDiaSeguinte(hora: string, duracao: string | number): boolean {
  const inicio = minutosDaHora(hora);
  const minutos = minutosDeDuracao(duracao);
  return inicio !== null && minutos !== null && inicio + minutos > MINUTOS_NO_DIA;
}

/**
 * Minutos entre o início e o fim digitados (HH:MM). Fim antes do início conta como o dia seguinte (23:30 → 00:30 = 60);
 * hora inválida é `null` (o máximo de duração do tipo barra o que passar de lá: ver {@link erroDoFim}). Fim igual ao início
 * são 24 h só quando o tipo aceita 24 h (`duracaoMaxima` de 1440, o evento); senão (o compromisso, ou sem limite) é `null`.
 */
export function duracaoEntre(inicio: string, fim: string, duracaoMaxima?: number): number | null {
  const a = minutosDaHora(inicio);
  const b = minutosDaHora(fim);
  if (a === null || b === null) return null;
  if (a === b) return duracaoMaxima !== undefined && duracaoMaxima >= MINUTOS_NO_DIA ? MINUTOS_NO_DIA : null;
  return b > a ? b - a : b + MINUTOS_NO_DIA - a;
}

/** Os inícios de 15 em 15 min, de 00:00 a 23:45. `atual` fora dessa grade (hora digitada ou compromisso antigo) entra no seu lugar. */
export function opcoesDoInicio(atual?: string): { valor: string; rotulo: string }[] {
  const horas: string[] = [];
  for (let m = 0; m < MINUTOS_NO_DIA; m += PASSO_DO_HORARIO) horas.push(horaDosMinutos(m));
  const minutosAtual = atual === undefined ? null : minutosDaHora(atual);
  if (minutosAtual !== null && !horas.includes(horaDosMinutos(minutosAtual))) {
    horas.push(horaDosMinutos(minutosAtual));
    horas.sort();
  }
  return horas.map((h) => ({ valor: h, rotulo: h }));
}

export interface OpcaoDoFim {
  /** A duração em minutos, como texto: é o que o formulário guarda em `duracao` (e não ambígua quando o fim é no dia seguinte). */
  valor: string;
  /** "17:30 (1 h)", "00:30 (1 h, dia seguinte)". */
  rotulo: string;
  /** A hora do fim (HH:MM). */
  fim: string;
  diaSeguinte: boolean;
}

/**
 * Os fins possíveis para um início: de início + 15 min até o máximo de duração do tipo, de 15 em 15 min, com a duração no
 * rótulo ("17:30 (1 h)", "18:00 (1 h 30 min)"). `duracaoAtual` fora da grade (ex.: 50 min de um compromisso antigo) e dentro
 * dos limites entra no seu lugar. Início inválido = lista vazia.
 */
export function opcoesDoFim(inicio: string, limites: LimitesDeDuracao, duracaoAtual?: string | number): OpcaoDoFim[] {
  if (minutosDaHora(inicio) === null) return [];
  const duracoes: number[] = [];
  for (let d = PASSO_DO_HORARIO; d <= limites.duracaoMaxima; d += PASSO_DO_HORARIO) if (d >= limites.duracaoMinima) duracoes.push(d);
  const atual = duracaoAtual === undefined ? null : minutosDeDuracao(duracaoAtual);
  if (atual !== null && atual >= limites.duracaoMinima && atual <= limites.duracaoMaxima && !duracoes.includes(atual)) {
    duracoes.push(atual);
    duracoes.sort((x, y) => x - y);
  }
  return duracoes.map((d) => opcaoDoFim(inicio, d));
}

/** A opção do fim para um início válido e uma duração: "17:30 (1 h)", "00:30 (1 h, dia seguinte)". */
function opcaoDoFim(inicio: string, duracao: number): OpcaoDoFim {
  const fim = horaDosMinutos((minutosDaHora(inicio) ?? 0) + duracao);
  const diaSeguinte = terminaNoDiaSeguinte(inicio, duracao);
  return { valor: String(duracao), rotulo: `${fim} (${textoDaDuracao(duracao)}${diaSeguinte ? ', dia seguinte' : ''})`, fim, diaSeguinte };
}

/**
 * A hora digitada na busca das listas de início e fim: "0910" e "910" (pela {@link mascaraHora}), "09:10", "9:10", "9h10"
 * e "9.10" viram "09:10". Incompleta, inválida (25:00, 09:60) ou com outra coisa = `null`.
 */
export function horaDigitada(texto: string): string | null {
  const t = texto.trim();
  const separada = /^(\d{1,2})\s*[:hH.]\s*(\d{2})$/.exec(t);
  const hora = separada ? `${separada[1].padStart(2, '0')}:${separada[2]}` : /^\d{3,4}$/.test(t) ? mascaraHora(t.padStart(4, '0')) : null;
  return hora !== null && minutosDaHora(hora) !== null ? hora : null;
}

/** O que a busca da lista oferece para o que foi digitado: a opção, um aviso de por que não vale ou nada (texto que não é hora). */
export type OpcaoDigitada<O> = { opcao: O } | { aviso: string } | null;

/** Início digitado fora da grade de 15 min ("09:10"): vira uma opção da lista. Qualquer minuto vale. */
export function opcaoDigitadaDoInicio(texto: string): OpcaoDigitada<{ valor: string; rotulo: string }> {
  const hora = horaDigitada(texto);
  return hora === null ? null : { opcao: { valor: hora, rotulo: hora } };
}

/**
 * Fim digitado ("09:30" com início 09:10): a opção com a duração no valor, como as da lista ("09:30 (20 min)"), ou o aviso de
 * {@link erroDoFim} (antes do início não existe: passa da meia-noite e termina no dia seguinte; fora dos limites do tipo, o
 * aviso diz o mínimo ou o máximo). Sem início válido = `null` (a lista do fim nem aparece).
 */
export function opcaoDigitadaDoFim(inicio: string, texto: string, limites: LimitesDeDuracao): OpcaoDigitada<OpcaoDoFim> {
  const hora = horaDigitada(texto);
  if (hora === null || minutosDaHora(inicio) === null) return null;
  const erro = erroDoFim(inicio, hora, limites);
  const duracao = duracaoEntre(inicio, hora, limites.duracaoMaxima);
  return erro || duracao === null ? { aviso: erro ?? 'O fim precisa ser depois do início.' } : { opcao: opcaoDoFim(inicio, duracao) };
}

/**
 * Mudar o início: o fim acompanha, porque a duração se mantém (o fim é derivado de `hora` + `duracao`). Nada é encurtado: o
 * que passa da meia-noite termina no dia seguinte, como a API já aceita.
 */
export function inicioMudou<F extends { hora: string; duracao: string }>(form: F, novaHora: string): F {
  return { ...form, hora: novaHora };
}

/**
 * Erro do par início–fim digitado (HH:MM), em texto curto, ou `null`. Início inválido não é problema do fim (o campo do início
 * tem o seu). Fim igual ao início (menos no tipo que aceita 24 h, o evento), duração abaixo do mínimo e acima do máximo do tipo.
 */
export function erroDoFim(inicio: string, fim: string, limites: LimitesDeDuracao): string | null {
  if (minutosDaHora(inicio) === null) return null;
  if (minutosDaHora(fim) === null) return 'Use HH:MM, de 00:00 a 23:59.';
  const minutos = duracaoEntre(inicio, fim, limites.duracaoMaxima);
  if (minutos === null) return 'O fim precisa ser depois do início.';
  if (minutos < limites.duracaoMinima) return `A duração mínima é ${textoDaDuracao(limites.duracaoMinima)}.`;
  if (minutos > limites.duracaoMaxima) return `A duração máxima é ${textoDaDuracao(limites.duracaoMaxima)}.`;
  return null;
}

/** Linha de metadados na agenda: "Compromisso · 09:00–10:00 · Sala 2 · com Ana" e, numa série, "· Ocorrência 3 de 10". */
export function metadadosDoCompromisso(c: Compromisso): string {
  const partes = ['Compromisso', textoDoHorario(c)];
  if (c.local) partes.push(c.local);
  if (c.responsavelNome) partes.push(`com ${c.responsavelNome}`);
  const ocorrencia = textoDaOcorrencia(c);
  if (ocorrencia) partes.push(ocorrencia);
  return partes.join(' · ');
}

/** Para o aluno: "Terça-feira, 04/11 · 09:00–10:00" e, abaixo, "Sala 2 · com Ana" (sem o que não existe). */
export function textosDoCompromissoDoAluno(c: CompromissoDoAluno, hoje: string): { titulo: string; detalhe: string | null } {
  const titulo = `${rotuloDoDia(c.data, hoje)}, ${dataSemAnoCorrente(c.data, hoje)} · ${textoDoHorario(c)}`;
  const partes = [c.local, c.responsavelNome ? `com ${c.responsavelNome}` : null].filter((p): p is string => !!p);
  return { titulo, detalhe: partes.length ? partes.join(' · ') : null };
}

// ---- Ações sobre a situação ----

export interface AcaoDeSituacao {
  situacao: SituacaoCompromisso;
  rotulo: string;
  /** Desabilitada, com o porquê (vai ao `motivo` do botão). */
  motivo?: string;
  /** Pede confirmação (cancelar). */
  confirmar?: boolean;
  perigo?: boolean;
  /** Rótulo para o leitor de tela, com o nome do aluno. */
  rotuloAcessivel?: string;
}

interface OpcoesDasAcoes {
  /** Nome do aluno, para o rótulo lido pelo leitor de tela ("Marcar realizado: Ana"). */
  nome?: string | null;
  /**
   * Único participante: cancelar e reabrir a participação dele é o mesmo que cancelar e reabrir o compromisso inteiro,
   * então essas duas ficam só com a ação do compromisso ({@link acaoDeCancelamento}), sem botão repetido.
   */
  sozinho?: boolean;
  /** O compromisso inteiro está cancelado: nada por aluno; só "Reabrir compromisso". */
  cancelado?: boolean;
}

/**
 * O que dá para fazer com um aluno do compromisso agora (`situacao` é a dele; mesmas regras da API): realizado e falta
 * só depois do início; cancelar a participação só de quem está agendado; o que não está agendado pode voltar a agendado
 * (o cancelado volta a ocupar o horário e a API confere o conflito de novo). Os rótulos falam da participação, nunca do
 * "compromisso": cancelar um aluno não cancela os outros.
 */
export function acoesDeSituacao(c: { situacao: SituacaoCompromisso; inicio: string }, agora: Date = new Date(),
  opcoes: OpcoesDasAcoes = {}): AcaoDeSituacao[] {
  if (opcoes.cancelado) return [];
  const comecou = Date.parse(c.inicio) <= agora.getTime();
  const antes = comecou ? undefined : 'Disponível depois do horário do compromisso.';
  const acoes: AcaoDeSituacao[] = [];
  if (c.situacao !== 'REALIZADO' && c.situacao !== 'CANCELADO') acoes.push({ situacao: 'REALIZADO', rotulo: 'Marcar realizado', motivo: antes });
  if (c.situacao !== 'FALTOU' && c.situacao !== 'CANCELADO') acoes.push({ situacao: 'FALTOU', rotulo: 'Marcar falta', motivo: antes });
  if (c.situacao === 'AGENDADO') {
    if (!opcoes.sozinho) acoes.push({ situacao: 'CANCELADO', rotulo: 'Cancelar participação', confirmar: true, perigo: true });
  } else if (c.situacao === 'CANCELADO') {
    if (!opcoes.sozinho) acoes.push({ situacao: 'AGENDADO', rotulo: 'Reabrir participação' });
  } else acoes.push({ situacao: 'AGENDADO', rotulo: 'Voltar para agendado' });
  const nome = opcoes.nome?.trim();
  return nome ? acoes.map((a) => ({ ...a, rotuloAcessivel: `${a.rotulo}: ${nome}` })) : acoes;
}

/**
 * Cancelar o compromisso inteiro (todos os participantes) ou reabri-lo; o cancelamento pede confirmação. Com vários
 * alunos o rótulo diz "inteiro", para não se confundir com cancelar a participação de um.
 */
export function acaoDeCancelamento(c: Pick<Compromisso, 'cancelado'> & { participantes?: readonly unknown[] }):
  { cancelado: boolean; rotulo: string; confirmar: boolean; perigo: boolean } {
  if (c.cancelado) return { cancelado: false, rotulo: 'Reabrir compromisso', confirmar: false, perigo: false };
  return { cancelado: true, rotulo: (c.participantes?.length ?? 0) > 1 ? 'Cancelar compromisso inteiro' : 'Cancelar compromisso', confirmar: true, perigo: true };
}

/**
 * Quem recebe o aviso de cancelamento ao cancelar o compromisso inteiro (D12): os participantes que ainda não estavam
 * cancelados; nenhum se o compromisso já terminou (a API não avisa compromisso terminado).
 */
export function avisadosAoCancelar(c: Pick<Compromisso, 'participantes' | 'fim'>, agora: Date = new Date()): number {
  if (Date.parse(c.fim) <= agora.getTime()) return 0;
  return c.participantes.filter((p) => p.situacao !== 'CANCELADO').length;
}

/** Texto da confirmação de cancelar o compromisso inteiro: quantos alunos serão avisados e que o horário fica livre. */
export function textoDoCancelamentoInteiro(c: Pick<Compromisso, 'participantes' | 'fim'>, agora: Date = new Date()): string {
  const avisados = avisadosAoCancelar(c, agora);
  const aviso = avisados === 0 ? 'Nenhum aluno recebe aviso.'
    : avisados === 1 ? '1 aluno recebe o aviso do cancelamento.' : `${avisados} alunos recebem o aviso do cancelamento.`;
  return `Todos os alunos deste compromisso ficam cancelados. ${aviso} O horário do responsável fica livre.`;
}

/** Confirmação de cancelar só a participação de um aluno: ele sai, os outros continuam; avisado só se ainda não terminou. */
export function textoDoCancelamentoDoAluno(nome: string | null, c: Pick<Compromisso, 'fim'>, agora: Date = new Date()): string {
  const quem = nome?.trim() || SEM_NOME;
  const avisa = Date.parse(c.fim) > agora.getTime();
  return `${quem} deixa de participar${avisa ? ' e recebe o aviso do cancelamento' : ''}. Os outros alunos continuam marcados.`;
}

/**
 * Texto próprio da agenda para um erro da API ao salvar ou mudar a situação; `null` = mostrar a mensagem da API. O 409
 * `HORARIO_OCUPADO` lista as datas que conflitam ({@link textoDoConflitoPorData}); `CONFLITO_EDICAO` pede para reabrir.
 */
export function textoDoErroDaAgenda(erro: unknown, hoje: string): string | null {
  const codigo = (erro as { codigo?: unknown } | null)?.codigo;
  if (codigo === 'HORARIO_OCUPADO') return textoDoConflitoPorData(datasEmConflito(erro), hoje);
  if (codigo === 'CONFLITO_EDICAO') return 'Outra pessoa alterou este compromisso. Feche e abra de novo para ver a versão atual.';
  return null;
}

/**
 * O filtro do aviso de aluno ocupado (D11), só com o que dá para conferir: alunos escolhidos, data, hora e duração
 * válidas. Senão `null` (a API nunca é chamada com a lista vazia). `ignorar` é o próprio compromisso, ao remarcar.
 */
export function filtroDeAlunosOcupados(f: Pick<FormularioDoCompromisso, 'alunoIds' | 'data' | 'hora' | 'duracao'>, ignorar?: string | null):
  FiltroAlunosOcupados | null {
  if (f.alunoIds.length === 0) return null;
  const data = dataDaTela(f.data);
  const hora = f.hora.trim();
  const duracao = /^\d+$/.test(f.duracao.trim()) ? Number(f.duracao.trim()) : NaN;
  if (!data || !horaValida(hora) || !(duracao >= LIMITES_COMPROMISSO.duracaoMinima && duracao <= LIMITES_COMPROMISSO.duracaoMaxima)) return null;
  return { data, hora, duracaoMinutos: duracao, alunoIds: [...f.alunoIds], ...(ignorar ? { ignorar } : {}) };
}

// ---- Formulário ----

/** A repetição como o formulário a guarda (texto digitado); `NENHUMA` = não se repete. */
export interface FormularioDaRepeticao {
  tipo: TipoDeRepeticao | 'NENHUMA';
  /** Só no semanal. */
  dias: DiaDaSemana[];
  /** O fim é obrigatório: numa data ou depois de N vezes (nunca "sem fim"). */
  fim: 'DATA' | 'VEZES';
  /** DD/MM/AAAA, quando `fim` é `DATA`. */
  ate: string;
  /** Quando `fim` é `VEZES`. */
  vezes: string;
}

export const SEM_REPETICAO: FormularioDaRepeticao = { tipo: 'NENHUMA', dias: [], fim: 'VEZES', ate: '', vezes: '' };

/**
 * Trocar o tipo da repetição: "Toda semana" já nasce com o dia da semana da data do compromisso marcado (a API exige que
 * ele esteja entre os dias); os outros tipos não guardam dias.
 */
export function trocarTipoDaRepeticao(r: FormularioDaRepeticao, tipo: FormularioDaRepeticao['tipo'], dataDoFormulario: string): FormularioDaRepeticao {
  if (tipo !== 'SEMANAL') return { ...r, tipo, dias: [] };
  const data = dataDaTela(dataDoFormulario);
  return { ...r, tipo, dias: r.dias.length ? r.dias : data ? [diaDaSemanaDaData(data)] : [] };
}

/** Marca ou desmarca um dia da semana, mantendo a ordem de segunda a domingo. */
export function alternarDiaDaRepeticao(dias: readonly DiaDaSemana[], dia: DiaDaSemana): DiaDaSemana[] {
  const conjunto = new Set(dias);
  if (conjunto.has(dia)) conjunto.delete(dia);
  else conjunto.add(dia);
  return DIAS_DA_SEMANA.filter((d) => conjunto.has(d));
}

export interface FormularioDoCompromisso {
  /** Os participantes, na ordem em que foram escolhidos (1 a 20, sem repetir). */
  alunoIds: string[];
  responsavelId: string;
  /** DD/MM/AAAA, como no `CampoData`. */
  data: string;
  /** HH:MM digitado. */
  hora: string;
  duracao: string;
  local: string;
  observacao: string;
  /** Só vale ao marcar um compromisso novo. */
  repeticao: FormularioDaRepeticao;
}

export type ErrosDoCompromisso = Partial<Record<keyof FormularioDoCompromisso, string>>;
export type ErrosDaRepeticao = Partial<Record<CampoDaRepeticao, string>>;

export function formularioNovo(responsavelId: string, data: string): FormularioDoCompromisso {
  return {
    alunoIds: [], responsavelId, data: dataParaTela(data), hora: '', duracao: String(DURACAO_PADRAO), local: '', observacao: '',
    repeticao: { ...SEM_REPETICAO, dias: [] },
  };
}

export function formularioDoCompromisso(c: Compromisso): FormularioDoCompromisso {
  return {
    alunoIds: c.participantes.map((p) => p.id), responsavelId: c.responsavelId ?? '', data: dataParaTela(c.data), hora: c.hora,
    duracao: String(c.duracaoMinutos), local: c.local ?? '', observacao: c.observacao ?? '', repeticao: { ...SEM_REPETICAO, dias: [] },
  };
}

/** Máscara da hora enquanto digita: só dígitos, "0930" → "09:30", até 5 caracteres. */
export function mascaraHora(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

/** "09:30" válida (00:00 a 23:59)? */
export function horaValida(texto: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(texto.trim());
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/**
 * A repetição do formulário em `Repeticao`, conferida com {@link previsaoDaSerie} (a regra da API). `primeira` é a data do
 * compromisso (AAAA-MM-DD); sem ela só confere o que dá. `NENHUMA` devolve `repeticao: null` e a previsão vazia.
 */
export function repeticaoDoFormulario(f: FormularioDaRepeticao, primeira: string | null):
  { erros: ErrosDaRepeticao; repeticao: Repeticao | null; previsao: PrevisaoDaSerie | null } {
  if (f.tipo === 'NENHUMA') return { erros: {}, repeticao: null, previsao: null };
  const erros: ErrosDaRepeticao = {};
  const repeticao: Repeticao = { tipo: f.tipo };
  if (f.tipo === 'SEMANAL') repeticao.diasDaSemana = DIAS_DA_SEMANA.filter((d) => f.dias.includes(d));
  if (f.fim === 'DATA') {
    const ate = dataDaTela(f.ate);
    if (ate && !dataNaFaixa(ate, 'PLANEJAMENTO')) erros.ate = mensagemDaFaixa('Última data da repetição', 'PLANEJAMENTO');
    else if (ate) repeticao.ate = ate;
    else erros.ate = ate === null ? 'Informe a data final.' : 'Data final inválida.';
  } else {
    const texto = f.vezes.trim();
    const vezes = /^\d+$/.test(texto) ? Number(texto) : NaN;
    if (Number.isInteger(vezes)) repeticao.vezes = vezes;
    else erros.vezes = texto ? 'Use só números.' : 'Informe quantas vezes.';
  }
  if (Object.keys(erros).length) return { erros, repeticao: null, previsao: null };
  if (!primeira) return { erros, repeticao: null, previsao: null };
  const previsao = previsaoDaSerie(primeira, repeticao);
  if (previsao.erro) return { erros: { [previsao.erro.campo]: previsao.erro.mensagem }, repeticao: null, previsao };
  return { erros, repeticao, previsao };
}

/**
 * Confere o formulário e monta o pedido. `comObservacao`: só quem grava dado sensível manda a observação (sem a
 * permissão a API ignoraria; aqui ela nem vai). `versao` presente = remarcar (PUT): a repetição não vai (a API recusa);
 * ausente = marcar, e a repetição escolhida vai no pedido.
 */
export function pedidoDoFormulario(f: FormularioDoCompromisso, comObservacao: boolean, versao?: number):
  { erros: ErrosDoCompromisso; errosDaRepeticao: ErrosDaRepeticao; pedido: CompromissoRequest | null } {
  const erros: ErrosDoCompromisso = {};
  const erroDosAlunos = erroDosParticipantes(f.alunoIds);
  if (erroDosAlunos) erros.alunoIds = erroDosAlunos;
  if (!f.responsavelId) erros.responsavelId = 'Escolha o responsável.';
  const data = dataDaTela(f.data);
  if (!data) erros.data = data === null ? 'Informe a data.' : 'Data inválida.';
  else if (!dataNaFaixa(data, 'PLANEJAMENTO')) erros.data = mensagemDaFaixa('Data do compromisso', 'PLANEJAMENTO');
  const hora = f.hora.trim();
  if (!hora) erros.hora = 'Informe a hora.';
  else if (!horaValida(hora)) erros.hora = 'Use HH:MM, de 00:00 a 23:59.';
  const duracao = /^\d+$/.test(f.duracao.trim()) ? Number(f.duracao.trim()) : NaN;
  if (!Number.isInteger(duracao) || duracao < LIMITES_COMPROMISSO.duracaoMinima || duracao > LIMITES_COMPROMISSO.duracaoMaxima) {
    erros.duracao = `De ${LIMITES_COMPROMISSO.duracaoMinima} a ${LIMITES_COMPROMISSO.duracaoMaxima} minutos.`;
  }
  const local = f.local.trim();
  if (local.length > LIMITES_COMPROMISSO.local) erros.local = `Use até ${LIMITES_COMPROMISSO.local} caracteres.`;
  const observacao = f.observacao.trim();
  if (comObservacao && observacao.length > LIMITES_COMPROMISSO.observacao) {
    erros.observacao = `Use até ${LIMITES_COMPROMISSO.observacao} caracteres.`;
  }
  const marcando = versao === undefined;
  const serie = marcando ? repeticaoDoFormulario(f.repeticao, data || null) : null;
  const errosDaRepeticao = serie?.erros ?? {};
  if (Object.keys(errosDaRepeticao).length) erros.repeticao = 'Confira a repetição.';
  if (Object.keys(erros).length || !data) return { erros, errosDaRepeticao, pedido: null };
  return {
    erros,
    errosDaRepeticao,
    pedido: {
      alunoIds: [...f.alunoIds], responsavelId: f.responsavelId, data, hora, duracaoMinutos: duracao,
      local: local || null, observacao: comObservacao ? observacao || null : null,
      ...(marcando ? (serie?.repeticao ? { repeticao: serie.repeticao } : {}) : { versao }),
    },
  };
}

/** Intervalo do pedido (para o aviso de conflito antes de salvar). */
export function intervaloDoPedido(p: Pick<CompromissoRequest, 'data' | 'hora' | 'duracaoMinutos'>): Intervalo {
  const inicio = instanteDeBrasilia(p.data, p.hora);
  return { inicio, fim: new Date(Date.parse(inicio) + p.duracaoMinutos * 60_000).toISOString() };
}
