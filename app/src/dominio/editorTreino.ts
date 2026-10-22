import type {
  Configuracao,
  ConteudoTreino,
  ExercicioPlano,
  FaixaPercentual,
  Intensidade,
  ModoIntensidade,
  PapelDaSerie,
  Serie,
  Sessao,
  Tecnica,
  TipoDeTecnica,
  TipoSessao,
} from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { somaDosBlocos } from './blocos';
import { intensidadeInicial, padraoDaTecnica, percentuaisDaRegra, repeticoesDoTipo, tipoDaMetodologia, tipoTrabalho } from './metodologia';
import { novoUid } from './uid';

/**
 * Operações do editor de treino. Todas puras (devolvem cópia), para o "Desfazer" e os testes. Nenhuma inventa carga
 * nem repetição: o que a série nova traz vem só da metodologia da consultoria (repetições, intensidade e regra de
 * percentuais do tipo; padrão da técnica), e depois quem manda é o que está gravado na série.
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
  { valor: 'ACIMA_DA_ANTERIOR', rotulo: 'Acima da anterior' },
  { valor: 'MESMA_CARGA', rotulo: 'Mesma carga da série de trabalho' },
  { valor: 'RPE', rotulo: 'RPE' },
  { valor: 'NENHUMA', rotulo: 'Sem intensidade' },
];

/**
 * As opções de intensidade com o "% de quê" escrito pelo nome da série de trabalho da metodologia ("% da WS", "Mesma
 * carga da WS"): o percentual sempre diz a base, para deixar a referência explícita.
 */
