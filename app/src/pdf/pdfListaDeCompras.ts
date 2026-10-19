import type { Marca } from '../api/tipos';
import { dataHoraParaTela } from '../dominio/formatos';
import { NOTA_DA_LISTA, quantidadeParaTela, textoDoPeriodo, type LinhaDaLista, type PeriodoDaLista } from '../dominio/listaDeCompras';
import { cssBase, esc, topo, type Documento } from './html';

export interface DadosPdfListaDeCompras {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  /** Título da dieta publicada de onde a lista saiu. */
  titulo: string;
  versao: number;
  periodo: PeriodoDaLista;
  /** "Café da manhã: opção B" para cada refeição com mais de uma opção (a escolha do aluno). */
  opcoes: string[];
  linhas: LinhaDaLista[];
  emitidoEm: Date;
}

const CSS_LISTA = `
.doc td.qtd { width: 22%; white-space: nowrap; font-weight: 700; }
.doc td.marca { width: 4%; }
.doc .caixa { display: inline-block; width: 10pt; height: 10pt; border: 1px solid #555; }
`;

/** PDF da lista de compras: topo com a marca, a quantidade arredondada para cima e uma caixa para marcar no mercado. */
export function documentoListaDeCompras(d: DadosPdfListaDeCompras): Documento {
  const linhas = d.linhas
    .map(
      (l) => `<tr><td class="marca"><span class="caixa"></span></td><td>${esc(l.nome)}${l.cru ? ' <span class="suave">(cru)</span>' : ''}</td><td class="qtd">${esc(quantidadeParaTela(l.quantidade, l.unidade))}</td></tr>`,
    )
    .join('');
  const corpo = [
    topo(d.marca, d.logoDataUri, [
      `Aluno: ${d.aluno}`,
      `${d.titulo} (v${d.versao})`,
      `Emitido em ${dataHoraParaTela(d.emitidoEm.toISOString())}`,
    ]),
    `<h2>Lista de compras — ${esc(textoDoPeriodo(d.periodo))}</h2>`,
    d.opcoes.length ? `<div class="pequeno">${d.opcoes.map(esc).join(' · ')}</div>` : '',
    linhas
      ? `<table><thead><tr><th></th><th>Alimento</th><th>Quantidade</th></tr></thead><tbody>${linhas}</tbody></table>`
      : '<div class="suave">—</div>',
    `<div class="rodape">${esc(NOTA_DA_LISTA)}</div>`,
  ].join('\n');
  return { titulo: `Lista de compras - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria) + CSS_LISTA, corpo };
}
