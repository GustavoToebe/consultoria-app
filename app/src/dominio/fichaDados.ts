import type { PeriodoDoPlano, SituacaoDaContratacao } from '../api/financeiroTipos';
import type { AlunoDetalhe, Lesao, SituacaoLesao } from '../api/tipos';
import { dataEmBrasilia, hojeEmBrasilia, horaEmBrasilia } from './agendaPresencial';
import { dataRelativa } from './datasRelativas';
import { dataParaTela, SEM_DADO } from './formatos';

/**
 * Regras da aba Ficha do aluno › Dados (23/11, `docs/planos/ficha-do-aluno-dados.md`): último login, vigência e valor do
 * plano contratado, as últimas cobranças e a ordem, o período e a contagem das lesões. Sem React e sem relógio escondido:
 * o "hoje" vem por argumento (padrão, Brasília) ou da própria API (`diasRestantesVigencia`).
 */

// ---- Acesso ao app ----

/**
 * "Último login: há 2 dias" (texto curto) e a data exata em Brasília (dica do mouse e nome acessível). Login nunca é
 * chamado de acesso (AGENTS.md, cabeçalho da ficha): `LOGIN` diz "Último login" e só `ACESSO` diz "Último acesso ao app".
 * Instante malformado ou tipo desconhecido = `null` (a linha some).
 */
export function ultimoAcessoNaFicha(u: AlunoDetalhe['ultimoAcesso'], agora: Date = new Date()): { texto: string; exata: string } | null {
  if (!u?.em || Number.isNaN(Date.parse(u.em))) return null;
  const rotulo = u.tipo === 'LOGIN' ? 'Último login' : u.tipo === 'ACESSO' ? 'Último acesso ao app' : null;
  if (!rotulo) return null;
  const dia = dataEmBrasilia(u.em);
  return { texto: `${rotulo}: ${dataRelativa(dia, hojeEmBrasilia(agora))}`, exata: `${dataParaTela(dia)} às ${horaEmBrasilia(u.em)}` };
}

// ---- Plano contratado ----

const POR_PERIODO: Record<PeriodoDoPlano, string> = {
  MENSAL: 'por mês', TRIMESTRAL: 'por trimestre', SEMESTRAL: 'por semestre', ANUAL: 'por ano', PARCELA_UNICA: 'em parcela única',
};

/** O que acompanha o valor em destaque ("R$ 997,00 por trimestre"). Parcela única não é "por" nada. */
export const valorPorPeriodo = (p: PeriodoDoPlano | null | undefined): string | null => (p ? POR_PERIODO[p] ?? null : null);

/** "Periodicidade: Trimestral" some quando o nome do plano já é a periodicidade ("Trimestral"), sem diferença de caixa. */
export function repeteAPeriodicidade(planoNome: string | null | undefined, rotuloDaPeriodicidade: string): boolean {
  const normal = (t: string) => t.trim().toLocaleLowerCase('pt-BR');
  return !!planoNome && normal(planoNome) === normal(rotuloDaPeriodicidade);
}

/** A partir de quantos dias restantes a vigência passa a âmbar (pedido de 23/11). A renovação pelo WhatsApp segue a janela da API. */
export const DIAS_PARA_AVISAR_VIGENCIA = 15;

export type TomDaVigencia = 'neutro' | 'atencao';

