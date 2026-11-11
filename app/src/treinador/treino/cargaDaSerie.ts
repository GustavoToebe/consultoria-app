import type { Configuracao, ModoDeCarga, PapelDaSerie, Serie } from '../../api/tipos';
import { descreverGrupo, modoDoGrupo, textoCarga, textoDosPercentuaisDoGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { alterarPercentuais, cargaDoModo, modosDeCarga } from '../../dominio/editorTreino';
import { nomeDoTipo, papelDe } from '../../dominio/metodologia';
import { linhasDasEtapas } from '../../dominio/resumoDaSerie';
import type { UnidadeDeCarga } from '../../dominio/unidadeDeCarga';

/**
 * Regras da faixa "Carga e RIR" do editor de séries e do padrão do tipo na metodologia: quais formas de carga aparecem
 * no seletor binário, como o Aquecimento lê os % em branco e o resumo "Para o aluno". Só decisão; as telas desenham.
 */

/** RIR de cada série: "—" (não prescrito), "0 (Falha)" e de 1 a 10. */
export const OPCOES_DO_RIR: { valor: number | null; rotulo: string }[] = [
  { valor: null, rotulo: '— (Não prescrito)' },
  { valor: 0, rotulo: '0 (Falha)' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((valor) => ({ valor: valor as number | null, rotulo: String(valor) })),
];

export interface EscolhaDeCargaDoPapel {
  opcoes: { valor: ModoDeCarga; rotulo: string }[];
  /** A opção marcada: no Aquecimento da série, "sem sugestão" aparece como "% da WS" com os campos em branco. */
  marcado: ModoDeCarga;
}

/**
 * As formas de carga do seletor, pelo papel (`modosDeCarga`, binário na série). No Aquecimento da série, "Sem sugestão"
 * é o "% da WS" com os percentuais em branco (fica marcado o "% da WS"). No padrão do tipo (`'padrao'`) todo papel menos
 * o de trabalho oferece também "Sem sugestão". Uma forma gravada fora da lista do papel continua marcada (nada some da tela).
 */
export function escolhaDeCargaDoPapel(
  config: Configuracao | null | undefined, papel: PapelDaSerie | null | undefined, modo: ModoDeCarga, unidade: UnidadeDeCarga, onde: 'serie' | 'padrao',
): EscolhaDeCargaDoPapel {
  const todas = modosDeCarga(config, null, unidade);
  let opcoes = modosDeCarga(config, papel, unidade);
  if (onde === 'padrao' && papel !== 'TRABALHO' && !opcoes.some((o) => o.valor === 'NENHUMA')) opcoes = [...opcoes, todas.find((o) => o.valor === 'NENHUMA')!];
  const marcado: ModoDeCarga = onde === 'serie' && papel === 'AQUECIMENTO' && modo === 'NENHUMA' ? 'PERCENTUAL_WS' : modo;
  if (!opcoes.some((o) => o.valor === marcado)) opcoes = [...opcoes, todas.find((o) => o.valor === marcado)!];
  return { opcoes, marcado };
}

/** O modo que a escolha grava: no Aquecimento, "% da WS" sem número ainda é "sem sugestão" (`NENHUMA`). */
export function modoAoEscolher(papel: PapelDaSerie | null | undefined, escolhido: ModoDeCarga): ModoDeCarga {
  return papel === 'AQUECIMENTO' && escolhido === 'PERCENTUAL_WS' ? 'NENHUMA' : escolhido;
}

/**
 * Percentual de uma série do grupo (`j` = posição no grupo). No Aquecimento a série com Mín e Máx em branco é "sem sugestão"
 * (`NENHUMA`) e a que tem % é `PERCENTUAL_WS`, cada uma por si: nada de erro nas vazias nem de mexer nas outras (o grupo
 * continua um só, `agrupamento`). Nos outros papéis o % em branco continua em % e a validação cobra.
 */
export function percentuaisNoGrupo(
  series: Serie[], grupo: GrupoDeSeries, j: number, min: number | null, max: number | null, config: Configuracao | null | undefined,
): Serie[] {
  const i = grupo.inicio + j;
  if (papelDe(config, grupo.series[0].tipo) === 'AQUECIMENTO' && min == null && max == null) {
    return series.map((s, k) => (k === i ? { ...s, carga: cargaDoModo('NENHUMA') } : s));
  }
  return alterarPercentuais(series, i, min, max);
}

/**
 * Coluna Carga da tabela dos blocos (guia pág. 9): "50% · 70% da WS", "Carga de trabalho", "60 kg" (um valor só quando todas
 * as séries do bloco têm o mesmo; senão cada um, na ordem) e "—" sem carga prescrita. Nada é calculado: só o que está gravado.
 */
export function cargaDoBloco(grupo: GrupoDeSeries, config: Configuracao | null | undefined, unidade: UnidadeDeCarga): string {
  const modo = modoDoGrupo(grupo);
  if (modo === 'PERCENTUAL_WS') return textoDosPercentuaisDoGrupo(grupo, config) || '—';
  if (modo === 'CARGA_TRABALHO') return 'Carga de trabalho';
  const textos = grupo.series.map((s) => textoCarga(s.carga, null, unidade) || '—');
  return textos.every((t) => t === textos[0]) ? textos[0] : textos.join(' · ');
}

/**
 * "Para o aluno" numa linha: "3×3 a 5 · FS · 50% · 70% · 85% a 90% da WS". Sai da mesma leitura do resumo do grupo
 * (`descreverGrupo`), só com a separação da prévia, e termina com a carga de cada bloco do Cluster ou as retomadas do
 * Rest pause, quando o treinador as escreveu (`linhasDasEtapas`, as mesmas do PDF).
 */
export function textoParaOAluno(grupo: GrupoDeSeries, config: Configuracao | null | undefined, unidade: UnidadeDeCarga): string {
  // Só a carga de cada etapa: a frase sobre a base dos percentuais fica no PDF e na tela do aluno, não na faixa compacta.
  const etapas = linhasDasEtapas(grupo.series[0], config).filter((l) => /^(Bloco|Retomada)/.test(l));
  return [linhaDoGrupo(grupo, config, unidade), ...etapas].join(' · ');
}

function linhaDoGrupo(grupo: GrupoDeSeries, config: Configuracao | null | undefined, unidade: UnidadeDeCarga): string {
  const texto = descreverGrupo(grupo, config, { unidade });
  const partes = /^(\d+)x(.*?) - (.*)$/.exec(texto);
  if (!partes) return texto;
  const [, n, reps, resto] = partes;
  const nome = nomeDoTipo(config, grupo.series[0].tipo);
  // "FS 50% · 70%" vira "FS · 50% · 70%"; "WS com Cluster" fica como está.
  const depois = nome && resto.startsWith(`${nome} `) && /^\d/.test(resto.slice(nome.length + 1)) ? `${nome} · ${resto.slice(nome.length + 1)}` : resto;
  const quantas = reps.trim() ? `${n}×${reps.trim()}` : `${n} ${n === '1' ? 'série' : 'séries'}`;
  return `${quantas} · ${depois}`;
}

/** Texto da pendência de carga (guia premium págs. 4 e 9): âmbar, é preenchimento pendente, não erro. */
export const FALTA_A_CARGA = 'Falta a carga';

/**
 * O erro da validação no `caminho` (relativo a `raiz`: o plano, o exercício ou a série) é só a carga obrigatória ainda
 * vazia: o % de uma carga em % da WS, os kg de uma carga fixa, a carga de um bloco do cluster ou de uma retomada. A tela
 * mostra isso em âmbar ("Falta a carga"); valor preenchido e fora da faixa continua vermelho. A validação não muda e
 * continua impedindo publicar.
 */
export function cargaPendente(raiz: unknown, caminho: string): boolean {
  const partes = caminho.split(/[.[\]]+/).filter(Boolean);
  const ultima = partes.at(-1);
  let pai: unknown;
  let valor: unknown = raiz;
  for (const p of partes) {
    pai = valor;
    valor = valor != null && typeof valor === 'object' ? (valor as Record<string, unknown>)[p] : undefined;
  }
  if (valor != null) return false;
  const modo = (pai as { modo?: string } | null | undefined)?.modo;
  if (ultima === 'percentualMin' || ultima === 'percentual') return modo === 'PERCENTUAL_WS';
  if (ultima === 'valorKg') return modo === 'CARGA_FIXA';
  // `tecnica.cargasDosBlocos[i]` (o bloco sem carga) e `tecnica.retomadas[i].carga` (a retomada sem carga).
  return /cargasDosBlocos\[\d+\]$/.test(caminho) || /retomadas\[\d+\]\.carga$/.test(caminho);
}
