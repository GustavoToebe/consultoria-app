import type {
  Cardio,
  Carga,
  Configuracao,
  ConteudoTreino,
  Esforco,
  ExercicioPlano,
  FaixaPercentual,
  ModoDeCarga,
  PapelDaSerie,
  Serie,
  Sessao,
  Tecnica,
  TipoDeTecnica,
  TipoSessao,
} from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { blocosValidos, somaDosBlocos } from './blocos';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import {
  cargaInicial,
  codigoTrabalho,
  copiarCarga,
  copiarEsforco,
  esforcoInicial,
  padraoDaTecnica,
  percentuaisDaRegra,
  repeticoesDoTipo,
  tipoPorCodigo,
  tipoTrabalho,
} from './metodologia';
import type { UnidadeDeCarga } from './unidadeDeCarga';
import { novoUid } from './uid';

/**
 * Operações do editor de treino. Todas puras (devolvem cópia), para o "Desfazer" e os testes. Nenhuma inventa carga
 * nem repetição: o que a série nova traz vem só da metodologia da consultoria (repetições, carga, esforço e regra de
 * percentuais do tipo; padrão da técnica), e depois quem manda é o que está gravado na série. `Serie.tipo` é o CÓDIGO do
 * tipo. As operações de grupos de exercícios da sessão ficam em `combinacoes`.
 */

export { moverExercicio, removerExercicio } from './combinacoes';

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const TIPOS_SESSAO: { valor: TipoSessao; rotulo: string }[] = [
  { valor: 'TREINO', rotulo: 'Treino' },
  { valor: 'DESCANSO_ATIVO', rotulo: 'Descanso ativo' },
  { valor: 'DESCANSO', rotulo: 'Descanso' },
  { valor: 'ACESSORIOS', rotulo: 'Acessórios' },
];

export const MODOS: { valor: ModoDeCarga; rotulo: string }[] = [
  { valor: 'CARGA_TRABALHO', rotulo: 'Carga de trabalho' },
  { valor: 'PERCENTUAL_WS', rotulo: '% da série de trabalho' },
  { valor: 'CARGA_FIXA', rotulo: 'Carga fixa (kg)' },
  // `NENHUMA` é a série sem sugestão de carga; o exercício "sem carga" (elástico, peso corporal) é a `unidade`, outra decisão.
  { valor: 'NENHUMA', rotulo: 'Sem sugestão de carga' },
];

export interface OpcaoDeModo {
  valor: ModoDeCarga;
  rotulo: string;
}

/**
 * Formas de carga que cada papel do tipo oferece, na ordem em que aparecem: aquecimento em "% da WS", carga fixa ou sem
 * sugestão; preparação e pós-trabalho em "% da WS" ou carga fixa; trabalho na carga de trabalho ou carga fixa. Papel
 * "Outro" (ou sem tipo na metodologia) oferece as quatro formas.
 */
const MODOS_POR_PAPEL: Partial<Record<PapelDaSerie, ModoDeCarga[]>> = {
  AQUECIMENTO: ['PERCENTUAL_WS', 'CARGA_FIXA', 'NENHUMA'],
  PREPARACAO: ['PERCENTUAL_WS', 'CARGA_FIXA'],
  TRABALHO: ['CARGA_TRABALHO', 'CARGA_FIXA'],
  POS_TRABALHO: ['PERCENTUAL_WS', 'CARGA_FIXA'],
};

/** Percentual com que um pós-trabalho (back off) passa para "% da WS" quando o tipo não traz esse padrão. */
const PERCENTUAL_PADRAO_DO_POS_TRABALHO = 85;

/**
 * As formas de carga que o papel oferece, com a base escrita pelo nome da série de trabalho da metodologia ("% da WS",
 * "Carga de trabalho (WS)"): o percentual sempre diz de onde sai, nunca do 1RM. A carga fixa é em kg ou na unidade do
 * treinador (`unidade`) e não é série de trabalho nem base de percentual.
 */
