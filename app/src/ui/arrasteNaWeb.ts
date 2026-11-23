import { passoDaRolagem, type CaixaDoItem } from '../dominio/reordenar';

/**
 * A parte do arraste que só existe na web (plano `docs/planos/arrastar-com-copia-translucida.md`, D1): a cópia translúcida
 * que segue o ponteiro, o espaço tracejado na origem e a linha guia ficam numa camada no `document.body` (`position:
 * fixed`), por cima de tudo: nada as corta (rolagem, `overflow`, a coluna vizinha do Kanban). A cópia é um clone do DOM
 * do item (sem `id`, `data-testid` e fora da árvore de acessibilidade), não uma segunda renderização: não duplica campo,
 * nome acessível nem estado. Fora da web todas as funções daqui não fazem nada (o `ItemArrastavel` desenha no lugar).
 */

const naWeb = (no: unknown): no is HTMLElement => typeof HTMLElement !== 'undefined' && no instanceof HTMLElement;

/** Caixa do nó na janela agora (síncrona; na web o `measureInWindow` só responde no próximo ciclo). */
export function caixaNaWeb(no: unknown): CaixaDoItem | undefined {
  if (!naWeb(no)) return undefined;
  const r = no.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export interface CoresDaCamada {
  superficie: string;
  sombra: string;
  bordaCampo: string;
  acao: string;
}

export interface CamadaDoArraste {
  /** Leva a cópia para o deslocamento do ponteiro desde o começo e redesenha o espaço da origem onde ele está agora. */
  mover: (dx: number, dy: number) => void;
  /** Linha guia de 2 px (coordenadas da janela) ou nenhuma. */
  guia: (caixa: CaixaDoItem | null) => void;
  /** `voar`: a cópia encaixa no lugar onde o item está agora (o novo, ou o de antes se nada mudou) e some; `sumir`: some já. */
  terminar: (fim: 'voar' | 'sumir', reduzido: boolean) => void;
}

const RAIO_DA_COPIA = 10;
const DURACAO_DO_ENCAIXE = 150;

function caixaFixa(estilo: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2147483000', boxSizing: 'border-box', ...estilo });
  document.body.appendChild(el);
  return el;
}

const posicionar = (el: HTMLElement, c: CaixaDoItem) => Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` });

/** Abre a camada para o item `no` (o nó do `ItemArrastavel`). Nulo fora da web. */
export function abrirCamada(no: unknown, cores: CoresDaCamada): CamadaDoArraste | null {
  if (!naWeb(no)) return null;
  const inicio = caixaNaWeb(no)!;
  const copia = no.cloneNode(true);
  if (!naWeb(copia)) return null;
  // O clone leva o atributo `value` dos campos, não o que foi digitado: copia o valor de agora.
  const campos = no.querySelectorAll('input, textarea');
  copia.querySelectorAll('input, textarea').forEach((c, i) => {
    const o = campos[i];
    if ((c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement) && (o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement)) c.value = o.value;
  });
  for (const el of [copia, ...Array.from(copia.querySelectorAll('[id], [data-testid]'))]) {
    el.removeAttribute('id');
    el.removeAttribute('data-testid');
  }
  copia.setAttribute('aria-hidden', 'true');
  copia.setAttribute('inert', '');
  copia.setAttribute('data-copia-do-arraste', '');
  Object.assign(copia.style, {
    position: 'fixed', margin: '0', left: `${inicio.x}px`, top: `${inicio.y}px`, width: `${inicio.w}px`, height: `${inicio.h}px`,
    opacity: '0.6', transform: 'translate(0px, 0px) scale(1.02)', transformOrigin: 'center', pointerEvents: 'none', zIndex: '2147483001',
    backgroundColor: cores.superficie, boxShadow: cores.sombra, borderRadius: `${RAIO_DA_COPIA}px`, overflow: 'hidden',
  });
  document.body.appendChild(copia);

  const espaco = caixaFixa({ border: `1px dashed ${cores.bordaCampo}`, borderRadius: `${RAIO_DA_COPIA}px` });
  espaco.setAttribute('data-espaco-do-arraste', '');
  posicionar(espaco, inicio);
  const linha = caixaFixa({ backgroundColor: cores.acao, borderRadius: '1px', display: 'none' });
  // Segurando: a mão fechada em qualquer lugar (o ponteiro fica preso ao item, que pode ter outro cursor) e sem selecionar texto.
  const cursor = document.createElement('style');
  cursor.textContent = '* { cursor: grabbing !important; user-select: none !important; -webkit-user-select: none !important; }';
  document.head.appendChild(cursor);
  const opacidade = no.style.opacity;
  no.style.opacity = '0';

  let aberta = true;
  const fechar = () => {
    if (!aberta) return;
    aberta = false;
    espaco.remove();
    linha.remove();
    cursor.remove();
  };
  const devolver = () => {
    no.style.opacity = opacidade;
    copia.remove();
  };
  return {
    mover: (dx, dy) => {
      if (!aberta) return;
      copia.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
      const agora = caixaNaWeb(no);
      if (agora) posicionar(espaco, agora);
    },
    guia: (c) => {
      if (!aberta) return;
      if (!c) {
        linha.style.display = 'none';
        return;
      }
      linha.style.display = 'block';
      posicionar(linha, c);
    },
    terminar: (fim, reduzido) => {
      fechar();
      if (fim === 'sumir' || reduzido) return devolver();
      // Dois quadros: a lista já se redesenhou com a ordem nova quando a cópia mede o lugar de chegada.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!no.isConnected) return devolver();
        const r = no.getBoundingClientRect();
        copia.style.transition = `transform ${DURACAO_DO_ENCAIXE}ms ease-out, opacity ${DURACAO_DO_ENCAIXE}ms ease-out`;
        copia.style.transform = `translate(${r.left - inicio.x}px, ${r.top - inicio.y}px) scale(1)`;
        copia.style.opacity = '1';
        setTimeout(devolver, DURACAO_DO_ENCAIXE + 20);
      }));
    },
  };
}

/** O ancestral mais próximo que rola na vertical (o inspetor do editor tem rolagem própria), ou a página. */
function rolavelDe(no: HTMLElement): HTMLElement {
  for (let p = no.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.documentElement;
}

/**
 * Rolagem automática perto da borda de cima ou de baixo da área que rola, enquanto o ponteiro estiver lá (um laço por
 * quadro: com o mouse parado não há evento de movimento). `aoRolar` roda a cada rolagem, também a da roda do mouse no
 * meio do arraste, para o destino ser recalculado com as medidas novas. Nulo fora da web.
 */
export function rolagemAutomatica(no: unknown, aoRolar: () => void): { ponteiro: (y: number) => void; parar: () => void } | null {
  if (!naWeb(no)) return null;
  const alvo = rolavelDe(no);
  const pagina = alvo === document.documentElement;
  const area = () => {
    if (pagina) return { topo: 0, base: window.innerHeight };
    const r = alvo.getBoundingClientRect();
    return { topo: Math.max(0, r.top), base: Math.min(window.innerHeight, r.bottom) };
  };
  let y: number | null = null;
  let quadro = 0;
  const passo = () => {
    quadro = 0;
    if (y === null) return;
    const v = passoDaRolagem(y, area());
    if (!v) return;
    if (pagina) window.scrollBy(0, v);
    else alvo.scrollTop += v;
    quadro = requestAnimationFrame(passo);
  };
  document.addEventListener('scroll', aoRolar, true);
  return {
    ponteiro: (novo) => {
      y = novo;
      if (!quadro) quadro = requestAnimationFrame(passo);
    },
    parar: () => {
      y = null;
      if (quadro) cancelAnimationFrame(quadro);
      quadro = 0;
      document.removeEventListener('scroll', aoRolar, true);
    },
  };
}

/** Esc cancela o arraste, sem chegar à folha ou ao inspetor que estiver aberto por baixo. Devolve quem para de ouvir. */
export function ouvirEsc(aoCancelar: () => void): (() => void) | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const tecla = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    aoCancelar();
  };
  window.addEventListener('keydown', tecla, true);
  return () => window.removeEventListener('keydown', tecla, true);
}
