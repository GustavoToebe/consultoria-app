import type {
  Configuracao,
  ConteudoTreino,
  FaixaPercentual,
  FaixaRepeticoes,
  Intensidade,
  PapelDaSerie,
  Tecnica,
  TecnicaDaMetodologia,
  TipoDeSerie,
  TipoDeTecnica,
} from '../api/tipos';

/**
 * Leitura da metodologia (formato de 22/10) para o editor, o aluno e o PDF. A metodologia só preenche padrões no editor
 * (ao criar a série ou trocar o tipo); depois, quem manda são os números gravados na série. Daqui saem os nomes
 * ("% da WS", "Muscle Round") e as explicações que o aluno lê.
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

/** As três técnicas, na ordem da metodologia. */
export const TIPOS_DE_TECNICA: readonly TipoDeTecnica[] = ['REST_PAUSE', 'CLUSTER', 'DROP_SET'];

/** Nome fixo de cada técnica: vale onde não há metodologia à mão (`nomeDaTecnica`). */
export const NOME_FIXO_DA_TECNICA: Record<TipoDeTecnica, string> = { REST_PAUSE: 'Rest pause', CLUSTER: 'Cluster', DROP_SET: 'Drop-set' };

/** Nome do primeiro tipo de trabalho: dá nome ao "% da WS". `null` sem metodologia ou sem tipo de trabalho. */
export function tipoTrabalho(config: Configuracao | null | undefined): string | null {
  const t = config?.tipos?.find((x) => x.papel === 'TRABALHO');
  return t?.nome.trim() || null;
}

/** Nome da série de trabalho para os textos ("% da WS"); sem ele, "série de trabalho". */
export function nomeDaSerieDeTrabalho(config: Configuracao | null | undefined): string {
  return tipoTrabalho(config) ?? 'série de trabalho';
}

/** O tipo da metodologia com esse nome (comparação pelo nome sem espaços nas pontas, como `ConfiguracaoConsultoria.tipo`). */
export function tipoDaMetodologia(config: Configuracao | null | undefined, nome: string | null | undefined): TipoDeSerie | null {
  if (!config || nome == null) return null;
  const alvo = nome.trim();
  return config.tipos.find((t) => t.nome.trim() === alvo) ?? null;
}

export function papelDe(config: Configuracao | null | undefined, nome: string | null | undefined): PapelDaSerie | null {
  return tipoDaMetodologia(config, nome)?.papel ?? null;
}

/**
 * Intensidade com que uma série desse tipo nasce: a da modalidade do exercício (só peso livre e máquina têm variação)
 * ou a padrão do tipo. Cópia, para a série não compartilhar o objeto com a metodologia.
 */
export function intensidadeInicial(tipo: TipoDeSerie | null | undefined, modalidade: string | null | undefined): Intensidade | null {
  const porModalidade = modalidade === 'LIVRE' || modalidade === 'MAQUINA' ? tipo?.intensidadePorModalidade?.[modalidade] : undefined;
  const i = porModalidade ?? tipo?.intensidadePadrao ?? null;
  return i ? { ...i } : null;
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
export function explicacaoDoTipo(config: Configuracao | null | undefined, nome: string | null | undefined): string | null {
  return tipoDaMetodologia(config, nome)?.explicacao?.trim() || null;
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

/** Tipos e técnicas que o treino usa, na ordem em que aparecem: o glossário "Como ler este treino" do PDF. */
export function tiposETecnicasUsados(conteudo: Pick<ConteudoTreino, 'sessoes'>): { tipos: string[]; tecnicas: TipoDeTecnica[] } {
  const tipos = new Set<string>();
  const tecnicas = new Set<TipoDeTecnica>();
  for (const sessao of conteudo.sessoes ?? []) {
    for (const exercicio of sessao.exercicios ?? []) {
      for (const serie of exercicio.series ?? []) {
        if (serie.tipo?.trim()) tipos.add(serie.tipo.trim());
        if (serie.tecnica) tecnicas.add(serie.tecnica.tipo);
      }
    }
  }
  return { tipos: [...tipos], tecnicas: [...tecnicas] };
}
