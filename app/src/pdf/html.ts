import type { Marca } from '../api/tipos';
import { videoValido } from '../dominio/video';

/**
 * Peças comuns dos PDFs: HTML + CSS de impressão gerados a partir dos dados (nunca imagem da tela). Fundo branco,
 * A4, margens de 14 mm, fonte do sistema; a cor da marca só em títulos e linhas. Todo texto do usuário passa por
 * `esc()`.
 */

export interface Documento {
  titulo: string;
  css: string;
  corpo: string;
}

const ENTIDADES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(texto: string | number | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

/** Texto com quebras de linha preservadas (observações, instruções). */
export function escLinhas(texto: string | null | undefined): string {
  return esc(texto).replace(/\r?\n/g, '<br>');
}

/** Só link de vídeo aceito (https do YouTube) vira link; o resto vira "—". */
export function link(url: string | null | undefined, rotulo: string): string {
  if (!url || !videoValido(url)) return '—';
  return `<a href="${esc(url)}">${esc(rotulo)}</a>`;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function cssBase(cor: string): string {
  const marca = HEX.test(cor) ? cor : '#333333';
  return `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; margin: 0; }
.doc { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; }
.doc h1 { font-size: 18pt; margin: 0; letter-spacing: 1px; text-transform: uppercase; color: ${marca}; }
.doc h2 { font-size: 12.5pt; margin: 14pt 0 5pt; padding-bottom: 3pt; border-bottom: 2px solid ${marca}; break-after: avoid; page-break-after: avoid; }
.doc h3 { font-size: 11pt; margin: 9pt 0 4pt; break-after: avoid; page-break-after: avoid; }
.doc .topo { display: flex; align-items: center; justify-content: space-between; gap: 12pt; border-bottom: 3px solid ${marca}; padding-bottom: 8pt; margin-bottom: 8pt; }
.doc .topo img { max-height: 48pt; max-width: 200pt; }
.doc .suave { color: #555; }
.doc .pequeno { font-size: 9pt; color: #555; }
.doc table { width: 100%; border-collapse: collapse; margin: 4pt 0; }
.doc thead { display: table-header-group; }
.doc th { text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; color: #fff; background: ${marca}; padding: 4pt 5pt; }
.doc td { border-bottom: 1px solid #ddd; padding: 4pt 5pt; vertical-align: top; }
.doc tr { break-inside: avoid; page-break-inside: avoid; }
.doc .bloco { break-inside: avoid; page-break-inside: avoid; }
.doc .texto { white-space: normal; }
.doc a { color: ${marca}; }
.doc .rodape { margin-top: 14pt; font-size: 8.5pt; color: #666; border-top: 1px solid #ddd; padding-top: 4pt; }
/* O fim (rodapé e nome) nunca vai sozinho para uma página nova: na reunião de 17/10 a dieta saiu com a 3ª página só
   com o nome da consultoria. Chromium respeita o avoid entre irmãos e leva junto as últimas linhas do bloco anterior. */
.doc .fim, .doc .rodape { break-before: avoid; page-break-before: avoid; break-inside: avoid; page-break-inside: avoid; }
`;
}

/** Topo: logo (data URI) ou o nome da consultoria em caixa alta, e as linhas de identificação à direita. */
export function topo(marca: Marca, logoDataUri: string | null, linhas: string[]): string {
  const esquerda = logoDataUri ? `<img src="${esc(logoDataUri)}" alt="${esc(marca.nome)}">` : `<h1>${esc(marca.nome)}</h1>`;
  return `<div class="topo"><div>${esquerda}</div><div class="pequeno" style="text-align:right">${linhas.map(esc).join('<br>')}</div></div>`;
}

/** Documento completo (celular: vira arquivo PDF). */
export function documentoCompleto(d: Documento): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title><style>${d.css}</style></head><body><div class="doc">${d.corpo}</div></body></html>`;
}
