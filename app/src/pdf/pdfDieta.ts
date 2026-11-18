import type { ConteudoDieta, ItemDieta, Marca, Refeicao, RegistroPeso, Suplemento } from '../api/tipos';
import { NOMES_DOS_DIAS } from '../dominio/calendario';
import { secoesDaDieta, soAVariacao } from '../dominio/variacoesDaDieta';
import { modoDePreparoParaMostrar, somar, textoDaAgua, textoEscolhaDasOpcoes, totalDoDia, type TotaisComFibra } from '../dominio/dieta';
import { DIAS_DO_PERIODO, NOTA_DA_LISTA, NOTA_DA_PREVIA, type LinhaDaLista, type PeriodoDaLista } from '../dominio/listaDeCompras';
import { cabecalhoDaTabela, corpoDaTabela } from './pdfListaDeCompras';
import { ergogenicosPreenchidos } from '../dominio/ergogenicos';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { linkParaAbrir } from '../dominio/links';
import { tomDaVariacaoDoPeso } from '../dominio/corDaVariacaoDoPeso';
import { variacaoDoPeso } from '../dominio/variacaoDoPeso';
import { textoSobre } from '../tema/tokens';
import { FUNDO_LEVE } from './cssDosTemas';
import { cabecalhoDoPdf, corDaMarca, corDeTextoNoTema, cssBase, esc, escLinhas, type Documento } from './html';
import { temaValido, type TemaPdf } from './temas';

export interface DadosPdfDieta {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  titulo: string;
  versao: number | null;
  conteudo: ConteudoDieta;
  /** Uid de uma variação: o PDF leva só ela. Nulo, ausente ou desconhecido = todas as variações. */
  variacaoUid?: string | null;
  pesos: RegistroPeso[];
  rodapePdf: string | null;
  emitidoEm: Date;
  /**
   * Lista de compras no fim do PDF. Sem este campo o HTML é o da dieta simples.
   * Os fatores da conta já estão nas linhas; `mostrarFatores` só liga as colunas.
   */
  lista?: {
    periodo: PeriodoDaLista;
    opcoes: string[];
    linhas: LinhaDaLista[];
    mostrarFatores: boolean;
  };
}

const g = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 1)} g`);
const kcal = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 0)} kcal`);

/** Soma de só uma parte dos itens (algum sem fibra informada): o número leva "(parcial)"; "—" nunca é parcial. */
const fibraParcial = (t: TotaisComFibra) => t.fibra !== null && !t.fibraCompleta;
/** Fibra (V089): neutra, fora da kcal; "—" sem valor, nunca zero. */
const fibra = (t: TotaisComFibra) => `${g(t.fibra)}${fibraParcial(t) ? ' (parcial)' : ''}`;

export function textoTotaisPdf(t: TotaisComFibra): string {
  return `${kcal(t.kcal)} · P: ${g(t.proteina)} · C: ${g(t.carboidrato)} · G: ${g(t.gordura)} · Fibra: ${fibra(t)}`;
}

