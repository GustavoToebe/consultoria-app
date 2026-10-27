import type { Cardio, Carga, CargaDaEtapa, Esforco, ModoDeCarga, Retomada, Serie, Tecnica } from '../api/tipos';
import { somaDosBlocos } from './blocos';
import { tecnicaDescritiva, TIPOS_DE_TECNICA } from './metodologia';

/**
 * Regras de uma série SOZINHA, as mesmas do servidor (`Carga.problemas`, `Esforco.problemas`, `Tecnica.problemas`,
 * `Cardio.problemas` e `ValidadorTreino.problemasDaSerie`): mesmos limites, mesmas mensagens e as mesmas chaves, que são
 * o caminho a partir do objeto (`percentualMin`, `rpe`, `intervalos.voltas`, `tecnica.miniSeries`...). Vazio = válido.
 * O servidor continua sendo quem decide ao publicar; aqui as telas mostram o erro no campo certo, antes. As regras que
 * dependem da posição da série no exercício e dos grupos ficam em `validacaoDoTreino`.
 */
export type Problemas = Record<string, string>;

export const MODOS_DE_CARGA: readonly ModoDeCarga[] = ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'ABAIXO_DA_REFERENCIA', 'NENHUMA'];

const inteiro = (v: number | null | undefined): v is number => v != null && Number.isInteger(v);
const numero = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Valor inteiro dentro de [min, max]. */
const dentro = (v: number | null | undefined, min: number, max: number): boolean => inteiro(v) && v >= min && v <= max;

/** Faixa de percentual: reporta o mínimo, ou o máximo se o mínimo está certo (nunca os dois), como a API. */
function faixaDePercentual(p: Problemas, carga: Carga, maximo: number, mensagem: string): void {
  const min = carga.percentualMin;
  const max = carga.percentualMax;
  if (!numero(min) || min < 1 || min > maximo) {
    p.percentualMin = mensagem;
  } else if (max != null && (!numero(max) || max < min || max > maximo)) {
    p.percentualMax = `Percentual máximo entre o mínimo e ${maximo}.`;
  }
}

/**
 * Problemas de uma carga. `exigeReferencia` falso é o padrão de um tipo na metodologia, que não conhece as séries do
 * exercício: a referência do back off só nasce na série.
 */
export function problemasDaCarga(carga: Carga | null | undefined, exigeReferencia = true): Problemas {
  const p: Problemas = {};
  if (!carga) return p;
  const modo = carga.modo ?? 'NENHUMA';
  if (!MODOS_DE_CARGA.includes(modo)) {
    p.modo = 'Forma de carga inválida.';
    return p;
  }
  if (modo === 'PERCENTUAL_WS') faixaDePercentual(p, carga, 200, 'Percentual da WS entre 1 e 200.');
  else if (modo === 'ACIMA_DA_ANTERIOR') faixaDePercentual(p, carga, 100, 'Acima da anterior: percentual entre 1 e 100.');
  else if (modo === 'ABAIXO_DA_REFERENCIA') {
    faixaDePercentual(p, carga, 50, 'Abaixo da referência: redução entre 1 e 50.');
    if (exigeReferencia && !carga.referenciaUid) p.referenciaUid = 'Escolha a série de referência.';
  }
  return p;
}

/** Esforço: RIR de 0 a 5 ou RPE de 1 a 10 de meio em meio, nunca os dois (o aviso dos dois vence a faixa do RPE). */
export function problemasDoEsforco(esforco: Esforco | null | undefined): Problemas {
  const p: Problemas = {};
  if (!esforco) return p;
  const { rir, rpe } = esforco;
  if (rir != null && !dentro(rir, 0, 5)) p.rir = 'RIR entre 0 (até a falha) e 5.';
  if (rpe != null && (!numero(rpe) || rpe < 1 || rpe > 10 || !Number.isInteger(rpe * 2))) p.rpe = 'RPE precisa ficar entre 1 e 10, de meio em meio.';
  if (rir != null && rpe != null) p.rpe = 'Use RIR ou RPE, não os dois.';
  return p;
}

/** Esforço sem RIR nem RPE: o mesmo que não ter esforço. */
export const esforcoVazio = (e: Esforco | null | undefined): boolean => !e || (e.rir == null && e.rpe == null);

