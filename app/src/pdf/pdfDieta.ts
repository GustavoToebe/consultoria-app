import type { ConteudoDieta, ItemDieta, Marca, RegistroPeso, Suplemento } from '../api/tipos';
import { somar, totalDoDia, type Totais } from '../dominio/dieta';
import { dataParaTela, numeroParaTela } from '../dominio/formatos';
import { linkParaAbrir } from '../dominio/links';
import { cssBase, esc, escLinhas, type Documento } from './html';

export interface DadosPdfDieta {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  titulo: string;
  versao: number | null;
  conteudo: ConteudoDieta;
  pesos: RegistroPeso[];
  rodapePdf: string | null;
  emitidoEm: Date;
}

const g = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 1)} g`);
const kcal = (v: number | null) => (v === null ? '—' : `${numeroParaTela(v, 0)} kcal`);

export function textoTotaisPdf(t: Totais): string {
  return `${kcal(t.kcal)} · P: ${g(t.proteina)} · C: ${g(t.carboidrato)} · G: ${g(t.gordura)}`;
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

function variacao(v: number | null): string {
  if (v === null) return '—';
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${numeroParaTela(Math.abs(v))}`;
}

const CSS_DIETA = `
.doc .capa { text-align: center; margin: 4pt 0 10pt; }
.doc .capa img { max-height: 110pt; max-width: 280pt; }
.doc .capa h1 { font-size: 26pt; }
.doc .capa .titulo { font-size: 16pt; font-weight: 800; color: ${NAVY}; margin-top: 10pt; letter-spacing: .5px; }
.doc .capa .sub { font-size: 9.5pt; color: #666; font-weight: 700; margin-top: 3pt; }
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
.doc .orient { margin-bottom: 3pt; }
.doc table.dark th { background: ${NAVY}; }
.doc table.dark td { border: 1px solid #ddd; font-weight: 700; }
.doc table.dark tr:nth-child(even) td { background: #f4f4f4; }
.doc .centro { text-align: center; }
`;

