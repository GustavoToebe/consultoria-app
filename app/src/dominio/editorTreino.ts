import type {
  Configuracao,
  ConteudoTreino,
  ExercicioPlano,
  Intensidade,
  ModoIntensidade,
  Serie,
  Sessao,
  Tecnica,
  TipoSessao,
} from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { novoUid } from './uid';

/**
 * Operações do editor de treino. Todas puras (devolvem cópia), para o "Desfazer" e os testes. Nenhuma inventa carga
 * nem repetição: séries novas nascem sem faixa; os percentuais só vêm da regra de preparação da própria consultoria.
 */

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const TIPOS_SESSAO: { valor: TipoSessao; rotulo: string }[] = [
  { valor: 'TREINO', rotulo: 'Treino' },
  { valor: 'DESCANSO_ATIVO', rotulo: 'Descanso ativo' },
  { valor: 'DESCANSO', rotulo: 'Descanso' },
  { valor: 'ACESSORIOS', rotulo: 'Acessórios' },
];

export const MODOS: { valor: ModoIntensidade; rotulo: string }[] = [
  { valor: 'CARGA_TRABALHO', rotulo: 'Carga de trabalho' },
  { valor: 'PERCENTUAL_WS', rotulo: '% da série de trabalho' },
  { valor: 'RIR', rotulo: 'RIR' },
  { valor: 'RPE', rotulo: 'RPE' },
  { valor: 'LIVRE', rotulo: 'Texto livre' },
  { valor: 'NENHUMA', rotulo: 'Sem intensidade' },
];

/**
 * As opções de intensidade com o "% de quê" escrito pelo nome da série de trabalho da metodologia ("% da WS"): o
 * levantamento de 19/10 pede que o percentual sempre diga a base, para não ser confundido com % do 1RM.
 */
export function modosDeIntensidade(tipoTrabalho: string | null | undefined): { valor: ModoIntensidade; rotulo: string }[] {
  const base = tipoTrabalho?.trim();
  return base ? MODOS.map((m) => (m.valor === 'PERCENTUAL_WS' ? { ...m, rotulo: `% da ${base}` } : m)) : MODOS;
}

export function novaSessao(diaSemana: number | null): Sessao {
  return {
    uid: novoUid(),
    nome: diaSemana ? DIAS_SEMANA[diaSemana - 1] : '',
    diaSemana,
    tipo: 'TREINO',
    frequenciaSemanal: null,
    observacao: null,
    cardio: null,
    exercicios: [],
  };
}

export function novoExercicio(): ExercicioPlano {
  return {
    uid: novoUid(),
    exercicioId: null,
    nome: '',
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
  };
}

/** Faixa de repetições que a metodologia define para o tipo de série, se houver. */
export function repeticoesDoTipo(config: Configuracao | null, tipo: string): { repsMin: number; repsMax: number } | null {
  const r = config?.repeticoes?.[tipo];
  return r && r.min != null && r.max != null ? { repsMin: r.min, repsMax: r.max } : null;
}

/** Limite de séries por exercício, o mesmo do servidor (`ConteudoTreino`, `@Size(max = 30)`): contado no exercício todo. */
export const LIMITE_SERIES = 30;

/** Descanso aceito pelo servidor (`ValidadorTreino`): de 0 a 1 hora, em segundos. */
export const DESCANSO_MAXIMO_SEGUNDOS = 3600;

/**
 * Série nova de um tipo (sem tipo, o de trabalho da consultoria), com a faixa de repetições da metodologia (ou sem, para
 * o treinador preencher). O de preparação nasce em "% da série de trabalho" com a regra de 1 série; os outros, em carga de trabalho.
 */
export function novaSerie(config: Configuracao | null, tipoEscolhido?: string): Serie {
  const tipo = tipoEscolhido ?? config?.tipoTrabalho ?? 'Série';
  const reps = repeticoesDoTipo(config, tipo);
  const preparacao = !!config && tipo === config.tipoPreparacao && tipo !== config.tipoTrabalho;
  const percentual = preparacao ? (percentuaisDaRegra(config, 1)?.[0] ?? null) : null;
  return {
    uid: novoUid(),
    tipo,
    repsMin: reps?.repsMin ?? null,
    repsMax: reps?.repsMax ?? null,
    alvoTexto: null,
    intensidade: preparacao ? { modo: 'PERCENTUAL_WS', percentual } : { modo: 'CARGA_TRABALHO' },
    descansoSegundos: null,
  };
}

