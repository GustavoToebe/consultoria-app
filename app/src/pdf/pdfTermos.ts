import type { Marca, TermosVigentes } from '../api/tipos';
import { blocosDoTexto, linhaDaVersao, type Trecho } from '../dominio/termos';
import { cabecalhoDoPdf, cssBase, esc, type Documento } from './html';

/**
 * PDF dos termos (Termos e privacidade › "Baixar PDF"): os dois documentos como a API os serve (o contato da consultoria já
 * montado, sem o aviso de rascunho), a versão e a data do aceite. Como o comprovante do contrato, é registro do aceite, não o
 * PDF de treino: não depende da funcionalidade `PDF` do plano e sai sempre neutro (sem modelo nem opções da marca). Todo
 * texto (inclusive o nome e o contato da consultoria, escritos pela equipe) passa por `esc()`; o título do arquivo é fixo.
 */
export interface DadosPdfTermos {
  marca: Marca;
  logoDataUri: string | null;
  termos: Pick<TermosVigentes, 'versao' | 'aceitoEm' | 'documentos'>;
  emitidoEm: Date;
}

const linha = (trechos: Trecho[]) => trechos.map((t) => (t.negrito ? `<strong>${esc(t.texto)}</strong>` : esc(t.texto))).join('');

function htmlDoDocumento(texto: string): string {
  const partes: string[] = [];
  let lista: string[] = [];
  const fecharLista = () => {
    if (lista.length) partes.push(`<ul>${lista.join('')}</ul>`);
    lista = [];
  };
  for (const b of blocosDoTexto(texto)) {
    if (b.tipo === 'item') {
      lista.push(`<li>${linha(b.trechos)}</li>`);
      continue;
    }
    fecharLista();
    partes.push(b.tipo === 'secao' ? `<h3>${linha(b.trechos)}</h3>` : `<p>${linha(b.trechos)}</p>`);
  }
  fecharLista();
  return partes.join('');
}

export function documentoTermos(d: DadosPdfTermos): Documento {
  const corpo = [
    cabecalhoDoPdf({ marca: d.marca, logoDataUri: d.logoDataUri, documento: 'Termos e privacidade', titulo: linhaDaVersao(d.termos.versao, d.termos.aceitoEm), emitidoEm: d.emitidoEm }),
    ...d.termos.documentos.map((doc) => `<section class="termo"><h2>${esc(doc.titulo)}</h2>${htmlDoDocumento(doc.texto)}</section>`),
  ].join('\n');
  const css = `${cssBase(d.marca.corPrimaria)}
.doc .termo + .termo { break-before: page; page-break-before: always; }
.doc .termo p, .doc .termo li { margin: 0 0 6pt; overflow-wrap: anywhere; }
.doc .termo h3 { margin: 12pt 0 4pt; }
`;
  return { titulo: 'Termos e privacidade', css, corpo };
}
