import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, type View } from 'react-native';

import type { FocoAoEntrar } from '../../dominio/importacaoAssistida';

export type Focavel = { focus: () => void };

/** O h1 da tela (o título do `Cabecalho`, que não expõe ref): o mais perto do painel, subindo pelos ancestrais. */
function tituloDaTela(raiz: View | null): HTMLElement | null {
  for (let no = (raiz as unknown as HTMLElement | null)?.parentElement; no; no = no.parentElement) {
    const titulo = no.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"]');
    if (titulo) return titulo;
  }
  return null;
}

const emCampo = (el: Element | null) =>
  !!el && ((el as HTMLElement).isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

/**
 * Foco ao entrar (T-206), uma vez por montagem: no título da tela ou na primeira ação pendente (`focoAoEntrar`). Não
 * rouba: se a pessoa já tocou ou teclou desde que a tela abriu, ou está num campo, o foco fica onde está. Espera dois
 * quadros, porque a tabela dos termos se mede e, estreita, vira cartões (o botão remonta), e confere de novo em 300 ms:
 * se o botão focado sumiu nessa troca (foco no `body`), foca o novo. O título não rola a página; a ação rola só se
 * estiver fora da vista. No nativo o leitor de tela já começa no topo da tela nova: só a ação pendente recebe o foco
 * (`setAccessibilityFocus`, como em `ConferirOArquivo`).
 */
export function useFocoAoEntrar(
  foco: FocoAoEntrar | null,
  raiz: RefObject<View | null>,
  ler: RefObject<View | null>,
  termo: RefObject<View | null>,
  aluno: RefObject<Focavel | null>,
) {
  const interagiu = useRef(false);
  const feito = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const marcar = () => { interagiu.current = true; };
    document.addEventListener('keydown', marcar, true);
    document.addEventListener('pointerdown', marcar, true);
    return () => {
      document.removeEventListener('keydown', marcar, true);
      document.removeEventListener('pointerdown', marcar, true);
    };
  }, []);

  useEffect(() => {
    if (!foco || feito.current) return;
    let noNativo: number | null = null;
    const focar = () => {
      if (interagiu.current) return;
      if (Platform.OS !== 'web') {
        const no = findNodeHandle(foco.tipo === 'ler' ? ler.current : foco.tipo === 'termo' ? termo.current : null);
        // O mesmo nó já tem o foco; outro nó é o botão remontado.
        if (!no || no === noNativo) return;
        AccessibilityInfo.setAccessibilityFocus(no);
        noNativo = no;
        feito.current = true;
        return;
      }
      const ativo = document.activeElement;
      // Na segunda passada só refaz se o foco se perdeu (o botão sumiu); a primeira tira o foco do menu que abriu a tela.
      if (feito.current && ativo && ativo !== document.body) return;
      if (emCampo(ativo)) return;
      if (foco.tipo === 'aluno') {
        if (!aluno.current) return;
        aluno.current.focus();
      } else if (foco.tipo === 'titulo') {
        const titulo = tituloDaTela(raiz.current);
        if (!titulo) return;
        if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
      } else {
        const botao = (foco.tipo === 'ler' ? ler.current : termo.current) as unknown as HTMLElement | null;
        if (!botao) return;
        botao.focus();
      }
      feito.current = true;
    };
    let segundo = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const primeiro = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => {
        focar();
        espera = setTimeout(focar, 300);
      });
    });
    return () => {
      cancelAnimationFrame(primeiro);
      cancelAnimationFrame(segundo);
      clearTimeout(espera);
    };
  }, [foco, raiz, ler, termo, aluno]);
}
