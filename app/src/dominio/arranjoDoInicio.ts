/**
 * Arranjo do Início do aluno na tela larga (revisão 2 de 24/11, decisão 2 de `docs/planos/tela-larga-revisao-2.md`): o
 * "Hoje" é o primeiro bloco e o resto vai em pilhas independentes (como a ficha › Dados, 4.10), cada uma com o mesmo vão;
 * nada fica embaixo de todas, então a sobra de altura só existe no fim da pilha mais curta. Da faixa `larga` em diante
 * (`telaLargaDoAluno`); abaixo dela, `linhasDoInicio` (o Hoje também primeiro, pedido do Gustavo de 24/11).
 *
 * Com o retorno ligado o mapa do ano existe e precisa de duas faixas (numa de 552 ele cai no modo do celular, com rolagem):
 * uma pilha de uma faixa com o dia (Hoje, dieta, água, pendências) e uma de duas com o progresso ("Sua semana" e "Seu nível"
 * lado a lado, da mesma altura, e o mapa embaixo, que ocupa o cartão) e, sob o mapa, compromissos e vitrine numa faixa
 * (`compromissosEVitrine`, na borda da semana): com tudo à esquerda, o Início cheio deixava ~500 px vazios sob o mapa.
 */

export type BlocoDoInicio = 'hoje' | 'dieta' | 'agua' | 'pendencias' | 'compromissos' | 'semana' | 'nivel' | 'vitrine' | 'mapa';
/**
 * Uma peça de pilha: um bloco, "Sua semana" e "Seu nível" lado a lado (`semanaENivel`) ou compromissos e vitrine empilhados
 * na primeira das duas faixas (`compromissosEVitrine`, a última peça da pilha larga: nada vem embaixo dela).
 */
export type PecaDoInicio = BlocoDoInicio | 'semanaENivel' | 'compromissosEVitrine';
/** `faixas` é a proporção da pilha (flex): uma ou duas faixas de 552. */
export interface PilhaDoInicio { faixas: 1 | 2; pecas: PecaDoInicio[] }

export interface SituacaoDoInicio {
  /** `retornoHabilitado`: o mapa do ano e o nível existem. */
  retorno: boolean;
  /** A vitrine tem itens para mostrar. */
  vitrine: boolean;
}

/** Faixas do teto da tela (`TelaDoAluno`): três quando há mapa ou vitrine; sem nenhum, as duas de 1120. */
export const faixasDaTelaDoInicio = (s: SituacaoDoInicio): 2 | 3 => (s.retorno || s.vitrine ? 3 : 2);

/**
 * As pilhas do Início na tela larga, da esquerda para a direita; a soma das faixas é `faixasDaTelaDoInicio`. Só depende de
 * chaves que não mudam enquanto a tela carrega (o pacote e a internet ficam de fora): nenhum bloco troca de pilha (nem
 * remonta) quando o pacote chega ou a conexão cai. O nível fica sempre ao lado da semana; sem internet ele mesmo mostra o
 * último valor lido, e sem plano de treino a semana não aparece e o nível ocupa a linha.
 */
export function pilhasDoInicio(s: SituacaoDoInicio): PilhaDoInicio[] {
  if (s.retorno) {
    return [
      { faixas: 1, pecas: ['hoje', 'dieta', 'agua', 'pendencias'] },
      { faixas: 2, pecas: ['semanaENivel', 'mapa', 'compromissosEVitrine'] },
    ];
  }
  const dia: PilhaDoInicio = { faixas: 1, pecas: ['hoje', 'dieta', 'agua'] };
  const tarefas: PilhaDoInicio = { faixas: 1, pecas: ['pendencias', 'compromissos', 'semana'] };
  return s.vitrine ? [dia, tarefas, { faixas: 1, pecas: ['vitrine'] }] : [dia, tarefas];
}

/** Abaixo da faixa larga: uma linha tem uma pilha (largura toda) ou duas (colunas iguais, independentes). */
export type LinhaDoInicio = PecaDoInicio[][];

/** Duas colunas no corpo do Início abaixo da faixa larga: cabem duas de 360 com o vão (tablet deitado e PC até 1280). */
export const MINIMO_DA_COLUNA_DO_INICIO = 360;

/**
 * O Início abaixo da faixa larga (24/11, pedido do Gustavo): o Hoje primeiro em qualquer largura, depois Dieta e Água, Sua
 * semana e Seu nível e o mapa do ano.
 * - Uma coluna (celular): Hoje › Dieta › Água › pendências › compromissos › semana › nível › mapa › vitrine.
 * - Duas colunas (PC até 1280): Hoje e Dieta à esquerda, Água à direita (as duas pilhas acabam perto: ~280 e ~230 px), com
 *   pendências e compromissos embaixo de cada uma; depois semana e nível lado a lado e da mesma altura, e o mapa na largura
 *   toda. Antes, Dieta, Água e Hoje à esquerda e semana e nível à direita deixavam ~210 px vazios sob o nível.
 * - Sem o retorno (sem nível nem mapa) a semana vai para a pilha da Água, para não esticar sozinha na largura toda.
 */
export function linhasDoInicio(o: { retorno: boolean; duasColunas: boolean }): LinhaDoInicio[] {
  if (!o.duasColunas) return [[['hoje', 'dieta', 'agua', 'pendencias', 'compromissos', 'semana', 'nivel', 'mapa', 'vitrine']]];
  if (!o.retorno) return [[['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'semana', 'vitrine']]];
  return [[['hoje', 'dieta', 'pendencias'], ['agua', 'compromissos', 'vitrine']], [['semanaENivel']], [['mapa']]];
}
