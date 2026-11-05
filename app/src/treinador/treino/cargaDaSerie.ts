import type { Configuracao, ModoDeCarga, PapelDaSerie, Serie } from '../../api/tipos';
import { descreverGrupo, type GrupoDeSeries } from '../../dominio/agrupamento';
import { alterarGrupo, alterarPercentuais, modosDeCarga } from '../../dominio/editorTreino';
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
 * As formas de carga do seletor, pelo papel (`modosDeCarga`). Na série (`onde = 'serie'`) o Aquecimento não mostra "Sem
 * sugestão": ela é o "% da WS" com os percentuais em branco. No padrão do tipo (`'padrao'`) todo papel menos o de trabalho
 * oferece também "Sem sugestão". Uma
 * forma gravada fora da lista do papel continua marcada (nada some da tela).
 */
export function escolhaDeCargaDoPapel(
  config: Configuracao | null | undefined, papel: PapelDaSerie | null | undefined, modo: ModoDeCarga, unidade: UnidadeDeCarga, onde: 'serie' | 'padrao',
): EscolhaDeCargaDoPapel {
  const todas = modosDeCarga(config, null, unidade);
  let opcoes = modosDeCarga(config, papel, unidade);
  if (onde === 'serie' && papel === 'AQUECIMENTO') opcoes = opcoes.filter((o) => o.valor !== 'NENHUMA');
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
 * Percentual de uma série do grupo (`j` = posição no grupo). O Aquecimento em "sem sugestão" vira "% da WS" no grupo
 * todo antes (trocar só a série partiria o grupo), e volta a "sem sugestão" quando todas as séries ficam em branco.
 */
export function percentuaisNoGrupo(
  series: Serie[], grupo: GrupoDeSeries, j: number, min: number | null, max: number | null, config: Configuracao | null | undefined,
): Serie[] {
  const aquecimento = papelDe(config, grupo.series[0].tipo) === 'AQUECIMENTO';
  const base = aquecimento && (grupo.series[0].carga?.modo ?? 'NENHUMA') === 'NENHUMA' ? alterarGrupo(series, grupo, { modo: 'PERCENTUAL_WS' }, config) : series;
  const novas = alterarPercentuais(base, grupo.inicio + j, min, max);
  const doGrupo = novas.slice(grupo.inicio, grupo.inicio + grupo.series.length);
  if (aquecimento && doGrupo.every((s) => s.carga?.percentualMin == null && s.carga?.percentualMax == null)) {
    return alterarGrupo(novas, { inicio: grupo.inicio, series: doGrupo }, { modo: 'NENHUMA' }, config);
  }
  return novas;
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