export function modosDeCarga(config: Configuracao | null | undefined, papel?: PapelDaSerie | null, unidade: UnidadeDeCarga = 'kg'): OpcaoDeModo[] {
  const base = tipoTrabalho(config) ?? 'WS';
  const rotulos: Record<ModoDeCarga, string> = {
    CARGA_TRABALHO: `Carga de trabalho (${base})`,
    PERCENTUAL_WS: `% da ${base}`,
    CARGA_FIXA: `Carga fixa (${unidade})`,
    NENHUMA: 'Sem sugestão de carga',
  };
  const valores = (papel && MODOS_POR_PAPEL[papel]) || MODOS.map((m) => m.valor);
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
}

export function novaSessao(diaSemana: number | null): Sessao {
  return {
    uid: novoUid(),
    nome: diaSemana ? DIAS_SEMANA[diaSemana - 1] : '',
    diaSemana,
    tipo: 'TREINO',
    frequenciaSemanal: null,
    observacao: null,
    cardio: null,
    exercicios: [],
    grupos: [],
  };
}

export function novoExercicio(): ExercicioPlano {
  return {
    uid: novoUid(),
    exercicioId: null,
    nome: '',
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
    grupoUid: null,
  };
}

/** Limite de séries por exercício, o mesmo do servidor (`ConteudoTreino`, `@Size(max = 30)`): contado no exercício todo. */
export const LIMITE_SERIES = 30;

/** Descanso aceito pelo servidor (`ValidadorTreino`): de 0 a 1 hora, em segundos. */
export const DESCANSO_MAXIMO_SEGUNDOS = 3600;

/** Carga só com a forma (os números o treinador preenche); `NENHUMA` é `null`, como o servidor aceita. A fixa leva `valorKg` vazio. */
export function cargaDoModo(modo: ModoDeCarga): Carga | null {
  if (modo === 'NENHUMA') return null;
  if (modo === 'CARGA_FIXA') return { modo, percentualMin: null, percentualMax: null, valorKg: null };
  return { modo, percentualMin: null, percentualMax: null };
}

/** Técnica nova com o padrão da metodologia (pausa, pausas, quedas...); o resto o treinador preenche e a publicação cobra o que faltar. */
export function tecnicaVazia(tipo: TipoDeTecnica, padrao?: Tecnica | null): Tecnica {
  return {
    pausaSegundos: null,
    pausaRespiracoes: null,
    pausas: null,
    blocos: null,
    quedas: null,
    reducaoPercentual: null,
    repsPorQueda: null,
    miniSeries: null,
    repsPorMiniSerie: null,
    repsParciais: null,
    regiao: null,
    repsAssistidas: null,
    ...(padrao ?? {}),
    tipo,
    ...(padrao?.blocos ? { blocos: [...padrao.blocos] } : {}),
  };
}

/** Cluster: as repetições da série são a soma dos blocos válidos. Blocos incompletos não guardam o total anterior. */
function comRepsDoCluster(s: Serie): Serie {
  if (s.tecnica?.tipo !== 'CLUSTER') return s;
  if (!blocosValidos(s.tecnica.blocos)) return { ...s, repsMin: null, repsMax: null, amrap: null };
  const soma = somaDosBlocos(s.tecnica.blocos)!;
  return { ...s, repsMin: soma, repsMax: soma, amrap: null };
}

/** Série de cardio (exercício `CARDIO`): só a prescrição de cardio, sem tipo, repetições, carga, esforço nem técnica. */
export function novaSerieDeCardio(cardio: Cardio | null = null): Serie {
  return {
    uid: novoUid(),
    tipo: null,
    repsMin: null,
    repsMax: null,
    amrap: null,
    carga: null,
    esforco: null,
    descansoSegundos: null,
    tecnica: null,
    cardio: cardio ? copiarCardio(cardio) : { duracaoMin: null, distanciaKm: null, ritmo: null, zona: null, intervalos: null },
    alvoExtra: null,
  };
}

/**
 * Série nova. `tipo` (CÓDIGO) ausente = o tipo de trabalho da metodologia (sem ela, a padrão). Tipo da metodologia traz as
 * repetições, a carga e o esforço com que ele nasce; o de preparação, a regra de 1 série; tipo fora da metodologia
 * nasce em carga de trabalho. A técnica vem com o padrão da metodologia (cluster com blocos no padrão já tem as repetições
 * somadas). Exercício `CARDIO` dá série de cardio.
 */
