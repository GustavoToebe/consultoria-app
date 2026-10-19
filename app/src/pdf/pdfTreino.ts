import type { ConteudoTreino, ExercicioPlano, Marca, Sessao } from '../api/tipos';
import { agrupar, faixa, textoIntensidade, textoTecnica, type GrupoDeSeries } from '../dominio/agrupamento';
import { gruposDaSessao } from '../dominio/combinacoes';
import { DIAS_SEMANA } from '../dominio/editorTreino';
import { textoExecucao } from '../dominio/execucaoDoExercicio';
import { dataHoraParaTela, dataParaTela, numeroParaTela } from '../dominio/formatos';
import { rotuloDoDia, rotuloDoTipo, sessoesDaSemana } from '../dominio/semana';
import { cssBase, esc, escLinhas, link, topo, type Documento } from './html';

export interface DadosPdfTreino {
  marca: Marca;
  logoDataUri: string | null;
  aluno: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  /** Número da versão publicada; `null` = rascunho (sai marcado). */
  versao: number | null;
  conteudo: ConteudoTreino;
  tipoTrabalho: string;
  instrucoesTreino: string | null;
  rodapePdf: string | null;
  emitidoEm: Date;
}

/** Coluna "Séries x reps": "3x3 - FS", "1x3 a 6 - WS", "1x - Cardio (50 min)". */
export function linhaDoGrupo(g: GrupoDeSeries): string {
  const s = g.series[0];
  const tecnica = textoTecnica(s.tecnica);
  return `${g.series.length}x${faixa(s)} - ${s.tipo || 'Série'}${s.alvoTexto ? ` (${s.alvoTexto})` : ''}${tecnica ? ` · ${tecnica}` : ''}`;
}

/** Intensidade escrita na coluna OBS: "Back off - 85% da WS", "FS - 50/70/85% da WS", "Série - 2 RIR". */
export function obsDoGrupo(g: GrupoDeSeries, tipoTrabalho: string): string | null {
  const s = g.series[0];
  const modo = s.intensidade?.modo ?? 'NENHUMA';
  if (modo === 'PERCENTUAL_WS') {
    const valores = [...new Set(g.series.map((x) => (x.intensidade?.percentual == null ? '?' : numeroParaTela(x.intensidade.percentual))))];
    const lista = g.series.length > 1 && valores.length > 1 ? g.series.map((x) => numeroParaTela(x.intensidade?.percentual ?? null)).join('/') : valores[0];
    return `${s.tipo} - ${lista}% da ${tipoTrabalho}`;
  }
  const t = textoIntensidade(s.intensidade);
  return t ? `${s.tipo} - ${t}` : null;
}

function linhaExercicio(e: ExercicioPlano, tipoTrabalho: string): string {
  const grupos = agrupar(e.series);
  const obs = [e.observacao, ...grupos.map((g) => obsDoGrupo(g, tipoTrabalho)), e.progressao ? null : 'Foco em controle, não em carga']
    .filter((x): x is string => !!x);
  const execucao = textoExecucao(e);
  return `<tr>
<td><strong>${esc(e.nome)}</strong>${execucao ? `<div class="suave">${esc(execucao)}</div>` : ''}</td>
<td>${grupos.map((g) => esc(linhaDoGrupo(g))).join('<br>') || '—'}</td>
<td>${obs.map(esc).join('<br>') || '—'}</td>
<td>${link(e.videoUrl, 'Vídeo')}</td>
</tr>`;
}

/** Exercícios da sessão; os feitos juntos (bi-set, tri-set, circuito) ganham uma linha com o nome do grupo antes. */
function linhasDosExercicios(s: Sessao, tipoTrabalho: string): string {
  return gruposDaSessao(s.exercicios)
    .map((g) => {
      const linhas = g.exercicios.map((e) => linhaExercicio(e, tipoTrabalho)).join('');
      if (!g.nome) return linhas;
      return `<tr><td colspan="4"><strong>${esc(g.nome)}</strong> · ${g.exercicios.length} exercícios em sequência, sem descanso entre eles</td></tr>${linhas}`;
    })
    .join('');
}

function blocoSessao(s: Sessao, tipoTrabalho: string): string {
  // Sem dia fixo: acrescenta "2x na semana" só se o nome ainda não diz.
  const dia = rotuloDoDia(s);
  const titulo = s.diaSemana || s.nome.toLowerCase().includes(dia.toLowerCase()) ? s.nome : `${s.nome} (${dia})`;
  const extras = [s.cardio ? `<div><strong>Cardio:</strong> ${esc(s.cardio)}</div>` : '', s.observacao ? `<div class="suave">${escLinhas(s.observacao)}</div>` : ''].join('');
  if (!s.exercicios.length) {
    return `<div class="bloco"><h2>${esc(titulo)}</h2><div class="suave">${esc(rotuloDoTipo(s))}</div>${extras}</div>`;
  }
  // Título preso à tabela: sessão curta vai inteira para a página seguinte em vez de deixar o título sozinho.
  return `<section class="${s.exercicios.length <= 8 ? 'bloco' : ''}">
<h2>${esc(titulo)}</h2>${extras}
<table><thead><tr><th style="width:34%">Exercício</th><th style="width:24%">Séries x reps</th><th>Obs</th><th style="width:9%">Vídeo</th></tr></thead>
<tbody>${linhasDosExercicios(s, tipoTrabalho)}</tbody></table>
</section>`;
}

