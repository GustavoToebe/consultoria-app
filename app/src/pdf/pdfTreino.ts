import type { Configuracao, ConteudoTreino, ExercicioPlano, Marca, Serie, Sessao } from '../api/tipos';
import { agrupar, descreverGrupo } from '../dominio/agrupamento';
import { estruturaDaSerie, linhasDasEtapas, ROTULO_DA_OBSERVACAO_DA_SERIE } from '../dominio/resumoDaSerie';
import { explicacaoDoCatalogo } from '../dominio/catalogoMetodologia';
import { gruposDaSessao } from '../dominio/combinacoes';
import { rotuloDescanso } from '../dominio/descanso';
import { DIAS_SEMANA } from '../dominio/editorTreino';
import { textoExecucao } from '../dominio/execucaoDoExercicio';
import { dataParaTela } from '../dominio/formatos';
import {
  explicacaoDaCombinacao,
  explicacaoDaTecnica,
  explicacaoDoTipo,
  nomeDaCombinacao,
  nomeDaTecnica,
  nomeDoTipo,
  tiposETecnicasUsados,
} from '../dominio/metodologia';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { rotuloDoDia, rotuloDoTipo, sessoesDaSemana } from '../dominio/semana';
import { descansoSoDoGrupo, detalheDoBloco } from '../dominio/textoDoGrupo';
import { cabecalhoDoPdf, cssBase, esc, escLinhas, link, type Documento } from './html';

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
  instrucoesTreino: string | null;
  rodapePdf: string | null;
  emitidoEm: Date;
}

/** Descanso das séries do grupo: "1 min" ou "1 min a 1 min 30 s"; vazio quando nenhuma tem. */
function textoDoDescansoDasSeries(series: readonly Serie[]): string {
  const valores = series.map((s) => s.descansoSegundos ?? 0).filter((d) => d > 0);
  if (!valores.length) return '';
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  return menor === maior ? rotuloDescanso(menor) : `${rotuloDescanso(menor)} a ${rotuloDescanso(maior)}`;
}

export interface SerieDoPdf {
  /** Linha do grupo, na língua da planilha: "3x3 - FS 50/70/85 a 90% da WS", "1x16 - WS com Cluster · 1 RIR". */
  linha: string;
  /** Embaixo dela: as etapas (blocos e pausa, ou etapa inicial e retomadas) e o descanso depois da série. */
  detalhes: string[];
}

/**
 * Coluna "Séries": um bloco por grupo de séries iguais. A linha tem o nome do tipo da metodologia (nunca o código), as
 * repetições ("AMRAP" quando pedido), a carga em faixa de percentual, o esforço (RIR/RPE, "até a falha" para RIR 0), a
 * técnica e a prescrição de cardio. Cluster e Rest-pause levam as etapas numa linha própria, e o descanso
 * depois da série fica separado da pausa entre etapas. A observação da série (`alvoExtra`) vai numa linha própria,
 * "Observação desta série: …", com o mesmo nome do editor e da prévia (reunião de 30/10). `comDescanso` falso nos membros de grupo cujo descanso é o do grupo
 * (a linha do grupo o diz).
 */
export function seriesDoPdf(e: Pick<ExercicioPlano, 'series'>, config: Configuracao, comDescanso = true): SerieDoPdf[] {
  return agrupar(e.series).map((g) => {
    const primeira = g.series[0];
    const detalhes: string[] = [];
    if (!primeira.cardio && (primeira.tecnica?.tipo === 'CLUSTER' || primeira.tecnica?.tipo === 'REST_PAUSE')) {
      detalhes.push(estruturaDaSerie(primeira, config), ...linhasDasEtapas(primeira, config));
    }
    const descanso = comDescanso ? textoDoDescansoDasSeries(g.series) : '';
    if (descanso) detalhes.push(`Descanso depois da série: ${descanso}`);
    const observacao = primeira.alvoExtra?.trim();
    if (observacao) detalhes.push(`${ROTULO_DA_OBSERVACAO_DA_SERIE}: ${observacao}`);
    return { linha: descreverGrupo(g, config, e.series, { etapasAParte: true, semObservacao: true }), detalhes };
  });
}