export function novaSerie(
  config: Configuracao | null | undefined,
  tipo?: string,
  modalidade: string | null = null,
  tecnica: TipoDeTecnica | null = null,
): Serie {
  if (modalidade === 'CARDIO') return novaSerieDeCardio();
  const metodologia = config ?? CONFIGURACAO_PADRAO;
  const codigo = tipo ?? codigoTrabalho(metodologia) ?? metodologia.tipos[0]?.codigo ?? 'WORKING';
  const daMetodologia = tipoPorCodigo(metodologia, codigo);
  const reps = repeticoesDoTipo(daMetodologia);
  let carga: Carga | null;
  let esforco: Esforco | null = null;
  if (daMetodologia) {
    carga = cargaInicial(daMetodologia);
    esforco = esforcoInicial(daMetodologia);
    const regra = daMetodologia.papel === 'PREPARACAO' ? percentuaisDaRegra(daMetodologia, 1) : null;
    if (regra && (carga == null || carga.modo === 'PERCENTUAL_WS')) {
      carga = { ...(carga ?? cargaDoModo('PERCENTUAL_WS')!), percentualMin: regra[0].min, percentualMax: regra[0].max };
    }
  } else {
    carga = cargaDoModo('CARGA_TRABALHO');
  }
  const serie: Serie = {
    uid: novoUid(),
    tipo: codigo,
    repsMin: reps?.min ?? null,
    repsMax: reps?.max ?? null,
    amrap: null,
    carga,
    esforco,
    descansoSegundos: null,
    tecnica: tecnica ? tecnicaVazia(tecnica, padraoDaTecnica(metodologia, tecnica)) : null,
    cardio: null,
    alvoExtra: null,
  };
  return comRepsDoCluster(serie);
}

/**
 * "Adicionar série" com o tipo (CÓDIGO) e, se quiser, a técnica escolhidos: entra no fim do exercício. Se o último grupo já
 * é desse tipo e dessa técnica, soma uma série a ele pelo mesmo caminho do "+" (copia a última e a regra de preparação
 * continua valendo); senão nasce um grupo novo. Tipo (para que a série serve) e técnica (como executar) são
 * independentes: um tipo fora de `config.tipos` é aceito (a publicação avisa). No limite de séries do exercício, nada
 * muda. Para pôr o grupo novo antes de outro, o treinador usa ↑ (`moverGrupo`). Em exercício `CARDIO` entra série de cardio.
 */
export function adicionarSerie(
  series: Serie[],
  config: Configuracao | null | undefined,
  tipo?: string,
  tecnica: TipoDeTecnica | null = null,
  modalidade: string | null = null,
): Serie[] {
  if (series.length >= LIMITE_SERIES) return series;
  const nova = novaSerie(config, tipo, modalidade, tecnica);
  const grupos = agrupar(series);
  const ultimo = grupos[grupos.length - 1];
  // Soma ao último grupo só se for o mesmo tipo com a mesma técnica: "1 WS + 1 WS em rest pause" precisa de dois
  // grupos, senão a técnica escolhida depois valeria para as duas.
  if (ultimo && (ultimo.series[0].tipo ?? null) === (nova.tipo ?? null) && (ultimo.series[0].tecnica?.tipo ?? null) === tecnica) {
    return mudarQuantidade(series, ultimo, ultimo.series.length + 1, config);
  }
  return [...series, nova];
}

/**
 * Troca um grupo de séries de lugar com o vizinho (↑↓ no editor): o FS criado depois da WS sobe para antes dela. Os
 * uids e o conteúdo de cada série ficam iguais; só a ordem muda.
 */
export function moverGrupo(series: Serie[], indiceDoGrupo: number, delta: -1 | 1): Serie[] {
  const grupos = agrupar(series);
  const reordenados = mover(grupos, indiceDoGrupo, delta);
  if (reordenados === grupos) return series;
  return reordenados.flatMap((g) => g.series);
}

