import type { Cardio, Carga, Configuracao, Esforco, Serie, Tecnica } from '../api/tipos';
import { textoDeBlocos } from './blocos';
import { numeroParaTela } from './formatos';
import { nomeDaTecnica, nomeDoTipo, tipoTrabalho } from './metodologia';

/**
 * Séries consecutivas iguais (tipo, faixa de repetições, forma de carga, esforço, técnica, alvo extra) aparecem juntas
 * como na planilha do Saraiva: "3x3 - FS 50/70/85 a 90% da WS", "1x3 a 6 - WS · 1 RIR", "1x8 - WS + Rest pause 20 s".
 * Os percentuais ficam fora da chave: cada série do grupo tem o seu (a referência do back off entra: duas séries que
 * apontam séries diferentes não se juntam). No plano elas continuam individuais, cada uma com seu uid.
 */
export interface GrupoDeSeries {
  /** Posição da primeira série do grupo na lista do exercício. */
  inicio: number;
  series: Serie[];
}

const modo = (s: Serie) => s.carga?.modo ?? 'NENHUMA';

/** Técnica na chave do grupo, campo a campo: ausente e nulo contam igual (o servidor devolve todos os campos). */
const chaveTecnica = (t: Tecnica | null | undefined) =>
  t
    ? [
        t.tipo,
        t.pausaSegundos,
        t.pausaRespiracoes,
        t.pausas,
        t.blocos ? t.blocos.join('+') : '',
        t.quedas,
        t.reducaoPercentual,
        t.repsPorQueda,
        t.miniSeries,
        t.repsPorMiniSerie,
        t.repsParciais,
        t.regiao,
        t.repsAssistidas,
      ]
        .map((v) => v ?? '')
        .join(',')
    : '';

const chave = (s: Serie) =>
  [
    s.tipo ?? '',
    s.repsMin ?? '',
    s.repsMax ?? '',
    s.amrap ? 'amrap' : '',
    modo(s),
    modo(s) === 'ABAIXO_DA_REFERENCIA' ? (s.carga?.referenciaUid ?? '') : '',
    s.esforco?.rir ?? '',
    s.esforco?.rpe ?? '',
    chaveTecnica(s.tecnica),
    s.alvoExtra ?? '',
    s.cardio ? JSON.stringify(s.cardio) : '',
  ].join('|');

export function agrupar(series: Serie[]): GrupoDeSeries[] {
  const grupos: GrupoDeSeries[] = [];
  series.forEach((s, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && chave(ultimo.series[0]) === chave(s)) {
      ultimo.series.push(s);
    } else {
      grupos.push({ inicio: i, series: [s] });
    }
  });
  return grupos;
}

/** "3 a 6" ou "3"; vazio quando a série é por tempo (sem repetições). */
export function faixa(s: Pick<Serie, 'repsMin' | 'repsMax'>): string {
  if (s.repsMin === null || s.repsMax === null || s.repsMin === undefined || s.repsMax === undefined) return '';
  return s.repsMin === s.repsMax ? String(s.repsMin) : `${s.repsMin} a ${s.repsMax}`;
}

/** Repetições para exibir: "AMRAP" (o máximo, só quando pedido), a faixa, ou "—" quando a série não tem. */
export function textoDasRepeticoes(s: Pick<Serie, 'repsMin' | 'repsMax' | 'amrap'>): string {
  if (s.amrap) return 'AMRAP';
  return faixa(s) || '—';
}

/** "85" ou "85 a 90" (sem o %); "—" sem mínimo. */
export function textoDaFaixaPercentual(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null) return '—';
  return max == null || max === min ? numeroParaTela(min) : `${numeroParaTela(min)} a ${numeroParaTela(max)}`;
}

/** RIR em texto: 0 = "até a falha", 1 = "1 RIR"; vazio sem RIR. */
export function textoRir(e: Esforco | null | undefined): string {
  if (e?.rir == null) return '';
  return e.rir === 0 ? 'até a falha' : `${e.rir} RIR`;
}

