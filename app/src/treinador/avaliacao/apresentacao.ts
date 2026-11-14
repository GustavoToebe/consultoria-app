import type { AvaliacaoFisica, CampoDaMedida } from '../../api/avaliacaoFisicaTipos';
import { cmParaTela, diferenca, diferencaParaTela, MEDIDAS, serieDaMedida } from '../../dominio/avaliacaoFisica';
import { PARES_DIREITA_ESQUERDA, seriesDoPar, type SeriesDoPar } from '../../dominio/comparacaoDeAvaliacoes';
import { dataCurta, dataParaTela } from '../../dominio/formatos';
import type { GraficoDoPdf } from '../../pdf/pdfAvaliacaoFisica';

type Pontos = { data: string; valor: number }[];

/** O que a Evolução mostra da medida escolhida: uma série, ou direita (A) e esquerda (B) do mesmo par. */
export interface SeriesDaEvolucao {
  nome: string;
  a: { rotulo: string; pontos: Pontos };
  b: { rotulo: string; pontos: Pontos } | null;
  /** Par com os dois lados registrados: a tela oferece ver os dois juntos. */
  par: SeriesDoPar | null;
  /** Par com um lado nunca registrado: a frase que diz qual (o gráfico fica só com a medida escolhida). */
  semOutroLado: string | null;
}

export function seriesDaEvolucao(avaliacoes: readonly AvaliacaoFisica[], campo: CampoDaMedida, verPar: boolean): SeriesDaEvolucao {
  const nome = MEDIDAS.find((m) => m.campo === campo)?.rotulo ?? '';
  const idDoPar = PARES_DIREITA_ESQUERDA.find((p) => p.direita === campo || p.esquerda === campo)?.id;
  const s = idDoPar ? seriesDoPar(avaliacoes, idDoPar) : null;
  const par = s?.suficiente ? s : null;
  const outro = s && !s.suficiente ? [s.direita, s.esquerda].find((l) => l.pontos.length === 0) : undefined;
  const semOutroLado = outro ? `Sem registro de ${outro.rotulo.toLowerCase()}: o gráfico mostra só ${nome.toLowerCase()}.` : null;
  if (par && verPar) return { nome, a: par.direita, b: par.esquerda, par, semOutroLado };
  return { nome, a: { rotulo: nome, pontos: serieDaMedida(avaliacoes, campo).pontos }, b: null, par, semOutroLado };
}

/** O gráfico opcional do PDF é o mesmo que a Evolução mostra (no par, `pontos` = direita e `serieB` = esquerda). */
export function graficoDoPdf(s: SeriesDaEvolucao): GraficoDoPdf {
  return { rotulo: s.a.rotulo, unidade: 'cm', pontos: s.a.pontos, serieB: s.b ? { rotulo: s.b.rotulo, pontos: s.b.pontos } : undefined };
}

/**
 * Apresentação do gráfico da Evolução por medida (só texto e números da tela, sem regra nova): os limites da escala que o
 * gráfico usa e o texto que diz quais são, e as linhas do balão de cada ponto. As regras da medida ficam em
 * `dominio/comparacaoDeAvaliacoes` e `dominio/avaliacaoFisica`.
 */

/**
 * Limites inteiros da escala vertical, com folga de 15% (mínimo 0,5 cm) dos dois lados, para a linha não encostar nas
 * bordas. Os mesmos números vão no `escala` e no texto da legenda: o eixo e o texto nunca discordam. Um ponto só (ou
 * valores iguais) ainda dá `max > min`.
 */
export function escalaDoGrafico(valores: readonly number[]): { min: number; max: number } {
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const folga = Math.max((maior - menor) * 0.15, 0.5);
  return { min: Math.max(0, Math.floor(menor - folga)), max: Math.ceil(maior + folga) };
}

/** "Escala vertical: 79 a 84 cm, não começa em zero." O guia pede dizer os limites quando a escala não começa em zero. */
export function textoDaEscala({ min, max }: { min: number; max: number }): string {
  return min > 0 ? `Escala vertical: ${min} a ${max} cm, não começa em zero.` : `Escala vertical: ${min} a ${max} cm.`;
}

/**
 * Linhas do balão de um ponto: o nome da série (com duas séries), "13/11/2026 · 35,2 cm" e a diferença para o primeiro
 * ponto da MESMA série ("+0,8 cm desde 01/11"); o primeiro ponto diz que é o primeiro registro.
 */
export function linhasDaDica(pontos: readonly { data: string; valor: number }[], indice: number, serie?: string): string[] {
  const ponto = pontos[indice];
  if (!ponto) return [];
  const primeiro = pontos[0];
  const referencia = indice === 0 ? 'Primeiro registro' : `${diferencaParaTela(diferenca(primeiro.valor, ponto.valor))} desde ${dataCurta(primeiro.data)}`;
  return [...(serie ? [serie] : []), `${dataParaTela(ponto.data)} · ${cmParaTela(ponto.valor)} cm`, referencia];
}