/** Troca um item de lugar com o vizinho (setas ↑↓). Fora dos limites devolve a mesma lista. */
export function mover<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function substituir<T>(lista: T[], indice: number, item: T): T[] {
  return lista.map((x, i) => (i === indice ? item : x));
}

export function remover<T>(lista: T[], indice: number): T[] {
  return lista.filter((_, i) => i !== indice);
}

function comPercentuais(series: Serie[], faixas: FaixaPercentual[]): Serie[] {
  return series.map((s, i) => ({
    ...s,
    carga: { modo: 'PERCENTUAL_WS', percentualMin: faixas[i].min, percentualMax: faixas[i].max },
  }));
}

function trocarGrupo(series: Serie[], grupo: GrupoDeSeries, novas: Serie[]): Serie[] {
  return [...series.slice(0, grupo.inicio), ...novas, ...series.slice(grupo.inicio + grupo.series.length)];
}

/** A regra de percentuais do tipo (só preparação) para `n` séries, se a série está em "% da série de trabalho". */
function regraDoGrupo(config: Configuracao | null | undefined, primeira: Serie, n: number): FaixaPercentual[] | null {
  if (primeira.carga?.modo !== 'PERCENTUAL_WS') return null;
  const tipo = tipoPorCodigo(config, primeira.tipo);
  return tipo?.papel === 'PREPARACAO' ? percentuaisDaRegra(tipo, n) : null;
}

/**
 * Muda a quantidade de séries de um grupo: acrescenta cópias da última (uids novos) ou tira do fim. Se o grupo é de
 * preparação em % (FS) e a metodologia tem regra para a nova quantidade, os percentuais são preenchidos por ela
 * (3 FS = 50/70/85–90; 2 FS = 70/85–90). Depois cada série pode ser editada.
 */
export function mudarQuantidade(series: Serie[], grupo: GrupoDeSeries, n: number, config: Configuracao | null | undefined): Serie[] {
  if (n < 1 || series.length - grupo.series.length + n > LIMITE_SERIES) return series;
  const ultima = grupo.series[grupo.series.length - 1];
  let novas =
    n <= grupo.series.length
      ? grupo.series.slice(0, n)
      : [...grupo.series, ...Array.from({ length: n - grupo.series.length }, () => serieNormalizada(ultima, novoUid()))];
  const regra = regraDoGrupo(config, ultima, n);
  if (regra) novas = comPercentuais(novas, regra);
  return trocarGrupo(series, grupo, novas);
}

export interface AlteracaoDeGrupo {
  /** CÓDIGO do tipo (da metodologia ou fora dela). */
  tipo?: string;
  repsMin?: number | null;
  repsMax?: number | null;
  /** AMRAP explícito: `true` tira as repetições; informar repetições tira o AMRAP. */
  amrap?: boolean;
  /** Troca a forma de carga de todas as séries do grupo (parte do padrão do tipo quando ele é dessa forma). */
  modo?: ModoDeCarga;
  /** Valores da carga para todas as séries do grupo (uma faixa de % única). */
  carga?: Partial<Carga>;
  /** Esforço de todas as séries do grupo (RIR ou RPE, nunca os dois); nulo tira. */
  esforco?: Esforco | null;
  /** Descanso depois de cada série do grupo, em segundos (vazio = sem descanso definido). */
  descansoSegundos?: number | null;
  /** Técnica do grupo (cluster, rest pause, drop-set, myo-reps, partial reps ou forced reps); nulo tira. */
  tecnica?: Tecnica | null;
  alvoExtra?: string | null;
  /** Prescrição de cardio (só em exercício `CARDIO`). */
  cardio?: Cardio | null;
}

/**
 * Aplica a mudança a todas as séries do grupo. Trocar o tipo põe a carga, o esforço e as repetições com que esse tipo
 * nasce na metodologia (preparação com a regra para a quantidade do grupo; tipo fora dela mantém o que estava). Trocar a
 * forma de carga parte do padrão do tipo quando ele é dessa forma (Back off de volta a "% da WS" volta aos 85%). Cluster
 * mantém as repetições iguais à soma dos blocos. Tudo continua editável.
 */
