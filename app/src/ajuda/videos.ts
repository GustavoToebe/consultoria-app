import { linkExternoSeguro } from '../dominio/links';
import type { Guia, Publico } from './conteudo';

/** Vídeo de uma seção da Ajuda; abre fora do app (`ui/abrirLinkExterno`), sem token. */
export interface VideoDaAjuda {
  titulo: string;
  /** Só `https://` (`dominio/links.linkExternoSeguro`). */
  url: string;
  /** Como a tela mostra, ex.: "3 min". */
  duracao?: string;
}

/** O `id` da seção do guia (`SecaoGuia.id`) onde o vídeo aparece. */
export type IdDaTela = string;

/** Por público porque os dois guias têm ids iguais (`anamnese`, `comunidade`) com conteúdos diferentes. */
export type VideosDaAjuda = Record<Publico, Partial<Record<IdDaTela, readonly VideoDaAjuda[]>>>;

/**
 * Fonte dos vídeos da Ajuda. Começa vazia: o bloco só aparece na seção que tem vídeo, e nenhum link é inventado.
 * Para incluir, ponha `{ titulo, url, duracao? }` na lista do id da seção; o teste confere https, id e repetição.
 */
export const VIDEOS_DA_AJUDA: VideosDaAjuda = { treinador: {}, aluno: {} };

/** Problemas da fonte (vazio = válida): id que não é seção do guia, título vazio, link fora do https, URL repetida. */
export function problemasDosVideos(videos: VideosDaAjuda, guias: Record<Publico, Guia>): string[] {
  const problemas: string[] = [];
  const vistas = new Set<string>();
  for (const publico of Object.keys(videos) as Publico[]) {
    const ids = new Set(guias[publico].secoes.map((s) => s.id));
    for (const [id, lista] of Object.entries(videos[publico])) {
      if (!ids.has(id)) problemas.push(`${publico}/${id}: não é seção do guia`);
      for (const v of lista ?? []) {
        if (!v.titulo.trim()) problemas.push(`${publico}/${id}: vídeo sem título`);
        if (!linkExternoSeguro(v.url)) problemas.push(`${publico}/${id}: link precisa ser https (${v.titulo})`);
        const url = v.url.trim();
        if (vistas.has(url)) problemas.push(`${publico}/${id}: link repetido (${v.titulo})`);
        vistas.add(url);
      }
    }
  }
  return problemas;
}
