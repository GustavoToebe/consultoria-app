import type {
  Carga,
  CombinacaoDaMetodologia,
  Configuracao,
  ConteudoTreino,
  Esforco,
  FaixaPercentual,
  FaixaRepeticoes,
  PapelDaSerie,
  Tecnica,
  TecnicaDaMetodologia,
  TecnicaDeGrupo,
  TipoDeSerie,
  TipoDeTecnica,
} from '../api/tipos';

/**
 * Leitura da metodologia para o editor, o aluno e o PDF. A metodologia só preenche padrões no editor (ao criar a série
 * ou trocar o tipo); depois, quem manda são os números gravados na série. Daqui saem os nomes ("% da WS", "Muscle
 * Round") e as explicações que o aluno lê. `Serie.tipo` é o CÓDIGO do tipo: toda busca do tipo da série é por código, e o
 * nome exibido sai de `nomeDoTipo` (que cai no código se o tipo não está na metodologia).
 */

export const PAPEIS: { valor: PapelDaSerie; rotulo: string }[] = [
  { valor: 'AQUECIMENTO', rotulo: 'Aquecimento' },
  { valor: 'PREPARACAO', rotulo: 'Preparação' },
  { valor: 'TRABALHO', rotulo: 'Trabalho' },
  { valor: 'POS_TRABALHO', rotulo: 'Pós-trabalho' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

export function rotuloDoPapel(papel: PapelDaSerie): string {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel;
}

/** As seis técnicas da série, na ordem da API (`ConteudoTreino.TECNICAS`). */
export const TIPOS_DE_TECNICA: readonly TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET', 'MYO_REPS', 'PARTIAL_REPS', 'FORCED_REPS'];

/** Nome fixo de cada técnica: vale onde não há metodologia à mão (`nomeDaTecnica`). */
export const NOME_FIXO_DA_TECNICA: Record<TipoDeTecnica, string> = {
  REST_PAUSE: 'Rest pause',
  CLUSTER: 'Cluster',
  DROP_SET: 'Drop-set',
  MYO_REPS: 'Myo-reps',
  PARTIAL_REPS: 'Partial reps',
  FORCED_REPS: 'Forced reps',
};

/** As sete técnicas de grupo de exercícios, na ordem da API (`ConteudoTreino.TECNICAS_DE_GRUPO`). */
export const TIPOS_DE_GRUPO: readonly TecnicaDeGrupo[] = ['SUPERSET', 'AGONISTA_ANTAGONISTA', 'TRI_SET', 'GIANT_SET', 'CIRCUITO', 'PRE_EXAUSTAO', 'POS_EXAUSTAO'];

/** Nome fixo de cada combinação de exercícios: vale onde não há metodologia à mão (`nomeDaCombinacao`). */
export const NOME_FIXO_DA_COMBINACAO: Record<TecnicaDeGrupo, string> = {
  SUPERSET: 'Superset',
  AGONISTA_ANTAGONISTA: 'Agonista-antagonista',
  TRI_SET: 'Tri-set',
  GIANT_SET: 'Giant set',
  CIRCUITO: 'Circuito',
  PRE_EXAUSTAO: 'Pré-exaustão',
  POS_EXAUSTAO: 'Pós-exaustão',
};

/** Região das repetições parciais, para o seletor. */
export const REGIOES_DAS_PARCIAIS: { valor: 'ALONGADA' | 'ENCURTADA' | 'LIVRE'; rotulo: string }[] = [
  { valor: 'ALONGADA', rotulo: 'Alongada' },
  { valor: 'ENCURTADA', rotulo: 'Encurtada' },
  { valor: 'LIVRE', rotulo: 'Livre' },
];

/** Cópia da carga, para a série não compartilhar o objeto com a metodologia. */
export function copiarCarga(c: Carga | null | undefined): Carga | null {
  return c ? { ...c } : null;
}

/** Cópia do esforço (vazio vira `null`: o servidor trata esforço sem RIR nem RPE como ausente). */
export function copiarEsforco(e: Esforco | null | undefined): Esforco | null {
  return e && (e.rir != null || e.rpe != null) ? { ...e } : null;
}

/**
 * Nome do primeiro tipo de trabalho: dá nome ao "% da WS" (é só um RÓTULO de exibição, nunca se compara com
 * `Serie.tipo`, que é código). `null` sem metodologia ou sem tipo de trabalho.
 */
export function tipoTrabalho(config: Configuracao | null | undefined): string | null {
  const t = config?.tipos?.find((x) => x.papel === 'TRABALHO');
  return t?.nome.trim() || null;
}

/** Código do primeiro tipo de trabalho (o que a série de trabalho grava em `tipo`), como `codigoTrabalho()` da API. */
export function codigoTrabalho(config: Configuracao | null | undefined): string | null {
  const t = config?.tipos?.find((x) => x.papel === 'TRABALHO' && x.codigo);
  return t?.codigo.trim() || null;
}

/** Nome da série de trabalho para os textos ("% da WS"); sem ele, "série de trabalho". */
export function nomeDaSerieDeTrabalho(config: Configuracao | null | undefined): string {
  return tipoTrabalho(config) ?? 'série de trabalho';
}

/** O tipo da metodologia com esse código (sem espaços nas pontas, como `ConfiguracaoConsultoria.tipoPorCodigo`). */
export function tipoPorCodigo(config: Configuracao | null | undefined, codigo: string | null | undefined): TipoDeSerie | null {
  if (!config || codigo == null) return null;
  const alvo = codigo.trim();
  return config.tipos?.find((t) => t.codigo?.trim() === alvo) ?? null;
}

/**
 * Nome exibido do tipo da série. Nunca mostra o código cru quando o tipo existe na metodologia; tipo fora dela cai no
 * código (como a API no histórico); sem tipo (cardio), vazio.
 */
export function nomeDoTipo(config: Configuracao | null | undefined, codigo: string | null | undefined): string {
  if (codigo == null || !codigo.trim()) return '';
  return tipoPorCodigo(config, codigo)?.nome.trim() || codigo.trim();
}

export function papelDe(config: Configuracao | null | undefined, codigo: string | null | undefined): PapelDaSerie | null {
  return tipoPorCodigo(config, codigo)?.papel ?? null;
}

/**
 * Carga com que uma série desse tipo nasce: a da modalidade do exercício (só peso livre e máquina têm variação) ou a
 * padrão do tipo. A variação por modalidade troca carga e esforço juntos (como a API: "troca a sugestão"). Cópia.
 */
export function cargaInicial(tipo: TipoDeSerie | null | undefined, modalidade: string | null | undefined): Carga | null {
  const porModalidade = modalidade === 'LIVRE' || modalidade === 'MAQUINA' ? tipo?.porModalidade?.[modalidade] : undefined;
  return copiarCarga(porModalidade ? porModalidade.carga : tipo?.cargaPadrao);
}

/** Esforço com que uma série desse tipo nasce (a variação por modalidade vale, inclusive quando não traz esforço). Cópia. */
export function esforcoInicial(tipo: TipoDeSerie | null | undefined, modalidade: string | null | undefined): Esforco | null {
  const porModalidade = modalidade === 'LIVRE' || modalidade === 'MAQUINA' ? tipo?.porModalidade?.[modalidade] : undefined;
  return copiarEsforco(porModalidade ? porModalidade.esforco : tipo?.esforcoPadrao);
}

/** Faixas da regra de percentuais para `n` séries, se o tipo (de preparação) tiver regra para esse número. */
export function percentuaisDaRegra(tipo: TipoDeSerie | null | undefined, n: number): FaixaPercentual[] | null {
  const regra = tipo?.regraPercentuais?.[String(n)];
  return regra && regra.length === n ? regra : null;
}

/** Faixa de repetições que a metodologia define para o tipo, se houver. */
export function repeticoesDoTipo(tipo: TipoDeSerie | null | undefined): FaixaRepeticoes | null {
  const r = tipo?.repeticoes;
  return r && r.min != null && r.max != null ? { min: r.min, max: r.max } : null;
}

/** Explicação do tipo para o aluno (vazia = nenhuma). */
export function explicacaoDoTipo(config: Configuracao | null | undefined, codigo: string | null | undefined): string | null {
  return tipoPorCodigo(config, codigo)?.explicacao?.trim() || null;
}

export function tecnicaDaMetodologia(config: Configuracao | null | undefined, tipo: TipoDeTecnica): TecnicaDaMetodologia | null {
  return config?.tecnicas?.find((t) => t.tipo === tipo) ?? null;
}

/** Nome exibido da técnica ("Muscle Round" para o cluster, se a metodologia disser); sem metodologia, o nome fixo. */
export function nomeDaTecnica(config: Configuracao | null | undefined, tipo: TipoDeTecnica): string {
  return tecnicaDaMetodologia(config, tipo)?.nome.trim() || NOME_FIXO_DA_TECNICA[tipo];
}

export function explicacaoDaTecnica(config: Configuracao | null | undefined, tipo: TipoDeTecnica): string | null {
  return tecnicaDaMetodologia(config, tipo)?.explicacao?.trim() || null;
}

/** Padrão da técnica na metodologia (cópia; os campos sem padrão ficam nulos). */
export function padraoDaTecnica(config: Configuracao | null | undefined, tipo: TipoDeTecnica): Tecnica | null {
  const p = tecnicaDaMetodologia(config, tipo)?.padrao;
  return p ? { ...p, tipo, blocos: p.blocos ? [...p.blocos] : null } : null;
}

export function combinacaoDaMetodologia(config: Configuracao | null | undefined, tipo: TecnicaDeGrupo): CombinacaoDaMetodologia | null {
  return config?.combinacoes?.find((c) => c.tipo === tipo) ?? null;
}

/** Nome exibido da combinação de exercícios ("Super-série" se a metodologia disser); sem metodologia, o nome fixo. */
export function nomeDaCombinacao(config: Configuracao | null | undefined, tipo: TecnicaDeGrupo): string {
  return combinacaoDaMetodologia(config, tipo)?.nome.trim() || NOME_FIXO_DA_COMBINACAO[tipo];
}

export function explicacaoDaCombinacao(config: Configuracao | null | undefined, tipo: TecnicaDeGrupo): string | null {
  return combinacaoDaMetodologia(config, tipo)?.explicacao?.trim() || null;
}

/**
 * O que o treino usa, na ordem em que aparece: os CÓDIGOS dos tipos, as técnicas das séries e as combinações dos grupos
 * (o glossário "Como ler este treino" do PDF). O nome de cada tipo sai de `nomeDoTipo`.
 */
export function tiposETecnicasUsados(conteudo: Pick<ConteudoTreino, 'sessoes'>): { tipos: string[]; tecnicas: TipoDeTecnica[]; combinacoes: TecnicaDeGrupo[] } {
  const tipos = new Set<string>();
  const tecnicas = new Set<TipoDeTecnica>();
  const combinacoes = new Set<TecnicaDeGrupo>();
  for (const sessao of conteudo.sessoes ?? []) {
    for (const exercicio of sessao.exercicios ?? []) {
      for (const serie of exercicio.series ?? []) {
        if (serie.tipo?.trim()) tipos.add(serie.tipo.trim());
        if (serie.tecnica) tecnicas.add(serie.tecnica.tipo);
      }
    }
    const usados = new Set((sessao.exercicios ?? []).map((e) => e.grupoUid).filter((u): u is string => !!u));
    for (const g of sessao.grupos ?? []) if (usados.has(g.uid)) combinacoes.add(g.tecnica);
  }
  return { tipos: [...tipos], tecnicas: [...tecnicas], combinacoes: [...combinacoes] };
}