export function alterarGrupo(
  series: Serie[],
  grupo: GrupoDeSeries,
  mudanca: AlteracaoDeGrupo,
  config: Configuracao | null | undefined,
): Serie[] {
  const primeira = grupo.series[0];
  const trocouTipo = mudanca.tipo !== undefined && mudanca.tipo !== (primeira.tipo ?? null);
  const tipoFinal = tipoPorCodigo(config, trocouTipo ? mudanca.tipo : primeira.tipo);
  // Trocar o tipo preenche carga e esforço do tipo (se a mudança não trouxer os seus) e a faixa de repetições dele.
  const cargaDoTipo = trocouTipo && tipoFinal && mudanca.modo === undefined && mudanca.carga === undefined ? cargaInicial(tipoFinal) : undefined;
  const esforcoDoTipo = trocouTipo && tipoFinal && mudanca.esforco === undefined ? esforcoInicial(tipoFinal) : undefined;
  const repsDoNovoTipo = trocouTipo && mudanca.repsMin === undefined && mudanca.repsMax === undefined && mudanca.amrap === undefined ? repeticoesDoTipo(tipoFinal) : null;
  let novas = grupo.series.map((s) => {
    const nova: Serie = { ...s };
    if (mudanca.tipo !== undefined) nova.tipo = mudanca.tipo;
    if (repsDoNovoTipo) {
      nova.repsMin = repsDoNovoTipo.min;
      nova.repsMax = repsDoNovoTipo.max;
      nova.amrap = null;
    }
    if (mudanca.repsMin !== undefined) nova.repsMin = mudanca.repsMin;
    if (mudanca.repsMax !== undefined) nova.repsMax = mudanca.repsMax;
    if ((mudanca.repsMin ?? null) !== null || (mudanca.repsMax ?? null) !== null) nova.amrap = null;
    if (mudanca.amrap !== undefined) {
      nova.amrap = mudanca.amrap ? true : null;
      if (mudanca.amrap) {
        nova.repsMin = null;
        nova.repsMax = null;
      }
    }
    if (mudanca.descansoSegundos !== undefined) nova.descansoSegundos = mudanca.descansoSegundos;
    if (mudanca.tecnica !== undefined) nova.tecnica = mudanca.tecnica;
    if (mudanca.alvoExtra !== undefined) nova.alvoExtra = mudanca.alvoExtra?.trim() ? mudanca.alvoExtra : null;
    if (mudanca.cardio !== undefined) nova.cardio = mudanca.cardio ? copiarCardio(mudanca.cardio) : null;
    if (cargaDoTipo !== undefined) nova.carga = copiarCarga(cargaDoTipo);
    if (esforcoDoTipo !== undefined) nova.esforco = copiarEsforco(esforcoDoTipo);
    if (mudanca.esforco !== undefined) nova.esforco = copiarEsforco(mudanca.esforco);
    if (mudanca.modo !== undefined && mudanca.modo !== (s.carga?.modo ?? 'NENHUMA')) {
      const padrao = cargaInicial(tipoFinal);
      nova.carga = padrao?.modo === mudanca.modo ? { ...padrao } : cargaDoModo(mudanca.modo);
      // Pós-trabalho (back off) em "% da WS" parte dos 85%, mesmo que o tipo não traga esse padrão.
      if (mudanca.modo === 'PERCENTUAL_WS' && padrao?.modo !== 'PERCENTUAL_WS' && tipoFinal?.papel === 'POS_TRABALHO') {
        nova.carga = { ...nova.carga!, percentualMin: PERCENTUAL_PADRAO_DO_POS_TRABALHO };
      }
    }
    if (mudanca.carga) nova.carga = { ...(nova.carga ?? { modo: 'NENHUMA' }), ...mudanca.carga };
    return comRepsDoCluster(nova);
  });
  const modoAntes = primeira.carga?.modo ?? 'NENHUMA';
  const virouPercentual = novas[0].carga?.modo === 'PERCENTUAL_WS' && (modoAntes !== 'PERCENTUAL_WS' || trocouTipo);
  const regra = virouPercentual && mudanca.carga === undefined ? regraDoGrupo(config, novas[0], novas.length) : null;
  if (regra) novas = comPercentuais(novas, regra);
  return trocarGrupo(series, grupo, novas);
}

