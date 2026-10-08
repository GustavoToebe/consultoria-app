import type { ConteudoDieta, ItemDieta, Marca, RegistroPeso } from '../api/tipos';
import { somar, totalDoDia, type Totais } from '../dominio/dieta';
import { dataHoraParaTela, dataParaTela, numeroParaTela } from '../dominio/formatos';
import { cssBase, esc, escLinhas, topo, type Documento } from './html';

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

function linhaItem(i: ItemDieta): string {
  return `<div>• <strong>${esc(i.nome)}</strong> ${esc(numeroParaTela(i.quantidade))} ${esc(i.unidade)} | ${esc(textoTotaisPdf(somar([i])))}</div>`;
}

function variacao(v: number | null): string {
  if (v === null) return '—';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${numeroParaTela(Math.abs(v))} kg`;
}

/** PDF da dieta no formato do Saraiva (seção 12). O total do dia soma só a opção A de cada refeição. */
export function documentoDieta(d: DadosPdfDieta): Documento {
  const c = d.conteudo;
  const total = totalDoDia(c);
  const identificacao = [
    ['Aluno', d.aluno],
    ['Objetivo', c.objetivo],
    ['Data de início', dataParaTela(c.dataInicio)],
    ['Profissional', c.profissional],
    ['Emitido em', dataHoraParaTela(d.emitidoEm.toISOString())],
  ]
    .map(([r, v]) => `<tr><td style="width:30%"><strong>${esc(r)}</strong></td><td>${esc(v || '—')}</td></tr>`)
    .join('');
  const refeicoes = c.refeicoes
    .map(
      (r, ri) => `<div class="bloco">
<h3>Sugestão — Refeição ${ri + 1} — ${esc(r.nome.toUpperCase())}${r.horario ? ` <span class="suave">(${esc(r.horario)})</span>` : ''}</h3>
${r.observacao ? `<div class="suave">${escLinhas(r.observacao)}</div>` : ''}
${r.opcoes
  .map(
    (o) => `<div style="margin:4pt 0 6pt">
<div><strong>▸ OPÇÃO ${esc(o.rotulo)}</strong></div>
${o.itens.map(linhaItem).join('') || '<div class="suave">—</div>'}
<div><strong>Total:</strong> ${esc(textoTotaisPdf(somar(o.itens)))}</div>
</div>`,
  )
  .join('')}
</div>`,
    )
    .join('');
  const suplementos = c.suplementacao.filter((s) => s.nome || s.dose || s.horario || s.observacao);
  const corpo = [
    topo(d.marca, d.logoDataUri, [`${d.titulo}${d.versao ? ` (v${d.versao})` : ' (RASCUNHO, não publicado)'}`]),
    `<div style="text-align:center;margin:6pt 0 2pt"><strong style="font-size:13pt">SUGESTÃO DE PLANO ALIMENTAR</strong></div>`,
    c.profissional ? `<div class="pequeno" style="text-align:center">Elaborado por ${esc(c.profissional)}</div>` : '',
    `<div class="bloco"><h2>Identificação</h2><table><tbody>${identificacao}</tbody></table></div>`,
    `<div class="bloco"><h2>Distribuição diária de macronutrientes</h2>
<table><thead><tr><th>Kcal</th><th>Proteína</th><th>Carboidrato</th><th>Gordura</th></tr></thead>
<tbody><tr><td>${esc(kcal(total.kcal))}</td><td>${esc(g(total.proteina))}</td><td>${esc(g(total.carboidrato))}</td><td>${esc(g(total.gordura))}</td></tr></tbody></table>
<div class="pequeno">Total do dia considerando a opção A de cada refeição.</div></div>`,
    `<h2>Refeições</h2>${refeicoes || '<div class="suave">—</div>'}`,
    c.orientacoes.length
      ? `<div class="bloco"><h2>Orientações e recomendações</h2>${c.orientacoes
          .map((o) => `<div style="margin-bottom:4pt">${o.titulo ? `<strong>${esc(o.titulo)}:</strong> ` : ''}${escLinhas(o.texto)}</div>`)
          .join('')}</div>`
      : '',
    c.observacoes ? `<div class="bloco"><h2>Observações</h2><div>${escLinhas(c.observacoes)}</div></div>` : '',
    suplementos.length
      ? `<div class="bloco"><h2>Suplementação</h2><table><thead><tr><th>Suplemento</th><th>Dose</th><th>Horário</th><th>Obs</th></tr></thead><tbody>${suplementos
          .map((s) => `<tr><td>${esc(s.nome) || '—'}</td><td>${esc(s.dose) || '—'}</td><td>${esc(s.horario) || '—'}</td><td>${esc(s.observacao) || '—'}</td></tr>`)
          .join('')}</tbody></table></div>`
      : '',
    d.pesos.length
      ? `<div class="bloco"><h2>Acompanhamento de peso</h2><table><thead><tr><th>Data</th><th>Peso</th><th>Variação</th><th>Obs</th></tr></thead><tbody>${d.pesos
          .map(
            (p) =>
              `<tr><td>${esc(dataParaTela(p.data))}</td><td>${esc(numeroParaTela(p.pesoKg))} kg</td><td>${esc(variacao(p.variacao))}</td><td>${esc(p.observacao) || '—'}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '',
    d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : '',
  ].join('\n');
  return { titulo: `Dieta - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria), corpo };
}