/** Coluna "Obs": só a observação do exercício (a técnica fica nas séries e no glossário, sem repetir). */
export function obsDoExercicio(e: ExercicioPlano): string[] {
  return [e.observacao, e.progressao ? null : 'Foco em controle, não em carga'].filter((x): x is string => !!x);
}

const TEXTO_RIR =
  'Repetições na reserva: quantas repetições você ainda conseguiria fazer ao terminar a série. 2 RIR = parar com 2 repetições sobrando.\nRIR 0 = até a falha: faça até não conseguir mais repetir com boa técnica.';
const TEXTO_RPE = 'Percepção de esforço, de 1 a 10 (de meio em meio ponto). 10 é o esforço máximo, sem nenhuma repetição sobrando.';

/** O treino usa RIR e/ou RPE em alguma série? Só então o glossário os explica. */
function esforcosUsados(conteudo: Pick<ConteudoTreino, 'sessoes'>): { rir: boolean; rpe: boolean } {
  let rir = false;
  let rpe = false;
  for (const s of conteudo.sessoes ?? []) {
    for (const e of s.exercicios ?? []) {
      for (const x of e.series ?? []) {
        if (x.esforco?.rir != null) rir = true;
        if (x.esforco?.rpe != null) rpe = true;
      }
    }
  }
  return { rir, rpe };
}

/**
 * "Como ler este treino": só o que o treino usa, na ordem tipos, técnicas, combinações de exercícios e, quando aparecem,
 * RIR (com "RIR 0 = até a falha") e RPE. Nome e explicação vêm da metodologia da versão; sem explicação, o item
 * não entra.
 */
export function blocoGlossario(conteudo: ConteudoTreino, config: Configuracao): string {
  const usados = tiposETecnicasUsados(conteudo);
  const esforcos = esforcosUsados(conteudo);
  const itens: { nome: string; texto: string | null }[] = [
    ...usados.tipos.map((codigo) => ({ nome: nomeDoTipo(config, codigo), texto: explicacaoDoTipo(config, codigo) })),
    ...usados.tecnicas.map((t) => ({ nome: nomeDaTecnica(config, t), texto: explicacaoDaTecnica(config, t) || explicacaoDoCatalogo(t) })),
    ...usados.combinacoes.map((c) => ({ nome: nomeDaCombinacao(config, c), texto: explicacaoDaCombinacao(config, c) })),
    ...(esforcos.rir ? [{ nome: 'RIR', texto: TEXTO_RIR }] : []),
    ...(esforcos.rpe ? [{ nome: 'RPE', texto: TEXTO_RPE }] : []),
  ].filter((x) => x.texto);
  if (!itens.length) return '';
  const linhas = itens.map((x) => `<tr><td class="termo">${esc(x.nome)}</td><td>${escLinhas(x.texto!)}</td></tr>`).join('');
  return `<section><h2>Como ler este treino</h2><table class="instrucoes"><tbody>${linhas}</tbody></table></section>`;
}

function celulaDeSeries(e: ExercicioPlano, config: Configuracao, comDescanso: boolean): string {
  const grupos = seriesDoPdf(e, config, comDescanso);
  if (!grupos.length) return '—';
  return grupos.map((g) => `<div class="serie">${esc(g.linha)}${g.detalhes.map((d) => `<div class="etapas">${esc(d)}</div>`).join('')}</div>`).join('');
}

function linhaExercicio(e: ExercicioPlano, config: Configuracao, comDescanso: boolean): string {
  const obs = obsDoExercicio(e);
  const execucao = textoExecucao(e);
  return `<tr>
<td><strong>${esc(e.nome)}</strong>${execucao ? `<div class="suave">${esc(execucao)}</div>` : ''}</td>
<td>${celulaDeSeries(e, config, comDescanso)}</td>
<td>${obs.map(esc).join('<br>') || '—'}</td>
<td>${link(e.videoUrl, 'Vídeo')}</td>
</tr>`;
}