/**
 * RIR de UMA série (a coluna RIR ao lado do % ou do kg): de 0 (até a falha) a 10, ou `null` para "não prescrito". Vale para
 * qualquer série, tenha ou não esforço antes; troca o RPE que houvesse (RIR e RPE nunca juntos). Índice fora da lista ou
 * série de cardio não mudam. O número não é validado aqui (a validação mostra o erro no campo).
 */
export function alterarRirDaSerie(series: Serie[], indice: number, rir: number | null): Serie[] {
  return series.map((s, i) => (i !== indice || s.cardio ? s : { ...s, esforco: rir == null ? null : { rir, rpe: null } }));
}

/** Faixa de % de uma série só (o grupo expandido): mantém a forma se já é por %, senão vira "% da série de trabalho". */
export function alterarPercentuais(series: Serie[], indice: number, min: number | null, max: number | null): Serie[] {
  return series.map((s, i) => {
    if (i !== indice) return s;
    const base = s.carga?.modo === 'PERCENTUAL_WS' ? s.carga : cargaDoModo('PERCENTUAL_WS')!;
    return { ...s, carga: { ...base, percentualMin: min, percentualMax: max } };
  });
}

export function removerGrupo(series: Serie[], grupo: GrupoDeSeries): Serie[] {
  return trocarGrupo(series, grupo, []);
}

function copiarCardio(c: Cardio): Cardio {
  return {
    duracaoMin: c.duracaoMin ?? null,
    distanciaKm: c.distanciaKm ?? null,
    ritmo: c.ritmo ?? null,
    zona: c.zona ?? null,
    intervalos: c.intervalos ? { trabalhoSeg: c.intervalos.trabalhoSeg ?? null, descansoSeg: c.intervalos.descansoSeg ?? null, voltas: c.intervalos.voltas ?? null } : null,
  };
}

/** Série com todos os campos do contrato (ausente vira nulo) e cópia profunda; a de cardio só leva `cardio`. */
function serieNormalizada(s: Partial<Serie>, uid: string): Serie {
  if (s.cardio) {
    return {
      uid,
      tipo: null,
      repsMin: null,
      repsMax: null,
      amrap: null,
      carga: null,
      esforco: null,
      descansoSegundos: s.descansoSegundos ?? null,
      tecnica: null,
      cardio: copiarCardio(s.cardio),
      alvoExtra: s.alvoExtra ?? null,
    };
  }
  return {
    uid,
    tipo: s.tipo ?? null,
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    amrap: s.amrap ? true : null,
    carga: s.carga
      ? {
          modo: s.carga.modo,
          percentualMin: s.carga.percentualMin ?? null,
          percentualMax: s.carga.percentualMax ?? null,
          ...(s.carga.valorKg != null ? { valorKg: s.carga.valorKg } : {}),
        }
      : null,
    esforco: copiarEsforco(s.esforco),
    descansoSegundos: s.descansoSegundos ?? null,
    tecnica: s.tecnica ? { ...tecnicaVazia(s.tecnica.tipo), ...s.tecnica, blocos: s.tecnica.blocos ? [...s.tecnica.blocos] : null } : null,
    cardio: null,
    alvoExtra: s.alvoExtra ?? null,
  };
}

/** Séries com uid novo (cópia profunda). */
function seriesComUidsNovos(series: readonly Partial<Serie>[]): Serie[] {
  return series.map((x) => serieNormalizada(x, novoUid()));
}

/** Séries de uma receita aplicadas no exercício: substituem as atuais, cada uma com uid novo. */
export function seriesDaReceita(conteudo: unknown): Serie[] {
  const lista = (conteudo as { series?: Partial<Serie>[] } | null)?.series ?? [];
  return seriesComUidsNovos(lista);
}

