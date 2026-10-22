import type { Configuracao, Intensidade, Serie, Tecnica } from '../api/tipos';
import { textoDeBlocos } from './blocos';
import { numeroParaTela } from './formatos';
import { nomeDaTecnica, tipoTrabalho } from './metodologia';

/**
 * Séries consecutivas iguais (tipo, faixa de repetições, modo de intensidade, RIR/RPE e técnica) aparecem juntas como
 * na planilha do Saraiva: "3x3 - FS 50/70/85 a 90% da WS", "1x3 a 6 - WS · 1 RIR", "1x8 - Rest pause 20 s · mesma
 * carga da WS". Os percentuais ficam fora da chave: cada série do grupo tem o seu. No plano elas continuam
 * individuais, cada uma com seu uid.
 */
export interface GrupoDeSeries {
  /** Posição da primeira série do grupo na lista do exercício. */
  inicio: number;
  series: Serie[];
}

const modo = (s: Serie) => s.intensidade?.modo ?? 'NENHUMA';

/** Técnica na chave do grupo, campo a campo: ausente e nulo contam igual (o servidor devolve todos os campos). */
const chaveTecnica = (t: Tecnica | null | undefined) =>
  t
    ? [t.tipo, t.pausaSegundos, t.pausaRespiracoes, t.pausas, t.blocos ? t.blocos.join('+') : '', t.quedas, t.reducaoPercentual, t.repsPorQueda]
        .map((v) => v ?? '')
        .join(',')
    : '';

const chave = (s: Serie) =>
  [s.tipo ?? '', s.repsMin ?? '', s.repsMax ?? '', modo(s), s.intensidade?.rpe ?? '', s.intensidade?.rir ?? '', chaveTecnica(s.tecnica)].join('|');

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
  if (s.repsMin === null || s.repsMax === null) return '';
  return s.repsMin === s.repsMax ? String(s.repsMin) : `${s.repsMin} a ${s.repsMax}`;
}

/** "85" ou "85 a 90" (sem o %); "—" sem mínimo. */
export function textoDaFaixaPercentual(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null) return '—';
  return max == null || max === min ? numeroParaTela(min) : `${numeroParaTela(min)} a ${numeroParaTela(max)}`;
}

/** RIR em texto: 0 = "até a falha", 1 = "1 RIR"; vazio sem RIR. */
export function textoRir(i: Intensidade | null | undefined): string {
  if (i?.rir == null) return '';
  return i.rir === 0 ? 'até a falha' : `${i.rir} RIR`;
}

/**
 * Intensidade em texto curto: "85% da WS", "85 a 90%", "+1 a 5% sobre a anterior", "mesma carga da WS", "RPE 8,5"; o
 * RIR entra depois ("· 1 RIR"; 0 = "· até a falha") em qualquer modo. Vazio para carga de trabalho sem RIR e para
 * "sem intensidade". `nomeDaWs` é o tipo de trabalho da metodologia ("WS"); sem ele, só "85%" e "mesma carga".
 */
