import type { DiaDeTreino } from '../api/tipos';
import { corDaDivisao } from './corDaSerie';
import { dataParaTela, diaDaSemanaIso, somarDias } from './formatos';
import { partesDaDivisao } from './relatorio';
import type { ChaveDeIdentificacao } from '../tema/tokens';

/**
 * Histórico do aluno (Frente G, D13 e D15, reunião de 30/10, C45): o período de cada visão escrito, a escolha do período
 * de "Registros e cargas" (pasta atual, pasta anterior, últimos 30 dias), a visão "Por dia" em semana → dia e a letra
 * e a cor de cada divisão. Só leitura do que já veio da API: nada é calculado de novo, e o que falta continua "—".
 */

export type PeriodoDoHistorico = 'PASTA_ATUAL' | 'PASTA_ANTERIOR' | 'ULTIMOS_30';

/** Dias de "Últimos 30 dias" (a mesma conta de antes: hoje e os 29 anteriores). */
export const DIAS_DO_HISTORICO = 30;

export interface PastaComPeriodo {
  id: string;
  inicio: string | null;
  fim: string | null;
}

const temPeriodo = <P extends PastaComPeriodo>(p: P | null | undefined): p is P & { inicio: string; fim: string } => !!p?.inicio && !!p.fim;

/**
 * A pasta anterior à pasta em uso: entre as pastas do aluno com início e fim, a de início mais recente que começa antes
 * da pasta em uso (empate, a que termina depois). Sem pasta em uso com período, ou sem nenhuma antes, `null`.
 */
export function pastaAnterior<P extends PastaComPeriodo>(pastas: readonly P[], atual: PastaComPeriodo | null | undefined): P | null {
  if (!temPeriodo(atual)) return null;
  const antes = pastas.filter((p): p is P & { inicio: string; fim: string } => temPeriodo(p) && p.id !== atual.id && p.inicio < atual.inicio);
  antes.sort((a, b) => b.inicio.localeCompare(a.inicio) || b.fim.localeCompare(a.fim));
  return antes[0] ?? null;
}

/** As escolhas de período que existem para este aluno: pasta atual e anterior só quando têm período; 30 dias sempre. */
export function opcoesDePeriodo(atual: PastaComPeriodo | null | undefined, anterior: PastaComPeriodo | null | undefined): { valor: PeriodoDoHistorico; rotulo: string }[] {
  return [
    ...(temPeriodo(atual) ? [{ valor: 'PASTA_ATUAL' as const, rotulo: 'Pasta em uso' }] : []),
    ...(temPeriodo(anterior) ? [{ valor: 'PASTA_ANTERIOR' as const, rotulo: 'Pasta anterior' }] : []),
    { valor: 'ULTIMOS_30' as const, rotulo: `Últimos ${DIAS_DO_HISTORICO} dias` },
  ];
}

/** O período começa na pasta em uso (com período); sem ela, nos últimos 30 dias. Escolha que deixou de existir volta ao padrão. */
export function periodoValido(escolhido: PeriodoDoHistorico | null, atual: PastaComPeriodo | null | undefined, anterior: PastaComPeriodo | null | undefined): PeriodoDoHistorico {
  const opcoes = opcoesDePeriodo(atual, anterior).map((o) => o.valor);
  if (escolhido && opcoes.includes(escolhido)) return escolhido;
  return opcoes[0];
}

/** Datas do período (as mesmas da rota `GET /aluno/execucoes?de=&ate=`). */
export function intervaloDoPeriodo(
  periodo: PeriodoDoHistorico,
  hoje: string,
  atual: PastaComPeriodo | null | undefined,
  anterior: PastaComPeriodo | null | undefined,
): { de: string; ate: string } {
  const pasta = periodo === 'PASTA_ATUAL' ? atual : periodo === 'PASTA_ANTERIOR' ? anterior : null;
  if (temPeriodo(pasta)) return { de: pasta.inicio, ate: pasta.fim };
  return { de: somarDias(hoje, -(DIAS_DO_HISTORICO - 1)), ate: hoje };
}

const ddmm = (iso: string) => dataParaTela(iso).slice(0, 5);