/** Séries prontas para virar receita: os uids nascem ao aplicar, então saem. */
export function seriesParaReceita(series: Serie[]): { series: Omit<Serie, 'uid'>[] } {
  return { series: series.map(({ uid: _uid, ...resto }) => resto) };
}

/** Exercício copiado com uids novos (dele e das séries); copiado sozinho, sai de qualquer grupo. */
export function exercicioComUidsNovos(e: ExercicioPlano): ExercicioPlano {
  return { ...e, uid: novoUid(), grupoUid: null, series: seriesComUidsNovos(e.series ?? []) };
}

/** Sessão copiada com uids novos (dela, dos grupos, dos exercícios e das séries); `grupoUid` acompanha os novos. */
export function sessaoComUidsNovos(s: Sessao): Sessao {
  const novosGrupos = new Map<string, string>();
  const grupos = (s.grupos ?? []).map((g) => {
    const uid = novoUid();
    if (g.uid && !novosGrupos.has(g.uid)) novosGrupos.set(g.uid, uid);
    return { ...g, uid };
  });
  return {
    ...s,
    uid: novoUid(),
    grupos,
    exercicios: (s.exercicios ?? []).map((e) => ({
      ...e,
      uid: novoUid(),
      grupoUid: e.grupoUid ? (novosGrupos.get(e.grupoUid) ?? e.grupoUid) : null,
      series: seriesComUidsNovos(e.series ?? []),
    })),
  };
}

/** Cópia profunda com uids novos (receita de semana, cópia de plano). */
export function comUidsNovos(conteudo: ConteudoTreino): ConteudoTreino {
  return { ...conteudo, sessoes: (conteudo.sessoes ?? []).map(sessaoComUidsNovos) };
}

/** Receita de semana: troca as sessões do plano pelas da receita (o objetivo e as orientações ficam). */
export function aplicarReceitaDePlano(atual: ConteudoTreino, receita: unknown): ConteudoTreino {
  const daReceita = comUidsNovos(normalizarTreino(receita));
  return { ...atual, sessoes: daReceita.sessoes, ...(daReceita.metodologia ? { metodologia: daReceita.metodologia } : {}) };
}

/** Garante listas e campos que o editor espera (receita parcial, servidor que manda `null`). */
export function normalizarTreino(conteudo: unknown): ConteudoTreino {
  const c = (conteudo ?? {}) as Partial<ConteudoTreino>;
  return {
    ...(c.metodologia ? { metodologia: JSON.parse(JSON.stringify(c.metodologia)) } : {}),
    objetivo: c.objetivo ?? null,
    orientacoes: c.orientacoes ?? null,
    sessoes: (c.sessoes ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      nome: s.nome ?? '',
      diaSemana: s.diaSemana ?? null,
      tipo: s.tipo ?? 'TREINO',
      frequenciaSemanal: s.frequenciaSemanal ?? null,
      observacao: s.observacao ?? null,
      cardio: s.cardio ?? null,
      grupos: (s.grupos ?? []).map((g) => ({
        uid: g.uid ?? novoUid(),
        tecnica: g.tecnica,
        descansoAposSegundos: g.descansoAposSegundos ?? null,
        voltas: g.voltas ?? null,
      })),
      exercicios: (s.exercicios ?? []).map((e) => ({
        uid: e.uid ?? novoUid(),
        exercicioId: e.exercicioId ?? null,
        nome: e.nome ?? '',
        modalidade: e.modalidade ?? null,
        videoUrl: e.videoUrl ?? null,
        observacao: e.observacao ?? null,
        progressao: e.progressao ?? true,
        unidade: e.unidade === 'nenhuma' ? 'nenhuma' : 'kg',
        cadencia: e.cadencia ?? null,
        isometriaSegundos: e.isometriaSegundos ?? null,
        grupoUid: e.grupoUid ?? null,
        series: (e.series ?? []).map((x) => serieNormalizada(x, x.uid ?? novoUid())),
      })),
    })),
  };
}

/** Unidade ao escolher da biblioteca: só o cardio fica sem carga; todo exercício de musculação aceita carga (04/11). */
export function unidadeDaModalidade(modalidade: string | null): 'kg' | 'nenhuma' {
  return modalidade === 'CARDIO' ? 'nenhuma' : 'kg';
}