/** "seg, qua, sex" para os dias da variação (1 = segunda ... 7 = domingo), em ordem; sem dia válido, "—". */
export function textoDosDias(dias: number[]): string {
  const validos = [...new Set(dias)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  return validos.length ? validos.map((d) => NOMES_DOS_DIAS[d % 7]).join(', ') : '—';
}

/** Nome do suplemento; vira link só se o link passa na regra (https sem credenciais). Nome e link passam por `esc()`. */
export function nomeDoSuplemento(s: Pick<Suplemento, 'nome' | 'link'>): string {
  const nome = esc(s.nome) || '—';
  const url = linkParaAbrir(s.link);
  return url ? `<a href="${esc(url)}">${nome}</a>` : nome;
}

/** Cor da faixa de cada opção (A usa a cor da marca). */
const COR_OPCAO = ['', '#1A5276', '#117A65', '#7D3C98'];
const NAVY = '#1A1A2E';

function linhaItem(i: ItemDieta, cor: string): string {
  const qtd = `${numeroParaTela(i.quantidade)} ${i.unidade}`;
  return `<div class="item">• ${esc(i.nome)} <strong style="color:${cor}">${esc(qtd)}</strong> <span class="macros">| ${esc(textoTotaisPdf(somar([i])))}</span></div>`;
}

function secaoDaLista(lista: NonNullable<DadosPdfDieta['lista']>, versao: number | null, cor: string, comVariacoes: boolean): string {
  const dias = DIAS_DO_PERIODO[lista.periodo];
  const tabela = lista.linhas.length
    ? `<table><thead>${cabecalhoDaTabela(lista.mostrarFatores)}</thead><tbody>${corpoDaTabela(lista.linhas, lista.mostrarFatores)}</tbody></table>`
    : '<div class="suave">—</div>';
  const previa = versao ? '' : `<div class="rodape">${esc(NOTA_DA_PREVIA)}</div>`;
  return `<div class="lista-pdf"><h2 class="sec" style="color:${cor}">Lista de compras · ${dias} dias</h2>
${comVariacoes ? '<div class="pequeno">Cada variação entra pelo número de dias dela na semana.</div>\n' : ''}${lista.opcoes.length ? `<div class="pequeno">${lista.opcoes.map(esc).join(' · ')}</div>` : ''}
${tabela}
<div class="rodape">${esc(NOTA_DA_LISTA)}</div>${previa}</div>`;
}

/**
 * Variação no PDF como na tela: seta e sinal sempre, e a cor da meta efetiva do item (verde no caminho da meta, vermelho
 * contra; sem meta, sem cor). Nunca a cor da marca. O PDF é fundo branco: os tons de status do tema claro.
 */
function celulaDaVariacao(p: RegistroPeso): string {
  const v = variacaoDoPeso(p);
  if (!v) return '<td>—</td>';
  const tom = tomDaVariacaoDoPeso(p.variacao, p.metaDoPeso);
  // O PDF não segue o tema do app: verde e vermelho fixos (os do CLARO até 16/11), senão o documento muda a cada ajuste de token.
  const cor = tom === 'positivo' ? '#125C32' : tom === 'problema' ? '#B71C1C' : null;
  const seta = v.seta === 'sobe' ? '▲ ' : v.seta === 'desce' ? '▼ ' : '';
  return `<td${cor ? ` style="color:${cor}"` : ''}>${esc(`${seta}${v.texto}`)}</td>`;
}

const CSS_DIETA = `
.doc .barra { height: 12pt; margin: 14pt 0 10pt; }
.doc h2.sec { border: 0; padding: 0; font-size: 11pt; text-transform: uppercase; margin: 8pt 0 6pt; }
.doc table.id td { border: 0; padding: 4pt 8pt; }
.doc table.id tr:nth-child(even) td { background: #f4f4f4; }
.doc table.id td:first-child { width: 28%; font-weight: 700; font-size: 9.5pt; color: ${NAVY}; }
.doc table.macros td { border: 1px solid #ddd; padding: 5pt 8pt; }
.doc table.macros tr:nth-child(even) td { background: #f4f4f4; }
.doc table.macros td:last-child { font-weight: 800; }
.doc .refeicao { margin: 8pt 0 12pt; }
.doc .refeicao > .cab { background: ${NAVY}; color: #fff; font-weight: 800; padding: 6pt 8pt; font-size: 10.5pt; break-after: avoid; page-break-after: avoid; }
.doc .opcao > .cab { color: #fff; font-weight: 800; font-size: 9pt; padding: 3pt 8pt 3pt 18pt; margin: 6pt 0 4pt; letter-spacing: .5px; }
.doc .item { margin: 2pt 0; }
.doc .item .macros { color: #777; font-size: 9pt; }
.doc .total { font-size: 9pt; font-weight: 700; margin: 3pt 0 2pt; }
.doc .escolha { font-size: 9pt; font-weight: 700; margin: 4pt 0 0; }
.doc .preparo { margin: 6pt 0 2pt; padding: 5pt 8pt; border-left: 3px solid #bbb; background: #f7f7f7; break-inside: avoid; page-break-inside: avoid; }
.doc .preparo strong { display: block; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 2pt; }
.doc .orient { margin-bottom: 3pt; }
.doc table.dark th { background: ${NAVY}; }
.doc table.dark td { border: 1px solid #ddd; font-weight: 700; }
.doc table.dark tr:nth-child(even) td { background: #f4f4f4; }
.doc .centro { text-align: center; }
.doc .lista-pdf { break-inside: avoid; page-break-inside: avoid; }
`;

/**
 * Regras da dieta em cada tema (o `CLASSICO` não acrescenta nada). Fundo na cor da marca ou escuro sempre com texto
 * legível: no `MINIMALISTA` as faixas escuras viram linhas e o texto é escuro; no `MARCANTE` o cabeçalho das tabelas é leve.
 */
function cssDoTemaDeDieta(tema: TemaPdf, cor: string): string {
  if (tema === 'MINIMALISTA') {
    return `.doc .refeicao > .cab { background: none; color: #111; padding: 4pt 0; border-bottom: 1px solid ${cor}; }
.doc .opcao > .cab { background: none !important; color: #111 !important; padding: 2pt 0 2pt 6pt; border-left: 2pt solid ${cor}; }
.doc table.dark th { background: none; color: #333; }
.doc table.id tr:nth-child(even) td, .doc table.macros tr:nth-child(even) td, .doc table.dark tr:nth-child(even) td { background: none; }
.doc .barra { height: 1px; margin: 10pt 0; }
`;
  }
  if (tema === 'MARCANTE') {
    // O canto da faixa da refeição vem do raio do `.cab`, não de `overflow: hidden` no cartão, que pode cortar o que passa
    // para a página seguinte na impressão.
    return `.doc .barra { display: none; }
.doc > .refeicao { padding: 0 0 6pt; }
.doc > .refeicao > .cab { border-radius: 5pt 5pt 0 0; }
.doc .refeicao > :not(.cab) { margin-left: 10pt; margin-right: 10pt; }
.doc table.dark th { background: ${FUNDO_LEVE}; color: #333; }
`;
  }
  return '';
}

/**
 * PDF da dieta no layout do Saraiva Team (barras da marca, refeições em faixas escuras), com o cabeçalho comum dos PDFs
 * (logo na faixa da marca). Refeição com várias opções diz para escolher uma; o modo de preparo sai no fim da refeição,
 * com as quebras de linha.
 */
export function documentoDieta(d: DadosPdfDieta): Documento {
  const c = soAVariacao(d.conteudo, d.variacaoUid ?? null);
  const cor = corDaMarca(d.marca.corPrimaria);
  const tema = temaValido(d.marca.temaPdf);
  const corTexto = corDeTextoNoTema(d.marca.corPrimaria, tema);
  const barra = `<div class="barra" style="background:${cor}"></div>`;
  const sec = (t: string) => `<h2 class="sec" style="color:${corTexto}">${esc(t)}</h2>`;
  const comVariacoes = c.variacoes.length > 0;
  const tabelaDoTotal = (t: TotaisComFibra) => `<table class="macros"><tbody>
<tr><td>Calorias Totais</td><td style="color:${corTexto}">${esc(kcal(t.kcal))}</td></tr>
<tr><td>Proteína</td><td style="color:${corTexto}">${esc(g(t.proteina))}</td></tr>
<tr><td>Carboidrato</td><td style="color:${corTexto}">${esc(g(t.carboidrato))}</td></tr>
<tr><td>Gordura</td><td style="color:${corTexto}">${esc(g(t.gordura))}</td></tr>
<tr><td>Fibra</td><td>${esc(fibra(t))}</td></tr></tbody></table>${fibraParcial(t) ? `<div class="pequeno">${esc('Fibra parcial: há itens sem fibra informada.')}</div>` : ''}`;
  // Nome do aluno e data de emissão ficam no cabeçalho comum (`cabecalhoDoPdf`), sem repetir aqui.
  const identificacao = [
    ['Objetivo', c.objetivo],
    ['Data Início', dataParaTela(c.dataInicio)],
    ...(textoDaAgua(c.aguaLitros) ? [['Água', textoDaAgua(c.aguaLitros)]] : []),
  ]
    .map(([r, v]) => `<tr><td>${esc(r)}</td><td>${esc(v || '—')}</td></tr>`)
    .join('');
  const htmlDasRefeicoes = (lista: Refeicao[]) => lista
    .map((r, ri) => {
      const varias = r.opcoes.length > 1;
      const opcoes = r.opcoes
        .map((o, oi) => {
          const corOpcao = oi === 0 ? cor : (COR_OPCAO[oi] ?? NAVY);
          const corDoItem = oi === 0 ? corTexto : corOpcao;
          const textoDaFaixa = tema === 'CLASSICO' ? '' : `;color:${textoSobre(corOpcao)}`;
          const faixa = varias ? `<div class="cab" style="background:${corOpcao}${textoDaFaixa}">▸ OPÇÃO ${esc(o.rotulo)}</div>` : '';
          const itens = o.itens.map((i) => linhaItem(i, varias ? corDoItem : corTexto)).join('') || '<div class="suave">—</div>';
          return `<div class="opcao">${faixa}${itens}<div class="total">Total: ${esc(textoTotaisPdf(somar(o.itens)))}</div></div>`;
        })
        .join('');
      // Opções são alternativas: o PDF diz para escolher uma (nada é somado nem comparado entre elas).
      const escolha = textoEscolhaDasOpcoes(r.opcoes.map((o) => o.rotulo));
      const preparo = modoDePreparoParaMostrar(r.modoDePreparo);
      return `<div class="refeicao">
<div class="cab">Sugestão — Refeição ${ri + 1} — ${esc(r.nome.toUpperCase())}${r.horario ? ` (${esc(r.horario)})` : ''}</div>
${r.observacao ? `<div class="suave">${escLinhas(r.observacao)}</div>` : ''}${escolha ? `<div class="escolha">${esc(escolha)}</div>` : ''}${opcoes}${
        preparo ? `<div class="preparo"><strong>Modo de preparo</strong>${escLinhas(preparo)}</div>` : ''
      }</div>`;
    })
    .join('');
  // Sem variação, a dieta de sempre (macros do dia e refeições); com variações, uma seção por variação: rótulo, dias em
  // texto, total do dia dela e refeições. Orientações, suplementos e o resto abaixo são globais.
  const planoAlimentar = comVariacoes
    ? [
        sec('Sugestão de plano alimentar'),
        ...secoesDaDieta(c).map((s) => `<div class="bloco">${sec(`Variação · ${s.rotulo ?? ''}`)}<div class="escolha">Dias: ${esc(textoDosDias(s.dias))}</div>
${tabelaDoTotal(totalDoDia(s.refeicoes))}
<div class="pequeno">Total do dia desta variação considerando a opção A de cada refeição.</div></div>
${htmlDasRefeicoes(s.refeicoes) || '<div class="suave">—</div>'}`),
      ]
    : [
        `<div class="bloco">${sec('Distribuição diária de macronutrientes')}
${tabelaDoTotal(totalDoDia(c.refeicoes))}
<div class="pequeno">Total do dia considerando a opção A de cada refeição.</div></div>`,
        barra,
        sec('Sugestão de plano alimentar'),
        htmlDasRefeicoes(c.refeicoes) || '<div class="suave">—</div>',
      ];
  const suplementos = c.suplementacao.filter((s) => s.nome || s.dose || s.horario || s.observacao || s.cupom?.trim());
  const ergogenicos = ergogenicosPreenchidos(c.ergogenicos);
  const comPrescricao = ergogenicos.some((e) => e.prescricao.trim() !== '');
  const partes = [
    cabecalhoDoPdf({
      marca: d.marca,
      logoDataUri: d.logoDataUri,
      documento: 'Sugestão de plano alimentar',
      titulo: d.titulo,
      versao: d.versao,
      aluno: d.aluno,
      emitidoEm: d.emitidoEm,
    }),
    `<div class="bloco">${sec('Identificação do aluno')}<table class="id"><tbody>${identificacao}</tbody></table></div>`,
    barra,
    ...planoAlimentar,
    c.orientacoes.length || c.observacoes ? barra : '',
    c.orientacoes.length
      ? `<div class="bloco">${sec('Orientações e recomendações')}${c.orientacoes
          .map((o) => `<div class="orient">${o.titulo ? `<strong>${esc(o.titulo)}:</strong> ` : ''}${escLinhas(o.texto)}</div>`)
          .join('')}</div>`
      : '',
    c.observacoes ? `<div class="bloco"><strong>Observações e Diretrizes do Protocolo:</strong><div class="suave">${escLinhas(c.observacoes)}</div></div>` : '',
    suplementos.length
      ? `${barra}<div class="bloco">${sec('Sugestão de suplementação')}<table class="dark"><thead><tr><th>Suplemento</th><th>Dose</th><th>Horário</th><th>Obs</th></tr></thead><tbody>${suplementos
          .map((s) => `<tr><td>${nomeDoSuplemento(s)}${s.cupom?.trim() ? ` · Cupom: ${esc(s.cupom.trim())}` : ''}</td><td>${esc(s.dose) || '—'}</td><td>${esc(s.horario) || '—'}</td><td>${esc(s.observacao) || '—'}</td></tr>`)
          .join('')}</tbody></table></div>`
      : '',
    ergogenicos.length
      ? `${barra}<div class="bloco">${sec('Medicação e ergogênicos')}<table class="dark"><thead><tr><th>Item</th><th>Dose</th><th>Horário</th><th>Obs</th>${comPrescricao ? '<th>Prescrição</th>' : ''}</tr></thead><tbody>${ergogenicos
          .map(
            (e) =>
              `<tr><td>${esc(e.nome) || '—'}${e.principioAtivo ? `<br><span class="suave">${esc(e.principioAtivo)}</span>` : ''}</td><td>${esc(e.dose) || '—'}</td><td>${esc(e.horario) || '—'}</td><td>${esc(e.observacao) || '—'}</td>${comPrescricao ? `<td>${esc(e.prescricao) || '—'}</td>` : ''}</tr>`,
          )
          .join('')}</tbody></table></div>`
      : '',
    d.pesos.length
      ? `${barra}<div class="bloco">${sec('Acompanhamento de peso')}<table class="dark"><thead><tr><th>Atualização</th><th>Data</th><th>Peso</th><th>Variação</th></tr></thead><tbody>${d.pesos
          .map(
            (p, n) =>
              `<tr><td>Atualização ${n + 1}</td><td>${esc(dataParaTela(p.data))}</td><td>${esc(numeroParaTela(p.pesoKg))} kg</td>${celulaDaVariacao(p)}</tr>`,
          )
          .join('')}</tbody></table></div>`
      : '',
    `<div class="fim">${d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : ''}<div class="pequeno centro" style="margin-top:14pt">${esc(d.marca.nome)}</div></div>`,
  ];
  if (d.lista) partes.splice(partes.length - 1, 0, secaoDaLista(d.lista, d.versao, corTexto, comVariacoes));
  return { titulo: `Dieta - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria, tema) + CSS_DIETA + cssDoTemaDeDieta(tema, cor), corpo: partes.join('\n') };
}
