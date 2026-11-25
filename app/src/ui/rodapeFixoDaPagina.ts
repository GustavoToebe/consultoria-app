/** Quantos pixels acima da linha padrão do aviso a sondagem olha (o aviso de 3 linhas cabe). */
const FAIXA = 96;
const PASSO = 16;
/** Rodapés empilhados que a sondagem atravessa (barra de ações + outra por cima); o resto fica como está. */
const MAX_RODAPES = 3;

/** Peça fixa de verdade (não uma camada de portal, véu ou diálogo) e baixa o bastante para ser um rodapé. */
function eRodape(el: Element, janela: number): boolean {
  if (el.closest('[data-camada],[role="dialog"],[role="alertdialog"]')) return false;
  const posicao = getComputedStyle(el).position;
  if (posicao !== 'fixed' && posicao !== 'sticky') return false;
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.height <= janela / 3 && r.top >= janela / 2;
}

/**
 * Web, sem Folha aberta: o topo do rodapé fixo (`fixed` ou `sticky`, como a barra de ações dos editores e da importação)
 * que o aviso cobriria na linha `linha` (px do topo da janela) ou `null` se nada atrapalha. Olha o meio da janela em alguns
 * pontos da faixa logo acima da linha; achando, sobe a linha até o topo da peça e olha de novo, para rodapés empilhados.
 * shortcut: só web (no celular nativo o `rodapeFora` do `TelaDoEditor` segue por baixo do aviso: precisa publicar a altura
 * dele num registro) e só o meio da largura (um botão flutuante no canto não é visto); trocar se um rodapé assim aparecer.
 */
export function topoDoRodapeFixo(linha: number): number | null {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') return null;
  const janela = window.innerHeight;
  const x = window.innerWidth / 2;
  let atual = linha;
  let achou = false;
  for (let volta = 0; volta < MAX_RODAPES; volta += 1) {
    let topo = atual;
    for (let y = atual - 1; y > atual - FAIXA && y > 0; y -= PASSO) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (eRodape(el, janela)) topo = Math.min(topo, el.getBoundingClientRect().top);
      }
    }
    if (topo >= atual) break;
    achou = true;
    atual = topo;
  }
  return achou ? Math.round(atual) : null;
}
