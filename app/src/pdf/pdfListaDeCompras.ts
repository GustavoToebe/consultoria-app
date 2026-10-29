import type { Marca } from '../api/tipos';
import { numeroParaTela } from '../dominio/formatos';
import { NOTA_DA_LISTA, NOTA_DA_PREVIA, quantidadeParaTela, textoDoPeriodo, type LinhaDaLista, type PeriodoDaLista } from '../dominio/listaDeCompras';
import { agruparLista, tituloDoGrupoNoPdf, type GrupoDaLista } from '../dominio/gruposDaLista';
import { gruposDoAluno, textoDaOrigem, type ItemDaListaDoAluno } from '../dominio/listaDeComprasDoAluno';
import { cabecalhoDoPdf, cssBase, esc, type Documento } from './html';

export interface DadosPdfListaDeCompras {
  marca: Marca;
  logoDataUri: string | null;
  /** Nulo no modelo de dieta do Planejamento (não é de um aluno). */
  aluno: string | null;
  /** Título da dieta de onde a lista saiu. */
  titulo: string;
  /** Versão publicada; nulo = prévia do editor do treinador (conteúdo da tela, fatores atuais da biblioteca). */
  versao: number | null;
  periodo: PeriodoDaLista;
  /** "Café da manhã: opção B" para cada refeição com mais de uma opção (a escolha do aluno). */
  opcoes: string[];
  linhas: LinhaDaLista[];
  /**
   * Só na lista do aluno: os itens como ele os vê (quantidade ajustada e itens que ele acrescentou, cada um marcado
   * como tal). Ausente (prévia do treinador), a tabela sai das `linhas`. As caixas vão sempre vazias: o "comprado" da
   * tela não entra no papel.
   */
  itensDoAluno?: ItemDaListaDoAluno[];
  emitidoEm: Date;
}

const CSS_LISTA = `
.doc td.qtd { width: 22%; white-space: nowrap; font-weight: 700; }
.doc td.marca { width: 4%; }
.doc .caixa { display: inline-block; width: 10pt; height: 10pt; border: 1px solid #555; }
.doc .origem { font-style: italic; }
`;

const celula = (texto: string) => esc(texto);

const fatorNaTabela = (n: number | null | undefined) => (n == null ? '—' : numeroParaTela(n, 2));

/**
 * Linhas da tabela com uma faixa por grupo do alimento ("Carnes e derivados (3)"), na ordem de `agruparLista` (grupos do catálogo na ordem do mercado, depois os do treinador,
 * em ordem alfabética, "Outros itens" e "Adicionados por você" no fim). Estilo em linha para valer também no PDF da
 * dieta, que tem o próprio CSS.
 */
function emGrupos<T>(grupos: GrupoDaLista<T>[], colunas: number, linha: (item: T) => string): string {
  return grupos
    .map((g) => `<tr class="grupo"><td colspan="${colunas}" style="font-weight:700;background:#f2f2f2;">${esc(tituloDoGrupoNoPdf(g))}</td></tr>${g.itens.map(linha).join('')}`)
    .join('');
}

/**
 * Corpo da tabela da lista, agrupado pelo grupo do alimento. Sem colunas de fator, é a tabela de hoje (caixa, alimento,
 * quantidade). Com colunas, mostra o que a dieta pediu, o FCc, o cru, o FC e o que comprar. Fator ausente ou divergente
 * é "—".
 */
export function corpoDaTabela(linhas: LinhaDaLista[], mostrarFatores: boolean): string {
  const grupos = agruparLista(linhas, (l) => l.grupo);
  if (!mostrarFatores) {
    return emGrupos(grupos, 3,
      (l) => `<tr><td class="marca"><span class="caixa"></span></td><td>${esc(l.nome)}${l.cru ? ' <span class="suave">(cru)</span>' : ''}</td><td class="qtd">${esc(quantidadeParaTela(l.quantidade, l.unidade))}</td></tr>`,
    );
  }
  return emGrupos(grupos, 7, (l) => {
    const comprar = `${quantidadeParaTela(l.quantidade, l.unidade)}${l.semFator ? ' (como na dieta)' : ''}`;
    const cru = l.quantidadeCru == null ? '—' : quantidadeParaTela(l.quantidadeCru, l.unidade);
    const naDieta = l.naDieta == null ? '—' : quantidadeParaTela(l.naDieta, l.unidade);
    return `<tr><td>${esc(l.nome)}</td><td class="qtd">${celula(naDieta)}</td><td>${celula(fatorNaTabela(l.fatorCoccao))}</td><td class="qtd">${celula(cru)}</td><td>${celula(fatorNaTabela(l.fatorCorrecao))}</td><td class="qtd">${celula(comprar)}</td><td class="marca"><span class="caixa"></span></td></tr>`;
  });
}

