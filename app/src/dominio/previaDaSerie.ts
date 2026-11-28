import type { Configuracao, ExercicioPlano, Serie } from '../api/tipos';
import { modoDoGrupo, textoCarga, type GrupoDeSeries } from './agrupamento';
import { textoCurtoDoDescanso } from './camposDaSerie';
import { numeroParaTela } from './formatos';
import { nomeDaSerieDeTrabalho, papelDe } from './metodologia';
import type { UnidadeDeCarga } from './unidadeDeCarga';

/**
 * Prévia para o aluno da série aberta no editor (SERIE-ABERTA, seção 4): quais séries do grupo ganham cartão, a legenda
 * embaixo dos cartões e o exercício que as peças do aluno (`LinhaDaSerie`, `CartaoSerieComEtapas`) consomem. Sem React.
 *
 * Índices e números são do EXERCÍCIO (`g.inicio + j`), para bater com o "Série N" do cartão do aluno.
 */

/** A prescrição que separa cartões: forma e valores da carga e o esforço. */
const prescricao = (s: Serie) =>
  JSON.stringify([s.carga?.modo ?? 'NENHUMA', s.carga?.percentualMin ?? null, s.carga?.percentualMax ?? null, s.carga?.valorKg ?? null, s.esforco?.rir ?? null, s.esforco?.rpe ?? null]);

/**
 * Um cartão por prescrição distinta, na ordem em que aparecem, até `max`. `indices` são as séries mostradas e `ocultas`
 * as demais (repetem um cartão ou passam do `max`), em índices do exercício.
 */
export function seriesDaPrevia(g: GrupoDeSeries, max = 3): { indices: number[]; ocultas: number[] } {
  const vistas = new Set<string>();
  const indices: number[] = [];
  const ocultas: number[] = [];
  g.series.forEach((s, j) => {
    const chave = prescricao(s);
    if (!vistas.has(chave) && indices.length < max) {
      vistas.add(chave);
      indices.push(g.inicio + j);
    } else ocultas.push(g.inicio + j);
  });
  return { indices, ocultas };
}

/** "1", "1 e 2", "1, 2 e 3". */
const lista = (n: number[]) => (n.length < 2 ? String(n[0]) : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`);

/** Esforço como na frase da legenda: "RIR 1", "RIR 0", "RPE 8,5"; vazio sem esforço. */
const esforcoCurto = (s: Serie) =>
  s.esforco?.rir != null ? `RIR ${s.esforco.rir}` : s.esforco?.rpe != null ? `RPE ${numeroParaTela(s.esforco.rpe)}` : '';

/**
 * Linhas da legenda da prévia (a série simples e o cluster usam a mesma):
 * 1. "Descanso de 60 s depois da série · carga sugerida a partir da WS do dia" (descanso da 1ª série do grupo, omitido
 *    nulo ou 0; a carga só no grupo em % da WS);
 * 2. só quando há séries ocultas cuja prescrição não ganhou cartão (passaram do `max`): "Mostrando a série 1 de 6. As
 *    séries 3 e 4 aparecem com RIR 1; 5 e 6 com RIR 0." Cada oculta diz só o que muda em relação à 1ª série (a carga,
 *    o esforço ou os dois). O "de N" é `totalDoExercicio`, como os números (os do cartão do aluno).
 * Cada linha sai sozinha: sem descanso nem %, só a 2ª. Oculta que repete um cartão não entra na 2ª linha. `wsKg` fica no
 * contexto para quem monta a prévia; a frase não o usa.
 */
export function legendaDaPrevia(g: GrupoDeSeries, config: Configuracao, ctx: { unidade: UnidadeDeCarga; wsKg: number | null; totalDoExercicio: number; max?: number }): string[] {
  const s0 = g.series[0];
  const ws = nomeDaSerieDeTrabalho(config);
  const partes: string[] = [];
  if (s0?.descansoSegundos) partes.push(`descanso de ${textoCurtoDoDescanso(s0.descansoSegundos)} depois da série`);
  if (modoDoGrupo(g) === 'PERCENTUAL_WS') partes.push(`carga sugerida a partir da ${ws} do dia`);
  const linhas = partes.length ? [partes.join(' · ').replace(/^./, (c) => c.toUpperCase())] : [];

  const { indices } = seriesDaPrevia(g, ctx.max);
  const comCartao = new Set(indices.map((i) => prescricao(g.series[i - g.inicio])));
  // Agrupa as excedentes pelo que muda em relação à 1ª série (carga e/ou esforço), na ordem em que aparecem.
  const cargaDe = (s: Serie) => textoCarga(s.carga, ws, ctx.unidade);
  const porTexto = new Map<string, number[]>();
  g.series.forEach((s, j) => {
    if (comCartao.has(prescricao(s))) return;
    const carga = cargaDe(s) !== cargaDe(s0) ? cargaDe(s) : '';
    const esforco = esforcoCurto(s) !== esforcoCurto(s0) ? esforcoCurto(s) : '';
    const texto = [carga, esforco].filter(Boolean).join(' · ');
    if (!texto) return;
    porTexto.set(texto, [...(porTexto.get(texto) ?? []), g.inicio + j + 1]);
  });
  if (!porTexto.size) return linhas;
  const mostradas = indices.map((i) => i + 1);
  const inicio = `Mostrando ${mostradas.length === 1 ? 'a série' : 'as séries'} ${lista(mostradas)} de ${ctx.totalDoExercicio}.`;
  const grupos = [...porTexto].map(([texto, n], k) => {
    if (k > 0) return `${lista(n)} com ${texto}`;
    return n.length === 1 ? `A série ${n[0]} aparece com ${texto}` : `As séries ${lista(n)} aparecem com ${texto}`;
  });
  linhas.push(`${inicio} ${grupos.join('; ')}.`);
  return linhas;
}

/**
 * O exercício que as peças do aluno consomem na prévia: TODAS as séries do exercício (a numeração bate com o cartão do
 * aluno) e nada do aluno (sem histórico: o "Último registro –" vem de `anterior="—"`). Cardio sai pelas próprias séries
 * (`ehExercicioDeCardio` lê `series[].cardio`). `progressao` ligada para não aparecer o "Foco em controle" do Como fazer.
 */
export function exercicioDaPrevia(series: Serie[], semCarga: boolean): ExercicioPlano {
  return { uid: 'previa', exercicioId: null, nome: '', modalidade: null, videoUrl: null, observacao: null, progressao: true, unidade: semCarga ? 'nenhuma' : 'kg', series };
}

/**
 * A carga fixa (kg) da primeira série de papel TRABALHO do exercício, base da estimativa da prévia; sem ela, `null` (sem
 * estimativa, o kg da prévia fica vazio). Só na prévia do editor: no app do aluno a carga fixa NÃO é base do "% da WS"
 * (`cargas.ts`; teste "WS de 12 kg seguida de Back off" em `cargaFixaERirPorSerie.test.ts`).
 */
export function wsDeReferenciaKg(series: readonly Serie[], config: Configuracao): number | null {
  const ws = series.find((s) => papelDe(config, s.tipo) === 'TRABALHO' && s.carga?.modo === 'CARGA_FIXA' && s.carga.valorKg != null);
  return ws?.carga?.valorKg ?? null;
}
