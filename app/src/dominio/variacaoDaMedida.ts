import type { AvaliacaoFisica, CampoDaMedida } from '../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../api/tipos';
import { diferenca, diferencaParaTela, serieDaMedida, TEXTO_PRIMEIRA, variacaoCurta } from './avaliacaoFisica';
import { formatadorDeDatas } from './comparacaoDeAvaliacoes';
import type { TomDoPeso } from './corDaVariacaoDoPeso';

export const ROTULO_DESDE_A_ANTERIOR = 'Desde a anterior';
export const ROTULO_DESDE_A_PRIMEIRA = 'Desde a primeira';

/** A diferença do último ponto para um ponto de referência da mesma medida. */
export interface DesdeUmaData {
  tipo: 'mudou' | 'igual';
  /** "▼ −20,0 cm", "▲ +10,0 cm" ou "0,0 cm" (zero sem seta). */
  texto: string;
  /** Data da referência, "11/11" (com o ano quando as datas da medida cruzam o ano). */
  data: string;
  /** Cor da regra da avaliação: cintura, abdômen e quadril pela meta do peso; o resto neutro (`COLUNAS_COM_META`). */
  tom: TomDoPeso;
  /** "desceu 20,0 cm, a favor da meta, desde 11/11"; "sem variação, desde 11/11". */
  falado: string;
}

export type VariacoesDaMedida =
  | { tipo: 'semMedida' }
  /** Um ponto só: "Primeira" (texto pequeno, secundário), sem variação inventada. */
  | { tipo: 'primeira'; texto: typeof TEXTO_PRIMEIRA }
  /** `primeira` é nula com dois pontos (a anterior já é a primeira: a linha repetiria). */
  | { tipo: 'comAnterior'; anterior: DesdeUmaData; primeira: DesdeUmaData | null };

/**
 * Resumo da medida no Histórico do aluno (28/11, pedido do Gustavo: "a MESMA regra do Peso"): a diferença desde a avaliação
 * anterior que mediu e, embaixo, desde a primeira. Só as datas com a medida contam (`serieDaMedida`, nunca interpolada);
 * tipo e tom vêm de `variacaoCurta`, a regra única da avaliação (zero "0,0" neutro e sem seta).
 */
export function variacoesDaMedida(avaliacoes: readonly AvaliacaoFisica[], campo: CampoDaMedida, meta: MetaDoPeso | null | undefined): VariacoesDaMedida {
  const { pontos } = serieDaMedida(avaliacoes, campo);
  if (!pontos.length) return { tipo: 'semMedida' };
  if (pontos.length === 1) return { tipo: 'primeira', texto: TEXTO_PRIMEIRA };
  const formatar = formatadorDeDatas(pontos.map((p) => p.data));
  const ultimo = pontos[pontos.length - 1];
  const desde = (ref: { data: string; valor: number }): DesdeUmaData => {
    const v = variacaoCurta(campo, ref.valor, ultimo.valor, meta);
    const d = diferenca(ref.valor, ultimo.valor) ?? 0;
    const data = formatar(ref.data);
    const mudou = v.tipo === 'mudou';
    return {
      tipo: mudou ? 'mudou' : 'igual',
      texto: mudou ? `${d > 0 ? '▲' : '▼'} ${diferencaParaTela(d)}` : diferencaParaTela(0),
      data,
      tom: v.tom,
      falado: `${v.falado}, desde ${data}`,
    };
  };
  return { tipo: 'comAnterior', anterior: desde(pontos[pontos.length - 2]), primeira: pontos.length > 2 ? desde(pontos[0]) : null };
}