export function textoIntensidade(i: Intensidade | null | undefined, nomeDaWs?: string | null): string {
  const partes: string[] = [];
  const daWs = nomeDaWs ? ` da ${nomeDaWs}` : '';
  switch (i?.modo) {
    case 'PERCENTUAL_WS':
      partes.push(`${textoDaFaixaPercentual(i.percentualMin, i.percentualMax)}%${daWs}`);
      break;
    case 'ACIMA_DA_ANTERIOR':
      partes.push(`+${textoDaFaixaPercentual(i.percentualMin, i.percentualMax)}% sobre a anterior`);
      break;
    case 'MESMA_CARGA':
      partes.push(`mesma carga${daWs}`);
      break;
    case 'RPE':
      if (i.rpe != null) partes.push(`RPE ${numeroParaTela(i.rpe)}`);
      break;
    default:
      break;
  }
  const rir = textoRir(i);
  if (rir) partes.push(rir);
  return partes.join(' · ');
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

/**
 * Técnica em texto curto (editor e PDF), com o nome da metodologia ("Muscle Round") ou o fixo: "Cluster 4+2, 15 s"
 * (sem os blocos quando `comBlocos` é falso: o resumo do grupo já os mostra junto das repetições), "Rest pause 20 s",
 * "Rest pause 15 s, 2 pausas", "Drop-set 2× −20%" ("2×8" com repetições fixas; sem redução fixada, sem o %).
 */
export function textoTecnica(t: Tecnica | null | undefined, config?: Configuracao | null, comBlocos = true): string {
  if (!t) return '';
  const nome = nomeDaTecnica(config, t.tipo);
  if (t.tipo === 'CLUSTER') {
    const blocos = comBlocos && t.blocos?.length ? ` ${textoDeBlocos(t.blocos)},` : '';
    return `${nome}${blocos} ${textoPausa(t)}`;
  }
  if (t.tipo === 'DROP_SET') {
    const reducao = t.reducaoPercentual ? ` −${t.reducaoPercentual}%` : '';
    return `${nome} ${n(t.quedas)}×${t.repsPorQueda ?? ''}${reducao}`;
  }
  const pausas = t.pausas != null && t.pausas > 1 ? `, ${t.pausas} pausas` : '';
  return `${nome} ${textoPausa(t)}${pausas}`;
}

/** Técnica por extenso, como o aluno lê: o que fazer, sem nada além do que o treinador escreveu. */
export function textoTecnicaPorExtenso(t: Tecnica | null | undefined, config?: Configuracao | null): string {
  if (!t) return '';
  const nome = nomeDaTecnica(config, t.tipo);
  if (t.tipo === 'CLUSTER') {
    const b = t.blocos ?? [];
    const pausa = `${textoPausa(t)} de pausa entre os blocos`;
    if (b.length === 0) return `${nome}: a série dividida em blocos de repetições, com ${pausa}.`;
    const blocos = b.every((x) => x === b[0])
      ? `${b.length} blocos de ${b[0]} ${b[0] === 1 ? 'repetição' : 'repetições'}`
      : `blocos de ${listaComE(b)} repetições`;
    return `${nome}: ${blocos}, ${pausa}.`;
  }
  if (t.tipo === 'DROP_SET') {
    const reduza = t.reducaoPercentual ? `reduza a carga cerca de ${t.reducaoPercentual}%` : 'reduza a carga';
    const depois = t.repsPorQueda ? `faça mais ${t.repsPorQueda} repetições` : 'continue até a falha';
    const vezes = t.quedas === 1 ? '1 vez' : `${n(t.quedas)} vezes`;
    return `${nome}: ao terminar, ${reduza} e ${depois}, ${vezes}.`;
  }
  const vezes = t.pausas != null && t.pausas > 1 ? `, ${t.pausas} vezes` : '';
  return `${nome}: depois da série, ${textoPausa(t)} de pausa e continue com a mesma carga até a falha${vezes}.`;
}

/**
 * Resumo do grupo, na língua da planilha: "3x3 - FS 50/70/85 a 90% da WS", "1x3 a 6 - WS · 1 RIR", "1x - Top set +1 a
 * 5% sobre a anterior", "1x8 - Rest pause 20 s · mesma carga da WS", "1x6 (4+2) - Cluster 15 s", "1x4 a 6 - WS + Rest
 * pause 15 s, 2 pausas". Sem metodologia, o % sai sem "da WS" e a técnica com o nome fixo.
 */
export function descreverGrupo(grupo: GrupoDeSeries, config?: Configuracao | null): string {
  const primeira = grupo.series[0];
  const ws = tipoTrabalho(config);
  const tecnica = textoTecnica(primeira.tecnica, config, false);
  const blocos = primeira.tecnica?.tipo === 'CLUSTER' && primeira.tecnica.blocos?.length ? ` (${textoDeBlocos(primeira.tecnica.blocos)})` : '';
  const quem = primeira.tipo ? `${primeira.tipo}${tecnica ? ` + ${tecnica}` : ''}` : tecnica || 'Série';
  const partes = [`${grupo.series.length}x${faixa(primeira)}${blocos} - ${quem}`];
  const m = modo(primeira);
  if (m === 'PERCENTUAL_WS' || m === 'ACIMA_DA_ANTERIOR') {
    const valores = grupo.series.map((s) => textoDaFaixaPercentual(s.intensidade?.percentualMin, s.intensidade?.percentualMax));
    const prefixo = m === 'ACIMA_DA_ANTERIOR' ? '+' : '';
    const sufixo = m === 'ACIMA_DA_ANTERIOR' ? ' sobre a anterior' : ws ? ` da ${ws}` : '';
    const lista = valores.every((v) => v === valores[0]) ? valores[0] : valores.join('/');
    partes.push(`${prefixo}${lista}%${sufixo}`);
    const rir = textoRir(primeira.intensidade);
    if (rir) partes.push(`· ${rir}`);
  } else {
    const texto = textoIntensidade(primeira.intensidade, ws);
    if (texto) partes.push(`· ${texto}`);
  }
  return partes.join(' ');
}

/** Resumo de todas as séries do exercício, um grupo por linha. */
export function descreverSeries(series: Serie[], config?: Configuracao | null): string[] {
  return agrupar(series).map((g) => descreverGrupo(g, config));
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
