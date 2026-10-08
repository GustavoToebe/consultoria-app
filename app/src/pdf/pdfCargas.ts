import type { Marca } from '../api/tipos';
import { dataHoraParaTela, dataParaTela, numeroParaTela } from '../dominio/formatos';
import { totalDeRegistros, type DivisaoRelatorio, type LinhaCarga } from '../dominio/relatorio';
import { cssBase, esc, topo, type Documento } from './html';

export interface DadosPdfCargas {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  de: string;
  ate: string;
  divisoes: DivisaoRelatorio[];
  rodapePdf: string | null;
  emitidoEm: Date;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Carga da linha: "75 kg", "Sem carga" (peso corporal) ou "—" (sem série de trabalho registrada). */
export function textoCarga(l: LinhaCarga): string {
  if (l.carga !== null) return `${numeroParaTela(l.carga)} kg`;
  return l.semCarga ? 'Sem carga' : '—';
}

/**
 * Relatório de cargas (como o do protótipo): divisão → exercício → uma linha por dia com a carga de trabalho, as
 * repetições e a observação do aluno. Só o que foi registrado.
 */
export function documentoCargas(d: DadosPdfCargas): Documento {
  const marca = HEX.test(d.marca.corPrimaria) ? d.marca.corPrimaria : '#333333';
  const total = totalDeRegistros(d.divisoes);
  const divisoes = d.divisoes
    .map((div) => {
      const exercicios = div.exercicios
        .map((e) => {
          const linhas = e.linhas
            .map(
              (l) => `<tr><td><strong>${esc(dataParaTela(l.data))}</strong></td><td class="carga">${esc(textoCarga(l))}</td>` +
                `<td>${l.repeticoes === null ? '—' : `${esc(l.repeticoes)} reps`}</td><td>${esc(l.series)}</td>` +
                `<td>${l.observacoes.length ? `<span class="obs">${l.observacoes.map(esc).join(' · ')}</span>` : '—'}</td></tr>`,
            )
            .join('');
          return `<div class="exercicio bloco"><div class="cab"><strong>${esc(e.nome)}</strong><span class="pequeno">${e.linhas.length} ${e.linhas.length === 1 ? 'sessão' : 'sessões'}</span></div>` +
            `<table><thead><tr><th style="width:16%">Data</th><th style="width:20%">Carga de trabalho</th><th style="width:13%">Reps</th><th style="width:11%">Séries</th><th>Observação</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
        })
        .join('');
      return `<div class="divisao"><div class="titulo-divisao"><span>${esc(div.nome)}</span><span class="pequeno">${div.exercicios.length} ${div.exercicios.length === 1 ? 'exercício' : 'exercícios'}</span></div>${exercicios}</div>`;
    })
    .join('');

  const corpo = [
    topo(d.marca, d.logoDataUri, [
      `Aluno: ${d.aluno}`,
      `Relatório de cargas: ${dataParaTela(d.de)} a ${dataParaTela(d.ate)}`,
      `Emitido em ${dataHoraParaTela(d.emitidoEm.toISOString())}`,
    ]),
    `<div class="resumo"><span><strong>${esc(d.aluno)}</strong><br><span class="suave">Período: ${esc(dataParaTela(d.de))} a ${esc(dataParaTela(d.ate))}</span></span>` +
      `<span style="text-align:right"><strong style="color:${marca}">${total} ${total === 1 ? 'registro' : 'registros'}</strong><br><span class="pequeno">Agrupado por divisão do plano</span></span></div>`,
    divisoes || '<p class="suave">Nenhum registro no período.</p>',
    `<div class="rodape">${d.rodapePdf ? `${esc(d.rodapePdf)} · ` : ''}Carga e repetições como o aluno registrou no app.</div>`,
  ].join('');

  const css = `${cssBase(marca)}
.doc .resumo { display: flex; justify-content: space-between; gap: 12pt; border: 1px solid #ddd; border-radius: 6px; padding: 8pt 10pt; margin: 6pt 0 10pt; }
.doc .divisao { margin-top: 12pt; }
.doc .titulo-divisao { display: flex; justify-content: space-between; align-items: center; background: #f3f3f4; border-left: 4px solid ${marca}; border-radius: 4px; padding: 6pt 10pt; font-weight: 700; font-size: 11.5pt; text-transform: uppercase; letter-spacing: .6px; break-after: avoid; page-break-after: avoid; }
.doc .exercicio { border: 1px solid #ddd; border-radius: 6px; margin: 6pt 0; overflow: hidden; }
.doc .exercicio .cab { display: flex; justify-content: space-between; align-items: center; padding: 5pt 8pt; background: #fafafa; border-bottom: 1px solid #ddd; }
.doc .exercicio table { margin: 0; }
.doc .exercicio th { background: #fff; color: #666; border-bottom: 1px solid #ddd; }
.doc .carga { color: ${marca}; font-weight: 700; }
.doc .obs { display: inline-block; border-left: 3px solid #d4a017; padding-left: 5pt; font-style: italic; }
`;
  return { titulo: `Cargas - ${d.aluno}`, css, corpo };
}