/** O período na faixa do cartão: "Pasta em uso: 01/10 a 31/10", "Últimos 30 dias: 04/10 a 02/11". */
export function rotuloDoPeriodo(periodo: PeriodoDoHistorico, de: string, ate: string): string {
  const nome = periodo === 'PASTA_ATUAL' ? 'Pasta em uso' : periodo === 'PASTA_ANTERIOR' ? 'Pasta anterior' : `Últimos ${DIAS_DO_HISTORICO} dias`;
  return `${nome}: ${ddmm(de)} a ${ddmm(ate)}`;
}

/** A frase do que "Registros e cargas" mostra, conforme a visão. */
export function fraseDoHistorico(visao: 'divisao' | 'dia', de: string, ate: string): string {
  const periodo = `de ${ddmm(de)} a ${ddmm(ate)}`;
  return visao === 'dia'
    ? `Mostrando os dias com treino ${periodo}, do mais recente ao mais antigo, agrupados por semana.`
    : `Mostrando a carga de trabalho de cada exercício por divisão, ${periodo}. Carga e reps contam só as séries de trabalho.`;
}

/** Os períodos fixos dos outros cartões do Histórico (o que cada busca realmente traz). */
export const PERIODO_DO_PROGRESSO = 'Todas as pastas · exercícios dos últimos 12 meses';
export const PERIODO_DE_TUDO = 'Desde o primeiro registro';

/** "Desde o primeiro registro (12/03/2026)"; sem registro, só a frase. `datas` em ISO, em qualquer ordem (vazias ficam de fora). */
export function periodoDesdeOPrimeiro(datas: readonly (string | null | undefined)[]): string {
  const primeira = datas.filter((d): d is string => !!d).sort()[0];
  return primeira ? `${PERIODO_DE_TUDO} (${dataParaTela(primeira)})` : PERIODO_DE_TUDO;
}

/* ---------------- semana → dia ---------------- */

const SIGLAS_DO_DIA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
/** As letras dos sete dias no cabeçalho da semana, de segunda a domingo. */
export const LETRAS_DA_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const NOMES_DO_DIA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** A data à esquerda do cartão do dia: "QUA", "07", "out" (e o nome por extenso para o leitor de tela). */
export function partesDaData(iso: string): { sigla: string; dia: string; mes: string; nomeDoDia: string } {
  const [, m, d] = iso.split('-');
  const i = diaDaSemanaIso(iso) - 1;
  return { sigla: SIGLAS_DO_DIA[i], dia: d, mes: MESES[Number(m) - 1] ?? '', nomeDoDia: NOMES_DO_DIA[i] };
}

export interface MarcaDaSemana {
  data: string;
  /** O dia com treino (`null` = sem treino). */
  dia: DiaDeTreino | null;
  /** O dia está fora do período buscado: antes do início ou depois do fim (não é "sem treino"). */
  foraDoPeriodo: boolean;
  /** O dia é depois de hoje e ainda faz parte do período (ou o período termina hoje): neutro, não é "sem treino" (D9). */
  aindaNaoChegou: boolean;
}

export interface SemanaDoHistorico {
  /** Segunda-feira da semana (ISO). */
  inicio: string;
  /** Domingo da semana (ISO). */
  fim: string;
  /** Dias com treino dentro do período, do mais recente ao mais antigo. */
  dias: DiaDeTreino[];
  /** Os sete dias, de segunda a domingo. */
  marcas: MarcaDaSemana[];
}

/**
 * "Por dia" em semanas (segunda a domingo), da mais recente à mais antiga; dentro, os dias com treino do mais recente ao
 * mais antigo. Dia sem sessão não aparece (não existe treino a mostrar). Só entram os dias de dentro do período (D1 e D5
 * do plano `historico-ajustes-g`): os da semana cortada antes do início ou depois do fim são `foraDoPeriodo`; os depois de
 * `hoje` que ainda são do período são `aindaNaoChegou` (D9). Período que termina hoje (os últimos 30 dias) foi cortado em
 * hoje, então o dia seguinte ainda não chegou, não está fora.
 */
