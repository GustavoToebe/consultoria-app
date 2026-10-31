import { lista, um, type Parametro } from './filtrosComuns';

/**
 * Filtros do histórico de importações (`docs/planos/filtros-nas-listas.md`, D10): destino, situação e tipo do arquivo,
 * no endereço (`?destino=&situacao=&arquivo=`). O histórico só guarda a extensão do arquivo (LGPD), então a busca da rota
 * (`busca`, sobre o "nome" guardado) só serve para separar Excel de CSV. O destino só vale entre os que a pessoa pode
 * importar. Funções puras.
 */
export type SituacaoDaImportacao = 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU';
export type ArquivoDaImportacao = 'xlsx' | 'csv';

export interface FiltrosDaImportacao {
  destino: string;
  situacao: SituacaoDaImportacao | '';
  arquivo: ArquivoDaImportacao | '';
}

export type ChaveDoFiltro = 'destino' | 'situacao' | 'arquivo';

export const SEM_FILTROS: FiltrosDaImportacao = { destino: '', situacao: '', arquivo: '' };

export const CHAVES_DO_ENDERECO = ['destino', 'situacao', 'arquivo'] as const;

export const SITUACOES: readonly { valor: SituacaoDaImportacao; rotulo: string }[] = [
  { valor: 'CONCLUIDA', rotulo: 'Concluída' },
  { valor: 'CONCLUIDA_COM_ERROS', rotulo: 'Concluída com erros' },
  { valor: 'FALHOU', rotulo: 'Falhou' },
];

export const ARQUIVOS: readonly { valor: ArquivoDaImportacao; rotulo: string }[] = [
  { valor: 'xlsx', rotulo: 'Excel (.xlsx)' },
  { valor: 'csv', rotulo: 'CSV (.csv)' },
];

export interface ParametrosDoEndereco {
  destino?: Parametro;
  situacao?: Parametro;
  arquivo?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco, destinos: readonly { id: string }[]): FiltrosDaImportacao {
  const destino = lista(q.destino)[0] ?? '';
  return {
    destino: destinos.some((d) => d.id === destino) ? destino : '',
    situacao: um(q.situacao, SITUACOES) ?? '',
    arquivo: (lista(q.arquivo)[0]?.toLowerCase() === 'csv' ? 'csv' : lista(q.arquivo)[0]?.toLowerCase() === 'xlsx' ? 'xlsx' : ''),
  };
}

export function paraEndereco(f: FiltrosDaImportacao): Record<string, string> {
  return { ...(f.destino ? { destino: f.destino } : {}), ...(f.situacao ? { situacao: f.situacao } : {}), ...(f.arquivo ? { arquivo: f.arquivo } : {}) };
}

/** O filtro de `listarImportacoes` (sem a página): o tipo do arquivo vai como busca pela extensão. */
export function pedidoDaApi(f: FiltrosDaImportacao): { destino?: string; situacao?: string; busca?: string } {
  return {
    ...(f.destino ? { destino: f.destino } : {}),
    ...(f.situacao ? { situacao: f.situacao } : {}),
    ...(f.arquivo ? { busca: `.${f.arquivo}` } : {}),
  };
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDaImportacao, rotuloDoDestino: (id: string) => string): ChipDeFiltro[] {
  return [
    ...(f.destino ? [{ chave: 'destino' as const, texto: `Destino: ${rotuloDoDestino(f.destino)}` }] : []),
    ...(f.situacao ? [{ chave: 'situacao' as const, texto: `Situação: ${SITUACOES.find((s) => s.valor === f.situacao)?.rotulo ?? f.situacao}` }] : []),
    ...(f.arquivo ? [{ chave: 'arquivo' as const, texto: `Arquivo: ${ARQUIVOS.find((a) => a.valor === f.arquivo)?.rotulo ?? f.arquivo}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDaImportacao, chave: ChaveDoFiltro): FiltrosDaImportacao {
  return { ...f, [chave]: '' };
}