/** Esforço em texto: "1 RIR", "até a falha" (RIR 0) ou "RPE 8,5"; vazio sem esforço. */
export function textoEsforco(e: Esforco | null | undefined): string {
  if (!e) return '';
  if (e.rir != null) return textoRir(e);
  return e.rpe != null ? `RPE ${numeroParaTela(e.rpe)}` : '';
}

/**
 * Carga em texto curto: "85% da WS", "85 a 90%", "+1 a 5% sobre a anterior", "mesma carga da WS", "15% abaixo da
 * referência (Top set)". Vazio para carga de trabalho e para "sem carga". `nomeDaWs` é o tipo de trabalho da metodologia
 * ("WS"); sem ele, só "85%" e "mesma carga". `nomeDaReferencia` é o nome do tipo da série de referência do back off.
 */
export function textoCarga(c: Carga | null | undefined, nomeDaWs?: string | null, nomeDaReferencia?: string | null): string {
  const daWs = nomeDaWs ? ` da ${nomeDaWs}` : '';
  switch (c?.modo) {
    case 'PERCENTUAL_WS':
      return `${textoDaFaixaPercentual(c.percentualMin, c.percentualMax)}%${daWs}`;
    case 'ACIMA_DA_ANTERIOR':
      return `+${textoDaFaixaPercentual(c.percentualMin, c.percentualMax)}% sobre a anterior`;
    case 'MESMA_CARGA':
      return `mesma carga${daWs}`;
    case 'ABAIXO_DA_REFERENCIA':
      return `${textoDaFaixaPercentual(c.percentualMin, c.percentualMax)}% abaixo da referência${nomeDaReferencia ? ` (${nomeDaReferencia})` : ''}`;
    default:
      return '';
  }
}

/** Carga e esforço juntos ("85% da WS · 1 RIR"); vazio para carga de trabalho sem esforço. */
export function textoCargaEEsforco(s: Pick<Serie, 'carga' | 'esforco'>, nomeDaWs?: string | null, nomeDaReferencia?: string | null): string {
  return [textoCarga(s.carga, nomeDaWs, nomeDaReferencia), textoEsforco(s.esforco)].filter(Boolean).join(' · ');
}

/** Nome (da metodologia) do tipo da série de referência do back off, entre as séries do exercício; vazio se não achar. */
export function nomeDaReferencia(serie: Pick<Serie, 'carga'>, series: readonly Serie[], config?: Configuracao | null): string {
  const uid = serie.carga?.referenciaUid;
  const referencia = uid ? series.find((x) => x.uid === uid) : undefined;
  return referencia ? nomeDoTipo(config, referencia.tipo) : '';
}

/** Cardio em texto curto: "30 min · 5 km · ritmo 6:00 · zona 2 · 8× 30 s / 60 s de descanso"; "—" sem nada. */
export function textoCardio(c: Cardio | null | undefined): string {
  if (!c) return '—';
  const partes: string[] = [];
  if (c.duracaoMin != null) partes.push(`${c.duracaoMin} min`);
  if (c.distanciaKm != null) partes.push(`${numeroParaTela(c.distanciaKm)} km`);
  if (c.ritmo?.trim()) partes.push(`ritmo ${c.ritmo.trim()}`);
  if (c.zona != null) partes.push(`zona ${c.zona}`);
  const i = c.intervalos;
  if (i) {
    const esforco = i.trabalhoSeg != null ? `${i.trabalhoSeg} s` : '— s';
    const descanso = i.descansoSeg != null ? ` / ${i.descansoSeg} s de descanso` : '';
    partes.push(`${i.voltas ?? '—'}× ${esforco}${descanso}`);
  }
  return partes.length ? partes.join(' · ') : '—';
}

const n = (v: number | null | undefined) => (v == null ? '—' : String(v));

/** "4 e 2", "4, 2 e 1". */
function listaComE(numeros: readonly number[]): string {
  if (numeros.length <= 1) return numeros.join('');
  return `${numeros.slice(0, -1).join(', ')} e ${numeros[numeros.length - 1]}`;
}

