import { useEffect, useId, useRef, type RefObject } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

import { espaco } from '../tema/tokens';

/**
 * Distância do pé da camada do aviso até a base dele (o `bottom`), para os quatro casos:
 * - sem rodapé que atrapalhe (`rodape` nulo): o padrão, área segura de baixo + 80 px;
 * - Folha com rodapé (`naFolha`): logo acima do rodapé dela (8 px), mesmo abaixo do padrão;
 * - página com rodapé fixo (barra de ações da importação; web pelo DOM, celular pelo registro abaixo): o rodapé só sobe o
 *   aviso, nunca o desce abaixo do padrão.
 * `rodape` é a distância do topo do rodapé ao pé da camada (não a altura dele: no celular a barra de abas fica embaixo).
 */
export function baseDoAviso(margemInferior: number, rodape: number | null, naFolha: boolean): number {
  const padrao = margemInferior + espaco(10);
  if (rodape === null) return padrao;
  return naFolha ? rodape + espaco(1) : Math.max(padrao, rodape + espaco(1));
}

// Celular nativo (sem DOM para sondar): o rodapé fixo da página publica onde fica o topo dele na janela
// (`measureInWindow`), e o `AvisoProvider` publica o pé da camada do aviso, medido do mesmo jeito. As duas pontas na mesma
// régua: `useWindowDimensions` engana no Android de ponta a ponta (barra de navegação e de status).
const topos = new Map<string, number>();
let peDaCamada: number | null = null;

/** Nativo: o `AvisoProvider` informa o pé da camada dele na janela (y + altura, por `measureInWindow`). */
export function registrarPeDaCamada(pe: number | null): void {
  peDaCamada = pe;
}

/** Nativo: px do topo do rodapé fixo mais alto ao pé da camada do aviso, ou `null` sem rodapé (ou antes das medidas). */
export function distanciaDoRodapeRegistrado(): number | null {
  if (peDaCamada === null || topos.size === 0) return null;
  const distancia = Math.round(peDaCamada - Math.min(...topos.values()));
  return distancia > 0 ? distancia : null;
}

/**
 * Nativo: liga a peça fixa embaixo da página (o `rodapeFora` da `TelaDoEditor`) ao aviso. Ponha `ref` e `onLayout` na
 * `View` do rodapé: a cada layout (o teclado empurra o rodapé no iOS) ele mede onde está e o aviso sobe acima dele; ao
 * desmontar, sai do registro. Na web não use (lá o aviso sonda o DOM, `topoDoRodapeFixo`).
 * shortcut: vale enquanto a tela está montada; as rotas do treinador vêm por `Slot` (a tela de trás desmonta). Uma tela
 * com rodapé que fique montada sob outra num `Stack` subiria o aviso da de cima: registrar só com a tela em foco.
 */
export function useRegistroDoRodapeFixo(): { ref: RefObject<View | null>; onLayout: (e: LayoutChangeEvent) => void } {
  const id = useId();
  const ref = useRef<View>(null);
  useEffect(() => () => {
    topos.delete(id);
  }, [id]);
  const onLayout = () => {
    ref.current?.measureInWindow((_x, y, _largura, altura) => {
      if (altura > 0) topos.set(id, y);
      else topos.delete(id);
    });
  };
  return { ref, onLayout };
}

/** Só para os testes: esquece os rodapés e o pé da camada. */
export function limparRegistroDoRodape(): void {
  topos.clear();
  peDaCamada = null;
}

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
 * No celular nativo vale o registro acima (`useRegistroDoRodapeFixo`).
 * shortcut: só o meio da largura (um botão flutuante no canto não é visto); trocar se um rodapé assim aparecer.
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