/**
 * Corpo da tabela da lista do aluno (caixa, alimento, quantidade), agrupado como a tela (`gruposDoAluno`): o calculado
 * como na tabela simples; o ajustado com a quantidade dele e o calculado ao lado; o avulso com o que ele escreveu ("—"
 * sem quantidade), no grupo "Adicionados por você". Ajuste e avulso levam a marca "ajustado por você" / "adicionado por
 * você".
 */
export function corpoDoAluno(itens: readonly ItemDaListaDoAluno[]): string {
  return emGrupos(gruposDoAluno(itens), 3, (i) => {
    const origem = textoDaOrigem(i.origem);
    const marca = origem ? ` <span class="suave origem">(${esc(origem.toLowerCase())})</span>` : '';
    const cru = i.cru ? ' <span class="suave">(cru)</span>' : '';
    const quantidade = i.origem === 'calculado' && i.linha ? quantidadeParaTela(i.linha.quantidade, i.linha.unidade) : i.quantidade;
    const calculado = i.origem === 'ajustado' && i.linha ? ` <span class="suave">(calculado: ${esc(quantidadeParaTela(i.linha.quantidade, i.linha.unidade))})</span>` : '';
    return `<tr><td class="marca"><span class="caixa"></span></td><td>${esc(i.nome)}${cru}${marca}</td><td class="qtd">${esc(quantidade)}${calculado}</td></tr>`;
  });
}

/** Cabeçalho correspondente a {@link corpoDaTabela}. */
export function cabecalhoDaTabela(mostrarFatores: boolean): string {
  return mostrarFatores
    ? '<tr><th>Alimento</th><th>Na dieta</th><th>FCc</th><th>Cru</th><th>FC</th><th>Comprar</th><th></th></tr>'
    : '<tr><th></th><th>Alimento</th><th>Quantidade</th></tr>';
}

/**
 * PDF da lista de compras: topo com a marca, a quantidade arredondada para cima e uma caixa para marcar no mercado. Sem
 * versão é a prévia do editor do treinador, que diz no topo e no rodapé que ainda não é o que o aluno vê.
 */
export function documentoListaDeCompras(d: DadosPdfListaDeCompras): Documento {
  const linhas = d.itensDoAluno ? corpoDoAluno(d.itensDoAluno) : corpoDaTabela(d.linhas, false);
  const corpo = [
    cabecalhoDoPdf({
      marca: d.marca,
      logoDataUri: d.logoDataUri,
      documento: 'Lista de compras',
      titulo: d.titulo,
      versao: d.versao,
      semVersao: 'prévia, não publicada',
      aluno: d.aluno,
      emitidoEm: d.emitidoEm,
    }),
    `<h2>Lista de compras — ${esc(textoDoPeriodo(d.periodo))}</h2>`,
    d.opcoes.length ? `<div class="pequeno">${d.opcoes.map(esc).join(' · ')}</div>` : '',
    linhas
      ? `<table><thead>${cabecalhoDaTabela(false)}</thead><tbody>${linhas}</tbody></table>`
      : '<div class="suave">—</div>',
    `<div class="rodape">${esc(NOTA_DA_LISTA)}${d.versao ? '' : ` ${esc(NOTA_DA_PREVIA)}`}</div>`,
  ].join('\n');
  return { titulo: `Lista de compras - ${d.aluno ?? 'Modelo'} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria) + CSS_LISTA, corpo };
}
