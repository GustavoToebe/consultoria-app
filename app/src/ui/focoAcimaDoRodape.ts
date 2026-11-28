import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

import { deslocamentoAcimaDoRodape } from '../dominio/focoAcimaDoRodape';
import { useTema } from '../tema/TemaProvider';

/**
 * Web: o elemento que ganha foco pelo teclado atrás de um rodapé grudado (`position: sticky; bottom`) rola até ficar acima
 * dele, com 8 px de folga (WCAG 2.4.11, foco não encoberto): o navegador só rola até a borda da janela, e ali está o
 * rodapé. Devolve o ref para o rodapé; `ativo` falso (rodapé escondido) não escuta nada. Mede um quadro depois do foco,
 * quando a rolagem do próprio navegador (e a do `scrollIntoView` da barra do editor) já aconteceu: se o elemento já está à
 * vista, não mexe. Foco vindo do ponteiro não rola (rolar entre o apertar e o soltar tirava o controle de baixo do
 * ponteiro). Movimento reduzido (o do app ou o do sistema, lido na hora): rolagem instantânea. No nativo não há foco de
 * teclado: nada. Regra pura em `dominio/focoAcimaDoRodape`.
 */
export function useFocoAcimaDoRodape(ativo: boolean) {
  const ref = useRef<View>(null);
  const reduzidoNoApp = useTema().preferencias?.movimento === 'REDUZIDO';
  useEffect(() => {
    if (Platform.OS !== 'web' || !ativo) return undefined;
    const rodape = ref.current as unknown as HTMLElement | null;
    return rodape ? manterFocoAcimaDoRodape(rodape, reduzidoNoApp) : undefined;
  }, [ativo, reduzidoNoApp]);
  return ref;
}

function manterFocoAcimaDoRodape(rodape: HTMLElement, reduzidoNoApp: boolean): () => void {
  let apertando = false;
  let quadro = 0;
  const aoApertar = () => { apertando = true; };
  const aoSoltar = () => { apertando = false; };
  const aoFocar = (e: FocusEvent) => {
    const alvo = e.target;
    if (apertando || !(alvo instanceof HTMLElement) || rodape.contains(alvo)) return;
    const rolagem = rolagemDe(rodape);
    // Só o conteúdo da mesma rolagem; folha e painel em portal ficam de fora.
    if (!rolagem?.contains(alvo)) return;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      if (document.activeElement !== alvo) return;
      const f = alvo.getBoundingClientRect();
      const d = deslocamentoAcimaDoRodape({ topo: f.top, base: f.bottom }, rodape.getBoundingClientRect().top, rolagem.getBoundingClientRect().top);
      if (d <= 0) return;
      const reduzido = reduzidoNoApp || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      rolagem.scrollBy({ top: d, behavior: reduzido ? 'auto' : 'smooth' });
    });
  };
  document.addEventListener('pointerdown', aoApertar, true);
  document.addEventListener('pointerup', aoSoltar, true);
  document.addEventListener('pointercancel', aoSoltar, true);
  document.addEventListener('focusin', aoFocar);
  return () => {
    cancelAnimationFrame(quadro);
    document.removeEventListener('pointerdown', aoApertar, true);
    document.removeEventListener('pointerup', aoSoltar, true);
    document.removeEventListener('pointercancel', aoSoltar, true);
    document.removeEventListener('focusin', aoFocar);
  };
}

/** A rolagem em que o rodapé gruda: o primeiro ancestral que rola na vertical. */
function rolagemDe(el: HTMLElement): HTMLElement | null {
  let atual = el.parentElement;
  while (atual && !/(auto|scroll)/.test(getComputedStyle(atual).overflowY)) atual = atual.parentElement;
  return atual;
}
