import type { Carga, Configuracao, ConteudoTreino, Esforco, Exercicio, ExercicioPlano, Serie, Sessao, Tecnica, TipoDeSerie, TipoDeTecnica } from '../api/tipos';
import { DESCANSO_MAXIMO_SEGUNDOS, LIMITE_SERIES, comModalidade, novaSerieDeCardio, novaSessao, novoExercicio, tecnicaVazia } from './editorTreino';
import { cargaInicial, codigoTrabalho, esforcoInicial, nomeDoTipo, padraoDaTecnica, percentuaisDaRegra, tecnicaNaMetodologia, tipoPorCodigo } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { novoUid } from './uid';

/**
 * Importar treino colado (A02): transforma o texto copiado de um PDF, Google Docs, Word ou WhatsApp em sessões, exercícios e
 * séries do editor de treino. Função pura (sem rede, sem tela): a biblioteca e a metodologia chegam por parâmetro.
 *
 * Formatos que reconhece (ver os testes):
 * 1. Tabela de PDF: o nome do exercício numa linha e uma linha `NxM - Tipo` por grupo de séries, ou o nome e a primeira
 *    série na mesma linha;
 * 2. uma linha por exercício, com vários blocos (`2x4 a 6 FS + 2x6 a 8 WS`), RIR, descanso, técnica e cardio;
 * 3. lista com marcadores, um tipo por linha (`- WS: 2x6 a 8 (RIR 0) - 120s`), percentuais e RIR.
 *
 * Nada é inventado: carga, esforço e técnica saem do que está escrito ou do PADRÃO DA METODOLOGIA do plano (o mesmo que
 * uma série nova do editor usa). O que não se entende vira aviso ou linha ignorada, nunca valor. Não grava nada: devolve o
 * que o editor recebe (e o treinador revisa antes de salvar).
 */

/** O que a leitura precisa de cada exercício da biblioteca da consultoria. */
export type ExercicioDaBibliotecaParaTexto = Pick<Exercicio, 'id' | 'nome' | 'grupoMuscular' | 'videoUrl' | 'modalidade'>;

/** Exercício reconhecido, com o que a prévia mostra (o `plano` é o que vai ao editor). */
export interface ItemLido {
  plano: ExercicioPlano;
  /** O nome como veio no texto (o `plano.nome` é o da biblioteca quando vinculou). */
  digitado: string;
  /** Grupo muscular da biblioteca, só para a prévia (o exercício do plano não o guarda). */
  grupoMuscular: string | null;
  /** Vinculado a um exercício da biblioteca (`exercicioId` preenchido). */
  vinculado: boolean;
}

export interface DivisaoLida {
  sessao: Sessao;
  itens: ItemLido[];
}

export interface LeituraDoTexto {
  sessoes: Sessao[];
  divisoes: DivisaoLida[];
  resumo: { divisoes: number; exercicios: number; series: number; semBiblioteca: number; semSeries: number };
  /** Coisas que o treinador precisa saber (tipo que não existe na metodologia, limite, cluster sem blocos...). */
  avisos: string[];
  /** Linhas que não viraram nada (cabeçalho, série sem exercício...), cortadas em 60 caracteres. */
  ignoradas: string[];
}

export const NOME_DA_DIVISAO_PADRAO = 'Treino A';
const NOME_MAXIMO_DA_SESSAO = 80;
const NOME_MAXIMO_DO_EXERCICIO = 120;
const EXERCICIOS_POR_SESSAO = 40;
const REPETICOES_MAXIMAS = 500;
const MAXIMO_DE_IGNORADAS = 8;

// ---- Texto ----

/** Minúsculas e sem acento, com o MESMO tamanho do original (para os índices valerem nos dois). */
function simples(linha: string): string {
  const p = Array.from(linha).map((ch) => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).join('');
  return p.length === linha.length ? p : linha.toLowerCase();
}

/** Para comparar nomes: sem acento, sem pontuação, espaços únicos. */
function chaveDeNome(texto: string): string {
  return simples(texto).replace(/[^a-z0-9]+/g, ' ').trim();
}

