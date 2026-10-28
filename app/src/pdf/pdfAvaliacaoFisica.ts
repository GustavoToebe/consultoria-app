import type { Marca } from '../api/tipos';
import { cmParaTela, diferencaParaTela, pesoParaTela, type Comparacao } from '../dominio/avaliacaoFisica';
import { dataHoraParaTela, dataParaTela } from '../dominio/formatos';
import { cssBase, esc, escLinhas, topo, type Documento } from './html';

export interface DadosPdfAvaliacaoFisica {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  /** De `dominio/avaliacaoFisica.comparar`: 2 a 4 datas em ordem cronológica. */
  comparacao: Comparacao;
  /** Observação de cada data escolhida (só as preenchidas aparecem, no fim). */
  observacoes: { data: string; texto: string }[];
  emitidoEm: Date;
}

/**
 * Comparativo da avaliação física: tabela medida × data e a diferença em cm entre a primeira e a última data. Só os
 * números registrados: nada de percentual de gordura, classificação, cor de "bom/ruim" ou texto que interprete.
 * Ausente = "—". Todo texto passa por `esc()`.
 */
export function documentoAvaliacaoFisica(d: DadosPdfAvaliacaoFisica): Documento {
  const { colunas, linhas } = d.comparacao;
  const primeira = colunas[0]?.data;
  const ultima = colunas[colunas.length - 1]?.data;
  const largura = Math.floor(52 / Math.max(1, colunas.length));
  const cabecalho = `<tr><th style="width:26%">Medida</th>${colunas
    .map((c) => `<th style="width:${largura}%;text-align:right">${esc(dataParaTela(c.data))}</th>`)
    .join('')}<th style="text-align:right">Diferença</th></tr>`;
  const corpoTabela = linhas
    .map((l) => {
      const valor = (v: number | null) => (l.unidade === 'cm' ? (v === null ? '—' : `${cmParaTela(v)} cm`) : pesoParaTela(v));
      return `<tr><td><strong>${esc(l.rotulo)}</strong></td>${l.valores
        .map((v) => `<td class="num">${esc(valor(v))}</td>`)
        .join('')}<td class="num">${esc(diferencaParaTela(l.diferenca, l.unidade))}</td></tr>`;
    })
    .join('');
  const observacoes = d.observacoes.filter((o) => o.texto.trim());
  const corpo = [
    topo(d.marca, d.logoDataUri, [
      `Aluno: ${d.aluno}`,
      `Avaliação física: ${dataParaTela(primeira)} a ${dataParaTela(ultima)}`,
      `Emitido em ${dataHoraParaTela(d.emitidoEm.toISOString())}`,
    ]),
    '<h2>Comparativo de circunferências</h2>',
    linhas.length
      ? `<table><thead>${cabecalho}</thead><tbody>${corpoTabela}</tbody></table>`
      : '<p class="suave">Nenhuma medida nas datas escolhidas.</p>',
    observacoes.length
      ? `<h2>Observações</h2>${observacoes
          .map((o) => `<div class="bloco obs"><strong>${esc(dataParaTela(o.data))}</strong><br>${escLinhas(o.texto)}</div>`)
          .join('')}`
      : '',
    `<div class="rodape">Medidas em centímetros como registradas pela equipe. Diferença = ${esc(dataParaTela(ultima))} menos ${esc(
      dataParaTela(primeira),
    )}; "—" quando falta um dos valores. O peso é o registro de peso da mesma data.</div>`,
  ].join('\n');
  const css = `${cssBase(d.marca.corPrimaria)}
.doc .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.doc .obs { margin: 4pt 0; padding: 4pt 0; border-bottom: 1px solid #ddd; }
`;
  return { titulo: `Avaliação física - ${d.aluno}`, css, corpo };
}
