import { espaco } from '../../tema/tokens';
import { FOLGA_DO_BOTAO } from '../../ui/folgaDoBotao';

/** Vão entre o formulário e a prévia ao lado. */
export const VAO_DA_PREVIA = espaco(3);
/** Coluna do formulário da Marca na tela larga (pedido de 27/11: ~720). */
export const LARGURA_DO_FORMULARIO_DA_MARCA = 720;
/** Coluna do formulário do Contato na tela larga (pedido de 28/11: ~640). */
export const LARGURA_DO_FORMULARIO_DO_CONTATO = 640;
/** Desenho de cada celular da prévia (28/11: até ~380, a largura de um celular de verdade); abaixo disso, em escala. */
export const LARGURA_DO_CELULAR = 380;
export const ALTURA_DO_CELULAR = 640;
/**
 * A partir daqui (largura MEDIDA da área das telas da consultoria, 28/11: ~1600) o formulário fica à esquerda e a prévia
 * fixa ao lado; abaixo, a prévia desce para baixo do formulário. Com o formulário de 720 sobram ~816 para os dois
 * celulares de 380 lado a lado. Dentro de Configurações (menu de 240 e coluna de 300), 1920 de janela mede ~1348: a
 * prévia fica embaixo; 3440 mede ~2868: ao lado.
 */
export const FORMULARIO_E_PREVIA = 1600;

/**
 * Onde a prévia fica, pela largura MEDIDA da tela (não a janela: o menu e a coluna de Configurações comem largura):
 * `empilhado` (embaixo do formulário) ou `larga` (formulário à esquerda e a prévia ao lado, fixa ao rolar). `null` sem
 * medida: nenhuma prévia pisca. Vale para a Marca e o Contato.
 */
export type ArranjoDaMarca = 'empilhado' | 'larga';

export function arranjoDaMarca(largura: number | null | undefined): ArranjoDaMarca | null {
  if (typeof largura !== 'number' || !(largura > 0)) return null;
  return largura >= FORMULARIO_E_PREVIA ? 'larga' : 'empilhado';
}

/**
 * Escala de um desenho de tamanho fixo (`base`) para caber na caixa medida: nunca maior que o desenho (1); com `altura`,
 * cabe também nela (a prévia fixa da tela larga). Sem medida, 0 (nada aparece até medir).
 */
export function escalaParaCaber(base: { largura: number; altura: number }, caixa: { largura: number; altura?: number }): number {
  if (!(caixa.largura > 0)) return 0;
  const pelaLargura = caixa.largura / base.largura;
  const pelaAltura = caixa.altura !== undefined && caixa.altura > 0 ? caixa.altura / base.altura : Infinity;
  return Math.min(1, pelaLargura, pelaAltura);
}

/**
 * Altura do cartão da prévia fixa: a da coluna do formulário, sem passar da janela menos o recuo de cima e a folga do botão
 * de voltar ao topo (`FOLGA_DO_BOTAO`, no fim da rolagem): no fim da página o `sticky` não passa do fim da linha e, mais
 * alto que isso, o cartão subia para fora da janela.
 */
export function alturaDaPreviaFixa(alturaDoFormulario: number | null, alturaDaJanela: number): number | undefined {
  if (!alturaDoFormulario || !(alturaDoFormulario > 0)) return undefined;
  return Math.max(0, Math.min(alturaDoFormulario, alturaDaJanela - espaco(2) - FOLGA_DO_BOTAO));
}