/**
 * "Adicionar série" com o tipo (e, se quiser, a técnica) escolhido: entra no fim do exercício. Se o último grupo já é
 * desse tipo e dessa técnica, soma uma série a ele pelo mesmo caminho do "+" (copia a última e a regra de preparação continua valendo); senão nasce um grupo novo.
 * Tipo (para que a série serve, da metodologia) e técnica (como executar) são independentes: um tipo fora de `config.tiposSerie` é aceito (a publicação avisa).
 * No limite de séries do exercício, nada muda. Para pôr o grupo novo antes de outro, o treinador usa ↑ (`moverGrupo`).
 */
export function adicionarSerie(
  series: Serie[],
  config: Configuracao | null,
  tipo?: string,
  tecnica: Tecnica['tipo'] | null = null,
): Serie[] {
  if (series.length >= LIMITE_SERIES) return series;
  const nova = novaSerie(config, tipo);
  if (tecnica) nova.tecnica = tecnicaVazia(tecnica);
  const grupos = agrupar(series);
  const ultimo = grupos[grupos.length - 1];
  // Soma ao último grupo só se for o mesmo tipo com a mesma técnica: "1 WS + 1 WS em cluster" (exemplo da pesquisa de
  // 19/10) precisa de dois grupos, senão a técnica escolhida depois valeria para as duas.
  if (ultimo && ultimo.series[0].tipo === nova.tipo && (ultimo.series[0].tecnica?.tipo ?? null) === tecnica) {
    return mudarQuantidade(series, ultimo, ultimo.series.length + 1, config);
  }
  return [...series, nova];
}

/**
 * Troca um grupo de séries de lugar com o vizinho (↑↓ no editor): o FS criado depois da WS sobe para antes dela. Os
 * uids e o conteúdo de cada série ficam iguais; só a ordem muda.
 */
export function moverGrupo(series: Serie[], indiceDoGrupo: number, delta: -1 | 1): Serie[] {
  const grupos = agrupar(series);
  const reordenados = mover(grupos, indiceDoGrupo, delta);
  if (reordenados === grupos) return series;
  return reordenados.flatMap((g) => g.series);
}

/** Troca um item de lugar com o vizinho (setas ↑↓). Fora dos limites devolve a mesma lista. */
export function mover<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function substituir<T>(lista: T[], indice: number, item: T): T[] {
  return lista.map((x, i) => (i === indice ? item : x));
}

export function remover<T>(lista: T[], indice: number): T[] {
  return lista.filter((_, i) => i !== indice);
}

/**
 * Depois de mover ou remover exercícios: a ligação "junto com o anterior" acompanha o exercício, mas o primeiro da
 * sessão não tem anterior, então perde a marca (o servidor recusaria publicar).
 */
export function ajustarLigacoes(exercicios: ExercicioPlano[]): ExercicioPlano[] {
  const primeiro = exercicios[0];
  if (!primeiro?.juntoComAnterior) return exercicios;
  return [{ ...primeiro, juntoComAnterior: null }, ...exercicios.slice(1)];
}

/** Sobe ou desce um exercício da sessão levando a ligação com ele. */
export function moverExercicio(exercicios: ExercicioPlano[], indice: number, delta: -1 | 1): ExercicioPlano[] {
  const movidos = mover(exercicios, indice, delta);
  return movidos === exercicios ? exercicios : ajustarLigacoes(movidos);
}

/** Remove um exercício da sessão; se o novo primeiro estava ligado ao removido, a ligação sai. */
export function removerExercicio(exercicios: ExercicioPlano[], indice: number): ExercicioPlano[] {
  return ajustarLigacoes(remover(exercicios, indice));
}

/** Percentuais da regra de preparação para `n` séries, se a consultoria tiver regra para esse número. */
export function percentuaisDaRegra(config: Configuracao | null, n: number): number[] | null {
  const regra = config?.regraPreparacao?.[String(n)];
  return regra && regra.length === n ? regra : null;
}

function comPercentuais(series: Serie[], percentuais: number[]): Serie[] {
  return series.map((s, i) => ({ ...s, intensidade: { modo: 'PERCENTUAL_WS', percentual: percentuais[i] } }));
}