/** Trocar a modalidade de/para cardio descarta as séries (a prescrição é outra). Vale avisar antes quando há série. */
export function trocaApagaSeries(e: Pick<ExercicioPlano, 'modalidade' | 'series'>, modalidade: string | null): boolean {
  return (e.modalidade === 'CARDIO') !== (modalidade === 'CARDIO') && (e.series ?? []).length > 0;
}

/**
 * Exercício com outra modalidade (escolha da biblioteca ou troca): acerta a unidade e, ao entrar ou sair de `CARDIO`, descarta
 * as séries incompatíveis (série de cardio não tem tipo, repetições, carga, esforço nem técnica; as demais não têm `cardio`).
 * Fora isso, as séries ficam como estão.
 */
export function comModalidade(e: ExercicioPlano, modalidade: string | null): ExercicioPlano {
  return { ...e, modalidade, unidade: unidadeDaModalidade(modalidade), series: trocaApagaSeries(e, modalidade) ? [] : e.series };
}

// ---- Sessão selecionada do editor (uma sessão aparece por vez) ----

/** O que aconteceu e pode mudar qual sessão está aberta no editor. */
export type AcaoDeSelecao =
  /** Sessão removida; `sessoes` é a lista de ANTES da remoção. */
  | { tipo: 'remover'; uid: string }
  /** Conteúdo trocado (desfazer, recarregar, modelo): `sessoes` é a lista de DEPOIS. */
  | { tipo: 'conteudo' }
  /** Validação com erro: abre a primeira sessão (ou exercício dela) com problema. */
  | { tipo: 'erros'; uidsComErro: ReadonlySet<string> };

/**
 * Uid da sessão que fica selecionada depois de uma ação. Remover seleciona a vizinha (a seguinte; sem seguinte, a
 * anterior); trocar o conteúdo mantém a seleção se o uid ainda existir; validar com erro vai para a primeira sessão
 * com problema. Sem sessões, `null`.
 */
export function sessaoSelecionadaDepois(sessoes: Sessao[], selecionada: string | null, acao: AcaoDeSelecao): string | null {
  const manter = () => (sessoes.some((s) => s.uid === selecionada) ? selecionada : (sessoes[0]?.uid ?? null));
  if (acao.tipo === 'remover') {
    const i = sessoes.findIndex((s) => s.uid === acao.uid);
    if (i < 0) return manter();
    if (selecionada !== acao.uid) return manter();
    return (sessoes[i + 1] ?? sessoes[i - 1])?.uid ?? null;
  }
  if (acao.tipo === 'erros') {
    const com = sessoes.find((s) => acao.uidsComErro.has(s.uid) || (s.grupos ?? []).some((g) => acao.uidsComErro.has(g.uid)) || s.exercicios.some((e) => acao.uidsComErro.has(e.uid)));
    return com ? com.uid : manter();
  }
  return manter();
}

/** Texto do chip da sessão: "Seg · Costas" (dia curto e o que vem depois de " - " no nome). */
export function rotuloDaSessao(s: Sessao, posicao: number): string {
  const nome = s.nome.trim();
  const parte = nome.includes(' - ') ? nome.slice(nome.indexOf(' - ') + 3).trim() : nome;
  const dia = s.diaSemana ? DIAS_CURTOS[s.diaSemana - 1] : null;
  const grupo = parte && parte.toLowerCase() !== (s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1].toLowerCase() : '') ? parte : '';
  if (dia && grupo) return `${dia} · ${grupo}`;
  if (dia) return dia;
  return grupo || `Sessão ${posicao + 1}`;
}

/** Linha de resumo do cabeçalho da sessão: "Segunda · Treino · 5 exercícios". */
export function resumoDaSessao(s: Sessao): string {
  const dia = s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1] : 'Sem dia fixo';
  const tipo = TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo;
  const n = s.exercicios.length;
  return `${dia} · ${tipo} · ${n} ${n === 1 ? 'exercício' : 'exercícios'}`;
}
