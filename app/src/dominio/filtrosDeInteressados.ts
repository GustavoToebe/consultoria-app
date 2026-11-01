import type { FiltroInscricoes, Origem } from '../api/inscricoesTipos';
import {
  periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, um, validos, type Parametro, type Periodo,
} from './filtrosComuns';
import { FILTROS_INSCRICOES, OPCOES_ORIGEM } from './inscricoes';
import {
  lerResponsaveis, MEUS, opcoesDeResponsaveis, responsaveisParaApi, responsaveisParaEndereco, SEM_RESPONSAVEL, soMeus,
  textoDosResponsaveis,
} from './responsaveisDoFiltro';

/**
 * Filtros de Interessados (`docs/planos/filtros-nas-listas.md`, D6 e lote 2): situação (só na Lista), responsáveis e
 * origens (várias de cada), entrada e última atividade (De/Até), no endereço (`?situacao=&meus=true` ou
 * `&responsavel=<id>,nenhum`, `&origem=INSTAGRAM,NAO_INFORMADA`, `&de=&ate=&atividadeDe=&atividadeAte=`); a busca vai à
 * API mas mora na tela (digitada). Lista, Kanban e contagens usam os mesmos filtros. Funções puras.
 */
export { MEUS, SEM_RESPONSAVEL };

export type FiltroDeOrigem = Origem | 'NAO_INFORMADA';

export interface FiltrosDeInteressados {
  situacao: FiltroInscricoes;
  /** `MEUS`, `SEM_RESPONSAVEL` e ids de membros. Vazio = toda a equipe. */
  responsaveis: string[];
  /** Vazio = todas. */
  origens: FiltroDeOrigem[];
  /** Data de entrada (inscrição). */
  entrada: Periodo;
  /** Última atividade. */
  atividade: Periodo;
}

export type ChaveDoFiltro = 'situacao' | 'responsavel' | 'origem' | 'entrada' | 'atividade';
export type VisaoDosFiltros = 'lista' | 'kanban';