function trocarGrupo(series: Serie[], grupo: GrupoDeSeries, novas: Serie[]): Serie[] {
  return [...series.slice(0, grupo.inicio), ...novas, ...series.slice(grupo.inicio + grupo.series.length)];
}

/**
 * Muda a quantidade de séries de um grupo: acrescenta cópias da última (uids novos) ou tira do fim. Se o grupo é de
 * preparação em % (FS) e a consultoria tem regra para a nova quantidade, os percentuais são preenchidos por ela
 * (3 FS = 50/70/85; 2 FS = 70/85). Depois cada série pode ser editada.
 */
export function mudarQuantidade(series: Serie[], grupo: GrupoDeSeries, n: number, config: Configuracao | null): Serie[] {
  if (n < 1 || series.length - grupo.series.length + n > LIMITE_SERIES) return series;
  const ultima = grupo.series[grupo.series.length - 1];
  let novas =
    n <= grupo.series.length
      ? grupo.series.slice(0, n)
      : [...grupo.series, ...Array.from({ length: n - grupo.series.length }, () => ({ ...ultima, uid: novoUid() }))];
  const regra = percentuaisDaRegra(config, n);
  if (regra && ultima.tipo === config?.tipoPreparacao && ultima.intensidade?.modo === 'PERCENTUAL_WS') {
    novas = comPercentuais(novas, regra);
  }
  return trocarGrupo(series, grupo, novas);
}

export interface AlteracaoDeGrupo {
  tipo?: string;
  repsMin?: number | null;
  repsMax?: number | null;
  alvoTexto?: string | null;
  modo?: ModoIntensidade;
  /** Valor da intensidade para todas as séries do grupo (RIR, RPE, texto ou um % único). */
  intensidade?: Partial<Intensidade>;
  /** Descanso depois de cada série do grupo, em segundos (vazio = sem descanso definido). */
  descansoSegundos?: number | null;
  /** Técnica do grupo (cluster, rest pause ou drop-set); nulo tira. */
  tecnica?: Tecnica | null;
}

/** Técnica nova sem números: o treinador preenche (nada é inventado) e a publicação cobra o que faltar. */
export function tecnicaVazia(tipo: Tecnica['tipo']): Tecnica {
  return {
    tipo,
    blocos: null,
    repsPorBloco: null,
    pausaSegundos: null,
    retomadas: null,
    repsPorRetomada: null,
    quedas: null,
    reducaoPercentual: null,
    repsPorQueda: null,
  };
}

function intensidadeDoModo(modo: ModoIntensidade): Intensidade {
  return { modo };
}

/**
 * Aplica a mudança a todas as séries do grupo. Trocar o tipo para o de trabalho (WS) põe "carga de trabalho"; para o
 * de preparação (FS) põe "% da série de trabalho" com a regra da consultoria; e a faixa de repetições do tipo, se a metodologia
 * tiver. Tudo continua editável.
 */
export function alterarGrupo(
  series: Serie[],
  grupo: GrupoDeSeries,
  mudanca: AlteracaoDeGrupo,
  config: Configuracao | null,
): Serie[] {
  let modo = mudanca.modo;
  if (mudanca.tipo !== undefined && modo === undefined && config) {
    if (mudanca.tipo === config.tipoTrabalho) modo = 'CARGA_TRABALHO';
    else if (mudanca.tipo === config.tipoPreparacao) modo = 'PERCENTUAL_WS';
  }
  // Trocar o tipo preenche a faixa de repetições que a metodologia define para ele (se a mudança não trouxer outra).
  const repsDoNovoTipo =
    mudanca.tipo !== undefined && mudanca.repsMin === undefined && mudanca.repsMax === undefined ? repeticoesDoTipo(config, mudanca.tipo) : null;
  let novas = grupo.series.map((s) => {
    const nova: Serie = { ...s };
    if (mudanca.tipo !== undefined) nova.tipo = mudanca.tipo;
    if (repsDoNovoTipo) Object.assign(nova, repsDoNovoTipo);
    if (mudanca.repsMin !== undefined) nova.repsMin = mudanca.repsMin;
    if (mudanca.repsMax !== undefined) nova.repsMax = mudanca.repsMax;
    if (mudanca.alvoTexto !== undefined) nova.alvoTexto = mudanca.alvoTexto || null;
    if (mudanca.descansoSegundos !== undefined) nova.descansoSegundos = mudanca.descansoSegundos;
    if (mudanca.tecnica !== undefined) nova.tecnica = mudanca.tecnica;
    if (modo !== undefined && modo !== (s.intensidade?.modo ?? 'NENHUMA')) nova.intensidade = intensidadeDoModo(modo);
    if (mudanca.intensidade) {
      nova.intensidade = { ...(nova.intensidade ?? { modo: 'NENHUMA' }), ...mudanca.intensidade };
    }
    return nova;
  });
  const virouPercentual = modo === 'PERCENTUAL_WS' && grupo.series[0].intensidade?.modo !== 'PERCENTUAL_WS';
  const regra = percentuaisDaRegra(config, novas.length);
  if (virouPercentual && regra) {
    novas = comPercentuais(novas, regra);
  }
  return trocarGrupo(series, grupo, novas);
}

