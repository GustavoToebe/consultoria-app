/**
 * Atalhos de teclado da barra lateral do treinador (web): Ctrl+B alterna a barra e Ctrl+K abre a busca global; no Mac,
 * Cmd no lugar de Ctrl. Regra pura, sem DOM: quem escuta o teclado passa a tecla, os modificadores e o elemento com foco.
 */

export type AcaoDoAtalho = 'alternar-barra' | 'buscar';

/** O mínimo do elemento com foco que decide se ele recebe texto (sem depender do DOM, para o teste). */
export interface AlvoDoTeclado {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

export interface TeclaDoAtalho {
  key: string;
  /** Ctrl ou Cmd. */
  ctrl: boolean;
  shift?: boolean;
  alt?: boolean;
  alvo?: AlvoDoTeclado | null;
}

/** Tipos de `input` que não recebem texto: neles o atalho vale (Ctrl+B num checkbox não rouba nada). */
const ENTRADAS_SEM_TEXTO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/** O foco está num campo de texto, textarea, select ou conteúdo editável: o atalho fica com ele (Ctrl+B é o negrito). */
export function focoEmCampo(alvo: AlvoDoTeclado | null | undefined): boolean {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;
  const tag = (alvo.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !ENTRADAS_SEM_TEXTO.has((alvo.type ?? 'text').toLowerCase());
}

/**
 * A ação de um atalho da barra, ou `null` quando não é atalho dela: sem Ctrl/Cmd, com Shift ou Alt (Ctrl+Shift+B é a barra
 * de favoritos do navegador) ou com o foco num campo de texto.
 */
export function acaoDoAtalho({ key, ctrl, shift, alt, alvo }: TeclaDoAtalho): AcaoDoAtalho | null {
  if (!ctrl || shift || alt || focoEmCampo(alvo)) return null;
  const tecla = key.toLowerCase();
  if (tecla === 'b') return 'alternar-barra';
  if (tecla === 'k') return 'buscar';
  return null;
}

/** Plataforma da Apple pelo `navigator.platform` (ou equivalente); vazio ou desconhecido = não é Mac. */
export const ehMac = (plataforma: string | null | undefined) => /mac|iphone|ipad/i.test(plataforma ?? '');

/** O atalho como aparece na dica e no nome acessível: "Ctrl+K" ou, no Mac, "⌘K". */
export const rotuloDoAtalho = (tecla: string, mac: boolean) => (mac ? `⌘${tecla.toUpperCase()}` : `Ctrl+${tecla.toUpperCase()}`);
