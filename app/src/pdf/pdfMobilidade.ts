import type { Marca } from '../api/tipos';
import type { ConteudoMobilidade, SecaoMobilidade } from '../dominio/mobilidade';
import { cabecalhoDoPdf, cssBase, esc, escLinhas, link, type Documento } from './html';

export interface DadosPdfMobilidade {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  titulo: string;
  /** Número da versão publicada; `null` = rascunho (sai marcado). */
  versao: number | null;
  conteudo: ConteudoMobilidade;
  rodapePdf: string | null;
  emitidoEm: Date;
}

function blocoSecao(s: SecaoMobilidade): string {
  const linhas = s.itens
    .map(
      (i) => `<tr>
<td><strong>${esc(i.nome.trim() || '—')}</strong></td>
<td>${i.prescricao.trim() ? escLinhas(i.prescricao) : '—'}</td>
<td>${link(i.videoUrl, 'Vídeo')}</td>
</tr>`,
    )
    .join('');
  // Seção curta fica inteira numa página; o título nunca sobra sozinho.
  return `<section class="${s.itens.length <= 8 ? 'bloco' : ''}">
<h2>${esc(s.titulo.trim() || 'Mobilidade')}</h2>
<table><thead><tr><th style="width:38%">Exercício</th><th>Prescrição</th><th style="width:9%">Vídeo</th></tr></thead>
<tbody>${linhas}</tbody></table>
</section>`;
}

/** PDF da mobilidade: orientações e, por seção, a tabela de exercícios com prescrição e só o link do vídeo. */
export function documentoMobilidade(d: DadosPdfMobilidade): Documento {
  const c = d.conteudo;
  const corpo = [
    cabecalhoDoPdf({
      marca: d.marca,
      logoDataUri: d.logoDataUri,
      documento: 'Mobilidade',
      titulo: d.titulo,
      versao: d.versao,
      aluno: d.aluno,
      emitidoEm: d.emitidoEm,
    }),
    c.orientacoes.trim() ? `<div class="suave">${escLinhas(c.orientacoes)}</div>` : '',
    ...c.secoes.filter((s) => s.itens.length).map(blocoSecao),
    d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : '',
  ].join('\n');
  return { titulo: `Mobilidade - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria), corpo };
}