/** Percentual de uma série só (o grupo expandido). */
export function alterarPercentual(series: Serie[], indice: number, percentual: number | null): Serie[] {
  return series.map((s, i) => (i === indice ? { ...s, intensidade: { modo: 'PERCENTUAL_WS', percentual } } : s));
}

export function removerGrupo(series: Serie[], grupo: GrupoDeSeries): Serie[] {
  return trocarGrupo(series, grupo, []);
}

/** Séries de uma receita (sem uids) aplicadas no exercício: substituem as atuais, cada uma com uid novo. */
export function seriesDaReceita(conteudo: unknown): Serie[] {
  const lista = (conteudo as { series?: Partial<Serie>[] } | null)?.series ?? [];
  return lista.map((s) => ({
    uid: novoUid(),
    tipo: s.tipo ?? '',
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    alvoTexto: s.alvoTexto ?? null,
    intensidade: s.intensidade ?? null,
    descansoSegundos: s.descansoSegundos ?? null,
    tecnica: s.tecnica ?? null,
  }));
}

/** Séries prontas para virar receita (sem uids: eles nascem ao aplicar). */
export function seriesParaReceita(series: Serie[]): { series: Omit<Serie, 'uid'>[] } {
  return { series: series.map(({ uid: _uid, ...resto }) => resto) };
}

/** Cópia profunda com uids novos (receita de semana, cópia de plano). */
export function comUidsNovos(conteudo: ConteudoTreino): ConteudoTreino {
  return {
    ...conteudo,
    sessoes: (conteudo.sessoes ?? []).map((s) => ({
      ...s,
      uid: novoUid(),
      exercicios: (s.exercicios ?? []).map((e) => ({
        ...e,
        uid: novoUid(),
        series: (e.series ?? []).map((x) => ({ ...x, uid: novoUid() })),
      })),
    })),
  };
}

/** Receita de semana: troca as sessões do plano pelas da receita (o objetivo e as orientações ficam). */
export function aplicarReceitaDePlano(atual: ConteudoTreino, receita: unknown): ConteudoTreino {
  const daReceita = comUidsNovos(normalizarTreino(receita));
  return { ...atual, sessoes: daReceita.sessoes, ...(daReceita.metodologia ? { metodologia: daReceita.metodologia } : {}) };
}

