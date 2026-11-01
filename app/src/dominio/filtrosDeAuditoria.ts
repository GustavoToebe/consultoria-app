import {
  lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, umId, type Parametro, type Periodo,
} from './filtrosComuns';

/**
 * Filtros da Auditoria (`docs/planos/filtros-nas-listas.md`, D9): pessoa, ação e período, no endereço
 * (`?usuarioId=&acao=&de=&ate=`), como a rota `GET /auditoria` os recebe. A ação só vale se estiver no catálogo do app
 * (`ACOES_AUDITORIA`); o resto do endereço é ignorado. Funções puras.
 */
export interface FiltrosDeAuditoria {
  /** Id de quem fez; vazio = todas as pessoas. */
  usuarioId: string;
  /** Código da ação; vazio = todas. */
  acao: string;
  periodo: Periodo;
}

export type ChaveDoFiltro = 'pessoa' | 'acao' | 'periodo';

export const SEM_FILTROS: FiltrosDeAuditoria = { usuarioId: '', acao: '', periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['usuarioId', 'acao', 'de', 'ate'] as const;

export interface ParametrosDoEndereco {
  usuarioId?: Parametro;
  acao?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco, acoes: Readonly<Record<string, string>>): FiltrosDeAuditoria {
  const acao = lista(q.acao)[0]?.toUpperCase() ?? '';
  return {
    usuarioId: umId(q.usuarioId) ?? '',
    acao: acao && acoes[acao] ? acao : '',
    periodo: periodoDoEndereco(q.de, q.ate),
  };
}

export function paraEndereco(f: FiltrosDeAuditoria): Record<string, string> {
  return {
    ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}),
    ...(f.acao ? { acao: f.acao } : {}),
    ...periodoParaEndereco(f.periodo),
  };
}

/** O filtro de `listarAuditoria` (sem a página). */
export function pedidoDaApi(f: FiltrosDeAuditoria): { de?: string; ate?: string; usuarioId?: string; acao?: string } {
  return {
    ...(f.periodo.de ? { de: f.periodo.de } : {}),
    ...(f.periodo.ate ? { ate: f.periodo.ate } : {}),
    ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}),
    ...(f.acao ? { acao: f.acao } : {}),
  };
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeAuditoria, nomeDe: (id: string) => string | null, acoes: Readonly<Record<string, string>>): ChipDeFiltro[] {
  return [
    ...(f.usuarioId ? [{ chave: 'pessoa' as const, texto: `Pessoa: ${nomeDe(f.usuarioId) ?? 'Outra pessoa'}` }] : []),
    ...(f.acao ? [{ chave: 'acao' as const, texto: `Ação: ${acoes[f.acao] ?? 'Ação registrada'}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Período: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeAuditoria, chave: ChaveDoFiltro): FiltrosDeAuditoria {
  if (chave === 'pessoa') return { ...f, usuarioId: '' };
  if (chave === 'acao') return { ...f, acao: '' };
  return { ...f, periodo: SEM_PERIODO };
}