/** Prescrição de cardio: ao menos duração, distância ou intervalos; os limites são os da API. */
export function problemasDoCardio(c: Cardio | null | undefined): Problemas {
  const p: Problemas = {};
  if (!c) return p;
  if (c.duracaoMin == null && c.distanciaKm == null && c.intervalos == null) p.duracaoMin = 'Informe a duração, a distância ou os intervalos.';
  if (c.duracaoMin != null && !dentro(c.duracaoMin, 1, 600)) p.duracaoMin = 'Duração de 1 a 600 minutos.';
  if (c.distanciaKm != null && (!numero(c.distanciaKm) || c.distanciaKm <= 0 || c.distanciaKm > 1000)) p.distanciaKm = 'Distância maior que zero e até 1000 km.';
  if (c.ritmo != null && c.ritmo.length > 40) p.ritmo = 'Ritmo com no máximo 40 caracteres.';
  if (c.zona != null && !dentro(c.zona, 1, 5)) p.zona = 'Zona de 1 a 5.';
  const i = c.intervalos;
  if (i) {
    if (!dentro(i.trabalhoSeg, 1, 3600)) p['intervalos.trabalhoSeg'] = 'Tempo de esforço de 1 a 3600 segundos.';
    if (i.descansoSeg != null && !dentro(i.descansoSeg, 0, 3600)) p['intervalos.descansoSeg'] = 'Descanso de 0 a 3600 segundos.';
    if (!dentro(i.voltas, 1, 100)) p['intervalos.voltas'] = 'Voltas de 1 a 100.';
  }
  return p;
}

/**
 * Problemas de uma técnica. `completa` é a técnica da série (cluster com blocos, pausa informada...); falso é o padrão
 * parcial da metodologia, em que só os valores presentes são conferidos (`Tecnica.problemasDosValores`).
 */
export function problemasDaTecnica(t: Tecnica | null | undefined, completa = true): Problemas {
  const p: Problemas = {};
  if (!t) return p;
  if (!(TIPOS_DE_TECNICA as readonly string[]).includes(t.tipo)) return { tipo: 'Técnica desconhecida.' };
  if (tecnicaDescritiva(t.tipo)) return p;
  const faixa = (campo: keyof Tecnica, min: number, max: number, mensagem: string, obrigatorio: boolean) => {
    const v = t[campo] as number | null | undefined;
    if (v == null ? obrigatorio : !dentro(v, min, max)) p[campo] = mensagem;
  };
  const pausa = (obrigatoria: boolean) => {
    if (obrigatoria && t.pausaSegundos == null && t.pausaRespiracoes == null) p.pausaSegundos = 'Informe a pausa em segundos ou em respirações.';
    faixa('pausaSegundos', 5, 600, 'Pausa de 5 a 600 segundos.', false);
    faixa('pausaRespiracoes', 1, 30, 'Pausa de 1 a 30 respirações.', false);
  };
  switch (t.tipo) {
    case 'REST_PAUSE':
      pausa(completa);
      faixa('pausas', 1, 5, 'Pausas do rest pause entre 1 e 5.', false);
      problemasDasRetomadas(p, t, completa);
      break;
    case 'CLUSTER': {
      pausa(completa);
      const b = t.blocos;
      if ((completa || b != null) && (b == null || b.length < 2 || b.length > 10 || b.some((x) => !dentro(x, 1, 50)))) {
        p.blocos = 'Cluster: de 2 a 10 blocos, cada um com 1 a 50 repetições.';
      }
      problemasDasCargasDosBlocos(p, t, completa);
      break;
    }
    case 'DROP_SET':
      faixa('quedas', 1, 5, 'Quedas do drop-set entre 1 e 5.', completa);
      faixa('reducaoPercentual', 5, 50, 'Redução da carga entre 5% e 50% (ou vazio, sem fixar).', false);
      faixa('repsPorQueda', 1, 50, 'Repetições por queda entre 1 e 50 (ou vazio, até a falha).', false);
      faixa('pausaSegundos', 0, 600, 'Descanso entre as quedas de 0 a 600 segundos (0 = sem descanso).', false);
      break;
    case 'MYO_REPS':
      faixa('miniSeries', 2, 10, 'Myo-reps: de 2 a 10 mini-séries.', completa);
      faixa('repsPorMiniSerie', 1, 50, 'Myo-reps: de 1 a 50 repetições por mini-série.', completa);
      pausa(completa);
      break;
    case 'PARTIAL_REPS': {
      faixa('repsParciais', 1, 30, 'Repetições parciais entre 1 e 30.', completa);
      const regioes = ['ALONGADA', 'ENCURTADA', 'LIVRE'];
      const r = t.regiao;
      if (completa ? r == null || !regioes.includes(r) : r != null && !regioes.includes(r)) p.regiao = 'Região das parciais: alongada, encurtada ou livre.';
      break;
    }
    case 'FORCED_REPS':
      faixa('repsAssistidas', 1, 5, 'Repetições assistidas entre 1 e 5.', completa);
      break;
    default:
      return p;
  }
  return p;
}