const CSS_INSTRUCOES = `
.doc table.instrucoes td { border-bottom: 1px solid #e3e3e3; padding: 5pt 6pt; }
.doc table.instrucoes td.termo { width: 26%; font-weight: 700; white-space: nowrap; }
.doc table.instrucoes .sub { color: #333; padding-left: 8pt; }
`;

/**
 * Instruções do treinador em bloco organizado: cada linha "Termo: explicação" vira uma linha de tabela (termo à
 * esquerda, texto à direita); linhas seguintes sem "Termo:" (cálculo de FS, exemplos) ficam sob o termo anterior;
 * linha solta sem termo vira nota de largura inteira. Tudo passa por `esc()`.
 */
export function blocoInstrucoes(texto: string): string {
  const itens: { termo: string | null; linhas: string[] }[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = /^([^:]{2,60}):\s*(.*)$/.exec(linha);
    if (m) itens.push({ termo: m[1], linhas: m[2] ? [m[2]] : [] });
    else if (itens.length && itens[itens.length - 1].termo) itens[itens.length - 1].linhas.push(linha);
    else itens.push({ termo: null, linhas: [linha] });
  }
  if (!itens.length) return '';
  const linhas = itens
    .map((i) =>
      i.termo
        ? `<tr><td class="termo">${esc(i.termo)}</td><td>${i.linhas.map((l, n) => (n === 0 ? esc(l) : `<div class="sub">${esc(l)}</div>`)).join('')}</td></tr>`
        : `<tr><td colspan="2" class="suave">${esc(i.linhas.join(' '))}</td></tr>`,
    )
    .join('');
  return `<section><h2>Instruções</h2><table class="instrucoes"><tbody>${linhas}</tbody></table></section>`;
}

/** PDF do treino no formato do Saraiva: semana, sessões com tabela e, no fim, as instruções. */
export function documentoTreino(d: DadosPdfTreino): Documento {
  const metodologia = d.conteudo.metodologia?.configuracao;
  if (metodologia) d = { ...d, tipoTrabalho: metodologia.tipoTrabalho, instrucoesTreino: metodologia.instrucoesTreino, rodapePdf: metodologia.rodapePdf };
  const c = d.conteudo;
  const periodo = d.inicio || d.fim ? `${dataParaTela(d.inicio) || '—'} a ${dataParaTela(d.fim) || '—'}` : null;
  const semana = DIAS_SEMANA.map((dia, i) => {
    const nomes = c.sessoes.filter((s) => s.diaSemana === i + 1).map((s) => esc(s.nome));
    return `<tr><td><strong>${dia}</strong></td><td>${nomes.join('<br>') || '—'}</td></tr>`;
  }).join('');
  const semDia = c.sessoes.filter((s) => !s.diaSemana);
  const corpo = [
    topo(d.marca, d.logoDataUri, [
      `Aluno: ${d.aluno}`,
      `${d.titulo}${d.versao ? ` (v${d.versao})` : ' (RASCUNHO, não publicado)'}`,
      ...(periodo ? [`Período: ${periodo}`] : []),
      `Emitido em ${dataHoraParaTela(d.emitidoEm.toISOString())}`,
    ]),
    c.objetivo ? `<div><strong>Objetivo:</strong> ${esc(c.objetivo)}</div>` : '',
    c.orientacoes ? `<div class="suave">${escLinhas(c.orientacoes)}</div>` : '',
    `<div class="bloco"><h2>Semana</h2><table><thead><tr><th style="width:25%">Dia</th><th>Treino</th></tr></thead><tbody>${semana}${semDia
      .map((s) => `<tr><td><strong>${esc(rotuloDoDia(s))}</strong></td><td>${esc(s.nome)}</td></tr>`)
      .join('')}</tbody></table></div>`,
    ...sessoesDaSemana(c).map((s) => blocoSessao(s, d.tipoTrabalho)),
    d.instrucoesTreino?.trim() ? blocoInstrucoes(d.instrucoesTreino) : '',
    d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : '',
  ].join('\n');
  return { titulo: `Treino - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria) + CSS_INSTRUCOES, corpo };
}
