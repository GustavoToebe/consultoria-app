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
  /^dia\s*(?:\d{1,2}|[a-z])\b.*$/,
  /^day\s*\d{1,2}\b.*$/,
  /^(?:upper|lower|push|pull|legs|inferiores?|superiores?|full body)(?:\s+(?:day|body|a|b|c|d|1|2|3))?(?:\s+-\s+.*|\s*[:(].*)?$/,
];

function ehTitulo(plain: string): boolean {
  const t = plain.replace(/^[\s#*>•·\-]+/, '').replace(/:+$/, '').trim();
  return DIA_DA_SEMANA.test(t) || TITULOS.some((r) => r.test(t));
}

const CABECALHO_DE_TABELA = /^(?:exercicios?|series?|repeticoes|reps|descanso|carga|tipo|obs\w*)(?:\s+(?:exercicios?|series?|repeticoes|reps|descanso|carga|tipo|obs\w*))*$/;
const CABECALHO_DO_DOCUMENTO = /^(?:(?:objetivo|aluno|aluna|nome|periodo|data|professor|professora|treinador|treinadora|consultoria|plano)\b[^:]{0,30}:|(?:pagina|semana|ciclo)\s*\d)/;
const OBSERVACAO = /^(?:obs|observacao|observacoes|nota|dica|atencao|importante)\b\s*[:.-]?\s*/;
const DESCANSO_SOLTO = /^descanso\b/;
const PALAVRAS_DE_CARDIO = /\b(?:cardio|esteira|bicicleta|bike|escada|eliptico|transport|corrida|caminhada|spinning|natacao|remo ergometro|ergometro|simulador)\b/;

/** Enfeite, cabeçalho de tabela e cabeçalho do documento: nada disso é treino. */
function ehLixo(plain: string): boolean {
  return /^[\s\-_=*#.•|]+$/.test(plain) || CABECALHO_DE_TABELA.test(plain.trim()) || CABECALHO_DO_DOCUMENTO.test(plain.trim());
}

/** Só o cabeçalho do documento ("Aluno: ...") aparece em "linhas ignoradas"; enfeite e cabeçalho de tabela somem calados. */
const avisaAoIgnorar = (plain: string) => CABECALHO_DO_DOCUMENTO.test(plain.trim());

// ---- Montagem ----

interface BlocoDeSerie {
  tipo: TipoDeSerie | null;
  n: number;
  min: number;
  max: number | null;
  leitura: LeituraDoSegmento;
  descansoDaLinha: number | null;
}

interface Rascunho {
  item: ItemLido;
  blocos: BlocoDeSerie[];
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
        carga = b.leitura.percentual ? faixa(b.leitura.percentual) : cargaInicial(tipo);
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
  const estado: { atual: Rascunho | null } = { atual: null };
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
    const nome = cortar(achado?.nome ?? digitado, NOME_MAXIMO_DO_EXERCICIO);
    let plano: ExercicioPlano = { ...novoExercicio(), nome };
    if (achado) plano = { ...plano, exercicioId: achado.id, videoUrl: achado.videoUrl ?? null };
    plano = comModalidade(plano, cardio ? 'CARDIO' : achado ? achado.modalidade : null);
    const r: Rascunho = { item: { plano, digitado, grupoMuscular: achado?.grupoMuscular ?? null, vinculado: !!achado }, blocos: [], descansoGeral: null, cardio };
    divisao.rascunhos.push(r);
    estado.atual = r;
    return r;
  };

  const linhas = texto.split(/\r?\n/);
  for (const bruta of linhas) {
    const linha = limparLinha(bruta);
    if (!linha) continue;
    const plain = simples(linha);
    if (ehLixo(plain)) { if (avisaAoIgnorar(plain)) ignorar(linha); continue; }

    const blocos = acharBlocos(plain);

    if (blocos.length === 0) {
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
        if (a) a.item.plano.observacao = cortar([a.item.plano.observacao, textoDaObs].filter(Boolean).join(' '), 1000);
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
          r.item.plano.series = [novaSerieDeCardio({ duracaoMin: cardio.minutos, distanciaKm: cardio.km, ritmo: cardio.ritmo, zona: null, intervalos: null })];
        }
        continue;
      }
      const nome = semMarcadores(linha);
      if (!nome || nome.length > NOME_MAXIMO_DO_EXERCICIO) { ignorar(linha); continue; }
      comecarExercicio(nome, false);
      continue;
    }

    // Linha com `NxM`: o que vem antes do primeiro bloco é o nome do exercício ou só o rótulo do tipo ("FS:", "- WS:").
    const prefixoBruto = linha.slice(0, blocos[0].inicio);
    const prefixo = semMarcadores(prefixoBruto);
    const rotuloDoPrefixo = prefixo ? aliases.mapa.get(chaveDeNome(prefixo)) ?? null : null;
    const novoNome = prefixo && !rotuloDoPrefixo ? prefixo : null;
    if (novoNome) {
      if (novoNome.length > NOME_MAXIMO_DO_EXERCICIO) { ignorar(linha); continue; }
      comecarExercicio(novoNome, false);
    }
    const r = corrente();
    if (!r || r.cardio) { ignorar(linha); continue; }

    // Estilo "antes" (rótulo no começo, "FS: 2x3 + WS: 2x6"): o tipo de cada bloco está no texto que o precede.
    // Estilo "depois" (o mais comum, "2x3 FS + 2x6 WS"): está no texto que o segue, até o próximo bloco.
    const estiloAntes = rotuloDoPrefixo !== null;
    const lidos = blocos.map((b, i) => {
      const fimDoSegmento = i + 1 < blocos.length ? blocos[i + 1].inicio : plain.length;
      const leitura = lerSegmento(plain.slice(b.fim, fimDoSegmento), aliases);
      const tipo = estiloAntes
        ? i === 0 ? rotuloDoPrefixo : aliases.achar(limpoParaProcura(plain.slice(blocos[i - 1].fim, b.inicio)))?.tipo ?? null
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
      });
    });
  }

  // Séries de cada exercício (a regra de FS depende do total, por isso só no fim) e as divisões que valem.
  const prontas: DivisaoLida[] = [];
  for (const d of divisoes) {
    const itens: ItemLido[] = [];
    for (const r of d.rascunhos) {
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

interface CardioLido { nome: string; minutos: number | null; km: number | null; ritmo: string | null }

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
  const resto = semMarcadores(linha.slice(fimDoUltimo));
  const minutos = min ? Number(min[1]) : null;
  const kmNumero = km ? Number(km[1].replace(',', '.')) : null;
  return {
    nome,
    minutos: minutos !== null && minutos >= 1 && minutos <= 600 ? minutos : null,
    km: kmNumero !== null && kmNumero > 0 && kmNumero <= 1000 ? kmNumero : null,
    ritmo: resto && resto.length <= 40 ? resto : null,
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