export const SEM_FILTROS: FiltrosDeInteressados = { situacao: 'ABERTAS', responsaveis: [], origens: [], entrada: SEM_PERIODO, atividade: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['situacao', 'meus', 'responsavel', 'origem', 'de', 'ate', 'atividadeDe', 'atividadeAte'] as const;

export const OPCOES_FILTRO_ORIGEM: { valor: FiltroDeOrigem; rotulo: string }[] = [
  ...OPCOES_ORIGEM,
  { valor: 'NAO_INFORMADA', rotulo: 'Não informada' },
];

export interface ParametrosDoEndereco {
  situacao?: Parametro;
  meus?: Parametro;
  responsavel?: Parametro;
  origem?: Parametro;
  de?: Parametro;
  ate?: Parametro;
  atividadeDe?: Parametro;
  atividadeAte?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco): FiltrosDeInteressados {
  return {
    situacao: um(q.situacao, FILTROS_INSCRICOES) ?? 'ABERTAS',
    responsaveis: lerResponsaveis(q.meus, q.responsavel),
    origens: validos(q.origem, OPCOES_FILTRO_ORIGEM),
    entrada: periodoDoEndereco(q.de, q.ate),
    atividade: periodoDoEndereco(q.atividadeDe, q.atividadeAte),
  };
}

/** Os filtros que não são de uma visão só (todos menos a situação): vão junto quando muda a visão. */
export function paraEnderecoSemSituacao(f: FiltrosDeInteressados): Record<string, string> {
  const atividade = periodoParaEndereco(f.atividade);
  return {
    ...responsaveisParaEndereco(f.responsaveis),
    ...(f.origens.length ? { origem: f.origens.join(',') } : {}),
    ...periodoParaEndereco(f.entrada),
    ...(atividade.de ? { atividadeDe: atividade.de } : {}),
    ...(atividade.ate ? { atividadeAte: atividade.ate } : {}),
  };
}

export function paraEndereco(f: FiltrosDeInteressados): Record<string, string> {
  return { ...(f.situacao !== 'ABERTAS' ? { situacao: f.situacao } : {}), ...paraEnderecoSemSituacao(f) };
}

/** "Meus" sozinho (o filtro dos retornos e do estado vazio). */
export const ehSoMeus = (f: FiltrosDeInteressados) => soMeus(f.responsaveis);

/** Os filtros da lista, das contagens e do Kanban (`FiltrosDoQuadro`), com a busca digitada. */
export function filtrosDaFila(f: FiltrosDeInteressados, busca: string, usuarioId?: string | null) {
  const r = responsaveisParaApi(f.responsaveis, usuarioId);
  return {
    meus: r.meus,
    busca: busca.trim() || undefined,
    responsavel: r.responsavel.length ? r.responsavel : undefined,
    origem: f.origens.length ? [...f.origens] : undefined,
    de: f.entrada.de ?? undefined,
    ate: f.entrada.ate ?? undefined,
    atividadeDe: f.atividade.de ?? undefined,
    atividadeAte: f.atividade.ate ?? undefined,
  };
}

export const chaveDosFiltros = (f: FiltrosDeInteressados, busca: string) =>
  JSON.stringify([[...f.responsaveis].sort(), [...f.origens].sort(), f.entrada, f.atividade, busca.trim()]);

/** A situação só vale na Lista; o Kanban já separa por etapa. */
export function filtrosVisiveis(visao: VisaoDosFiltros): ChaveDoFiltro[] {
  return visao === 'lista' ? ['situacao', 'responsavel', 'origem', 'entrada', 'atividade'] : ['responsavel', 'origem', 'entrada', 'atividade'];
}

/** Há filtro além da situação, da busca e do "Meus" sozinho? (estado vazio). */
export const temOutrosFiltros = (f: FiltrosDeInteressados) =>
  (f.responsaveis.length > 0 && !soMeus(f.responsaveis)) || f.origens.length > 0 || temPeriodo(f.entrada) || temPeriodo(f.atividade);

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeInteressados, visao: VisaoDosFiltros, nomeDe: (id: string) => string | null = () => null): ChipDeFiltro[] {
  const visiveis = filtrosVisiveis(visao);
  const chips: ChipDeFiltro[] = [];
  if (visiveis.includes('situacao') && f.situacao !== 'ABERTAS') {
    chips.push({ chave: 'situacao', texto: `Situação: ${FILTROS_INSCRICOES.find((o) => o.valor === f.situacao)?.rotulo ?? f.situacao}` });
  }
  if (f.responsaveis.length) chips.push({ chave: 'responsavel', texto: `Responsável: ${textoDosResponsaveis(f.responsaveis, nomeDe, 'Meus')}` });
  if (f.origens.length) {
    chips.push({ chave: 'origem', texto: `Origem: ${OPCOES_FILTRO_ORIGEM.filter((o) => f.origens.includes(o.valor)).map((o) => o.rotulo).join(', ')}` });
  }
  if (temPeriodo(f.entrada)) chips.push({ chave: 'entrada', texto: `Entrada: ${textoDoPeriodo(f.entrada)}` });
  if (temPeriodo(f.atividade)) chips.push({ chave: 'atividade', texto: `Última atividade: ${textoDoPeriodo(f.atividade)}` });
  return chips;
}

export function semOFiltro(f: FiltrosDeInteressados, chave: ChaveDoFiltro): FiltrosDeInteressados {
  switch (chave) {
    case 'situacao': return { ...f, situacao: SEM_FILTROS.situacao };
    case 'responsavel': return { ...f, responsaveis: [] };
    case 'origem': return { ...f, origens: [] };
    case 'entrada': return { ...f, entrada: SEM_PERIODO };
    case 'atividade': return { ...f, atividade: SEM_PERIODO };
  }
}

/** "Limpar filtros" tira o que a visão mostra; na Kanban a situação da Lista fica como estava. */
export function limpos(f: FiltrosDeInteressados, visao: VisaoDosFiltros): FiltrosDeInteressados {
  return visao === 'lista' ? SEM_FILTROS : { ...SEM_FILTROS, situacao: f.situacao };
}

/** Meus, as outras pessoas (por nome) e Sem responsável; nada marcado = toda a equipe. */
export const opcoesDeResponsavel = (pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined) =>
  opcoesDeResponsaveis(pessoas, usuarioId, 'Meus');