/** Pausa da técnica: "20 s", "5 respirações", "5 respirações ou 10 s"; "— s" quando o treinador ainda não informou. */
export function textoPausa(t: Pick<Tecnica, 'pausaSegundos' | 'pausaRespiracoes'>): string {
  const r = t.pausaRespiracoes != null && t.pausaRespiracoes > 0 ? `${t.pausaRespiracoes} ${t.pausaRespiracoes === 1 ? 'respiração' : 'respirações'}` : '';
  const s = t.pausaSegundos != null && t.pausaSegundos > 0 ? `${t.pausaSegundos} s` : '';
  if (r && s) return `${r} ou ${s}`;
  return r || s || '— s';
}

const REGIAO_CURTA = { ALONGADA: 'alongadas', ENCURTADA: 'encurtadas', LIVRE: '' } as const;
const REGIAO_POR_EXTENSO = { ALONGADA: ' na parte alongada do movimento', ENCURTADA: ' na parte encurtada do movimento', LIVRE: '' } as const;

/**
 * Técnica em texto curto (editor e PDF), com o nome da metodologia ("Muscle Round") ou o fixo: "Cluster 4+2, 15 s"
 * (sem os blocos quando `comBlocos` é falso: o resumo do grupo já os mostra junto das repetições), "Rest pause 20 s",
 * "Rest pause 15 s, 2 pausas", "Drop-set 2× −20%" ("2×8" com repetições fixas; sem redução fixada, sem o %),
 * "Myo-reps 4×5, 5 respirações", "Partial reps 5 alongadas", "Forced reps 2 assistidas".
 */
export function textoTecnica(t: Tecnica | null | undefined, config?: Configuracao | null, comBlocos = true): string {
  if (!t) return '';
  const nome = nomeDaTecnica(config, t.tipo);
  switch (t.tipo) {
    case 'CLUSTER': {
      const blocos = comBlocos && t.blocos?.length ? ` ${textoDeBlocos(t.blocos)},` : '';
      return `${nome}${blocos} ${textoPausa(t)}`;
    }
    case 'DROP_SET': {
      const reducao = t.reducaoPercentual ? ` −${t.reducaoPercentual}%` : '';
      const pausa = t.pausaSegundos ? `, pausa ${t.pausaSegundos} s` : '';
      return `${nome} ${n(t.quedas)}×${t.repsPorQueda ?? ''}${reducao}${pausa}`;
    }
    case 'MYO_REPS':
      return `${nome} ${n(t.miniSeries)}×${n(t.repsPorMiniSerie)}, ${textoPausa(t)}`;
    case 'PARTIAL_REPS': {
      const regiao = t.regiao ? REGIAO_CURTA[t.regiao] : '';
      return `${nome} ${n(t.repsParciais)}${regiao ? ` ${regiao}` : ''}`;
    }
    case 'FORCED_REPS':
      return `${nome} ${n(t.repsAssistidas)} ${t.repsAssistidas === 1 ? 'assistida' : 'assistidas'}`;
    default: {
      const pausas = t.pausas != null && t.pausas > 1 ? `, ${t.pausas} pausas` : '';
      return `${nome} ${textoPausa(t)}${pausas}`;
    }
  }
}

