import type { AvaliacaoFisica } from '../api/avaliacaoFisicaTipos';
import type { Marca } from '../api/tipos';
import { cmParaTela } from '../dominio/avaliacaoFisica';
import { compararAvaliacoes, formatadorDeDatas, linhaDoPeso, type ColunaComparada } from '../dominio/comparacaoDeAvaliacoes';
import { dataParaTela } from '../dominio/formatos';
import { base64DeTexto } from './base64';
import { cabecalhoDoPdf, cssBase, esc, escLinhas, type Documento } from './html';

/** Um ponto real do gráfico: data ISO `AAAA-MM-DD` e valor em cm (sem interpolar data sem medida). */
export interface PontoDoGrafico {
  data: string;
  valor: number;
}

/** Gráfico opcional do PDF: uma medida (e, no máximo, uma segunda série tracejada, ex.: lado esquerdo). */
export interface GraficoDoPdf {
  rotulo: string;
  unidade: 'cm';
  pontos: readonly PontoDoGrafico[];
  serieB?: { rotulo: string; pontos: readonly PontoDoGrafico[] };
}

export interface DadosPdfAvaliacaoFisica {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  /** TODAS as avaliações do aluno que a tela tem (o PDF escolhe as datas por `escolhidas`, como a tela). */
  avaliacoes: readonly AvaliacaoFisica[];
  /** Ids escolhidos no Comparar (2 a 4, em qualquer ordem); o PDF sai em ordem cronológica, igual à tela. */
  escolhidas: readonly string[];
  /** Sem ele a página não muda. */
  grafico?: GraficoDoPdf;
  emitidoEm: Date;
}

const COR_A = '#1D4ED8';
const COR_B = '#6D28D9';

// ---------- Gráfico (SVG estático, sem script, dentro de <img> em base64) ----------

const LARGURA = 560;
const ALTURA = 220;
const MARGEM = { esq: 62, dir: 40, topo: 16, base: 36 };
/** Largura estimada de um caractere do rótulo de data (fonte de 9 px; dígitos e "/" ficam abaixo de 0,6 em) e a folga entre dois rótulos. */
const LARGURA_DO_CARACTERE = 5.4;
const FOLGA_ENTRE_ROTULOS = 4;