export function modosDeIntensidade(config: Configuracao | null | undefined, papel?: PapelDaSerie | null): { valor: ModoIntensidade; rotulo: string }[] {
  const base = tipoTrabalho(config);
  const preferidos: Partial<Record<PapelDaSerie, ModoIntensidade[]>> = {
    AQUECIMENTO: ['NENHUMA', 'PERCENTUAL_WS', 'CARGA_TRABALHO', 'RPE'],
    PREPARACAO: ['PERCENTUAL_WS', 'NENHUMA', 'RPE', 'CARGA_TRABALHO'],
    TRABALHO: ['CARGA_TRABALHO', 'ACIMA_DA_ANTERIOR', 'MESMA_CARGA', 'RPE', 'NENHUMA'],
    POS_TRABALHO: ['PERCENTUAL_WS', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR', 'CARGA_TRABALHO', 'RPE', 'NENHUMA'],
  };
  const ordem = papel ? preferidos[papel] : undefined;
  // O papel prioriza as opções, sem proibir um modo que a API aceita nesse tipo.
  const opcoes = ordem ? [...ordem.map((valor) => MODOS.find((m) => m.valor === valor)!), ...MODOS.filter((m) => !ordem.includes(m.valor))] : MODOS;
  return opcoes.map((m) => {
    if (!base) return { ...m };
    if (m.valor === 'PERCENTUAL_WS') return { ...m, rotulo: `% da ${base}` };
    if (m.valor === 'MESMA_CARGA') return { ...m, rotulo: `Mesma carga da ${base}` };
    return m;
  });
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

/** Limite de séries por exercício, o mesmo do servidor (`ConteudoTreino`, `@Size(max = 30)`): contado no exercício todo. */
export const LIMITE_SERIES = 30;

/** Descanso aceito pelo servidor (`ValidadorTreino`): de 0 a 1 hora, em segundos. */
export const DESCANSO_MAXIMO_SEGUNDOS = 3600;

/** Intensidade só com o modo (os números o treinador preenche); `NENHUMA` é `null`, como o servidor aceita. */
export function intensidadeDoModo(modo: ModoIntensidade): Intensidade | null {
  if (modo === 'NENHUMA') return null;
  return { modo, percentualMin: null, percentualMax: null, rpe: null, rir: null };
}

/** Técnica nova com o padrão da metodologia (pausa, pausas, quedas); o resto o treinador preenche e a publicação cobra o que faltar. */
export function tecnicaVazia(tipo: TipoDeTecnica, padrao?: Tecnica | null): Tecnica {
  return {
    pausaSegundos: null,
    pausaRespiracoes: null,
    pausas: null,
    blocos: null,
    quedas: null,
    reducaoPercentual: null,
    repsPorQueda: null,
    ...(padrao ?? {}),
    tipo,
    ...(padrao?.blocos ? { blocos: [...padrao.blocos] } : {}),
  };
}

/** Cluster: as repetições da série são a soma dos blocos (o servidor confere). Sem blocos, as repetições ficam como estão. */
function comRepsDoCluster(s: Serie): Serie {
  if (s.tecnica?.tipo !== 'CLUSTER') return s;
  const soma = somaDosBlocos(s.tecnica.blocos);
  return soma == null ? s : { ...s, repsMin: soma, repsMax: soma };
}

/**
 * Série nova. `tipo` ausente = o tipo de trabalho da metodologia (sem ela, "Série"); `null` = série só com técnica
 * ("1x8 - Rest pause"), que nasce em "mesma carga da série de trabalho" quando já há uma série de carga de trabalho
 * antes no exercício e, senão, sem intensidade. Tipo da metodologia traz as repetições e a intensidade com que ele
 * nasce (a da modalidade do exercício, se houver variação); o de preparação, a regra de 1 série; tipo fora da
 * metodologia nasce em carga de trabalho. A técnica vem com o padrão da metodologia; cluster com blocos no padrão já
 * tem as repetições somadas.
 */
export function novaSerie(
  config: Configuracao | null | undefined,
  tipo?: string | null,
  modalidade: string | null = null,
  tecnica: TipoDeTecnica | null = null,
  temTrabalhoAntes = false,
): Serie {
  const nome = tipo === undefined ? (tipoTrabalho(config) ?? 'Série') : tipo;
  const daMetodologia = tipoDaMetodologia(config, nome);
  const reps = repeticoesDoTipo(daMetodologia);
  let intensidade: Intensidade | null;
  if (nome === null) {
    intensidade = temTrabalhoAntes ? intensidadeDoModo('MESMA_CARGA') : null;
  } else if (daMetodologia) {
    intensidade = intensidadeInicial(daMetodologia, modalidade);
    const regra = daMetodologia.papel === 'PREPARACAO' ? percentuaisDaRegra(daMetodologia, 1) : null;
    if (regra && (intensidade == null || intensidade.modo === 'PERCENTUAL_WS')) {
      intensidade = { ...(intensidade ?? intensidadeDoModo('PERCENTUAL_WS')!), percentualMin: regra[0].min, percentualMax: regra[0].max };
    }
  } else {
    intensidade = intensidadeDoModo('CARGA_TRABALHO');
  }
  const serie: Serie = {
    uid: novoUid(),
    tipo: nome,
    repsMin: reps?.min ?? null,
    repsMax: reps?.max ?? null,
    intensidade,
    descansoSegundos: null,
    tecnica: tecnica ? tecnicaVazia(tecnica, padraoDaTecnica(config, tecnica)) : null,
  };
  return comRepsDoCluster(serie);
}

/**
 * "Adicionar série" com o tipo (e, se quiser, a técnica) escolhido: entra no fim do exercício. Se o último grupo já é
 * desse tipo e dessa técnica, soma uma série a ele pelo mesmo caminho do "+" (copia a última e a regra de preparação
 * continua valendo); senão nasce um grupo novo. Tipo (para que a série serve) e técnica (como executar) são
 * independentes: um tipo fora de `config.tipos` é aceito (a publicação avisa). No limite de séries do exercício, nada
 * muda. Para pôr o grupo novo antes de outro, o treinador usa ↑ (`moverGrupo`).
 */
export function adicionarSerie(
  series: Serie[],
  config: Configuracao | null | undefined,
  tipo?: string | null,
  tecnica: TipoDeTecnica | null = null,
  modalidade: string | null = null,
): Serie[] {
  if (series.length >= LIMITE_SERIES) return series;
  const temTrabalhoAntes = series.some((s) => s.intensidade?.modo === 'CARGA_TRABALHO');
  const nova = novaSerie(config, tipo, modalidade, tecnica, temTrabalhoAntes);
  const grupos = agrupar(series);
  const ultimo = grupos[grupos.length - 1];
  // Soma ao último grupo só se for o mesmo tipo com a mesma técnica: "1 WS + 1 WS em rest pause" precisa de dois
  // grupos, senão a técnica escolhida depois valeria para as duas.
  if (ultimo && (ultimo.series[0].tipo ?? null) === (nova.tipo ?? null) && (ultimo.series[0].tecnica?.tipo ?? null) === tecnica) {
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

function comPercentuais(series: Serie[], faixas: FaixaPercentual[]): Serie[] {
  return series.map((s, i) => ({
    ...s,
    intensidade: { ...(s.intensidade ?? intensidadeDoModo('PERCENTUAL_WS')!), modo: 'PERCENTUAL_WS', percentualMin: faixas[i].min, percentualMax: faixas[i].max },
  }));
}

function trocarGrupo(series: Serie[], grupo: GrupoDeSeries, novas: Serie[]): Serie[] {
  return [...series.slice(0, grupo.inicio), ...novas, ...series.slice(grupo.inicio + grupo.series.length)];
}

/** A regra de percentuais do tipo (só preparação) para `n` séries, se a série está em "% da série de trabalho". */
function regraDoGrupo(config: Configuracao | null | undefined, primeira: Serie, n: number): FaixaPercentual[] | null {
  if (primeira.intensidade?.modo !== 'PERCENTUAL_WS') return null;
  const tipo = tipoDaMetodologia(config, primeira.tipo);
  return tipo?.papel === 'PREPARACAO' ? percentuaisDaRegra(tipo, n) : null;
}

/**
 * Muda a quantidade de séries de um grupo: acrescenta cópias da última (uids novos) ou tira do fim. Se o grupo é de
 * preparação em % (FS) e a metodologia tem regra para a nova quantidade, os percentuais são preenchidos por ela
 * (3 FS = 50/70/85–90; 2 FS = 70/85–90). Depois cada série pode ser editada.
 */
export function mudarQuantidade(series: Serie[], grupo: GrupoDeSeries, n: number, config: Configuracao | null | undefined): Serie[] {
  if (n < 1 || series.length - grupo.series.length + n > LIMITE_SERIES) return series;
  const ultima = grupo.series[grupo.series.length - 1];
  let novas =
    n <= grupo.series.length
      ? grupo.series.slice(0, n)
      : [...grupo.series, ...Array.from({ length: n - grupo.series.length }, () => serieNormalizada(ultima, novoUid()))];
  const regra = regraDoGrupo(config, ultima, n);
  if (regra) novas = comPercentuais(novas, regra);
  return trocarGrupo(series, grupo, novas);
}

export interface AlteracaoDeGrupo {
  /** Tipo da metodologia (ou fora dela); `null` = série só com técnica. */
  tipo?: string | null;
  repsMin?: number | null;
  repsMax?: number | null;
  modo?: ModoIntensidade;
  /** Valores da intensidade para todas as séries do grupo (RIR, RPE ou uma faixa de % única). */
  intensidade?: Partial<Intensidade>;
  /** Descanso depois de cada série do grupo, em segundos (vazio = sem descanso definido). */
  descansoSegundos?: number | null;
  /** Técnica do grupo (cluster, rest pause ou drop-set); nulo tira. */
  tecnica?: Tecnica | null;
}

/**
 * Aplica a mudança a todas as séries do grupo. Trocar o tipo põe a intensidade e as repetições com que esse tipo
 * nasce na metodologia (preparação com a regra para a quantidade do grupo; tipo fora dela mantém o que estava); tirar
 * o tipo (série só com técnica) põe "mesma carga" se há série de carga de trabalho antes no exercício. Trocar o modo
 * parte do padrão do tipo quando ele é desse modo (Back off de volta a "% da WS" volta aos 85%). Cluster mantém as
 * repetições iguais à soma dos blocos. Tudo continua editável.
 */
export function alterarGrupo(
  series: Serie[],
  grupo: GrupoDeSeries,
  mudanca: AlteracaoDeGrupo,
  config: Configuracao | null | undefined,
  modalidade: string | null = null,
): Serie[] {
  const primeira = grupo.series[0];
  const trocouTipo = mudanca.tipo !== undefined && (mudanca.tipo ?? null) !== (primeira.tipo ?? null);
  const tipoFinal = tipoDaMetodologia(config, trocouTipo ? mudanca.tipo : primeira.tipo);
  let intensidadeDoTipo: Intensidade | null | undefined;
  if (trocouTipo && mudanca.modo === undefined && mudanca.intensidade === undefined) {
    if (mudanca.tipo === null) {
      const temTrabalhoAntes = series.slice(0, grupo.inicio).some((s) => s.intensidade?.modo === 'CARGA_TRABALHO');
      intensidadeDoTipo = temTrabalhoAntes ? intensidadeDoModo('MESMA_CARGA') : null;
    } else if (tipoFinal) {
      intensidadeDoTipo = intensidadeInicial(tipoFinal, modalidade);
    }
  }
  // Trocar o tipo preenche a faixa de repetições que a metodologia define para ele (se a mudança não trouxer outra).
  const repsDoNovoTipo = trocouTipo && mudanca.repsMin === undefined && mudanca.repsMax === undefined ? repeticoesDoTipo(tipoFinal) : null;
  let novas = grupo.series.map((s) => {
    const nova: Serie = { ...s };
    if (mudanca.tipo !== undefined) nova.tipo = mudanca.tipo;
    if (repsDoNovoTipo) {
      nova.repsMin = repsDoNovoTipo.min;
      nova.repsMax = repsDoNovoTipo.max;
    }
    if (mudanca.repsMin !== undefined) nova.repsMin = mudanca.repsMin;
    if (mudanca.repsMax !== undefined) nova.repsMax = mudanca.repsMax;
    if (mudanca.descansoSegundos !== undefined) nova.descansoSegundos = mudanca.descansoSegundos;
    if (mudanca.tecnica !== undefined) nova.tecnica = mudanca.tecnica;
    if (intensidadeDoTipo !== undefined) nova.intensidade = intensidadeDoTipo ? { ...intensidadeDoTipo } : null;
    if (mudanca.modo !== undefined && mudanca.modo !== (s.intensidade?.modo ?? 'NENHUMA')) {
      const padrao = intensidadeInicial(tipoFinal, modalidade);
      const base = padrao?.modo === mudanca.modo ? { ...padrao } : intensidadeDoModo(mudanca.modo);
      const rir = s.intensidade?.rir ?? base?.rir ?? null;
      nova.intensidade = base || rir != null ? { ...(base ?? { modo: 'NENHUMA' }), rir } : null;
    }
    if (mudanca.intensidade) {
      nova.intensidade = { ...(nova.intensidade ?? { modo: 'NENHUMA' }), ...mudanca.intensidade };
    }
    return comRepsDoCluster(nova);
  });
  const modoAntes = primeira.intensidade?.modo ?? 'NENHUMA';
  const virouPercentual = novas[0].intensidade?.modo === 'PERCENTUAL_WS' && (modoAntes !== 'PERCENTUAL_WS' || trocouTipo);
  const regra = virouPercentual ? regraDoGrupo(config, novas[0], novas.length) : null;
  if (regra) novas = comPercentuais(novas, regra);
  return trocarGrupo(series, grupo, novas);
}

/** Faixa de % de uma série só (o grupo expandido): mantém o modo se já é por %, senão vira "% da série de trabalho". */
export function alterarPercentuais(series: Serie[], indice: number, min: number | null, max: number | null): Serie[] {
  return series.map((s, i) => {
    if (i !== indice) return s;
    const base = s.intensidade?.modo === 'PERCENTUAL_WS' || s.intensidade?.modo === 'ACIMA_DA_ANTERIOR' ? s.intensidade : intensidadeDoModo('PERCENTUAL_WS')!;
    return { ...s, intensidade: { ...base, percentualMin: min, percentualMax: max } };
  });
}

export function removerGrupo(series: Serie[], grupo: GrupoDeSeries): Serie[] {
  return trocarGrupo(series, grupo, []);
}

function serieNormalizada(s: Partial<Serie>, uid: string): Serie {
  return {
    uid,
    tipo: s.tipo ?? null,
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    intensidade: s.intensidade ? { ...s.intensidade } : null,
    descansoSegundos: s.descansoSegundos ?? null,
    tecnica: s.tecnica ? { ...s.tecnica, blocos: s.tecnica.blocos ? [...s.tecnica.blocos] : null } : null,
  };
}

/** Séries de uma receita (sem uids) aplicadas no exercício: substituem as atuais, cada uma com uid novo. */
export function seriesDaReceita(conteudo: unknown): Serie[] {
  const lista = (conteudo as { series?: Partial<Serie>[] } | null)?.series ?? [];
  return lista.map((s) => serieNormalizada(s, novoUid()));
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
        series: (e.series ?? []).map((x) => serieNormalizada(x, novoUid())),
      })),
    })),
  };
}

/** Receita de semana: troca as sessões do plano pelas da receita (o objetivo e as orientações ficam). */
export function aplicarReceitaDePlano(atual: ConteudoTreino, receita: unknown): ConteudoTreino {
  const daReceita = comUidsNovos(normalizarTreino(receita));
  return { ...atual, sessoes: daReceita.sessoes, ...(daReceita.metodologia ? { metodologia: daReceita.metodologia } : {}) };
}

/** Garante listas e campos que o editor espera (receita parcial). Campo que o formato não tem mais (`alvoTexto`) cai fora. */
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
        series: (e.series ?? []).map((x) => serieNormalizada(x, x.uid ?? novoUid())),
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