/** Técnica por extenso, como o aluno lê: o que fazer, sem nada além do que o treinador escreveu. */
export function textoTecnicaPorExtenso(t: Tecnica | null | undefined, config?: Configuracao | null): string {
  if (!t) return '';
  const nome = nomeDaTecnica(config, t.tipo);
  switch (t.tipo) {
    case 'CLUSTER': {
      const b = t.blocos ?? [];
      const pausa = `${textoPausa(t)} de pausa entre os blocos`;
      if (b.length === 0) return `${nome}: a série dividida em blocos de repetições, com ${pausa}.`;
      const blocos = b.every((x) => x === b[0]) ? `${b.length} blocos de ${b[0]} ${b[0] === 1 ? 'repetição' : 'repetições'}` : `blocos de ${listaComE(b)} repetições`;
      return `${nome}: ${blocos}, ${pausa}.`;
    }
    case 'DROP_SET': {
      const reduza = t.reducaoPercentual ? `reduza a carga cerca de ${t.reducaoPercentual}%` : 'reduza a carga';
      const depois = t.repsPorQueda ? `faça mais ${t.repsPorQueda} repetições` : 'continue até a falha';
      const vezes = t.quedas === 1 ? '1 vez' : `${n(t.quedas)} vezes`;
      const pausa = t.pausaSegundos ? ` Descanse ${t.pausaSegundos} s entre as quedas.` : '';
      return `${nome}: ao terminar, ${reduza} e ${depois}, ${vezes}.${pausa}`;
    }
    case 'MYO_REPS': {
      const quantas = t.miniSeries ? `${t.miniSeries} mini-séries` : 'várias mini-séries';
      const reps = t.repsPorMiniSerie ? ` de ${t.repsPorMiniSerie} ${t.repsPorMiniSerie === 1 ? 'repetição' : 'repetições'}` : ' curtas';
      return `${nome}: depois da série de ativação, faça ${quantas}${reps} com a mesma carga, com ${textoPausa(t)} de pausa entre elas.`;
    }
    case 'PARTIAL_REPS': {
      const quantas = t.repsParciais ? `mais ${t.repsParciais} ${t.repsParciais === 1 ? 'repetição parcial' : 'repetições parciais'}` : 'repetições parciais';
      return `${nome}: ao chegar à falha, faça ${quantas}${t.regiao ? REGIAO_POR_EXTENSO[t.regiao] : ''}, sem completar o movimento.`;
    }
    case 'FORCED_REPS': {
      const quantas = t.repsAssistidas ? `mais ${t.repsAssistidas} ${t.repsAssistidas === 1 ? 'repetição assistida' : 'repetições assistidas'}` : 'repetições assistidas';
      return `${nome}: ao chegar à falha, um parceiro ajuda só o necessário para você fazer ${quantas}.`;
    }
    default: {
      const vezes = t.pausas != null && t.pausas > 1 ? `, ${t.pausas} vezes` : '';
      return `${nome}: depois da série, ${textoPausa(t)} de pausa e continue com a mesma carga até a falha${vezes}.`;
    }
  }
}

/**
 * Resumo do grupo, na língua da planilha: "3x3 - FS 50/70/85 a 90% da WS", "1x3 a 6 - WS · 1 RIR", "1x - Top set +1 a
 * 5% sobre a anterior", "2x6 a 8 - Back off 15% abaixo da referência (Top set)", "1x6 (4+2) - WS + Cluster 15 s". O tipo
 * sai pelo nome da metodologia (a série grava o código). `series` (as do exercício) dá o nome da série de referência.
 * Sem metodologia, o % sai sem "da WS" e a técnica com o nome fixo.
 */
export function descreverGrupo(grupo: GrupoDeSeries, config?: Configuracao | null, series: readonly Serie[] = []): string {
  const primeira = grupo.series[0];
  if (primeira.cardio) return `${grupo.series.length}x ${textoCardio(primeira.cardio)}`;
  const ws = tipoTrabalho(config);
  const tecnica = textoTecnica(primeira.tecnica, config, false);
  const blocos = primeira.tecnica?.tipo === 'CLUSTER' && primeira.tecnica.blocos?.length ? ` (${textoDeBlocos(primeira.tecnica.blocos)})` : '';
  const nome = nomeDoTipo(config, primeira.tipo);
  const quem = nome ? `${nome}${tecnica ? ` + ${tecnica}` : ''}` : tecnica || 'Série';
  const reps = primeira.amrap ? 'AMRAP' : faixa(primeira);
  const partes = [`${grupo.series.length}x${reps}${blocos} - ${quem}`];
  const m = modo(primeira);
  if (m === 'PERCENTUAL_WS' || m === 'ACIMA_DA_ANTERIOR' || m === 'ABAIXO_DA_REFERENCIA') {
    const valores = grupo.series.map((s) => textoDaFaixaPercentual(s.carga?.percentualMin, s.carga?.percentualMax));
    const lista = valores.every((v) => v === valores[0]) ? valores[0] : valores.join('/');
    if (m === 'PERCENTUAL_WS') partes.push(`${lista}%${ws ? ` da ${ws}` : ''}`);
    else if (m === 'ACIMA_DA_ANTERIOR') partes.push(`+${lista}% sobre a anterior`);
    else {
      const referencia = nomeDaReferencia(primeira, series, config);
      partes.push(`${lista}% abaixo da referência${referencia ? ` (${referencia})` : ''}`);
    }
    const esforco = textoEsforco(primeira.esforco);
    if (esforco) partes.push(`· ${esforco}`);
  } else {
    const texto = textoCargaEEsforco(primeira, ws);
    if (texto) partes.push(`· ${texto}`);
  }
  if (primeira.alvoExtra?.trim()) partes.push(`· ${primeira.alvoExtra.trim()}`);
  return partes.join(' ');
}

