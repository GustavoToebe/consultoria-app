import { useCallback, useEffect, useId, useRef, type RefObject } from 'react';
import { Platform, type LayoutChangeEvent, type View } from 'react-native';

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

// Folha com rodapé no celular: o aviso dela mora dentro do `Modal` (outra janela, `PortalHost` da folha), então a régua da
// raiz não serve (o `Modal` do Android pode ter origem e altura diferentes). Fica a distância medida de dentro da própria
// janela da folha: do topo do rodapé ao pé do host do portal, que é onde o `bottom` do aviso começa. As duas medidas
// são `measureInWindow` na mesma janela, então qualquer desvio (barra de status, edge-to-edge) se cancela.
const rodapesDeFolha = new Map<string, number>();

/** Nativo: px do topo do rodapé da folha `nome` ao pé do portal dela, ou `null` (sem rodapé, fechada ou antes da medida). */
export function distanciaDoRodapeDaFolha(nome: string): number | null {
  return rodapesDeFolha.get(nome) ?? null;
}

/**
 * Nativo: a `Folha` com rodapé informa onde ele está. Devolve `medir`, para chamar quando o layout da folha muda (rodapé,
 * painel, host: o teclado empurra o painel no iOS); mede de novo ao (des)aparecer o rodapé e sai do registro ao desmontar
 * (a folha fechada nunca vaza para a tela de baixo; medida que chega depois de desmontar é descartada). Na web é inerte
 * (lá o aviso sonda o DOM, `data-rodape-da-folha`).
 */
export function useRegistroDoRodapeDaFolha(nome: string, temRodape: boolean, rodape: RefObject<View | null>, host: RefObject<View | null>): () => void {
  const viva = useRef(true);
  const medir = useCallback(() => {
    if (Platform.OS === 'web') return;
    const r = rodape.current;
    const h = host.current;
    if (!r || !h) {
      rodapesDeFolha.delete(nome);
      return;
    }
    r.measureInWindow((_x, y, _largura, altura) => {
      h.measureInWindow((_hx, hy, _hl, ha) => {
        if (!viva.current) return;
        const distancia = Math.round(hy + ha - y);
        if (altura > 0 && ha > 0 && distancia > 0) rodapesDeFolha.set(nome, distancia);
        else rodapesDeFolha.delete(nome);
      });
    });
  }, [nome, rodape, host]);
  useEffect(() => {
    viva.current = true;
    return () => {
      viva.current = false;
      rodapesDeFolha.delete(nome);
    };
  }, [nome]);
  useEffect(() => {
    if (temRodape) medir();
    else rodapesDeFolha.delete(nome);
  }, [temRodape, medir, nome]);
  return medir;
}

/** Só para os testes: esquece os rodapés e o pé da camada. */
export function limparRegistroDoRodape(): void {
  topos.clear();
  rodapesDeFolha.clear();
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