/** Problemas da carga de uma etapa (`ConteudoTreino.CargaDaEtapa.problemas`). */
export function problemasDaCargaDaEtapa(c: CargaDaEtapa): Problemas {
  if (c.modo === 'DA_SERIE') return c.percentual != null ? { percentual: 'Carga da série não leva percentual.' } : {};
  if (c.modo === 'PERCENTUAL_WS') return dentro(c.percentual, 1, 200) ? {} : { percentual: 'Percentual da WS entre 1 e 200.' };
  return { modo: 'Carga da etapa: da série ou percentual da WS.' };
}

/** Problemas de uma retomada do Rest-pause (`ConteudoTreino.Retomada.problemas`). */
export function problemasDaRetomada(r: Retomada): Problemas {
  const p: Problemas = {};
  const temReps = r.repsMin != null || r.repsMax != null;
  if (r.amrap === true) {
    if (temReps) p.amrap = 'AMRAP não leva repetições mínima e máxima.';
  } else if (r.repsMin == null || r.repsMax == null) p.repsMin = 'Informe as repetições (exatas ou faixa) ou AMRAP.';
  else if (!inteiro(r.repsMin) || !inteiro(r.repsMax) || r.repsMin < 1 || r.repsMax > 50) p.repsMin = 'Repetições da retomada entre 1 e 50.';
  else if (r.repsMax < r.repsMin) p.repsMax = 'Repetição máxima menor que a mínima.';
  if (!r.carga) p.carga = 'Informe a carga: da série ou percentual da WS.';
  else for (const [campo, mensagem] of Object.entries(problemasDaCargaDaEtapa(r.carga))) p[`carga.${campo}`] = mensagem;
  return p;
}

function problemasDasCargasDosBlocos(p: Problemas, t: Tecnica, completa: boolean): void {
  const cargas = t.cargasDosBlocos;
  if (cargas == null) return;
  if (!completa) {
    p.cargasDosBlocos = 'A carga por bloco é da série, não do padrão da metodologia.';
    return;
  }
  if (!t.blocos || cargas.length !== t.blocos.length) {
    p.cargasDosBlocos = 'Informe uma carga para cada bloco.';
    return;
  }
  cargas.forEach((c, i) => {
    if (!c) p[`cargasDosBlocos[${i}]`] = `Informe a carga do bloco ${i + 1}.`;
    else for (const [campo, mensagem] of Object.entries(problemasDaCargaDaEtapa(c))) p[`cargasDosBlocos[${i}].${campo}`] = `Bloco ${i + 1}: ${mensagem}`;
  });
}

function problemasDasRetomadas(p: Problemas, t: Tecnica, completa: boolean): void {
  const retomadas = t.retomadas;
  if (retomadas == null) return;
  if (!completa) {
    p.retomadas = 'As retomadas são da série, não do padrão da metodologia.';
    return;
  }
  const quantas = t.pausas != null && t.pausas >= 1 ? t.pausas : 1;
  if (retomadas.length !== quantas) {
    p.retomadas = 'Informe uma retomada para cada pausa.';
    return;
  }
  retomadas.forEach((r, i) => {
    const nome = quantas === 1 ? 'Retomada' : `Retomada ${i + 1}`;
    if (!r) p[`retomadas[${i}]`] = `${nome}: informe a meta e a carga.`;
    else for (const [campo, mensagem] of Object.entries(problemasDaRetomada(r))) p[`retomadas[${i}].${campo}`] = `${nome}: ${mensagem}`;
  });
}

/** Há etapa (bloco ou retomada) com carga em percentual da WS? (`Tecnica.temEtapaEmPercentual`) */
export function temEtapaEmPercentual(t: Tecnica | null | undefined): boolean {
  if (t?.tipo === 'CLUSTER') return !!t.cargasDosBlocos?.some((c) => c?.modo === 'PERCENTUAL_WS');
  if (t?.tipo === 'REST_PAUSE') return !!t.retomadas?.some((r) => r?.carga?.modo === 'PERCENTUAL_WS');
  return false;
}