function instante(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

/** Só pontos reais: valor finito e data que existe. */
function limpos(pontos: readonly PontoDoGrafico[]): PontoDoGrafico[] {
  return pontos.filter((p) => Number.isFinite(p.valor) && Number.isFinite(instante(p.data)) && dataParaTela(p.data) !== '');
}

function svgDoGrafico(a: PontoDoGrafico[], b: PontoDoGrafico[], titulo: string): string {
  const todos = [...a, ...b];
  const tempos = todos.map((p) => instante(p.data));
  const tMin = Math.min(...tempos);
  const tMax = Math.max(...tempos);
  const vMin = Math.min(...todos.map((p) => p.valor));
  const vMax = Math.max(...todos.map((p) => p.valor));
  const areaX = LARGURA - MARGEM.esq - MARGEM.dir;
  const topoY = MARGEM.topo + 10;
  const baseY = ALTURA - MARGEM.base;
  const x = (iso: string) => (tMax === tMin ? MARGEM.esq + areaX / 2 : MARGEM.esq + ((instante(iso) - tMin) / (tMax - tMin)) * areaX);
  const y = (v: number) => (vMax === vMin ? (topoY + baseY) / 2 : topoY + ((vMax - v) / (vMax - vMin)) * (baseY - topoY - 10));
  const f = (n: number) => n.toFixed(1);
  const texto = (px: number, py: number, t: string, ancora: 'start' | 'middle' | 'end') =>
    `<text x="${f(px)}" y="${f(py)}" text-anchor="${ancora}" font-size="9" fill="#333">${esc(t)}</text>`;

  const rotulosDoEixo = vMax === vMin
    ? texto(MARGEM.esq - 6, y(vMax) + 3, `${cmParaTela(vMax)} cm`, 'end')
    : texto(MARGEM.esq - 6, y(vMax) + 3, `${cmParaTela(vMax)} cm`, 'end') + texto(MARGEM.esq - 6, y(vMin) + 3, `${cmParaTela(vMin)} cm`, 'end');
  const guias = [...new Set([y(vMax), y(vMin)])]
    .map((py) => `<line x1="${MARGEM.esq}" y1="${f(py)}" x2="${LARGURA - MARGEM.dir}" y2="${f(py)}" stroke="#ddd" stroke-width="0.8"/>`)
    .join('');
  const datas = [...new Set(todos.map((p) => p.data))].sort();
  const formatarData = formatadorDeDatas(datas);
  // Datas próximas (dias seguidos num eixo de meses) deixariam os rótulos um sobre o outro: a marca e o ponto de cada data
  // ficam, e só o texto que colidiria com o anterior já escrito, ou com o último, é omitido. Primeiro e último sempre saem.
  const faixas = datas.map((d) => ({ d, x: x(d), meia: (formatarData(d).length * LARGURA_DO_CARACTERE) / 2 }));
  const ultimaFaixa = faixas[faixas.length - 1];
  let fimDoAnterior = -Infinity;
  const comTexto = new Set(
    faixas
      .filter((r, i) => {
        const sai = i === 0 || i === faixas.length - 1
          || (r.x - r.meia >= fimDoAnterior + FOLGA_ENTRE_ROTULOS && r.x + r.meia + FOLGA_ENTRE_ROTULOS <= ultimaFaixa.x - ultimaFaixa.meia);
        if (sai) fimDoAnterior = r.x + r.meia;
        return sai;
      })
      .map((r) => r.d),
  );
  const eixoX = datas
    .map((d) => `<line x1="${f(x(d))}" y1="${baseY}" x2="${f(x(d))}" y2="${baseY + 4}" stroke="#555" stroke-width="0.8"/>${comTexto.has(d) ? texto(x(d), baseY + 15, formatarData(d), 'middle') : ''}`)
    .join('');
  const serie = (pontos: PontoDoGrafico[], cor: string, tracejada: boolean) => {
    if (!pontos.length) return '';
    const linha = pontos.length > 1
      ? `<polyline points="${pontos.map((p) => `${f(x(p.data))},${f(y(p.valor))}`).join(' ')}" fill="none" stroke="${cor}" stroke-width="2"${tracejada ? ' stroke-dasharray="6 4"' : ''}/>`
      : '';
    const marcas = pontos
      .map((p) => {
        const px = x(p.data);
        const py = y(p.valor);
        // Série A: círculo cheio; série B: quadrado vazado (distinguem-se sem cor).
        const marca = tracejada
          ? `<rect x="${f(px - 3.5)}" y="${f(py - 3.5)}" width="7" height="7" fill="#fff" stroke="${cor}" stroke-width="2"/>`
          : `<circle cx="${f(px)}" cy="${f(py)}" r="3.5" fill="${cor}"/>`;
        return marca + texto(px, tracejada ? py + 15 : py - 8, cmParaTela(p.valor), 'middle');
      })
      .join('');
    return linha + marcas;
  };
  // Fundo branco: a página imprime em claro e o SVG, como imagem, não herda a cor do documento. Todo texto passou por `esc()`.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="0 0 ${LARGURA} ${ALTURA}">`
    + `<title>${esc(titulo)}</title><rect width="${LARGURA}" height="${ALTURA}" fill="#fff"/>`
    + `${guias}<line x1="${MARGEM.esq}" y1="${topoY - 6}" x2="${MARGEM.esq}" y2="${baseY}" stroke="#555" stroke-width="1"/>`
    + `<line x1="${MARGEM.esq}" y1="${baseY}" x2="${LARGURA - MARGEM.dir}" y2="${baseY}" stroke="#555" stroke-width="1"/>`
    + `${rotulosDoEixo}${eixoX}${serie(a, COR_A, false)}${serie(b, COR_B, true)}</svg>`;
}

/**
 * O gráfico entra no documento como `<img src="data:image/svg+xml;base64,...">` gerado só por esta função (números, datas e
 * textos escapados): SVG dentro de `<img>` não executa script nem carrega recurso externo, e a barreira da web
 * (`imprimir.web.ts`) só aceita esse formato no `src` de `<img>`.
 */
function imagemDoGrafico(svg: string, titulo: string): string {
  return `<img alt="${esc(titulo)}" src="data:image/svg+xml;base64,${base64DeTexto(svg)}" width="${LARGURA}" height="${ALTURA}" style="max-width:100%;height:auto">`;
}

function blocoDoGrafico(g: GraficoDoPdf): string {
  const a = limpos(g.pontos);
  const b = g.serieB ? limpos(g.serieB.pontos) : [];
  if (!a.length && !b.length) return '';
  const titulo = g.serieB ? `${g.rotulo} e ${g.serieB.rotulo} (${g.unidade})` : `${g.rotulo} (${g.unidade})`;
  const legenda = [
    `<span>Linha contínua, círculos: ${esc(g.rotulo)}</span>`,
    g.serieB ? `<span>Linha tracejada, quadrados: ${esc(g.serieB.rotulo)}</span>` : '',
  ].join('');
  return `<div class="grafico"><h3>Evolução: ${esc(titulo)}</h3>${imagemDoGrafico(svgDoGrafico(a, b, `Evolução: ${titulo}`), `Evolução: ${titulo}`)}<div class="legenda pequeno">${legenda}</div></div>`;
}

// ---------- Tabelas ----------

function colgroup(n: number): string {
  const largura = Math.floor(54 / Math.max(1, n));
  return `<colgroup><col style="width:28%">${`<col style="width:${largura}%">`.repeat(n)}<col style="width:${100 - 28 - largura * n}%"></colgroup>`;
}

function cabecalhoDaTabela(primeira: string, colunas: readonly ColunaComparada[]): string {
  return `<thead><tr><th>${esc(primeira)}</th>${colunas.map((c) => `<th class="num">${esc(c.dataTexto)}</th>`).join('')}<th class="num">Variação</th></tr></thead>`;
}

function linha(rotulo: string, celulas: { texto: string; ausente: boolean }[], variacao: string): string {
  return `<tr><td><strong>${esc(rotulo)}</strong></td>${celulas
    .map((c) => `<td class="num${c.ausente ? ' ausente' : ''}">${esc(c.texto)}</td>`)
    .join('')}<td class="num">${esc(variacao)}</td></tr>`;
}

/**
 * Comparativo da avaliação física, igual ao da tela: as datas e medidas vêm de `compararAvaliacoes` (mesma função), sem
 * recalcular nada aqui. Tabela por grupo (Tronco, Braços, Pernas) com uma coluna por data em ordem cronológica e a variação
 * (última − primeira) escrita com sinal ("+0,8 cm", "−0,8 cm", "0,0 cm"), então lê em preto e branco. O peso do dia é só
 * informativo (tabela à parte, fora dos grupos). Sem soma, meta, classificação nem interpretação. Todo texto dinâmico
 * passa por `esc()`. Lança erro se `escolhidas` não resulta em 2 a 4 datas (a tela só habilita o botão nesse caso).
 */
export function documentoAvaliacaoFisica(d: DadosPdfAvaliacaoFisica): Documento {
  const c = compararAvaliacoes(d.avaliacoes, d.escolhidas);
  if (c.estado !== 'ok') throw new Error(c.mensagem);
  const { colunas } = c;
  const escolhidasEmOrdem = colunas.map((col) => d.avaliacoes.find((a) => a.id === col.id)).filter((a): a is AvaliacaoFisica => !!a);

  const grupos = c.grupos
    .map((g) => `<section class="grupo-bloco"><h3>${esc(g.titulo)}</h3><table class="comp">${colgroup(colunas.length)}${cabecalhoDaTabela('Medida (cm)', colunas)}<tbody>${g.itens
      .map((i) => linha(i.rotulo, i.celulas.map((x) => ({ texto: x.texto, ausente: x.valor === null })), i.variacao.texto))
      .join('')}</tbody></table></section>`)
    .join('');

  // Peso do dia: informativo, fora dos grupos; a mesma regra da tela (`linhaDoPeso`).
  const pesoDoDia = linhaDoPeso(d.avaliacoes, colunas);
  const peso = pesoDoDia
    ? `<section class="grupo-bloco"><h3>Peso do dia (informativo)</h3><table class="comp">${colgroup(colunas.length)}${cabecalhoDaTabela('Registro de peso', colunas)}<tbody>${linha(
        'Peso',
        pesoDoDia.celulas.map((x) => ({ texto: x.texto, ausente: x.valor === null })),
        pesoDoDia.variacao.texto,
      )}</tbody></table></section>`
    : '';

  const observacoes = escolhidasEmOrdem.filter((a) => a.observacao?.trim());
  const corpo = [
    cabecalhoDoPdf({
      marca: d.marca,
      logoDataUri: d.logoDataUri,
      documento: 'Avaliação física',
      aluno: d.aluno,
      periodo: `${dataParaTela(colunas[0].data)} a ${dataParaTela(colunas[colunas.length - 1].data)}`,
      emitidoEm: d.emitidoEm,
    }),
    '<h2>Comparativo de circunferências</h2>',
    '<p class="pequeno">Medidas em centímetros (cm), como registradas pela equipe.</p>',
    `<p class="pequeno referencia">${esc(c.referencia)}</p>`,
    grupos || '<p class="suave">Nenhuma medida nas datas escolhidas.</p>',
    peso,
    d.grafico ? blocoDoGrafico(d.grafico) : '',
    observacoes.length
      ? `<section class="obs-bloco"><h2>Observações</h2>${observacoes
          .map((a) => `<div class="bloco obs"><strong>${esc(dataParaTela(a.data))}</strong>: ${escLinhas(a.observacao)}</div>`)
          .join('')}</section>`
      : '',
    '<div class="rodape">O peso é o registro de peso da mesma data; "—" quando não há registro.</div>',
  ].join('\n');

  const css = `${cssBase(d.marca.corPrimaria)}
.doc table.comp { table-layout: fixed; }
.doc table.comp th, .doc table.comp td { overflow-wrap: anywhere; word-break: break-word; }
.doc table.comp th { background: #f1f3f5; color: #111; border-bottom: 1.5px solid #888; }
.doc table.comp thead, .doc table.comp thead tr { break-after: avoid; page-break-after: avoid; }
.doc table.comp tr { break-inside: avoid; page-break-inside: avoid; }
.doc .num { text-align: right; font-variant-numeric: tabular-nums; }
.doc td.num { white-space: nowrap; }
.doc .ausente { color: #555; }
.doc .grupo-bloco, .doc .grafico { break-inside: avoid; page-break-inside: avoid; margin: 6pt 0 10pt; }
.doc .grupo-bloco h3, .doc .grafico h3 { margin: 6pt 0 3pt; break-after: avoid; page-break-after: avoid; }
.doc .legenda { display: flex; flex-wrap: wrap; gap: 4pt 14pt; }
.doc .obs { margin: 4pt 0; padding: 4pt 0; border-bottom: 1px solid #ddd; overflow-wrap: anywhere; }
`;
  return { titulo: `Avaliação física - ${d.aluno}`, css, corpo };
}
