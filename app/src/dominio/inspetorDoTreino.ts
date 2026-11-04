import type { Configuracao, ExercicioPlano, Serie, Sessao } from '../api/tipos';
import { agrupar, descreverSeries, resumoTecnicasEDescanso, type GrupoDeSeries } from './agrupamento';
import { nomeDoTipo, papelDe } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

/**
 * Regras puras do editor de treino em "lista + inspetor": texto da lista, resumo da sessão por contagem, qual aba do
 * inspetor abrir e que item fica selecionado depois de uma mudança. Nada aqui calcula média, meta nem percentual.
 */

export interface ResumoDaSessaoPorContagem {
  exercicios: number;
  series: number;
  seriesDeTrabalho: number;
  /** Quantas séries de cada tipo, na ordem em que o tipo aparece primeiro; `nome` é o da metodologia (tipo fora dela, o código). */
  porTipo: { codigo: string; nome: string; quantidade: number }[];
  /** Séries de trabalho por grupo muscular (texto da biblioteca, ou "—"); "—" por último, o resto em ordem alfabética. */
  porGrupoMuscular: { grupo: string; seriesDeTrabalho: number }[];
}

const SEM_GRUPO = '—';

/**
 * Linha de resumo do exercício na lista: "3 séries: 1 WS, 2 Back off · Descanso 120 s". As quantidades saem de `agrupar`
 * (uma por grupo de séries iguais, com o nome do tipo da metodologia) e o resto de `resumoTecnicasEDescanso`, o mesmo texto
 * do aluno ("Cluster na série 4 · descanso 90 s"), com a inicial maiúscula. Sem séries: "Sem séries"; cardio sem
 * prescrição: "Sem prescrição"; cardio com séries: `descreverSeries` (um grupo por linha) juntas com " · ".
 */
export function linhaDoExercicio(ex: ExercicioPlano, config: Configuracao | null): string {
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const cardio = ex.modalidade === 'CARDIO';
  if (ex.series.length === 0) return cardio ? 'Sem prescrição' : 'Sem séries';
  if (cardio) return descreverSeries(ex.series, cfg).join(' · ');
  const quantas = `${ex.series.length} ${ex.series.length === 1 ? 'série' : 'séries'}`;
  // Soma por tipo (não por grupo de `agrupar`, que separa por técnica, repetições e carga): "1 WS, 2 Back off", não "1 WS, 1 WS".
  const contagem = new Map<string, number>();
  for (const s of ex.series) {
    const nome = nomeDoTipo(cfg, s.tipo) || 'sem tipo';
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }
  const porGrupo = [...contagem].map(([nome, n]) => `${n} ${nome}`);
  const extra = resumoTecnicasEDescanso(ex.series, cfg);
  const depois = extra ? ` · ${extra.charAt(0).toUpperCase()}${extra.slice(1)}` : '';
  return `${quantas}: ${porGrupo.join(', ')}${depois}`;
}

/**
 * Contagens da sessão. Série de trabalho = tipo com papel `TRABALHO` na metodologia (nulo usa a padrão); cardio e série
 * sem tipo contam em `series`, mas não em `seriesDeTrabalho` nem em `porTipo`. `grupoMuscularDe` devolve o grupo da
 * biblioteca (nulo ou vazio = "—"); grupo sem série de trabalho não aparece.
 */