/**
 * Exercícios da sessão. Os feitos juntos (superset, circuito, pré e pós-exaustão...) ganham uma linha com o nome da
 * combinação, a ordem, as voltas e o descanso depois do grupo; nos grupos com descanso depois da volta, a coluna das séries
 * não repete o descanso por série.
 */
function linhasDosExercicios(s: Sessao, config: Configuracao): string {
  return gruposDaSessao(s, config)
    .map((g) => {
      const comDescanso = !(g.nome && g.grupo && descansoSoDoGrupo(g.grupo));
      const linhas = g.exercicios.map((e) => linhaExercicio(e, config, comDescanso)).join('');
      if (!g.nome) return linhas;
      return `<tr><td colspan="4"><strong>${esc(g.nome)}</strong> · ${esc(detalheDoBloco(g))}</td></tr>${linhas}`;
    })
    .join('');
}

function blocoSessao(s: Sessao, config: Configuracao): string {
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
<table><thead><tr><th style="width:34%">Exercício</th><th style="width:26%">Séries</th><th>Obs</th><th style="width:9%">Vídeo</th></tr></thead>
<tbody>${linhasDosExercicios(s, config)}</tbody></table>
</section>`;
}

const CSS_INSTRUCOES = `
.doc .serie { border-left: 2pt solid #c8c8c8; padding: 1pt 0 1pt 5pt; margin: 0 0 4pt; break-inside: avoid; }
.doc .serie:last-child { margin-bottom: 0; }
.doc .serie .etapas { color: #444; font-size: 0.92em; }
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

/** PDF do treino no formato do Saraiva: semana, sessões com tabela e, no fim, o glossário e as instruções. */
export function documentoTreino(d: DadosPdfTreino): Documento {
  const metodologia = d.conteudo.metodologia?.configuracao;
  if (metodologia) d = { ...d, instrucoesTreino: metodologia.instrucoesTreino, rodapePdf: metodologia.rodapePdf };
  const c = d.conteudo;
  const periodo = d.inicio || d.fim ? `${dataParaTela(d.inicio) || '—'} a ${dataParaTela(d.fim) || '—'}` : null;
  const semana = DIAS_SEMANA.map((dia, i) => {
    const nomes = c.sessoes.filter((s) => s.diaSemana === i + 1).map((s) => esc(s.nome));
    return `<tr><td><strong>${dia}</strong></td><td>${nomes.join('<br>') || '—'}</td></tr>`;
  }).join('');
  const semDia = c.sessoes.filter((s) => !s.diaSemana);
  const corpo = [
    cabecalhoDoPdf({
      marca: d.marca,
      logoDataUri: d.logoDataUri,
      documento: 'Treino',
      titulo: d.titulo,
      versao: d.versao,
      aluno: d.aluno,
      periodo,
      emitidoEm: d.emitidoEm,
    }),
    c.objetivo ? `<div><strong>Objetivo:</strong> ${esc(c.objetivo)}</div>` : '',
    c.orientacoes ? `<div class="suave">${escLinhas(c.orientacoes)}</div>` : '',
    `<div class="bloco"><h2>Semana</h2><table><thead><tr><th style="width:25%">Dia</th><th>Treino</th></tr></thead><tbody>${semana}${semDia
      .map((s) => `<tr><td><strong>${esc(rotuloDoDia(s))}</strong></td><td>${esc(s.nome)}</td></tr>`)
      .join('')}</tbody></table></div>`,
    ...sessoesDaSemana(c).map((s) => blocoSessao(s, metodologia ?? CONFIGURACAO_PADRAO)),
    blocoGlossario(c, metodologia ?? CONFIGURACAO_PADRAO),
    d.instrucoesTreino?.trim() ? blocoInstrucoes(d.instrucoesTreino) : '',
    d.rodapePdf?.trim() ? `<div class="rodape">${esc(d.rodapePdf)}</div>` : '',
  ].join('\n');
  return { titulo: `Treino - ${d.aluno} - ${d.titulo}`, css: cssBase(d.marca.corPrimaria) + CSS_INSTRUCOES, corpo };
}