/** PDF da dieta no layout do Saraiva Team (capa com logo, barras da marca, refeições em faixas escuras). */
export function documentoDieta(d: DadosPdfDieta): Documento {
  const c = d.conteudo;
  const cor = /^#[0-9A-Fa-f]{6}$/.test(d.marca.corPrimaria) ? d.marca.corPrimaria : '#333333';
  const barra = `<div class="barra" style="background:${cor}"></div>`;
  const sec = (t: string) => `<h2 class="sec" style="color:${cor}">${esc(t)}</h2>`;
  const total = totalDoDia(c);
  const identificacao = [
    ['Nome', d.aluno],
    ['Objetivo', c.objetivo],
    ['Data Início', dataParaTela(c.dataInicio)],
    ['Profissional', c.profissional ?? d.marca.nome],
    ['Emitido em', dataParaTela(d.emitidoEm.toISOString().slice(0, 10))],
  ]
    .map(([r, v]) => `<tr><td>${esc(r)}</td><td>${esc(v || '—')}</td></tr>`)
    .join('');
  const refeicoes = c.refeicoes
    .map((r, ri) => {
      const varias = r.opcoes.length > 1;
      const opcoes = r.opcoes
        .map((o, oi) => {
          const corOpcao = oi === 0 ? cor : (COR_OPCAO[oi] ?? NAVY);
          const faixa = varias ? `<div class="cab" style="background:${corOpcao}">▸ OPÇÃO ${esc(o.rotulo)}</div>` : '';
          const itens = o.itens.map((i) => linhaItem(i, varias ? corOpcao : cor)).join('') || '<div class="suave">—</div>';
          return `<div class="opcao">${faixa}${itens}<div class="total">Total: ${esc(textoTotaisPdf(somar(o.itens)))}</div></div>`;
        })
        .join('');
      return `<div class="refeicao">
<div class="cab">Sugestão — Refeição ${ri + 1} — ${esc(r.nome.toUpperCase())}${r.horario ? ` (${esc(r.horario)})` : ''}</div>
${r.observacao ? `<div class="suave">${escLinhas(r.observacao)}</div>` : ''}${opcoes}</div>`;
    })
    .join('');
  const suplementos = c.suplementacao.filter((s) => s.nome || s.dose || s.horario || s.observacao);
  const marcaOuLogo = d.logoDataUri ? `<img src="${esc(d.logoDataUri)}" alt="${esc(d.marca.nome)}">` : `<h1>${esc(d.marca.nome)}</h1>`;
  const corpo = [
    `<div class="capa">${marcaOuLogo}
<div class="titulo">SUGESTÃO DE PLANO ALIMENTAR</div>
<div class="sub">Elaborado por profissional habilitado${d.versao ? '' : ' · RASCUNHO, não publicado'}</div></div>`,
    barra,
    `<div class="bloco">${sec('Identificação do aluno')}<table class="id"><tbody>${identificacao}</tbody></table></div>`,
    barra,
    `<div class="bloco">${sec('Distribuição diária de macronutrientes')}
<table class="macros"><tbody>
<tr><td>Calorias Totais</td><td style="color:${cor}">${esc(kcal(total.kcal))}</td></tr>
<tr><td>Proteína</td><td style="color:${cor}">${esc(g(total.proteina))}</td></tr>
<tr><td>Carboidrato</td><td style="color:${cor}">${esc(g(total.carboidrato))}</td></tr>
<tr><td>Gordura</td><td style="color:${cor}">${esc(g(total.gordura))}</td></tr></tbody></table>
<div class="pequeno">Total do dia considerando a opção A de cada refeição.</div></div>`,
    barra,
    sec('Sugestão de plano alimentar'),
    refeicoes || '<div class="suave">—</div>',
    c.orientacoes.length || c.observacoes ? barra : '',
    c.orientacoes.length
      ? `<div class="bloco">${sec('Orientações e recomendações')}${c.orientacoes
          .map((o) => `<div class="orient">${o.titulo ? `<strong>${esc(o.titulo)}:</strong> ` : ''}${escLinhas(o.texto)}</div>`)
          .join('')}</div>`
      : '',
    c.observacoes ? `<div class="bloco"><strong>Observações e Diretrizes do Protocolo:</strong><div class="suave">${escLinhas(c.observacoes)}</div></div>` : '',
    suplementos.length
      ? `${barra}<div class="bloco">${sec('Sugestão de suplementação')}<table class="dark"><thead><tr><th>Suplemento</th><th>Dose</th><th>Horário</th><th>Obs</th></tr></thead><tbody>${suplementos
          .map((s) => `<tr><td>${nomeDoSuplemento(s)}</td><td>${esc(s.dose) || '—'}</td><td>${esc(s.horario) || '—'}</td><td>${esc(s.observacao) || '—'}</td></tr>`)
          .join('')}</tbody></table></div>`
      : '',
    d.pesos.length
      ? `${barra}<div class="bloco">${sec('Acompanhamento de peso')}<table class="dark"><thead><tr><th>Atualização</th><th>Data</th><th>Peso</th><th>Variação</th><th>Obs</th></tr></thead><tbody>${d.pesos
          .map(
            (p, n) =>
              `<tr><td>Atualização ${n + 1}</td><td>${esc(dataParaTela(p.data))}</td><td>${esc(numeroParaTela(p.pesoKg))} kg</td><td${p.variacao !== null && p.variacao > 0 ? ` style="color:${cor}"` : ''}>${esc(variacao(p.variacao))}</td><td>${esc(p.observacao) || '—'}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '',
    d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : '',
    `<div class="pequeno centro" style="margin-top:14pt">${esc(d.marca.nome)}</div>`,
  ].join('\n');
  return { titulo: `Dieta - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria) + CSS_DIETA, corpo };
}
