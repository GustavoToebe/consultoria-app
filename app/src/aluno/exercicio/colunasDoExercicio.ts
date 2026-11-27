import { arranjoPrincipalComApoio, larguraDoApoioDaFaixa, VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { LARGURA_LISTA_DO_ALUNO, telaLargaDoAluno } from '../../dominio/telaLargaDoAluno';
import { espaco, type FaixaDeLargura } from '../../tema/tokens';
import { FOLGA_DO_BOTAO } from '../../ui/folgaDoBotao';

/**
 * Colunas do exercício do aluno na web (27/11, no contêiner do treinador; `docs/planos/orientacoes-de-design-26-11.md`, 1.4,
 * e o item 7 do pedido do Gustavo). Pura: decide pela faixa da `Tela` (a largura da coluna "Sobre o exercício": 380, 420 ou
 * 440) e pela largura útil medida (`useAreaDaTela().largura`, que já respeita a "Largura do conteúdo"), nunca pela janela.
 *
 * - Sem espaço para 560 + 32 + apoio: o desenho do celular (`null`).
 * - Faixa `normal` (ou sem nada para a 3ª coluna): "Sobre o exercício" + séries ocupando o resto, sem faixa vazia.
 * - `larga` e `ultralarga`: as séries crescem até 880 (a lista sequencial do aluno) e o resto vira a coluna do próximo
 *   exercício e do histórico, com pelo menos 340; se não couber com as séries em 640, as séries encolhem até 640 e, abaixo
 *   disso, a 3ª coluna não abre. Com 752 ou mais, ela se divide em duas (próximo e últimos registros | carga por data), para
 *   o espaço extra virar coluna e nunca um cartão esticado.
 * - Só o próximo (cardio ou exercício livre, sem histórico): a 3ª coluna fica com a largura do apoio e as séries com o resto.
 */

/** As séries não passam disto quando há 3ª coluna (o nome da série longe da carga perde a linha). */
export const SERIES_ATE = LARGURA_LISTA_DO_ALUNO;
/** Abaixo disto as séries não encolhem para abrir a 3ª coluna. */
export const SERIES_NO_MINIMO = 640;
/** A 3ª coluna (próximo e histórico) não abre mais estreita que isto: o cartão do próximo cabe em duas linhas. */
export const EXTRAS_NO_MINIMO = 340;
/** Duas colunas de 360 e o vão: a partir daqui a 3ª coluna se divide em duas. */
export const EXTRAS_EM_DUAS = 2 * 360 + VAO_DA_PRINCIPAL;

export interface ColunasDoExercicio {
  /** Coluna "Sobre o exercício", à esquerda. */
  apoio: number;
  /** Coluna das séries (onde a barra fixa de baixo se alinha), começando em `apoio + VAO_DA_PRINCIPAL`. */
  series: number;
  /** Largura total da 3ª coluna (0 = não abre). */
  extras: number;
  /** A 3ª coluna em 1 ou 2 colunas (0 = não abre). */
  colunasDosExtras: 0 | 1 | 2;
}

export function colunasDoExercicio(
  util: number | null,
  faixa: FaixaDeLargura,
  tem: { proximo: boolean; historico: boolean },
): ColunasDoExercicio | null {
  const apoio = larguraDoApoioDaFaixa(faixa);
  if (util === null || arranjoPrincipalComApoio(util, true, apoio) !== 'lado') return null;
  const resto = util - apoio - VAO_DA_PRINCIPAL;
  const so = { apoio, series: resto, extras: 0, colunasDosExtras: 0 as const };
  if (!telaLargaDoAluno(faixa) || (!tem.proximo && !tem.historico)) return so;
  if (!tem.historico) {
    // Só o cartão do próximo: não estica; as séries ficam com o resto.
    const extras = Math.min(apoio, resto - VAO_DA_PRINCIPAL - SERIES_NO_MINIMO);
    return extras >= EXTRAS_NO_MINIMO ? { apoio, series: resto - VAO_DA_PRINCIPAL - extras, extras, colunasDosExtras: 1 } : so;
  }
  const series = Math.min(SERIES_ATE, resto - VAO_DA_PRINCIPAL - EXTRAS_NO_MINIMO);
  if (series < SERIES_NO_MINIMO) return so;
  const extras = resto - VAO_DA_PRINCIPAL - series;
  return { apoio, series, extras, colunasDosExtras: extras >= EXTRAS_EM_DUAS ? 2 : 1 };
}

/** Onde fica a coluna das séries dentro do bloco do conteúdo (`esquerda` a partir da borda do bloco): a barra fixa se alinha a ela. */
export const colunaDasSeriesNoBloco = (c: ColunasDoExercicio) => ({ esquerda: c.apoio + VAO_DA_PRINCIPAL, largura: c.series });

/**
 * Onde a coluna do exercício gruda, a partir do topo da área que rola: 16, a folga de cima da `Tela`. As barras desta rota
 * (topo e "Próximo") ficam fora da rolagem; com mais que a folga a coluna nasceria abaixo das séries.
 */
export const TOPO_DA_COLUNA_DO_EXERCICIO = espaco(2);
/**
 * O que fica abaixo da coluna no fim da rolagem: a folga de baixo da `Tela` (16) e a do botão "voltar ao topo" da
 * `RolagemComTopo` (`FOLGA_DO_BOTAO`, 16 + 44 + 8, a mesma constante de `ui/folgaDoBotao`). Entra na
 * altura máxima da coluna para o nome e o Descanso continuarem à vista também no fim das séries.
 */
export const FOLGA_NO_FIM_DA_ROLAGEM = FOLGA_DO_BOTAO;
