import type { PacoteSalvo } from './repositorioLocal';

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): v is Objeto => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown) => v == null || (typeof v === 'number' && Number.isFinite(v));
const texto = (v: unknown) => v == null || typeof v === 'string';
const campos = (v: Objeto, permitidos: readonly string[]) => Object.keys(v).every((k) => permitidos.includes(k));
const lista = (v: unknown, conferir: (x: unknown) => boolean) => Array.isArray(v) && v.every(conferir);
const todos = (v: Objeto, chaves: readonly string[], conferir: (x: unknown) => boolean) => chaves.every((k) => conferir(v[k]));

const MODOS_DE_CARGA = ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'ABAIXO_DA_REFERENCIA', 'NENHUMA'];
const TIPOS_DE_TECNICA = [
  'REST_PAUSE', 'CLUSTER', 'DROP_SET', 'MYO_REPS', 'PARTIAL_REPS', 'FORCED_REPS',
  'NEGATIVA', 'SUPER_SLOW', 'VINTE_E_UM', 'EMOM', 'PIRAMIDE_CRESCENTE', 'PIRAMIDE_DECRESCENTE',
  'PIRAMIDE_TRUNCADA', 'DUPLA_PROGRESSAO', 'GVT', 'FST7', 'ESPECIALIZACAO',
];
const TECNICAS_DE_GRUPO = ['SUPERSET', 'AGONISTA_ANTAGONISTA', 'TRI_SET', 'GIANT_SET', 'CIRCUITO', 'PRE_EXAUSTAO', 'POS_EXAUSTAO'];
const PAPEIS = ['AQUECIMENTO', 'PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'OUTRO'];
const REGIOES = ['ALONGADA', 'ENCURTADA', 'LIVRE'];
const CAMPOS_NUMERICOS_DA_TECNICA = [
  'pausaSegundos',
  'pausaRespiracoes',
  'pausas',
  'quedas',
  'reducaoPercentual',
  'repsPorQueda',
  'miniSeries',
  'repsPorMiniSerie',
  'repsParciais',
  'repsAssistidas',
] as const;

/** Carga nula é "sem carga"; o `modo` é um dos seis e os números e a referência têm o tipo certo. */
function carga(v: unknown): boolean {
  if (v == null) return true;
  return objeto(v) && campos(v, ['modo', 'percentualMin', 'percentualMax', 'referenciaUid']) && MODOS_DE_CARGA.includes(String(v.modo)) && numero(v.percentualMin) && numero(v.percentualMax) && texto(v.referenciaUid);
}

function esforco(v: unknown): boolean {
  return v == null || (objeto(v) && campos(v, ['rir', 'rpe']) && numero(v.rir) && numero(v.rpe));
}

/** Carga de uma etapa: da série ou % da WS (docs/series-etapas.md). */
function cargaDaEtapa(v: unknown): boolean {
  return objeto(v) && campos(v, ['modo', 'percentual']) && ['DA_SERIE', 'PERCENTUAL_WS'].includes(String(v.modo)) && numero(v.percentual);
}

function retomada(v: unknown): boolean {
  return objeto(v) && campos(v, ['repsMin', 'repsMax', 'amrap', 'carga']) && numero(v.repsMin) && numero(v.repsMax)
    && (v.amrap == null || typeof v.amrap === 'boolean') && (v.carga == null || cargaDaEtapa(v.carga));
}

function tecnica(v: unknown): boolean {
  if (v == null) return true;
  return (
    objeto(v) &&
    campos(v, ['tipo', ...CAMPOS_NUMERICOS_DA_TECNICA, 'blocos', 'regiao', 'cargasDosBlocos', 'retomadas']) &&
    (v.cargasDosBlocos == null || lista(v.cargasDosBlocos, cargaDaEtapa)) &&
    (v.retomadas == null || lista(v.retomadas, retomada)) &&
    TIPOS_DE_TECNICA.includes(String(v.tipo)) &&
    (v.blocos == null || lista(v.blocos, (b) => typeof b === 'number' && Number.isFinite(b))) &&
    (v.regiao == null || REGIOES.includes(String(v.regiao))) &&
    todos(v, CAMPOS_NUMERICOS_DA_TECNICA, numero)
  );
}

function cardio(v: unknown): boolean {
  if (v == null) return true;
  const intervalos = (i: unknown) => i == null || (objeto(i) && campos(i, ['trabalhoSeg', 'descansoSeg', 'voltas']) && todos(i, ['trabalhoSeg', 'descansoSeg', 'voltas'], numero));
  return objeto(v) && campos(v, ['duracaoMin', 'distanciaKm', 'ritmo', 'zona', 'intervalos']) && numero(v.duracaoMin) && numero(v.distanciaKm) && texto(v.ritmo) && numero(v.zona) && intervalos(v.intervalos);
}

function faixaDeRepeticoes(v: unknown): boolean {
  return v == null || (objeto(v) && campos(v, ['min', 'max']) && typeof v.min === 'number' && typeof v.max === 'number');
}

function faixaPercentual(v: unknown): boolean {
  return objeto(v) && campos(v, ['min', 'max']) && typeof v.min === 'number' && numero(v.max);
}

function padraoPorModalidade(v: unknown): boolean {
  return objeto(v) && campos(v, ['carga', 'esforco']) && carga(v.carga) && esforco(v.esforco);
}

function tipoDeSerie(v: unknown): boolean {
  return (
    objeto(v) &&
    campos(v, ['codigo', 'nome', 'papel', 'repeticoes', 'cargaPadrao', 'esforcoPadrao', 'porModalidade', 'regraPercentuais', 'explicacao']) &&
    typeof v.codigo === 'string' &&
    typeof v.nome === 'string' &&
    PAPEIS.includes(String(v.papel)) &&
    faixaDeRepeticoes(v.repeticoes) &&
    carga(v.cargaPadrao) &&
    esforco(v.esforcoPadrao) &&
    (v.porModalidade == null ||
      (objeto(v.porModalidade) && campos(v.porModalidade, ['LIVRE', 'MAQUINA']) && Object.values(v.porModalidade).every(padraoPorModalidade))) &&
    (v.regraPercentuais == null || (objeto(v.regraPercentuais) && Object.values(v.regraPercentuais).every((f) => lista(f, faixaPercentual)))) &&
    texto(v.explicacao)
  );
}

function metodologia(v: unknown): boolean {
  return (
    objeto(v) &&
    campos(v, ['tipos', 'tecnicas', 'combinacoes', 'arredondamentoKg', 'instrucoesTreino', 'rodapePdf']) &&
    lista(v.tipos, tipoDeSerie) &&
    Array.isArray(v.tecnicas) && v.tecnicas.length <= 17 &&
    lista(v.tecnicas, (t) => objeto(t) && campos(t, ['tipo', 'nome', 'explicacao', 'padrao']) && TIPOS_DE_TECNICA.includes(String(t.tipo)) && typeof t.nome === 'string' && texto(t.explicacao) && tecnica(t.padrao)) &&
    Array.isArray(v.combinacoes) && v.combinacoes.length <= 7 &&
    lista(v.combinacoes, (c) => objeto(c) && campos(c, ['tipo', 'nome', 'explicacao']) && TECNICAS_DE_GRUPO.includes(String(c.tipo)) && typeof c.nome === 'string' && texto(c.explicacao)) &&
    typeof v.arredondamentoKg === 'number' &&
    texto(v.instrucoesTreino) &&
    texto(v.rodapePdf)
  );
}

function serie(v: unknown): boolean {
  return (
    objeto(v) &&
    campos(v, ['uid', 'tipo', 'repsMin', 'repsMax', 'amrap', 'carga', 'esforco', 'descansoSegundos', 'tecnica', 'cardio', 'alvoExtra']) &&
    typeof v.uid === 'string' &&
    texto(v.tipo) &&
    numero(v.repsMin) &&
    numero(v.repsMax) &&
    (v.amrap == null || typeof v.amrap === 'boolean') &&
    carga(v.carga) &&
    esforco(v.esforco) &&
    numero(v.descansoSegundos) &&
    tecnica(v.tecnica) &&
    cardio(v.cardio) &&
    texto(v.alvoExtra)
  );
}

function exercicio(v: unknown): boolean {
  return (
    objeto(v) &&
    campos(v, ['uid', 'exercicioId', 'nome', 'modalidade', 'videoUrl', 'observacao', 'progressao', 'unidade', 'series', 'cadencia', 'isometriaSegundos', 'grupoUid']) &&
    typeof v.uid === 'string' &&
    lista(v.series, serie) &&
    texto(v.grupoUid) &&
    numero(v.isometriaSegundos)
  );
}

function grupo(v: unknown): boolean {
  return objeto(v) && campos(v, ['uid', 'tecnica', 'descansoAposSegundos', 'voltas']) && typeof v.uid === 'string' && TECNICAS_DE_GRUPO.includes(String(v.tecnica)) && numero(v.descansoAposSegundos) && numero(v.voltas);
}

function sessao(v: unknown): boolean {
  return (
    objeto(v) &&
    campos(v, ['uid', 'nome', 'diaSemana', 'tipo', 'frequenciaSemanal', 'observacao', 'cardio', 'exercicios', 'grupos']) &&
    typeof v.uid === 'string' &&
    lista(v.exercicios, exercicio) &&
    lista(v.grupos, grupo)
  );
}

/**
 * Aceita somente a estrutura atual (série com `carga`/`esforco`, `tipo` em código, grupos na sessão, combinações na
 * metodologia). Pacote ilegível é descartado e baixado de novo, sem conversão e sem apagar a fila.
 */
export function pacoteNoFormatoAtual(v: unknown): v is PacoteSalvo {
  if (!objeto(v) || typeof v.salvoEm !== 'string' || !objeto(v.pacote)) return false;
  const p = v.pacote;
  if (!objeto(p.configuracao) || typeof p.configuracao.tipoTrabalho !== 'string' || typeof p.configuracao.arredondamentoKg !== 'number') return false;
  if (p.treino === null) return true;
  if (!objeto(p.treino) || !objeto(p.treino.conteudo)) return false;
  const c = p.treino.conteudo;
  return (c.metodologia == null || (objeto(c.metodologia) && metodologia(c.metodologia.configuracao))) && lista(c.sessoes, sessao);
}
