import { arranjoPrincipalComApoio, VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { espaco } from '../../tema/tokens';
import { FOLGA_DO_BOTAO } from '../../ui/folgaDoBotao';

/**
 * Medidas do exercício do aluno na web larga (`docs/planos/orientacoes-de-design-26-11.md`, 1.4). A coluna do exercício
 * (apoio, à esquerda) tem 400: a orientação pede 400 a 440, e dentro do teto de 1312 das telas do aluno a área nunca chega
 * à faixa que daria 440. As séries vão até 720 (a série é mais estreita que uma refeição); a sobra do teto vira margem.
 */
export const LARGURA_DA_COLUNA_DO_EXERCICIO = 400;
export const LARGURA_DAS_SERIES = 720;
/**
 * Onde a coluna do exercício gruda, a partir do topo da área que rola: 16, a folga de cima da `Tela`. As barras desta rota
 * (topo e "Próximo") ficam fora da rolagem; com mais que a folga a coluna nasceria abaixo das séries.
 */
export const TOPO_DA_COLUNA_DO_EXERCICIO = espaco(2);
/**
 * O que fica abaixo da coluna no fim da rolagem: a folga do botão "voltar ao topo" da `RolagemComTopo`
 * (`FOLGA_DO_BOTAO`, 16 + 44 + 8, a mesma constante de `ui/folgaDoBotao`). Entra na altura máxima da coluna para o nome
 * e o Descanso continuarem à vista também no fim das séries.
 */
export const FOLGA_NO_FIM_DA_ROLAGEM = FOLGA_DO_BOTAO;

/** Onde fica a coluna das séries dentro do bloco do conteúdo (`esquerda` a partir da borda do bloco): a barra fixa se alinha a ela. */
export const colunaDasSeriesNoBloco = (larguraDoBloco: number) => {
  const esquerda = LARGURA_DA_COLUNA_DO_EXERCICIO + VAO_DA_PRINCIPAL;
  return { esquerda, largura: Math.max(0, Math.min(LARGURA_DAS_SERIES, larguraDoBloco - esquerda)) };
};

/**
 * Duas colunas quando a área do conteúdo da tela comporta a principal mínima + vão + 400 (992 px de área); senão, o desenho
 * do celular. Medida pela rota, porque a barra do "Próximo", fora da rolagem, também se alinha à coluna das séries.
 */
export const exercicioEmColunas = (area: number | null) =>
  arranjoPrincipalComApoio(area, true, LARGURA_DA_COLUNA_DO_EXERCICIO) === 'lado';