function problemasDasRepeticoes(p: Problemas, s: Pick<Serie, 'repsMin' | 'repsMax' | 'amrap'>): void {
  const temReps = s.repsMin != null || s.repsMax != null;
  if (s.amrap === true && temReps) {
    p.amrap = 'AMRAP é o máximo de repetições: tire as repetições mínima e máxima.';
  } else if ((s.repsMin == null) !== (s.repsMax == null)) {
    p.repsMax = 'Informe repetições mínima e máxima, ou nenhuma (série por tempo).';
  } else if (s.repsMin != null && s.repsMax != null) {
    if (!inteiro(s.repsMin) || !inteiro(s.repsMax) || s.repsMin < 0 || s.repsMax > 500) p.repsMin = 'Repetições precisam ficar entre 0 e 500.';
    else if (s.repsMax < s.repsMin) p.repsMax = 'Repetição máxima menor que a mínima.';
  }
}

/** Série de exercício de cardio: só `cardio`; tipo, carga, esforço, repetições e técnica não existem. */
function problemasDaSerieDeCardio(p: Problemas, s: Serie): void {
  if (!s.cardio) p.cardio = 'Série de cardio sem prescrição (duração, distância ou intervalos).';
  else for (const [campo, mensagem] of Object.entries(problemasDoCardio(s.cardio))) p[`cardio.${campo}`] = mensagem;
  if (s.tipo?.trim()) p.tipo = 'Série de cardio não tem tipo.';
  if (s.carga && (s.carga.modo ?? 'NENHUMA') !== 'NENHUMA') p.carga = 'Série de cardio não tem carga.';
  if (!esforcoVazio(s.esforco)) p.esforco = 'Série de cardio não tem esforço (RIR ou RPE).';
  if (s.repsMin != null || s.repsMax != null || s.amrap === true) p.repsMin = 'Série de cardio não tem repetições.';
  if (s.tecnica) p.tecnica = 'Série de cardio não tem técnica.';
}

/**
 * Problemas de uma série sozinha, por campo (`ValidadorTreino.problemasDaSerie`): `exercicioCardio` = a série leva
 * `cardio` e não tem tipo, carga, esforço, repetições nem técnica; fora do cardio o tipo (código) é obrigatório e `cardio`
 * não existe. Repetições mínima e máxima juntas (ou nenhuma, série por tempo ou `amrap`); no cluster são a soma dos
 * blocos. Também vale para as séries de uma receita.
 */
export function problemasDaSerie(s: Serie, exercicioCardio: boolean): Problemas {
  const p: Problemas = {};
  if (s.descansoSegundos != null && !dentro(s.descansoSegundos, 0, 3600)) p.descansoSegundos = 'Descanso precisa ficar entre 0 e 3600 segundos.';
  if (s.alvoExtra != null && s.alvoExtra.length > 120) p.alvoExtra = 'Alvo extra com no máximo 120 caracteres.';
  if (exercicioCardio) {
    problemasDaSerieDeCardio(p, s);
    return p;
  }
  if (s.cardio) p.cardio = 'A prescrição de cardio só vale em exercício de cardio.';
  if (!s.tipo?.trim()) p.tipo = 'Série sem tipo.';
  problemasDasRepeticoes(p, s);
  if (s.tecnica) {
    for (const [campo, mensagem] of Object.entries(problemasDaTecnica(s.tecnica))) p[`tecnica.${campo}`] = mensagem;
    const soma = s.tecnica.tipo === 'CLUSTER' && s.tecnica.blocos?.every((b) => b != null) ? somaDosBlocos(s.tecnica.blocos) : null;
    if (soma != null && (soma !== s.repsMin || soma !== s.repsMax)) p.repsMin ??= `Cluster: as repetições são a soma dos blocos (${soma}).`;
  }
  if (s.carga) for (const [campo, mensagem] of Object.entries(problemasDaCarga(s.carga))) p[`carga.${campo}`] = mensagem;
  if (s.esforco) for (const [campo, mensagem] of Object.entries(problemasDoEsforco(s.esforco))) p[`esforco.${campo}`] = mensagem;
  return p;
}