export interface VigenciaNaTela {
  inicio: string;
  termino: string;
  /** De 0 a 1: quanto do período já passou (a barra, decorativa). */
  fracao: number;
  /** "92 dias restantes", "1 dia restante", "Termina hoje", "Encerrado em 19/10/2026". */
  restantes: string;
  tom: TomDaVigencia;
  /** O texto equivalente da barra, para o leitor de tela. */
  falado: string;
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/**
 * Quem mostra a vigência (Gustavo, 23/11): só a contratação ATIVA de período maior que um mês. O mensal não (o ciclo é o
 * próprio mês e o "Vence todo dia N" já diz tudo); pausada e encerrada também não, porque o término que a API devolve para
 * elas sai da âncora antiga e não significa nada para o aluno.
 */
export const mostraVigencia = (periodicidade: PeriodoDoPlano | null | undefined, situacao: SituacaoDaContratacao): boolean =>
  situacao === 'ATIVA' && !!periodicidade && periodicidade !== 'MENSAL';

/**
 * Vigência da contratação: datas, dias restantes e o tom. Os dias restantes são os da API (`diasRestantesVigencia`, que
 * também decide se acabou); a tela não recalcula o "hoje". Faltando 15 dias ou menos, âmbar; neutro no resto. Só a parcela
 * única passa do término (o ciclo dela não se renova): vira "Encerrado em dd/mm/aaaa", em âmbar (23/11: o estado de plano
 * encerrado não some, e não é alarme). Fora do `mostraVigencia`, sem término ou sem os dias, não há vigência (o bloco some).
 */
export function vigenciaDaContratacao(c: {
  periodicidade: PeriodoDoPlano | null | undefined; situacao: SituacaoDaContratacao; inicio: string; terminoVigencia?: string | null; diasRestantesVigencia?: number | null;
}): VigenciaNaTela | null {
  const termino = c.terminoVigencia;
  const restantes = c.diasRestantesVigencia;
  if (!mostraVigencia(c.periodicidade, c.situacao) || !termino || restantes == null || !c.inicio) return null;
  const total = diasEntre(c.inicio, termino);
  const fracao = total > 0 ? Math.min(1, Math.max(0, (total - restantes) / total)) : 1;
  const texto = restantes < 0 ? `Encerrado em ${dataParaTela(termino)}`
    : restantes === 0 ? 'Termina hoje'
      : `${dias(restantes)} ${restantes === 1 ? 'restante' : 'restantes'}`;
  const tom: TomDaVigencia = restantes <= DIAS_PARA_AVISAR_VIGENCIA ? 'atencao' : 'neutro';
  const de = dataParaTela(c.inicio);
  const ate = dataParaTela(termino);
  return { inicio: de, termino: ate, fracao, restantes: texto, tom, falado: `Vigência de ${de} a ${ate}: ${texto.toLocaleLowerCase('pt-BR')}` };
}

/** As cobranças à vista no cartão: as mais recentes por vencimento (as outras ficam em "Ver todas no Financeiro"). */
export const COBRANCAS_NA_FICHA = 3;

export function ultimasCobrancas<T extends { vencimento: string }>(lista: readonly T[], quantas: number = COBRANCAS_NA_FICHA): T[] {
  return [...lista].sort((a, b) => b.vencimento.localeCompare(a.vencimento)).slice(0, quantas);
}

// ---- Lesões ----

/** Ativa = ainda não recuperada (ativa ou em recuperação): a mesma regra do aviso do Resumo (`fichaDoAluno.avisoDeLesoes`). */
export const lesaoAtiva = (l: Pick<Lesao, 'situacao'>): boolean => l.situacao !== 'RECUPERADA';

/**
 * Selo da situação (tabela 4.5): ativa e em recuperação pedem cuidado de quem prescreve (âmbar, `atencao`); recuperada é
 * encerrada (`neutro`).
 */
export function seloDaLesao(s: SituacaoLesao): { texto: string; tipo: 'atencao' | 'neutro' } {
  if (s === 'ATIVA') return { texto: 'Ativa', tipo: 'atencao' };
  if (s === 'EM_RECUPERACAO') return { texto: 'Em recuperação', tipo: 'atencao' };
  return { texto: 'Recuperada', tipo: 'neutro' };
}

/** "Desde 01/11/2026" (em aberto), "01/11/2026 a 15/11/2026" (fechada), "Até 15/11/2026" (só o fim); sem datas, "—". */
export function periodoDaLesao(l: Pick<Lesao, 'dataInicio' | 'dataFim'>): string {
  const inicio = dataParaTela(l.dataInicio);
  const fim = dataParaTela(l.dataFim);
  if (inicio && fim) return `${inicio} a ${fim}`;
  if (inicio) return `Desde ${inicio}`;
  if (fim) return `Até ${fim}`;
  return SEM_DADO;
}

/** Mais recente primeiro: pela data de fim (recuperadas) ou de início; sem data, por último. */
const maisRecente = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

/** Ativas primeiro (a ativa antes da em recuperação, depois a mais recente), e as recuperadas, da que terminou por último. */
export function lesoesNaOrdem<T extends Pick<Lesao, 'situacao' | 'dataInicio' | 'dataFim'>>(lista: readonly T[]): { ativas: T[]; recuperadas: T[] } {
  const ativas = lista.filter(lesaoAtiva).sort((a, b) =>
    (a.situacao === b.situacao ? 0 : a.situacao === 'ATIVA' ? -1 : 1) || maisRecente(a.dataInicio, b.dataInicio));
  const recuperadas = lista.filter((l) => !lesaoAtiva(l)).sort((a, b) =>
    maisRecente(a.dataFim ?? a.dataInicio, b.dataFim ?? b.dataInicio));
  return { ativas, recuperadas };
}

/** Recuperadas à vista; com mais, "Ver todas". */
export const RECUPERADAS_VISIVEIS = 5;

/** "1 ativa · 3 no total", "Nenhuma ativa · 2 no total"; sem lesões, `null` (o vazio diz). */
export function contagemDeLesoes(lista: readonly Pick<Lesao, 'situacao'>[]): string | null {
  if (lista.length === 0) return null;
  const n = lista.filter(lesaoAtiva).length;
  const ativas = n === 0 ? 'Nenhuma ativa' : `${n} ${n === 1 ? 'ativa' : 'ativas'}`;
  return `${ativas} · ${lista.length} no total`;
}

/** Observação longa (mais de duas linhas prováveis): a tela corta em duas e oferece o texto inteiro. Heurística, sem medir. */
export const observacaoLonga = (texto: string): boolean => texto.length > 140 || texto.includes('\n');