function limparLinha(bruta: string): string {
  return bruta
    .normalize('NFC')
    .replace(/[\u00a0\u2007\u202f\u200b\ufeff]/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/[×✕✖]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function cortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

/** Tira marcadores (`•`, `-`, `*`, `1.`, `2)`, `3 -`) do começo e a pontuação do fim. */
function semMarcadores(texto: string): string {
  let t = texto;
  for (let i = 0; i < 4; i++) {
    const antes = t;
    t = t.replace(/^[\s•·▪►→*#>◦○●■□\-]+/, '').replace(/^\d{1,2}\s*[.)]\s+/, '').replace(/^\d{1,2}\s+-\s+/, '');
    if (t === antes) break;
  }
  return t.replace(/[\s\-:;,.|]+$/, '').trim();
}

// ---- Tipos de série e técnicas ----

interface Aliases {
  /** alias normalizado (`back off`) → tipo da metodologia. */
  mapa: Map<string, TipoDeSerie>;
  /** Procura o primeiro alias num texto já limpo (só letras e números), com o fim dele. */
  achar: (limpo: string) => { tipo: TipoDeSerie; inicio: number; fim: number } | null;
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');

function montarAliases(config: Configuracao): Aliases {
  const tipos = config.tipos ?? [];
  const mapa = new Map<string, TipoDeSerie>();
  const add = (alias: string, tipo: TipoDeSerie | null | undefined) => {
    const chave = chaveDeNome(alias);
    if (tipo && chave.length >= 2 && !mapa.has(chave)) mapa.set(chave, tipo);
  };
  // O que está na metodologia vale primeiro: nome e código de cada tipo (o treinador pode ter renomeado).
  for (const t of tipos) {
    add(t.nome ?? '', t);
    add((t.codigo ?? '').replace(/_/g, ' '), t);
  }
  const porCodigo = (c: string) => tipos.find((t) => t.codigo?.trim() === c) ?? null;
  const porPapel = (p: TipoDeSerie['papel']) => tipos.find((t) => t.papel === p) ?? null;
  const apelidos: [TipoDeSerie | null, string[]][] = [
    [porCodigo('WARM_UP') ?? porPapel('AQUECIMENTO'), ['aquecimento', 'aquec', 'warm up', 'warmup']],
    [porCodigo('FEEDER') ?? porPapel('PREPARACAO'), ['fs', 'feeder', 'feeder set', 'feeder sets', 'preparacao']],
    [porCodigo('WORKING') ?? porPapel('TRABALHO'), ['ws', 'work set', 'working set', 'workset', 'trabalho', 'serie de trabalho']],
    [porCodigo('TOP_SET'), ['top set', 'topset', 'ts']],
    [porCodigo('BACK_OFF') ?? porPapel('POS_TRABALHO'), ['back off', 'backoff', 'bo']],
  ];
  for (const [tipo, nomes] of apelidos) for (const n of nomes) add(n, tipo);
  const ordenados = [...mapa.keys()].sort((a, b) => b.length - a.length);
  const regex = ordenados.length ? new RegExp(`(?:^|[^a-z0-9])(${ordenados.map(escapar).join('|')})(?![a-z0-9])`) : null;
  return {
    mapa,
    achar: (limpo) => {
      const m = regex?.exec(limpo);
      if (!m) return null;
      const inicio = m.index + m[0].length - m[1].length;
      const tipo = mapa.get(chaveDeNome(m[1]));
      return tipo ? { tipo, inicio, fim: inicio + m[1].length } : null;
    },
  };
}

/** Apelidos de tipo que o treinador escreve mas a metodologia dele não tem (aviso em vez de chute). */
const TIPOS_CONHECIDOS_SEM_CADASTRO = /(?:^|[^a-z0-9])(top set|topset|ts|back off|backoff|bo|feeder|fs|aquecimento|warm up|ws)(?![a-z0-9])/;

const TECNICAS: { tipo: TipoDeTecnica; regex: RegExp }[] = [
  { tipo: 'REST_PAUSE', regex: /(?:^|[^a-z0-9])(rest ?pause)(?![a-z0-9])/ },
  { tipo: 'CLUSTER', regex: /(?:^|[^a-z0-9])(cluster|muscle round)(?![a-z0-9])/ },
  { tipo: 'DROP_SET', regex: /(?:^|[^a-z0-9])(drop ?set|drop)(?![a-z0-9])/ },
];

/** Só os separadores viram espaço; o resto fica como está, para a procura dos apelidos. */
function limpoParaProcura(seg: string): string {
  return seg.replace(/[^a-z0-9%.,]+/g, ' ').replace(/\s+/g, ' ');
}

// ---- Blocos de série (`NxM`, `NxM a K`) ----

interface BlocoBruto { inicio: number; fim: number; n: number; min: number; max: number | null }

const BLOCO = /(\d{1,3})\s*x\s*(\d{1,3})(?:(?:\s+(?:a|ate)\s+|\s*-\s*)(\d{1,3})(?!\d|\s*(?:s\b|seg|min|%|kg)))?(?!\d)/g;

function acharBlocos(plain: string): BlocoBruto[] {
  const blocos: BlocoBruto[] = [];
  BLOCO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCO.exec(plain)) !== null) {
    if (m.index > 0 && /[\d.,]/.test(plain[m.index - 1])) continue;
    const min = Number(m[2]);
    const fim = Number(m[3]);
    const max = m[3] !== undefined && fim >= min && fim <= 100 ? fim : null;
    // Intervalo mal lido ("3x10 - 120"): fica só o mínimo e o resto do texto segue para o segmento.
    const consumido = m[3] !== undefined && max === null ? m[0].slice(0, m[0].search(/\s*(?:-|\s(?:a|ate)\s)/)) : m[0];
    blocos.push({ inicio: m.index, fim: m.index + consumido.length, n: Number(m[1]), min, max });
    BLOCO.lastIndex = m.index + consumido.length;
  }
  return blocos;
}

/** `60s`, `90 seg`, `2 min`, `1,5 min` → segundos. */
const TEMPO = /(\d{1,4}(?:[.,]\d+)?)\s*(min(?:utos?)?|seg(?:undos?)?|s)(?![a-z0-9])/g;

interface Tempo { inicio: number; segundos: number }

function acharTempos(seg: string): Tempo[] {
  const lista: Tempo[] = [];
  TEMPO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEMPO.exec(seg)) !== null) {
    if (m.index > 0 && /[\d.,]/.test(seg[m.index - 1])) continue;
    const valor = Number(m[1].replace(',', '.'));
    const segundos = Math.round(m[2].startsWith('min') ? valor * 60 : valor);
    if (segundos > 0 && segundos <= DESCANSO_MAXIMO_SEGUNDOS) lista.push({ inicio: m.index, segundos });
  }
  return lista;
}

interface LeituraDoSegmento {
  tipo: TipoDeSerie | null;
  tipoDesconhecido: boolean;
  tecnica: TipoDeTecnica | null;
  rir: number | null;
  rpe: number | null;
  percentual: { min: number; max: number | null } | null;
  descanso: number | null;
  pausaDaTecnica: number | null;
}

function lerSegmento(seg: string, aliases: Aliases): LeituraDoSegmento {
  const limpo = limpoParaProcura(seg);
  const tipoAchado = aliases.achar(limpo);
  const tecnica = TECNICAS.map((t) => ({ t, m: t.regex.exec(limpo) })).filter((x) => x.m).sort((a, b) => a.m!.index - b.m!.index)[0]?.t.tipo ?? null;
  const rir = /\brir\s*[:=]?\s*(\d{1,2})(?!\d)/.exec(seg);
  const rpe = /\brpe\s*[:=]?\s*(\d{1,2}(?:[.,]5)?)(?![\d])/.exec(seg);
  const perc = /(\d{1,3}(?:[.,]\d+)?)(?:\s*(?:a|-)\s*(\d{1,3}(?:[.,]\d+)?))?\s*%/.exec(seg);
  let percentual: LeituraDoSegmento['percentual'] = null;
  if (perc) {
    const min = Number(perc[1].replace(',', '.'));
    const maxBruto = perc[2] !== undefined ? Number(perc[2].replace(',', '.')) : null;
    if (min >= 1 && min <= 200) percentual = { min, max: maxBruto !== null && maxBruto > min && maxBruto <= 200 ? maxBruto : null };
  }
  let descanso: number | null = null;
  let pausaDaTecnica: number | null = null;
  for (const t of acharTempos(seg)) {
    const antes = seg.slice(0, t.inicio).replace(/[-_(:]+/g, ' ').replace(/\s+/g, ' ').trimEnd();
    if (tecnica && /(?:rest ?pause|cluster|muscle round|drop ?set|drop|pausa(?: de)?)$/.test(antes)) pausaDaTecnica ??= t.segundos;
    else descanso ??= t.segundos;
  }
  const rirNumero = rir ? Number(rir[1]) : null;
  const rpeNumero = rpe ? Number(rpe[1].replace(',', '.')) : null;
  return {
    tipo: tipoAchado?.tipo ?? null,
    tipoDesconhecido: !tipoAchado && TIPOS_CONHECIDOS_SEM_CADASTRO.test(limpo),
    tecnica,
    rir: rirNumero !== null && rirNumero >= 0 && rirNumero <= 10 ? rirNumero : null,
    rpe: rpeNumero !== null && rpeNumero >= 1 && rpeNumero <= 10 ? rpeNumero : null,
    percentual,
    descanso,
    pausaDaTecnica,
  };
}

// ---- Exercício da biblioteca ----

const PALAVRAS_SEM_VALOR = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'na', 'no', 'em', 'e', 'a', 'o', 'para', 'por']);