export function semanasDoHistorico(dias: readonly DiaDeTreino[], periodo: { de: string; ate: string }, hoje: string): SemanaDoHistorico[] {
  const dentro = (data: string) => data >= periodo.de && data <= periodo.ate;
  const aindaNaoChegou = (data: string) => data > hoje && data >= periodo.de && (data <= periodo.ate || periodo.ate === hoje);
  const semanas = new Map<string, DiaDeTreino[]>();
  for (const dia of [...dias].filter((d) => d.sessoes.length && dentro(d.data)).sort((a, b) => b.data.localeCompare(a.data))) {
    const inicio = somarDias(dia.data, -(diaDaSemanaIso(dia.data) - 1));
    semanas.set(inicio, [...(semanas.get(inicio) ?? []), dia]);
  }
  return [...semanas].map(([inicio, lista]) => ({
    inicio,
    fim: somarDias(inicio, 6),
    dias: lista,
    marcas: Array.from({ length: 7 }, (_, i) => {
      const data = somarDias(inicio, i);
      const dia = lista.find((d) => d.data === data) ?? null;
      // Dia com treino já chegou, mesmo depois do "hoje" de Brasília (registro com a data do aparelho, em outro fuso).
      const futuro = !dia && aindaNaoChegou(data);
      return { data, dia, foraDoPeriodo: !dentro(data) && !futuro, aindaNaoChegou: futuro };
    }),
  }));
}

/** "Semana de 06/10 a 12/10". */
export function tituloDaSemana(s: Pick<SemanaDoHistorico, 'inicio' | 'fim'>): string {
  return `Semana de ${ddmm(s.inicio)} a ${ddmm(s.fim)}`;
}

/** "1 treino", "3 treinos" (sessões dentro do período: dia com duas sessões conta 2). */
export function treinosDaSemana(s: Pick<SemanaDoHistorico, 'dias'>): string {
  const n = s.dias.reduce((total, d) => total + d.sessoes.length, 0);
  return n === 1 ? '1 treino' : `${n} treinos`;
}

/* ---------------- letra e cor da divisão (D13) ---------------- */

const chaveDoNome = (nome: string) => nome.trim().toLowerCase();

/** Letra que o próprio nome já diz: "Treino B - Costas", "Divisão C", "A - Peito" (depois do dia da semana, se houver). */
function letraDoNome(nome: string): string | null {
  const titulo = partesDaDivisao(nome).titulo;
  const m = /^(?:treino|divis[aã]o)\s+([a-z])(?=$|[\s\-–—·:|,.])/i.exec(titulo) ?? /^([A-Z])(?=$|\s*[-–—·:|])/.exec(titulo);
  return m ? m[1].toUpperCase() : null;
}

/**
 * O rótulo de cada divisão do histórico, pelo nome (chave sem caixa nem espaços nas pontas). Duas passadas (D2): 1) toda
 * divisão cujo nome diz uma letra fica com ela, e a repetida ganha número na ordem em que chega ("A", "A2", "A3");
 * 2) as sem letra no nome pegam a próxima letra que nenhum nome diz. A cor é a da primeira letra (`corDaLetra`), então
 * "A2" tem a cor de "A". Mesmo rótulo nas duas visões. Só rótulo do histórico: a letra não existe no plano.
 */
export function letrasDasDivisoes(nomes: readonly string[]): Map<string, string> {
  const letras = new Map<string, string>();
  const vezes = new Map<string, number>();
  const unicos = [...new Map(nomes.map((n) => [chaveDoNome(n), n])).values()];
  for (const nome of unicos) {
    const letra = letraDoNome(nome);
    if (!letra) continue;
    const n = (vezes.get(letra) ?? 0) + 1;
    vezes.set(letra, n);
    letras.set(chaveDoNome(nome), n === 1 ? letra : `${letra}${n}`);
  }
  let proxima = 0;
  for (const nome of unicos) {
    if (letras.has(chaveDoNome(nome))) continue;
    while (vezes.has(String.fromCharCode(65 + (proxima % 26))) && vezes.size < 26) proxima++;
    const letra = String.fromCharCode(65 + (proxima % 26));
    letras.set(chaveDoNome(nome), letra);
    vezes.set(letra, 1);
    proxima++;
  }
  return letras;
}

/** A letra de uma divisão pelo nome; nome desconhecido = `null` (sem letra nem cor). */
export function letraDaDivisaoNoHistorico(letras: ReadonlyMap<string, string>, nome: string): string | null {
  return letras.get(chaveDoNome(nome)) ?? null;
}

/** A cor da letra (A azul, B magenta, C ciano...), em ciclo; só o primeiro caractere conta ("A2" = a cor de "A"). */
export function corDaLetra(letra: string): ChaveDeIdentificacao {
  return corDaDivisao(letra.toUpperCase().charCodeAt(0) - 65);
}