export function resumoDaSessaoPorContagem(sessao: Sessao, config: Configuracao | null, grupoMuscularDe: (e: ExercicioPlano) => string | null): ResumoDaSessaoPorContagem {
  const cfg = config ?? CONFIGURACAO_PADRAO;
  const porTipo = new Map<string, { codigo: string; nome: string; quantidade: number }>();
  const porGrupo = new Map<string, number>();
  let series = 0;
  let seriesDeTrabalho = 0;
  for (const ex of sessao.exercicios) {
    const cardio = ex.modalidade === 'CARDIO';
    let doExercicio = 0;
    for (const s of ex.series) {
      series++;
      const codigo = s.tipo?.trim();
      if (codigo) {
        const atual = porTipo.get(codigo);
        if (atual) atual.quantidade++;
        else porTipo.set(codigo, { codigo, nome: nomeDoTipo(cfg, codigo), quantidade: 1 });
      }
      if (!cardio && papelDe(cfg, s.tipo) === 'TRABALHO') doExercicio++;
    }
    seriesDeTrabalho += doExercicio;
    if (doExercicio > 0) {
      const grupo = grupoMuscularDe(ex)?.trim() || SEM_GRUPO;
      porGrupo.set(grupo, (porGrupo.get(grupo) ?? 0) + doExercicio);
    }
  }
  const porGrupoMuscular = [...porGrupo]
    .map(([grupo, n]) => ({ grupo, seriesDeTrabalho: n }))
    .sort((a, b) => (a.grupo === SEM_GRUPO ? 1 : b.grupo === SEM_GRUPO ? -1 : a.grupo.localeCompare(b.grupo, 'pt-BR')));
  return { exercicios: sessao.exercicios.length, series, seriesDeTrabalho, porTipo: [...porTipo.values()], porGrupoMuscular };
}

/**
 * Uid da série a que um erro de validação se refere. Aceita o caminho completo (`sessoes[0].exercicios[1].series[2].campo`)
 * e o relativo ao exercício (`series[2].campo`); só o índice da série conta, o do exercício é de quem chama. Nulo se o
 * caminho não aponta para uma série (`series`, `exercicios[1].nome`) ou se o índice não existe.
 */
export function serieDoProblema(exercicio: ExercicioPlano, caminho: string): string | null {
  const m = /(?:^|\.)series\[(\d+)\](?:\.|$)/.exec(caminho);
  return m ? (exercicio.series[Number(m[1])]?.uid ?? null) : null;
}

/** Grupo (de `agrupar`) que contém a série com esse uid; uid nulo ou que não existe mais = o primeiro grupo; sem séries, nulo. */
export function grupoComSerie(series: Serie[], uid: string | null): GrupoDeSeries | null {
  const grupos = agrupar(series);
  return grupos.find((g) => uid !== null && g.series.some((s) => s.uid === uid)) ?? grupos[0] ?? null;
}

/**
 * Uid a guardar como aba aberta depois de uma mudança nas séries. Trocar o tipo, juntar ou partir grupos não fecha a aba
 * (o uid segue existindo). Se a série aberta saiu mas outra do mesmo grupo ficou, vale a primeira que ficou. Se o grupo
 * todo sumiu, passa ao vizinho: o grupo que ocupa o mesmo índice, limitado ao último (devolve o uid da primeira série dele).
 * Sem séries depois, nulo; sem aba aberta (nulo), nulo. Série nova que o chamador quer abrir: ele mesmo passa o uid dela.
 */
export function uidDaAbaAposMudar(antes: Serie[], depois: Serie[], uidAberto: string | null): string | null {
  if (depois.length === 0 || uidAberto === null) return null;
  if (depois.some((s) => s.uid === uidAberto)) return uidAberto;
  const gruposAntes = agrupar(antes);
  const indice = gruposAntes.findIndex((g) => g.series.some((s) => s.uid === uidAberto));
  if (indice >= 0) {
    const sobrevivente = gruposAntes[indice].series.find((s) => depois.some((d) => d.uid === s.uid));
    if (sobrevivente) return sobrevivente.uid;
  }
  const gruposDepois = agrupar(depois);
  return gruposDepois[Math.min(Math.max(indice, 0), gruposDepois.length - 1)].series[0].uid;
}

/**
 * Item selecionado depois de uma mudança na lista: continua o mesmo se ainda existe; se saiu, vai para o vizinho (o que
 * ocupa o mesmo índice, limitado ao último); selecionado nulo ou desconhecido, o primeiro; lista vazia, nulo.
 */
export function proximaSelecao(uidsAntes: string[], uidsDepois: string[], selecionado: string | null): string | null {
  if (uidsDepois.length === 0) return null;
  if (selecionado !== null && uidsDepois.includes(selecionado)) return selecionado;
  const indice = selecionado === null ? -1 : uidsAntes.indexOf(selecionado);
  return indice < 0 ? uidsDepois[0] : uidsDepois[Math.min(indice, uidsDepois.length - 1)];
}
