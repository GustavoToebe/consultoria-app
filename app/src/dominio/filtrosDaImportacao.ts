import {
  lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, um, type Parametro, type Periodo,
} from './filtrosComuns';

/**
 * Filtros do histórico de importações (`docs/planos/filtros-nas-listas.md`, D10 e lote 2): destino, situação, tipo do
 * arquivo e período (data da importação), no endereço (`?destino=&situacao=&arquivo=&de=&ate=`), como a rota os recebe
 * (`arquivo=xlsx|csv`: o histórico só guarda a extensão, LGPD). O destino só vale entre os que a pessoa pode importar.
 * Funções puras.
 */
export type SituacaoDaImportacao = 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU';
export type ArquivoDaImportacao = 'xlsx' | 'csv';

export interface FiltrosDaImportacao {
  destino: string;
  situacao: SituacaoDaImportacao | '';
  arquivo: ArquivoDaImportacao | '';
  periodo: Periodo;
}

export type ChaveDoFiltro = 'destino' | 'situacao' | 'arquivo' | 'periodo';

export const SEM_FILTROS: FiltrosDaImportacao = { destino: '', situacao: '', arquivo: '', periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['destino', 'situacao', 'arquivo', 'de', 'ate'] as const;

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
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco, destinos: readonly { id: string }[]): FiltrosDaImportacao {
  const destino = lista(q.destino)[0] ?? '';
  return {
    destino: destinos.some((d) => d.id === destino) ? destino : '',
    situacao: um(q.situacao, SITUACOES) ?? '',
    arquivo: (lista(q.arquivo)[0]?.toLowerCase() === 'csv' ? 'csv' : lista(q.arquivo)[0]?.toLowerCase() === 'xlsx' ? 'xlsx' : ''),
    periodo: periodoDoEndereco(q.de, q.ate),
  };
}

export function paraEndereco(f: FiltrosDaImportacao): Record<string, string> {
  return {
    ...(f.destino ? { destino: f.destino } : {}), ...(f.situacao ? { situacao: f.situacao } : {}), ...(f.arquivo ? { arquivo: f.arquivo } : {}),
    ...periodoParaEndereco(f.periodo),
  };
}

/** O filtro de `listarImportacoes` (sem a página). */
export function pedidoDaApi(f: FiltrosDaImportacao): { destino?: string; situacao?: string; arquivo?: ArquivoDaImportacao; de?: string; ate?: string } {
  return {
    ...(f.destino ? { destino: f.destino } : {}),
    ...(f.situacao ? { situacao: f.situacao } : {}),
    ...(f.arquivo ? { arquivo: f.arquivo } : {}),
    ...(f.periodo.de ? { de: f.periodo.de } : {}),
    ...(f.periodo.ate ? { ate: f.periodo.ate } : {}),
  };
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDaImportacao, rotuloDoDestino: (id: string) => string): ChipDeFiltro[] {
  return [
    ...(f.destino ? [{ chave: 'destino' as const, texto: `Destino: ${rotuloDoDestino(f.destino)}` }] : []),
    ...(f.situacao ? [{ chave: 'situacao' as const, texto: `Situação: ${SITUACOES.find((s) => s.valor === f.situacao)?.rotulo ?? f.situacao}` }] : []),
    ...(f.arquivo ? [{ chave: 'arquivo' as const, texto: `Arquivo: ${ARQUIVOS.find((a) => a.valor === f.arquivo)?.rotulo ?? f.arquivo}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDaImportacao, chave: ChaveDoFiltro): FiltrosDaImportacao {
  return chave === 'periodo' ? { ...f, periodo: SEM_PERIODO } : { ...f, [chave]: '' };
}