const tokens = (texto: string): string[] =>
  chaveDeNome(texto).split(' ').filter((t) => t.length >= 2 && !PALAVRAS_SEM_VALOR.has(t)).map((t) => (t.length > 3 ? t.replace(/s$/, '') : t));

interface Entrada { ex: ExercicioDaBibliotecaParaTexto; chave: string; palavras: Set<string> }

function indexar(biblioteca: readonly ExercicioDaBibliotecaParaTexto[]): Entrada[] {
  return biblioteca.map((ex) => ({ ex, chave: chaveDeNome(ex.nome), palavras: new Set(tokens(ex.nome)) }));
}

/** Igual sem acento e sem caixa; senão, o ÚNICO exercício que tem todas as palavras do nome (duas respostas = nenhuma). */
function acharNaBiblioteca(nome: string, indice: Entrada[], cardio: boolean): ExercicioDaBibliotecaParaTexto | null {
  const doTipo = indice.filter((e) => (e.ex.modalidade === 'CARDIO') === cardio);
  for (const texto of [nome, nome.replace(/\([^)]*\)/g, ' ')]) {
    const chave = chaveDeNome(texto);
    if (!chave) continue;
    const igual = doTipo.filter((e) => e.chave === chave);
    if (igual.length >= 1) return igual[0].ex;
    const palavras = tokens(texto);
    if (!palavras.length) continue;
    const candidatos = doTipo.filter((e) => palavras.every((p) => e.palavras.has(p)));
    if (candidatos.length === 1) return candidatos[0].ex;
  }
  return null;
}

// ---- Títulos de divisão e linhas que não são exercício ----

