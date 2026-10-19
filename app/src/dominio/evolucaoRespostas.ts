import type { EvolucaoRespostas, PontoDeResposta, SerieDeResposta } from '../api/tipos';
import { dataCurta, numeroParaTela } from './formatos';

/**
 * Evolução das respostas numéricas das atualizações (ficha do aluno). Só reorganiza o que o aluno respondeu: sem
 * média, tendência, meta nem juízo de melhora ou piora. Pergunta sem resposta não é ponto (nunca zero); a API já tira
 * as séries vazias.
 */

const ROTULO_MAXIMO = 32;
const cortar = (texto: string) => (texto.length > ROTULO_MAXIMO ? `${texto.slice(0, ROTULO_MAXIMO - 1)}…` : texto);

/** Nome curto da pergunta para a escolha: o rótulo curto do treinador, senão o rótulo (cortado). */
export const nomeDaSerie = (s: SerieDeResposta) => cortar(s.rotuloCurto?.trim() || s.rotulo.trim() || s.perguntaId);

const respostas = (n: number) => `${n} ${n === 1 ? 'resposta' : 'respostas'}`;

/** Opções da escolha da pergunta, na ordem da API (a do questionário mais recente). */
export function opcoesDasSeries(series: readonly SerieDeResposta[]) {
  return series.map((s) => {
    const nome = nomeDaSerie(s);
    const completo = s.rotulo.trim();
    return {
      valor: s.perguntaId,
      rotulo: nome,
      detalhe: completo && completo !== nome ? `${completo} · ${respostas(s.pontos.length)}` : respostas(s.pontos.length),
    };
  });
}

/** A série escolhida; id que não existe mais (ou nenhum escolhido) cai na primeira. Sem série, `null`. */
export const serieEscolhida = (series: readonly SerieDeResposta[], id: string | null) =>
  series.find((s) => s.perguntaId === id) ?? series[0] ?? null;

/** "7" na NOTA; "88,5 cm" no NUMERO, com as casas e a unidade da pergunta. */
export function textoDoValor(s: Pick<SerieDeResposta, 'tipo' | 'casas' | 'unidade'>, valor: number): string {
  if (s.tipo === 'NOTA') return numeroParaTela(valor, 0);
  const unidade = s.unidade?.trim();
  return `${numeroParaTela(valor, s.casas ?? 0)}${unidade ? ` ${unidade}` : ''}`;
}

/** Unidade no eixo do gráfico: a do NUMERO; a NOTA (0 a 10) não tem. */
export const unidadeDoGrafico = (s: Pick<SerieDeResposta, 'tipo' | 'unidade'>) => (s.tipo === 'NUMERO' ? s.unidade?.trim() ?? '' : '');

const porData = (a: PontoDeResposta, b: PontoDeResposta) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0);

/** Pontos do gráfico, do mais antigo ao mais novo (não depende da ordem da API). */
export const pontosDoGrafico = (s: SerieDeResposta) =>
  [...s.pontos].sort(porData).map((p) => ({ rotulo: dataCurta(p.data), valor: p.valor }));

/** O gráfico só aparece com a preferência ligada e 2 pontos ou mais; a lista aparece sempre. */
export const mostraGrafico = (s: SerieDeResposta | null, graficosLigados: boolean) => graficosLigados && !!s && s.pontos.length >= 2;

/** Lista das datas: da mais recente para a mais antiga; `limite` mantém as mais recentes. */
export function linhasDaLista(s: SerieDeResposta, limite: number | null) {
  const desc = [...s.pontos].sort(porData).reverse();
  return limite === null ? desc : desc.slice(0, limite);
}

/** Quantas atualizações a evolução cobre: "Últimas 24 atualizações enviadas." ou "3 atualizações enviadas.". */
export function textoDoAlcance(e: Pick<EvolucaoRespostas, 'limite' | 'atualizacoes'>): string {
  if (e.atualizacoes === 0) return 'Nenhuma atualização enviada ainda.';
  if (e.atualizacoes >= e.limite) return `Últimas ${e.limite} atualizações enviadas.`;
  return e.atualizacoes === 1 ? '1 atualização enviada.' : `${e.atualizacoes} atualizações enviadas.`;
}