/** Garante listas e campos que o editor espera (receita parcial). */
export function normalizarTreino(conteudo: unknown): ConteudoTreino {
  const c = (conteudo ?? {}) as Partial<ConteudoTreino>;
  return {
    ...(c.metodologia ? { metodologia: JSON.parse(JSON.stringify(c.metodologia)) } : {}),
    objetivo: c.objetivo ?? null,
    orientacoes: c.orientacoes ?? null,
    sessoes: (c.sessoes ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      nome: s.nome ?? '',
      diaSemana: s.diaSemana ?? null,
      tipo: s.tipo ?? 'TREINO',
      frequenciaSemanal: s.frequenciaSemanal ?? null,
      observacao: s.observacao ?? null,
      cardio: s.cardio ?? null,
      exercicios: (s.exercicios ?? []).map((e) => ({
        uid: e.uid ?? novoUid(),
        exercicioId: e.exercicioId ?? null,
        nome: e.nome ?? '',
        modalidade: e.modalidade ?? null,
        videoUrl: e.videoUrl ?? null,
        observacao: e.observacao ?? null,
        progressao: e.progressao ?? true,
        unidade: e.unidade === 'nenhuma' ? 'nenhuma' : 'kg',
        cadencia: e.cadencia ?? null,
        isometriaSegundos: e.isometriaSegundos ?? null,
        juntoComAnterior: e.juntoComAnterior ?? null,
        combinacao: e.combinacao ?? null,
        series: (e.series ?? []).map((x) => ({
          uid: x.uid ?? novoUid(),
          tipo: x.tipo ?? '',
          repsMin: x.repsMin ?? null,
          repsMax: x.repsMax ?? null,
          alvoTexto: x.alvoTexto ?? null,
          intensidade: x.intensidade ?? null,
          descansoSegundos: x.descansoSegundos ?? null,
          tecnica: x.tecnica ?? null,
        })),
      })),
    })),
  };
}

/** Unidade sugerida ao escolher da biblioteca: elástico, peso corporal e cardio não têm campo de carga. */
export function unidadeDaModalidade(modalidade: string | null): 'kg' | 'nenhuma' {
  return modalidade === 'ELASTICO' || modalidade === 'PESO_CORPORAL' || modalidade === 'CARDIO' ? 'nenhuma' : 'kg';
}

// ---- Sessão selecionada do editor (uma sessão aparece por vez) ----

/** O que aconteceu e pode mudar qual sessão está aberta no editor. */
export type AcaoDeSelecao =
  /** Sessão removida; `sessoes` é a lista de ANTES da remoção. */
  | { tipo: 'remover'; uid: string }
  /** Conteúdo trocado (desfazer, recarregar, modelo): `sessoes` é a lista de DEPOIS. */
  | { tipo: 'conteudo' }
  /** Validação com erro: abre a primeira sessão (ou exercício dela) com problema. */
  | { tipo: 'erros'; uidsComErro: ReadonlySet<string> };

/**
 * Uid da sessão que fica selecionada depois de uma ação. Remover seleciona a vizinha (a seguinte; sem seguinte, a
 * anterior); trocar o conteúdo mantém a seleção se o uid ainda existir; validar com erro vai para a primeira sessão
 * com problema. Sem sessões, `null`.
 */
export function sessaoSelecionadaDepois(sessoes: Sessao[], selecionada: string | null, acao: AcaoDeSelecao): string | null {
  const manter = () => (sessoes.some((s) => s.uid === selecionada) ? selecionada : (sessoes[0]?.uid ?? null));
  if (acao.tipo === 'remover') {
    const i = sessoes.findIndex((s) => s.uid === acao.uid);
    if (i < 0) return manter();
    if (selecionada !== acao.uid) return manter();
    return (sessoes[i + 1] ?? sessoes[i - 1])?.uid ?? null;
  }
  if (acao.tipo === 'erros') {
    const com = sessoes.find((s) => acao.uidsComErro.has(s.uid) || s.exercicios.some((e) => acao.uidsComErro.has(e.uid)));
    return com ? com.uid : manter();
  }
  return manter();
}

/** Texto do chip da sessão: "Seg · Costas" (dia curto e o que vem depois de " - " no nome). */
export function rotuloDaSessao(s: Sessao, posicao: number): string {
  const nome = s.nome.trim();
  const parte = nome.includes(' - ') ? nome.slice(nome.indexOf(' - ') + 3).trim() : nome;
  const dia = s.diaSemana ? DIAS_CURTOS[s.diaSemana - 1] : null;
  const grupo = parte && parte.toLowerCase() !== (s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1].toLowerCase() : '') ? parte : '';
  if (dia && grupo) return `${dia} · ${grupo}`;
  if (dia) return dia;
  return grupo || `Sessão ${posicao + 1}`;
}

/** Linha de resumo do cabeçalho da sessão: "Segunda · Treino · 5 exercícios". */
export function resumoDaSessao(s: Sessao): string {
  const dia = s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1] : 'Sem dia fixo';
  const tipo = TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo;
  const n = s.exercicios.length;
  return `${dia} · ${tipo} · ${n} ${n === 1 ? 'exercício' : 'exercícios'}`;
}