const DIA_DA_SEMANA = /^(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?(?:\s*[-:(].*)?$/;
const TITULOS = [
  /^(?:treino|sessao|divisao)\b.*$/,
  /^dia(?:\s*\d{1,2}|\s+[a-z])\b.*$/,
  /^day\s*\d{1,2}\b.*$/,
  /^(?:upper|lower|push|pull|legs|inferiores?|superiores?|full body)(?:\s+(?:day|body|a|b|c|d|1|2|3))?(?:\s+-\s+.*|\s*[:(].*)?$/,
];

function ehTitulo(plain: string): boolean {
  const t = plain.replace(/^[\s#*>•·\-]+/, '').replace(/:+$/, '').trim();
  return DIA_DA_SEMANA.test(t) || TITULOS.some((r) => r.test(t));
}

const CABECALHO_DE_TABELA = /^(?:exercicios?|series?|x|repeticoes|reps|descanso|carga|tipo|links?|video|obs\w*)(?:\s+(?:exercicios?|series?|x|repeticoes|reps|descanso|carga|tipo|links?|video|obs\w*))*$/;
/** Número de página solto ("1", "2") que o PDF deixa entre as linhas. */
const NUMERO_DE_PAGINA = /^\d{1,3}$/;
const CABECALHO_DO_DOCUMENTO = /^(?:(?:objetivo|aluno|aluna|nome|periodo|data|professor|professora|treinador|treinadora|consultoria|plano)\b[^:]{0,30}:|(?:pagina|semana|ciclo)\s*\d)/;
const OBSERVACAO = /^(?:obs|observacao|observacoes|nota|dica|atencao|importante)\b\s*[:.-]?\s*/;
const DESCANSO_SOLTO = /^descanso\b/;
const PALAVRAS_DE_CARDIO = /\b(?:cardio|esteira|bicicleta|bike|escada|eliptico|transport|corrida|caminhada|spinning|natacao|remo ergometro|ergometro|simulador)\b/;

/** Enfeite, cabeçalho de tabela e cabeçalho do documento: nada disso é treino. */
function ehLixo(plain: string): boolean {
  const p = plain.trim();
  return /^[\s\-_=*#.•|]+$/.test(plain) || NUMERO_DE_PAGINA.test(p) || CABECALHO_DE_TABELA.test(p) || CABECALHO_DO_DOCUMENTO.test(p);
}

/** Só o cabeçalho do documento ("Aluno: ...") aparece em "linhas ignoradas"; enfeite e cabeçalho de tabela somem calados. */
const avisaAoIgnorar = (plain: string) => CABECALHO_DO_DOCUMENTO.test(plain.trim());

// ---- Páginas de instrução, observação solta e frase de percentual ----

/** Começo das páginas de explicação do PDF ("Instruções"): dali até a próxima divisão nada é treino. */
const GATILHO_DE_INSTRUCOES = /^(?:instrucoes|orientacoes gerais|legenda|glossario)\s*:?$/;
const TITULO_CARDIO_EXPLICADO = /^cardio\s*:$/;

/** Frase que abre um verbo de instrução ("Faça igual o vídeo", "Prefira...", "Caso a pegada..."): é observação do exercício. */
const COMECO_DE_OBSERVACAO = /^(?:faca|prefira|mantenha|mantendo|utilize|use|evite|procure|tente|caso|controle|controlando|lembre|atencao|cuidado|respeite|nao)\b|^pegada\s+\w+$/;
/** O mesmo verbo no meio da linha de série (coluna "Obs" colada depois do tipo). */
const OBSERVACAO_NA_LINHA = /(?:^|[\s\-:|])(faca|prefira|mantenha|utilize|evite|procure|tente|caso|controle|use)(?![a-z0-9])/;
/** Sobra da frase de percentual quebrada em duas linhas ("da carga realizada na WS"): nada a guardar. */
const RESTO_DA_FRASE = /^(?:da\s+carga\b|carga\s+realizada\b|realizada\s+na\b|na\s+ws$)/;
/** Só sobrou "Faça com" / "Vídeo" (coluna de links): não é observação. */
const OBSERVACAO_VAZIA = /^(?:faca(?: com)?|video|links?)(?: video)?$/;

const NUMERO_DA_LISTA = String.raw`\d{1,3}(?:[.,]\d(?!\d))?`;
const LISTA_DE_PERCENTUAIS = String.raw`${NUMERO_DA_LISTA}\s*%?(?:\s*(?:,|ou|e|a|-|~)\s*${NUMERO_DA_LISTA}\s*%?)*`;
const INTRODUCAO_DA_FRASE = /back\s*off\s*-\s*faca\s+com\b/;
/** O que a frase ainda leva depois do número, quando o PDF a quebra ("... 85% da" / "carga realizada na WS"). */
const FIM_DA_FRASE = String.raw`(?:\s*%?\s*da\b(?:\s+carga\b)?(?:\s+realizada\b)?(?:\s+na\s+ws\b)?)?`;
const FRASE_FAZER_COM = new RegExp(String.raw`(?:back\s*off\s*-\s*)?faca\s+com\s+(${LISTA_DE_PERCENTUAIS})${FIM_DA_FRASE}`);
const FRASE_DA_CARGA = new RegExp(String.raw`(${LISTA_DE_PERCENTUAIS})\s*%?\s*da\s+carga\b`);

interface FrasePercentual {
  inicio: number;
  fim: number;
  min: number;
  max: number | null;
  /** O texto trazia mais de um percentual ("80%, 85% ou 90%"): vira faixa e avisa. */
  varios: boolean;
  /** Os percentuais como estavam escritos, para o aviso ("80%, 85% ou 90%"). */
  texto: string;
}

/** "Faça com 85% da carga realizada na WS", "Back off - Faça com 80%, 85% ou 90% da carga": a faixa do back off. */
function acharFrasePercentual(plain: string): FrasePercentual | null {
  const m = FRASE_FAZER_COM.exec(plain) ?? FRASE_DA_CARGA.exec(plain);
  if (!m) return null;
  const numeros = Array.from(m[1].matchAll(new RegExp(NUMERO_DA_LISTA, 'g')))
    .map((n) => Number(n[0].replace(',', '.')))
    .filter((n) => n >= 10 && n <= 200);
  if (numeros.length === 0) return null;
  const min = Math.min(...numeros);
  const maxBruto = Math.max(...numeros);
  const distintos = new Set(numeros).size > 1;
  const escritos = numeros.map((n) => `${String(n).replace('.', ',')}%`);
  const texto = escritos.length > 1 ? `${escritos.slice(0, -1).join(', ')} ou ${escritos[escritos.length - 1]}` : escritos[0];
  return { inicio: m.index, fim: m.index + m[0].length, min, max: distintos ? maxBruto : null, varios: distintos, texto };
}

/** Troca um trecho por espaços (o mesmo tamanho, para os índices do resto da linha continuarem valendo). */
function esvaziar(texto: string, inicio: number, fim: number): string {
  return texto.slice(0, inicio) + ' '.repeat(fim - inicio) + texto.slice(fim);
}

const inicialMinuscula = (t: string): boolean => {
  const c = Array.from(t).find((ch) => ch.toLowerCase() !== ch.toUpperCase());
  return !!c && c === c.toLowerCase();
};
const inicialMaiuscula = (t: string): boolean => {
  const c = Array.from(t).find((ch) => ch.toLowerCase() !== ch.toUpperCase());
  return !!c && c === c.toUpperCase();
};

/** Linhas em MAIÚSCULAS que se repetem no texto sem nunca vir antes de uma série: cabeçalho de página ("SARAIVA TEAM"). */
function cabecalhosRepetidos(linhas: readonly string[]): Set<string> {
  const contagem = new Map<string, number>();
  const comSerie = new Set<string>();
  linhas.forEach((l, i) => {
    if (l !== l.toUpperCase() || !/\p{L}/u.test(l) || /\d/.test(l) || l.length < 3) return;
    const chave = simples(l);
    if (ehTitulo(chave)) return;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    const proxima = linhas[i + 1];
    if (proxima !== undefined && acharBlocos(simples(proxima))[0]?.inicio === 0) comSerie.add(chave);
  });
  return new Set([...contagem].filter(([chave, n]) => n >= 2 && !comSerie.has(chave)).map(([chave]) => chave));
}

// ---- Montagem ----

interface BlocoDeSerie {
  tipo: TipoDeSerie | null;
  n: number;
  min: number;
  max: number | null;
  leitura: LeituraDoSegmento;
  descansoDaLinha: number | null;
  /** Faixa da frase "Faça com 85% da carga..." (só nas séries de pós-trabalho, o back off). */
  percentualDaFrase: { min: number; max: number | null } | null;
}

interface Rascunho {
  item: ItemLido;
  blocos: BlocoDeSerie[];
  /** A frase de percentual do back off já lida neste exercício (vale para o back off que vier depois também). */
  percentualDaFrase: { min: number; max: number | null } | null;
  /** Descanso de uma linha "Descanso: 90s" depois do exercício: vale para as séries que ainda não têm. */
  descansoGeral: number | null;
  cardio: boolean;
}

function faixa(valor: { min: number; max: number | null }): Carga {
  return { modo: 'PERCENTUAL_WS', percentualMin: valor.min, percentualMax: valor.max };
}

/** As séries de um exercício: carga e esforço da metodologia (ou do que está escrito), FS pela regra do total de FS. */
function montarSeries(r: Rascunho, config: Configuracao, aviso: (t: string) => void): Serie[] {
  const comTipo = r.blocos.map((b) => b.tipo ?? tipoPorCodigo(config, codigoTrabalho(config)) ?? config.tipos[0]);
  const totalDePreparacao = r.blocos.reduce((s, b, i) => s + (comTipo[i]?.papel === 'PREPARACAO' ? b.n : 0), 0);
  const series: Serie[] = [];
  let jaDePreparacao = 0;
  r.blocos.forEach((b, i) => {
    const tipo = comTipo[i];
    if (!tipo) return;
    for (let k = 0; k < b.n; k++) {
      if (series.length >= LIMITE_SERIES) { aviso(`“${r.item.plano.nome}” passou de ${LIMITE_SERIES} séries: o resto ficou de fora.`); return; }
      let carga: Carga | null;
      if (tipo.papel === 'PREPARACAO') {
        const regra = b.leitura.percentual ? null : percentuaisDaRegra(tipo, totalDePreparacao);
        const faixaDaRegra = regra?.[jaDePreparacao];
        carga = b.leitura.percentual ? faixa(b.leitura.percentual) : faixaDaRegra ? faixa(faixaDaRegra) : cargaInicial(tipo);
        jaDePreparacao++;
      } else if (tipo.papel === 'TRABALHO') {
        carga = cargaInicial(tipo);
      } else {
        const escrito = b.percentualDaFrase ?? b.leitura.percentual;
        carga = escrito ? faixa(escrito) : cargaInicial(tipo);
      }
      let esforco: Esforco | null = esforcoInicial(tipo);
      if (b.leitura.rir !== null) esforco = { rir: b.leitura.rir, rpe: null };
      else if (b.leitura.rpe !== null) esforco = { rir: null, rpe: b.leitura.rpe };
      let tecnica: Tecnica | null = null;
      if (b.leitura.tecnica && tecnicaNaMetodologia(config, b.leitura.tecnica)) {
        tecnica = tecnicaVazia(b.leitura.tecnica, padraoDaTecnica(config, b.leitura.tecnica));
        if (b.leitura.pausaDaTecnica !== null) tecnica = { ...tecnica, pausaSegundos: b.leitura.pausaDaTecnica };
      }
      series.push({
        uid: novoUid(),
        tipo: tipo.codigo.trim(),
        repsMin: b.min,
        repsMax: b.max ?? b.min,
        amrap: null,
        carga,
        esforco,
        descansoSegundos: b.leitura.descanso ?? b.descansoDaLinha ?? r.descansoGeral,
        tecnica,
        cardio: null,
        alvoExtra: null,
      });
    }
  });
  return series;
}

/** A linha de baixo começa pelo tipo da série ("Aquecimento", "FS - na WS")? Devolve o rótulo como escrito e o resto da linha. */
function tipoNoInicio(linha: string, aliases: Aliases): { rotulo: string; resto: string } | null {
  const sp = simples(linha);
  const inicioDoTexto = /^[\s•·\-*]*/.exec(sp)?.[0].length ?? 0;
  const limpo = limpoParaProcura(sp.slice(inicioDoTexto)).trimStart();
  const achado = aliases.achar(limpo);
  if (!achado || achado.inicio !== 0) return null;
  const palavras = limpo.slice(achado.inicio, achado.fim).split(' ').length;
  const palavrasDaLinha = Array.from(sp.matchAll(/[a-z0-9%.,]+/g)).filter((m) => m.index >= inicioDoTexto);
  const ultima = palavrasDaLinha[palavras - 1];
  if (!ultima) return null;
  const fimDoRotulo = ultima.index + ultima[0].length;
  return { rotulo: linha.slice(inicioDoTexto, fimDoRotulo).trim(), resto: linha.slice(fimDoRotulo).replace(/^[\s\-:|]+/, '').trim() };
}

/** Lê o texto colado. `config` é a metodologia do plano (sem ela, a padrão); `biblioteca` os exercícios da consultoria. */
export function lerTreinoDeTexto(
  texto: string,
  config: Configuracao | null | undefined,
  biblioteca: readonly ExercicioDaBibliotecaParaTexto[],
): LeituraDoTexto {
  const metodologia = config && config.tipos?.length ? config : CONFIGURACAO_PADRAO;
  const aliases = montarAliases(metodologia);
  const indice = indexar(biblioteca);
  const avisos: string[] = [];
  const ignoradas: string[] = [];
  const dizer = (t: string) => { if (!avisos.includes(t)) avisos.push(t); };
  const ignorar = (linha: string) => { if (ignoradas.length < MAXIMO_DE_IGNORADAS) ignoradas.push(cortar(linha, 60)); };

  const divisoes: { sessao: Sessao; rascunhos: Rascunho[]; titulada: boolean }[] = [];
  // Num objeto (e lido por função) para o TypeScript não achar que o exercício corrente é sempre nulo.
  // `nomeAberto`: a última linha lida foi um nome de exercício (o nome pode continuar na linha de baixo).
  const estado: { atual: Rascunho | null; nomeAberto: boolean } = { atual: null, nomeAberto: false };
  const corrente = (): Rascunho | null => estado.atual;

  const divisaoAtual = () => {
    let d = divisoes[divisoes.length - 1];
    if (!d) {
      const sessao = novaSessao(null);
      sessao.nome = NOME_DA_DIVISAO_PADRAO;
      d = { sessao, rascunhos: [], titulada: false };
      divisoes.push(d);
    }
    return d;
  };

  const comecarExercicio = (digitado: string, cardio: boolean): Rascunho | null => {
    const divisao = divisaoAtual();
    if (divisao.rascunhos.length >= EXERCICIOS_POR_SESSAO) {
      dizer(`A divisão “${divisao.sessao.nome}” passou de ${EXERCICIOS_POR_SESSAO} exercícios: o resto ficou de fora.`);
      estado.atual = null;
      return null;
    }
    const achado = acharNaBiblioteca(digitado, indice, cardio);
    const r: Rascunho = { item: itemDoExercicio(novoExercicio(), digitado, cardio, achado), blocos: [], percentualDaFrase: null, descansoGeral: null, cardio };
    divisao.rascunhos.push(r);
    estado.atual = r;
    return r;
  };

  /** O item da prévia para um nome digitado: nome e vínculo da biblioteca, modalidade e vídeo (uid e observação do `base` ficam). */
  const itemDoExercicio = (base: ExercicioPlano, digitado: string, cardio: boolean, achado: ExercicioDaBibliotecaParaTexto | null): ItemLido => {
    let plano: ExercicioPlano = { ...base, nome: cortar(achado?.nome ?? digitado, NOME_MAXIMO_DO_EXERCICIO), exercicioId: achado?.id ?? null, videoUrl: achado?.videoUrl ?? null };
    plano = comModalidade(plano, cardio ? 'CARDIO' : achado ? achado.modalidade : null);
    return { plano, digitado, grupoMuscular: achado?.grupoMuscular ?? null, vinculado: !!achado };
  };

  /** O nome do exercício veio quebrado em várias linhas: junta o pedaço e refaz o vínculo com a biblioteca. */
  const juntarNome = (r: Rascunho, pedaco: string) => {
    const digitado = cortar(`${r.item.digitado} ${pedaco}`, NOME_MAXIMO_DO_EXERCICIO);
    r.item = itemDoExercicio(r.item.plano, digitado, r.cardio, acharNaBiblioteca(digitado, indice, r.cardio));
  };

  const anexarObservacao = (r: Rascunho, textoBruto: string) => {
    // "Vídeo" com V maiúsculo no fim é o rótulo da coluna de links colado no texto, não parte da observação.
    const t = textoBruto.trim().replace(/\s+(?:Vídeo|Links?)$/, '');
    if (!t || OBSERVACAO_VAZIA.test(chaveDeNome(t))) return;
    r.item.plano.observacao = cortar([r.item.plano.observacao, t].filter(Boolean).join(' '), 1000);
  };

  /** "Faça com 85% da carga": vale para o back off do exercício (os que já foram lidos e os que vierem). Vários valores viram faixa. */
  const aplicarFrase = (r: Rascunho, f: FrasePercentual) => {
    const valor = { min: f.min, max: f.max };
    r.percentualDaFrase = valor;
    for (const b of r.blocos) if (b.tipo?.papel === 'POS_TRABALHO') b.percentualDaFrase = valor;
    if (f.varios) dizer(`“${r.item.plano.nome}”: o texto traz vários percentuais de back off (${f.texto}). Gravei a faixa de ${f.min}% a ${f.max}%; confira.`);
  };

  const comecoDeNome = (linha: string, a: Rascunho): boolean =>
    /^\(/.test(linha) || (inicialMinuscula(linha) && inicialMaiuscula(a.item.digitado));
  const terminaEmConector = (nome: string) => {
    const ultima = chaveDeNome(nome).split(' ').pop() ?? '';
    return PALAVRAS_SEM_VALOR.has(ultima) || ultima === 'ou';
  };

  const fila = texto.split(/\r?\n/).map(limparLinha).filter(Boolean);
  const cabecalhos = cabecalhosRepetidos(fila);
  let emInstrucoes = false;
  let pos = 0;
  while (pos < fila.length) {
    const linha = fila[pos++];
    const plain = simples(linha);
    if (ehLixo(plain) || RESTO_DA_FRASE.test(semMarcadores(plain)) || cabecalhos.has(plain)) { if (avisaAoIgnorar(plain)) ignorar(linha); continue; }

    // Páginas de instrução (o que é FS, WS, rest pause...) não são treino: valem até a próxima divisão.
    const semMarcaDaLinha = semMarcadores(plain);
    if (emInstrucoes) {
      if (!(acharBlocos(plain).length === 0 && linha.length <= 40 && ehTitulo(plain))) continue;
      emInstrucoes = false;
    } else if (GATILHO_DE_INSTRUCOES.test(semMarcaDaLinha)
      || (TITULO_CARDIO_EXPLICADO.test(plain.trim()) && fila[pos] !== undefined && (fila[pos].length > 70 || /^dias?\b[^:]{0,30}:/.test(simples(fila[pos]))))) {
      emInstrucoes = true;
      estado.atual = null;
      estado.nomeAberto = false;
      ignorar(linha);
      continue;
    }

    // A frase "Faça com 85% da carga" não é série nem nome: sai da linha e vai para o back off. A introdução sozinha também.
    const frase = acharFrasePercentual(plain);
    let plainUso = frase ? esvaziar(plain, frase.inicio, frase.fim) : plain;
    const introducao = INTRODUCAO_DA_FRASE.exec(plainUso);
    if (introducao) plainUso = esvaziar(plainUso, introducao.index, introducao.index + introducao[0].length);

    const blocos = acharBlocos(plainUso);
    const nomeAbertoAntes = estado.nomeAberto;
    estado.nomeAberto = false;

    if (blocos.length === 0) {
      if (frase) {
        const a = corrente();
        if (a && !a.cardio) aplicarFrase(a, frase);
        else ignorar(linha);
        continue;
      }
      if (ehTitulo(plain)) {
        const nome = cortar(semMarcadores(linha), NOME_MAXIMO_DA_SESSAO);
        const sessao = novaSessao(null);
        sessao.nome = nome;
        divisoes.push({ sessao, rascunhos: [], titulada: true });
        estado.atual = null;
        continue;
      }
      const semMarca = semMarcadores(plain);
      if (OBSERVACAO.test(semMarca)) {
        const textoDaObs = semMarcadores(linha).replace(/^[^:.\-]*[:.\-]?\s*/, '').trim() || semMarcadores(linha);
        const a = corrente();
        if (a) anexarObservacao(a, textoDaObs);
        else ignorar(linha);
        continue;
      }
      if (DESCANSO_SOLTO.test(semMarca)) {
        const tempo = acharTempos(plain)[0];
        const a = corrente();
        if (a && tempo) a.descansoGeral = tempo.segundos;
        else ignorar(linha);
        continue;
      }
      const cardio = lerCardio(linha, plain, indice);
      if (cardio) {
        const r = comecarExercicio(cardio.nome, true);
        if (r) {
          // "Cardio 50 min ou HIIT de 25 min": usa a primeira opção (50 min); a frase inteira vai na observação e a prévia avisa.
          r.item.plano.series = [novaSerieDeCardio({
            duracaoMin: cardio.minutos, distanciaKm: cardio.km, ritmo: cardio.ritmo, zona: null, intervalos: null,
          })];
          if (cardio.frase) {
            anexarObservacao(r, cardio.frase);
            if (cardio.minutos !== null) dizer(`“${r.item.plano.nome}”: o texto traz mais de uma opção; usei o primeiro tempo (${cardio.minutos} min) e a frase inteira ficou na observação. Confira.`);
            else if (cardio.km !== null) dizer(`“${r.item.plano.nome}”: o texto traz mais de uma opção; usei a primeira distância (${String(cardio.km).replace('.', ',')} km) e a frase inteira ficou na observação. Confira.`);
          }
        }
        continue;
      }
      const nome = semMarcadores(linha);
      const a = corrente();
      const pareceObservacao = COMECO_DE_OBSERVACAO.test(semMarca);
      if (a && nome) {
        // O nome do exercício quebrado em várias linhas ("Remada baixa na polia" / "unilateral"): junta até a linha das séries.
        if (!pareceObservacao && !a.cardio && a.blocos.length === 0 && nomeAbertoAntes && (comecoDeNome(nome, a) || terminaEmConector(a.item.digitado))) {
          juntarNome(a, nome);
          estado.nomeAberto = true;
          continue;
        }
        // Observação técnica solta ("Faça igual o vídeo...", "pegada neutra", linha que continua em minúscula): vai para o exercício.
        // A observação mantém a pontuação do texto (só os marcadores do começo saem).
        if (pareceObservacao || comecoDeNome(nome, a)) { anexarObservacao(a, linha.replace(/^[\s•·▪►→*#>◦○●■□-]+/, '')); continue; }
      }
      if (!nome || nome.length > NOME_MAXIMO_DO_EXERCICIO) { ignorar(linha); continue; }
      comecarExercicio(nome, false);
      estado.nomeAberto = true;
      continue;
    }

    // Linha com `NxM`: o que vem antes do primeiro bloco é o nome do exercício ou só o rótulo do tipo ("FS:", "- WS:").
    const ultimo = blocos[blocos.length - 1];
    // "Vídeo" no fim da linha é o rótulo da coluna de links: sai (a palavra solta em minúscula, dentro de uma frase, fica).
    const rotuloDeLink = /\s(?:Vídeo|Links?)\s*$/.exec(linha);
    if (rotuloDeLink && rotuloDeLink.index >= ultimo.fim) plainUso = esvaziar(plainUso, rotuloDeLink.index, plainUso.length);
    // Observação colada depois do tipo ("2x6 a 8 - Back off Faça igual o vídeo ao"): o resto da linha é do exercício.
    const naLinha = OBSERVACAO_NA_LINHA.exec(plainUso.slice(ultimo.fim));
    let observacaoDaLinha: string | null = null;
    if (naLinha) {
      const inicioDaObs = ultimo.fim + naLinha.index + naLinha[0].length - naLinha[1].length;
      observacaoDaLinha = linha.slice(inicioDaObs);
      plainUso = plainUso.slice(0, inicioDaObs);
    }
    const prefixo = semMarcadores(linha.slice(0, blocos[0].inicio));
    const rotuloDoPrefixo = prefixo ? aliases.mapa.get(chaveDeNome(prefixo)) ?? null : null;

    // "1x10 a 15 -" com o tipo na linha de baixo (Aquecimento, FS, WS, Back off): é a mesma série, não um exercício novo.
    // O PDF também pode pôr o resto do nome antes do tipo ("unilateral Aquecimento ..."): o pedaço volta para o nome.
    let pedacoDoNome: string | null = null;
    if (!rotuloDoPrefixo && !/[a-z0-9]/.test(plainUso.slice(ultimo.fim)) && fila[pos] !== undefined) {
      const terminaEmTraco = /[-:|]\s*$/.test(plainUso.trimEnd());
      let debaixo = tipoNoInicio(fila[pos], aliases);
      let restoDaLinha = fila[pos];
      if (!debaixo && terminaEmTraco && (inicialMinuscula(fila[pos]) || /^\(/.test(fila[pos]))) {
        const palavras = fila[pos].split(/\s+/);
        for (let n = 1; n <= 3 && n < palavras.length && !debaixo; n++) {
          const achado = tipoNoInicio(palavras.slice(n).join(' '), aliases);
          if (achado) { debaixo = achado; pedacoDoNome = palavras.slice(0, n).join(' '); restoDaLinha = achado.resto; }
        }
      } else if (debaixo) restoDaLinha = debaixo.resto;
      if (debaixo && (terminaEmTraco || restoDaLinha === '')) {
        plainUso = `${plainUso.trimEnd()} ${simples(debaixo.rotulo)}`;
        if (restoDaLinha) fila[pos] = restoDaLinha;
        else fila.splice(pos, 1);
      } else pedacoDoNome = null;
    }

    const atual = corrente();
    if (prefixo && !rotuloDoPrefixo) {
      const continuaONome = atual && !atual.cardio && (atual.blocos.length > 0 || nomeAbertoAntes)
        && (comecoDeNome(prefixo, atual) || (atual.blocos.length === 0 && terminaEmConector(atual.item.digitado)));
      if (continuaONome && atual) juntarNome(atual, prefixo);
      else {
        if (prefixo.length > NOME_MAXIMO_DO_EXERCICIO) { ignorar(linha); continue; }
        comecarExercicio(prefixo, false);
      }
    }
    const r = corrente();
    if (!r || r.cardio) { ignorar(linha); continue; }
    if (pedacoDoNome) juntarNome(r, pedacoDoNome);

    // Estilo "antes" (rótulo no começo, "FS: 2x3 + WS: 2x6"): o tipo de cada bloco está no texto que o precede.
    // Estilo "depois" (o mais comum, "2x3 FS + 2x6 WS"): está no texto que o segue, até o próximo bloco.
    const estiloAntes = rotuloDoPrefixo !== null;
    const lidos = blocos.map((b, k) => {
      const fimDoSegmento = k + 1 < blocos.length ? blocos[k + 1].inicio : plainUso.length;
      const leitura = lerSegmento(plainUso.slice(b.fim, fimDoSegmento), aliases);
      const tipo = estiloAntes
        ? k === 0 ? rotuloDoPrefixo : aliases.achar(limpoParaProcura(plainUso.slice(blocos[k - 1].fim, b.inicio)))?.tipo ?? null
        : leitura.tipo;
      return { b, leitura, tipo };
    });
    const descansoDoFim = lidos[lidos.length - 1].leitura.descanso;
    lidos.forEach((x) => {
      const tipo = x.tipo;
      if (x.leitura.tipoDesconhecido && !tipo) dizer(`Um tipo de série da linha “${cortar(linha, 40)}” não existe na metodologia: usei a série de trabalho.`);
      if (x.b.n < 1 || x.b.n > LIMITE_SERIES || x.b.min < 1 || x.b.min > REPETICOES_MAXIMAS) { ignorar(linha); return; }
      if (x.leitura.tecnica && !tecnicaNaMetodologia(metodologia, x.leitura.tecnica)) dizer('Uma técnica do texto não está na metodologia do plano: ela foi ignorada.');
      if (x.leitura.tecnica === 'CLUSTER' && tecnicaNaMetodologia(metodologia, 'CLUSTER')) dizer('Cluster: defina os blocos de repetições no editor (o texto não traz o padrão).');
      r.blocos.push({
        tipo,
        n: x.b.n,
        min: x.b.min,
        max: x.b.max,
        leitura: x.leitura,
        // "2x4 a 6 FS + 2x6 a 8 WS - 90s": o descanso do fim da linha vale para os blocos que não escreveram o seu.
        descansoDaLinha: lidos.length > 1 ? descansoDoFim : null,
        percentualDaFrase: tipo?.papel === 'POS_TRABALHO' ? r.percentualDaFrase : null,
      });
    });
    if (frase) aplicarFrase(r, frase);
    if (observacaoDaLinha) anexarObservacao(r, observacaoDaLinha);
  }

  // Séries de cada exercício (a regra de FS depende do total, por isso só no fim) e as divisões que valem.
  const prontas: DivisaoLida[] = [];
  const haDivisaoTitulada = divisoes.some((d) => d.titulada && d.rascunhos.length > 0);
  for (const d of divisoes) {
    // Texto antes da primeira divisão que não trouxe nenhuma série é cabeçalho do documento (nome, aviso, legenda): fica de fora.
    if (!d.titulada && haDivisaoTitulada && d.rascunhos.every((r) => !r.cardio && r.blocos.length === 0)) {
      d.rascunhos.forEach((r) => ignorar(r.item.digitado));
      continue;
    }
    const itens: ItemLido[] = [];
    for (const r of d.rascunhos) {
      if (r.percentualDaFrase && !r.blocos.some((b) => b.tipo?.papel === 'POS_TRABALHO')) {
        dizer(`“${r.item.plano.nome}”: a frase de percentual do back off não achou série de back off e foi ignorada.`);
      }
      if (!r.cardio) r.item.plano.series = montarSeries(r, metodologia, dizer);
      itens.push(r.item);
    }
    if (itens.length === 0) {
      if (d.titulada) dizer(`A divisão “${d.sessao.nome}” não tem exercício reconhecido: ficou de fora.`);
      continue;
    }
    d.sessao.exercicios = itens.map((i) => i.plano);
    prontas.push({ sessao: d.sessao, itens });
  }

  const todos = prontas.flatMap((d) => d.itens);
  return {
    sessoes: prontas.map((d) => d.sessao),
    divisoes: prontas,
    resumo: {
      divisoes: prontas.length,
      exercicios: todos.length,
      series: todos.reduce((s, i) => s + i.plano.series.length, 0),
      semBiblioteca: todos.filter((i) => !i.vinculado).length,
      semSeries: todos.filter((i) => i.plano.series.length === 0).length,
    },
    avisos,
    ignoradas,
  };
}

// ---- Cardio ----

/** `frase`: o texto trazia duas opções ("50 min ou HIIT de 25 min"); `minutos`/`km` trazem só a primeira medida e a frase inteira vai para a observação. */
interface CardioLido { nome: string; minutos: number | null; km: number | null; ritmo: string | null; frase: string | null }

function lerCardio(linha: string, plain: string, indice: Entrada[]): CardioLido | null {
  const min = /(\d{1,3})(?:[.,]\d+)?\s*(?:min(?:utos?)?)(?![a-z0-9])/.exec(plain);
  const km = /(\d{1,3}(?:[.,]\d+)?)\s*km(?![a-z0-9])/.exec(plain);
  if (!min && !km) return null;
  const comecaComCardio = /^[\s•·\-*]*cardio\b/.test(plain);
  const primeiro = Math.min(min?.index ?? Infinity, km?.index ?? Infinity);
  const nomeBruto = semMarcadores(linha.slice(0, primeiro)).replace(/^cardio\s*[:\-]?\s*/i, '').replace(/\b(?:por|de|durante)$/i, '').trim();
  const conhecido = nomeBruto ? acharNaBiblioteca(nomeBruto, indice, true) : null;
  if (!comecaComCardio && !PALAVRAS_DE_CARDIO.test(plain) && !conhecido) return null;
  const nome = nomeBruto || 'Cardio';
  const fimDoUltimo = Math.max(min ? min.index + min[0].length : 0, km ? km.index + km[0].length : 0);
  const fimDoPrimeiro = Math.min(min ? min.index + min[0].length : Infinity, km ? km.index + km[0].length : Infinity);
  const resto = semMarcadores(linha.slice(fimDoUltimo));
  const depois = plain.slice(fimDoPrimeiro);
  const comAlternativa = /^\s*(?:ou|\/)\s*\S/.test(depois) && (acharTempos(depois).length > 0 || /\bkm\b|\bhiit\b/.test(depois));
  // Com alternativas só vale a PRIMEIRA medida da linha (tempo ou distância); a outra fica só na frase da observação.
  const primeiraEKm = comAlternativa && !!km && (!min || km.index < min.index);
  const minutos = min && !(comAlternativa && primeiraEKm) ? Number(min[1]) : null;
  const kmNumero = km && !(comAlternativa && !primeiraEKm) ? Number(km[1].replace(',', '.')) : null;
  return {
    nome,
    minutos: minutos !== null && minutos >= 1 && minutos <= 600 ? minutos : null,
    km: kmNumero !== null && kmNumero > 0 && kmNumero <= 1000 ? kmNumero : null,
    ritmo: comAlternativa ? null : resto && resto.length <= 40 ? resto : null,
    frase: comAlternativa ? semMarcadores(linha) : null,
  };
}

// ---- Para o editor ----

/** Substituir quando o plano ainda não tem exercício nenhum; senão, acrescentar as divisões ao fim. */
export function modoDeTrazer(atual: Pick<ConteudoTreino, 'sessoes'>): 'SUBSTITUIR' | 'ADICIONAR' {
  return atual.sessoes.every((s) => s.exercicios.length === 0) ? 'SUBSTITUIR' : 'ADICIONAR';
}

/** Como a Folha chama a ação, antes de o treinador tocar. */
export function rotuloDeTrazer(atual: Pick<ConteudoTreino, 'sessoes'>): string {
  return modoDeTrazer(atual) === 'SUBSTITUIR' ? 'Trazer para o editor' : 'Adicionar ao plano';
}

/** O conteúdo do editor depois de trazer as divisões lidas (uids já são novos; o resto do plano não muda). */
export function trazerParaOEditor(atual: ConteudoTreino, lidas: Sessao[]): ConteudoTreino {
  return modoDeTrazer(atual) === 'SUBSTITUIR' ? { ...atual, sessoes: lidas } : { ...atual, sessoes: [...atual.sessoes, ...lidas] };
}

/** "5 divisões · 12 exercícios · 40 séries prontas", como a Folha mostra (singular quando for um). */
export function textoDoResumo(r: LeituraDoTexto['resumo']): string {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  return `${plural(r.divisoes, 'divisão', 'divisões')} · ${plural(r.exercicios, 'exercício', 'exercícios')} · ${plural(r.series, 'série pronta', 'séries prontas')}`;
}

/** Resumo curto das séries de um exercício para a prévia: "2× FS 3–5 · 1× WS 8 (RIR 0)", cardio "20 min". */
export function descreverSeries(series: readonly Serie[], config: Configuracao | null | undefined): string {
  if (series.length === 0) return 'sem séries';
  const grupos: { s: Serie; n: number }[] = [];
  for (const s of series) {
    const ultimo = grupos[grupos.length - 1];
    const igual = ultimo && ultimo.s.tipo === s.tipo && ultimo.s.repsMin === s.repsMin && ultimo.s.repsMax === s.repsMax && ultimo.s.esforco?.rir === s.esforco?.rir;
    if (igual) ultimo.n++;
    else grupos.push({ s, n: 1 });
  }
  return grupos.map(({ s, n }) => {
    if (s.cardio) {
      const partes = [s.cardio.duracaoMin ? `${s.cardio.duracaoMin} min` : null, s.cardio.distanciaKm ? `${String(s.cardio.distanciaKm).replace('.', ',')} km` : null].filter(Boolean);
      return partes.join(' · ') || 'cardio';
    }
    const reps = s.repsMin == null ? '' : s.repsMax != null && s.repsMax !== s.repsMin ? ` ${s.repsMin} a ${s.repsMax}` : ` ${s.repsMin}`;
    const rir = s.esforco?.rir != null ? ` (RIR ${s.esforco.rir})` : s.esforco?.rpe != null ? ` (RPE ${String(s.esforco.rpe).replace('.', ',')})` : '';
    const tecnica = s.tecnica ? ` + ${s.tecnica.tipo === 'REST_PAUSE' ? 'rest pause' : s.tecnica.tipo === 'CLUSTER' ? 'cluster' : s.tecnica.tipo === 'DROP_SET' ? 'drop-set' : s.tecnica.tipo.toLowerCase()}` : '';
    const descanso = s.descansoSegundos ? ` · ${s.descansoSegundos} s` : '';
    return `${n}× ${nomeDoTipo(config ?? CONFIGURACAO_PADRAO, s.tipo)}${reps}${rir}${tecnica}${descanso}`;
  }).join(' · ');
}
