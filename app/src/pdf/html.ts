import type { Marca } from '../api/tipos';
import { dataHoraParaTela } from '../dominio/formatos';
import { videoValido } from '../dominio/video';
import { textoSobre } from '../tema/tokens';

/**
 * Peças comuns dos PDFs: HTML + CSS de impressão gerados a partir dos dados (nunca imagem da tela). Fundo branco,
 * A4, margens de 14 mm, fonte do sistema; a cor da marca só em títulos, linhas e na faixa fina do alto. Todo texto do usuário passa por
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
const COR_NEUTRA = '#333333';

/**
 * Única validação da cor da marca nos PDFs: só `#RRGGBB` entra no CSS/HTML; qualquer outra coisa cai no neutro.
 * Todo gerador usa esta função, nunca a cor crua.
 */
export function corDaMarca(cor: string | null | undefined): string {
  return typeof cor === 'string' && HEX.test(cor) ? cor : COR_NEUTRA;
}

export function cssBase(cor: string): string {
  const marca = corDaMarca(cor);
  return `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; margin: 0; }
.doc { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.35; }
.doc h1 { font-size: 18pt; margin: 0; letter-spacing: 1px; text-transform: uppercase; color: ${marca}; }
.doc h2 { font-size: 12.5pt; margin: 14pt 0 5pt; padding-bottom: 3pt; border-bottom: 2px solid ${marca}; break-after: avoid; page-break-after: avoid; }
.doc h3 { font-size: 11pt; margin: 9pt 0 4pt; break-after: avoid; page-break-after: avoid; }
.doc .faixa-marca { display: flex; align-items: center; gap: 6pt; padding: 2pt 8pt; margin-bottom: 8pt; font-size: 7.5pt; line-height: 1.2; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.doc .faixa-marca.com-logo { padding: 3pt 8pt; }
.doc .faixa-logo { flex: none; display: inline-flex; align-items: center; background: #fff; border-radius: 3pt; padding: 1.5pt 3pt; line-height: 0; }
.doc .faixa-logo img { display: block; max-height: 18pt; max-width: 90pt; width: auto; height: auto; }
.doc .faixa-nome { min-width: 0; overflow-wrap: anywhere; }
.doc .topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 12pt; border-bottom: 3px solid ${marca}; padding-bottom: 8pt; margin-bottom: 8pt; break-inside: avoid; page-break-inside: avoid; }
.doc .topo-titulo { flex: 1 1 60%; min-width: 0; overflow-wrap: anywhere; }
.doc .topo-titulo h1 { line-height: 1.15; }
.doc .doc-titulo { font-size: 11pt; font-weight: 700; margin-top: 3pt; }
.doc .topo-dados { flex: 0 1 40%; min-width: 0; text-align: right; overflow-wrap: anywhere; }
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

/**
 * Faixa fina no alto do documento: fundo na cor da marca, a logo da consultoria (quando há) e o nome na cor de contraste
 * (`textoSobre`, a mesma regra do `sobreMarca` do app). A logo fica num quadro branco pequeno (até 18 pt de altura e
 * 90 pt de largura, proporção mantida e nunca ampliada), para continuar legível sobre qualquer cor da marca. O corpo não
 * ganha fundo colorido. Cor que não é `#RRGGBB` usa o neutro. Os valores de cor vêm só de `corDaMarca` (validada), nunca
 * crus; o `src` da logo e o nome passam por `esc()`.
 */
export function faixaDaMarca(marca: Marca, logoDataUri: string | null = null): string {
  const fundo = corDaMarca(marca.corPrimaria);
  const logo = logoDataUri ? `<span class="faixa-logo"><img src="${esc(logoDataUri)}" alt="${esc(marca.nome)}"></span>` : '';
  return `<div class="faixa-marca${logo ? ' com-logo' : ''}" style="background:${fundo};color:${textoSobre(fundo)}">${logo}<span class="faixa-nome">${esc(marca.nome)}</span></div>`;
}

/**
 * Dados do cabeçalho comum de todo PDF do app (treino, dieta, mobilidade, cargas, lista de compras e, a seguir, a
 * avaliação física). Só texto: tudo passa por `esc()` em {@link cabecalhoDoPdf}.
 */
export interface CabecalhoDoPdf {
  marca: Marca;
  /** Logo já reduzida e em data URI (`pdf/logo.ts`); `null` = só o nome na faixa. */
  logoDataUri: string | null;
  /** Que documento é: "Treino", "Sugestão de plano alimentar", "Relatório de cargas"... Sai grande, em caixa alta. */
  documento: string;
  /** Título do plano ou do documento (o que o treinador escreveu); vazio = só o tipo do documento. */
  titulo?: string | null;
  /**
   * Número da versão publicada (" (v3)" ao lado do título). `null` = ainda não publicado: sai `semVersao`.
   * Sem o campo (`undefined`) o documento não tem versão (relatório de cargas, avaliação) e nada aparece.
   */
  versao?: number | null;
  /** Texto do que não foi publicado; padrão "RASCUNHO, não publicado" (a lista de compras usa "prévia, não publicada"). */
  semVersao?: string;
  /** Nome do aluno; nulo no modelo do Planejamento (não é de ninguém). */
  aluno?: string | null;
  /** Período já escrito para a tela ("05/10/2026 a 20/10/2026"); nulo não aparece. */
  periodo?: string | null;
  emitidoEm: Date;
}

/**
 * Cabeçalho uniforme dos PDFs: a faixa da marca (logo + nome da consultoria) e, embaixo, à esquerda o tipo do documento
 * (h1) com o título e a versão, e à direita "Aluno:", "Período:" e "Emitido em". As duas colunas encolhem e quebram
 * palavra longa (`overflow-wrap: anywhere`, `min-width: 0`): nome comprido de consultoria, aluno ou plano desce de
 * linha, nunca passa por cima da outra coluna. O bloco não se parte entre páginas. Gerador novo (ex.: a avaliação
 * física) chama só isto no começo do corpo, com `cssBase` no CSS.
 */
export function cabecalhoDoPdf(c: CabecalhoDoPdf): string {
  const situacao = c.versao === undefined ? '' : c.versao ? ` (v${c.versao})` : ` (${c.semVersao ?? 'RASCUNHO, não publicado'})`;
  const titulo = c.titulo?.trim() ? `${c.titulo}${situacao}` : situacao.trim();
  const dados = [
    ...(c.aluno ? [`Aluno: ${c.aluno}`] : []),
    ...(c.periodo ? [`Período: ${c.periodo}`] : []),
    `Emitido em ${dataHoraParaTela(c.emitidoEm.toISOString())}`,
  ];
  return `${faixaDaMarca(c.marca, c.logoDataUri)}<div class="topo"><div class="topo-titulo"><h1>${esc(c.documento)}</h1>${
    titulo ? `<div class="doc-titulo">${esc(titulo)}</div>` : ''
  }</div><div class="topo-dados pequeno">${dados.map(esc).join('<br>')}</div></div>`;
}

/** Documento completo (celular: vira arquivo PDF). */
export function documentoCompleto(d: Documento): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title><style>${d.css}</style></head><body><div class="doc">${d.corpo}</div></body></html>`;
}