/** Resumo de todas as séries do exercício, um grupo por linha. */
export function descreverSeries(series: Serie[], config?: Configuracao | null): string[] {
  return agrupar(series).map((g) => descreverGrupo(g, config, series));
}

/** Técnicas do exercício por extenso, sem repetir (o aluno lê uma vez, antes das séries). */
export function textosDeTecnica(series: readonly Serie[], config?: Configuracao | null): string[] {
  return tecnicasDoExercicio(series, config).map((t) => t.texto);
}

export interface TecnicaParaOAluno {
  texto: string;
  /** Pausa em segundos entre blocos ou antes da retomada; nulo quando o treinador não informou (ou só em respirações). */
  pausaSegundos: number | null;
}

/**
 * Técnicas do exercício para o aluno, sem repetir, com a pausa: a tela oferece um botão para iniciar o cronômetro
 * dela (opcional; nada começa sozinho e nada prende o aluno, pedido da reunião de 17/10). Pausa só em respirações não
 * liga o botão.
 */
export function tecnicasDoExercicio(series: readonly Serie[], config?: Configuracao | null): TecnicaParaOAluno[] {
  const vistas = new Map<string, TecnicaParaOAluno>();
  for (const s of series) {
    const texto = textoTecnicaPorExtenso(s.tecnica, config);
    if (!texto || vistas.has(texto)) continue;
    const pausa = s.tecnica?.pausaSegundos;
    vistas.set(texto, { texto, pausaSegundos: pausa != null && pausa > 0 ? pausa : null });
  }
  return [...vistas.values()];
}

function listaDeNumeros(numeros: number[]): string {
  if (numeros.length === 1) return `na série ${numeros[0]}`;
  return `nas séries ${numeros.slice(0, -1).join(', ')} e ${numeros[numeros.length - 1]}`;
}

/**
 * Resumo do exercício na lista do dia: em que série está cada técnica e o descanso ("Cluster na série 4 · descanso
 * 90 s"). A lista não mostrava nada disso e o aluno só descobria dentro do exercício. Nulo quando não há nenhum dos dois.
 */
export function resumoTecnicasEDescanso(series: readonly Serie[], config?: Configuracao | null): string | null {
  const porTecnica = new Map<Tecnica['tipo'], number[]>();
  series.forEach((s, i) => {
    if (!s.tecnica) return;
    porTecnica.set(s.tecnica.tipo, [...(porTecnica.get(s.tecnica.tipo) ?? []), i + 1]);
  });
  const partes = [...porTecnica].map(([tipo, numeros]) => `${nomeDaTecnica(config, tipo)} ${listaDeNumeros(numeros)}`);
  const descansos = series.map((s) => s.descansoSegundos ?? 0).filter((d) => d > 0);
  if (descansos.length) {
    const menor = Math.min(...descansos),
      maior = Math.max(...descansos);
    partes.push(menor === maior ? `descanso ${menor} s` : `descanso ${menor} a ${maior} s`);
  }
  return partes.length ? partes.join(' · ') : null;
}
