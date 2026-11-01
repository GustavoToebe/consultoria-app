import {
  ehId, lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, type Parametro, type Periodo,
} from './filtrosComuns';

/**
 * Filtros da Auditoria (`docs/planos/filtros-nas-listas.md`, D9 e lote 2): pessoas (várias, e "Sistema" para os eventos
 * sem autor), ações (várias) e período, no endereço (`?usuarioId=<id>,sistema&acao=A,B&de=&ate=`); para a API cada
 * pessoa e cada ação vira um parâmetro repetido. A ação só vale se estiver no catálogo do app (`ACOES_AUDITORIA`); o resto
 * do endereço é ignorado. Funções puras.
 */
export const SISTEMA = 'sistema';

export interface FiltrosDeAuditoria {
  /** Ids de quem fez e/ou `SISTEMA`; vazio = todas as pessoas. */
  pessoas: string[];
  /** Códigos das ações; vazio = todas. */
  acoes: string[];
  periodo: Periodo;
}

export type ChaveDoFiltro = 'pessoa' | 'acao' | 'periodo';

export const SEM_FILTROS: FiltrosDeAuditoria = { pessoas: [], acoes: [], periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['usuarioId', 'acao', 'de', 'ate'] as const;

export interface ParametrosDoEndereco {
  usuarioId?: Parametro;
  acao?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco, acoes: Readonly<Record<string, string>>): FiltrosDeAuditoria {
  const pessoas = lista(q.usuarioId).map((v) => (v.toLowerCase() === SISTEMA ? SISTEMA : v)).filter((v) => v === SISTEMA || ehId(v));
  const codigos = lista(q.acao).map((v) => v.toUpperCase()).filter((v) => !!acoes[v]);
  return { pessoas: [...new Set(pessoas)], acoes: [...new Set(codigos)], periodo: periodoDoEndereco(q.de, q.ate) };
}

export function paraEndereco(f: FiltrosDeAuditoria): Record<string, string> {
  return {
    ...(f.pessoas.length ? { usuarioId: f.pessoas.join(',') } : {}),
    ...(f.acoes.length ? { acao: f.acoes.join(',') } : {}),
    ...periodoParaEndereco(f.periodo),
  };
}

/** O filtro de `listarAuditoria` (sem a página). */
export function pedidoDaApi(f: FiltrosDeAuditoria): { de?: string; ate?: string; usuarioId?: string[]; acao?: string[] } {
  return {
    ...(f.periodo.de ? { de: f.periodo.de } : {}),
    ...(f.periodo.ate ? { ate: f.periodo.ate } : {}),
    ...(f.pessoas.length ? { usuarioId: [...f.pessoas] } : {}),
    ...(f.acoes.length ? { acao: [...f.acoes] } : {}),
  };
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeAuditoria, nomeDe: (id: string) => string | null, acoes: Readonly<Record<string, string>>): ChipDeFiltro[] {
  const pessoa = (id: string) => (id === SISTEMA ? 'Sistema' : nomeDe(id) ?? 'Outra pessoa');
  return [
    ...(f.pessoas.length ? [{ chave: 'pessoa' as const, texto: `Pessoa: ${f.pessoas.map(pessoa).join(', ')}` }] : []),
    ...(f.acoes.length ? [{ chave: 'acao' as const, texto: `Ação: ${f.acoes.map((a) => acoes[a] ?? 'Ação registrada').join(', ')}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Período: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeAuditoria, chave: ChaveDoFiltro): FiltrosDeAuditoria {
  if (chave === 'pessoa') return { ...f, pessoas: [] };
  if (chave === 'acao') return { ...f, acoes: [] };
  return { ...f, periodo: SEM_PERIODO };
}

/** As pessoas da equipe (por nome) e "Sistema" por último. */
export function opcoesDePessoa(membros: readonly { id: string; nome: string }[]) {
  return [...membros.map((m) => ({ valor: m.id, rotulo: m.nome })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
    { valor: SISTEMA, rotulo: 'Sistema' }];
}
