import {
  lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, validos, type Parametro, type Periodo,
} from './filtrosComuns';

/**
 * Filtros do histórico de importações (`docs/planos/filtros-nas-listas.md`, D10 e lote 2; regra única dos filtros de
 * 28/11): destinos e situações (vários de cada; nada marcado = todos), tipo do arquivo (um) e período (data da importação).
 * No endereço vão numa vírgula (`?destino=alunos,pesos&situacao=FALHOU&arquivo=csv&de=&ate=`); para a API, parâmetros
 * repetidos (`destino=alunos&destino=pesos`; `arquivo=xlsx|csv`: o histórico só guarda a extensão, LGPD). O destino só vale
 * entre os que a pessoa pode importar. Funções puras.
 */
export type SituacaoDaImportacao = 'CONCLUIDA' | 'CONCLUIDA_COM_ERROS' | 'FALHOU';
export type ArquivoDaImportacao = 'xlsx' | 'csv';

export interface FiltrosDaImportacao {
  destinos: string[];
  situacoes: SituacaoDaImportacao[];
  arquivo: ArquivoDaImportacao | '';
  periodo: Periodo;
}

export type ChaveDoFiltro = 'destino' | 'situacao' | 'arquivo' | 'periodo';

export const SEM_FILTROS: FiltrosDaImportacao = { destinos: [], situacoes: [], arquivo: '', periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['destino', 'situacao', 'arquivo', 'de', 'ate'] as const;

/** Com o tom da bolinha do chip, o mesmo do selo da lista (verde, âmbar, vermelho). */
export const SITUACOES: readonly { valor: SituacaoDaImportacao; rotulo: string; tom: 'sucesso' | 'atencao' | 'perigo' }[] = [
  { valor: 'CONCLUIDA', rotulo: 'Concluída', tom: 'sucesso' },
  { valor: 'CONCLUIDA_COM_ERROS', rotulo: 'Concluída com erros', tom: 'atencao' },
  { valor: 'FALHOU', rotulo: 'Falhou', tom: 'perigo' },
];

export const ARQUIVOS: readonly { valor: ArquivoDaImportacao; rotulo: string }[] = [
  { valor: 'xlsx', rotulo: 'Excel' },
  { valor: 'csv', rotulo: 'CSV' },
];

export interface ParametrosDoEndereco {
  destino?: Parametro;
  situacao?: Parametro;
  arquivo?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco, destinos: readonly { id: string }[]): FiltrosDaImportacao {
  const pedidos = new Set(lista(q.destino));
  const situacoes = validos(q.situacao, SITUACOES);
  const arquivo = lista(q.arquivo)[0]?.toLowerCase();
  return {
    // Na ordem da tela, sem repetir; destino que a pessoa não pode importar é ignorado.
    destinos: destinos.map((d) => d.id).filter((id) => pedidos.has(id)),
    situacoes: SITUACOES.map((s) => s.valor).filter((v) => situacoes.includes(v)),
    arquivo: arquivo === 'csv' ? 'csv' : arquivo === 'xlsx' ? 'xlsx' : '',
    periodo: periodoDoEndereco(q.de, q.ate),
  };
}

export function paraEndereco(f: FiltrosDaImportacao): Record<string, string> {
  return {
    ...(f.destinos.length ? { destino: f.destinos.join(',') } : {}), ...(f.situacoes.length ? { situacao: f.situacoes.join(',') } : {}),
    ...(f.arquivo ? { arquivo: f.arquivo } : {}), ...periodoParaEndereco(f.periodo),
  };
}

/** O filtro de `listarImportacoes` (sem a página): destinos e situações vão repetidos no pedido. */
export function pedidoDaApi(f: FiltrosDaImportacao): { destino?: string[]; situacao?: SituacaoDaImportacao[]; arquivo?: ArquivoDaImportacao; de?: string; ate?: string } {
  return {
    ...(f.destinos.length ? { destino: f.destinos } : {}),
    ...(f.situacoes.length ? { situacao: f.situacoes } : {}),
    ...(f.arquivo ? { arquivo: f.arquivo } : {}),
    ...(f.periodo.de ? { de: f.periodo.de } : {}),
    ...(f.periodo.ate ? { ate: f.periodo.ate } : {}),
  };
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDaImportacao, rotuloDoDestino: (id: string) => string): ChipDeFiltro[] {
  const rotuloDaSituacao = (v: SituacaoDaImportacao) => SITUACOES.find((s) => s.valor === v)?.rotulo ?? v;
  return [
    ...(f.destinos.length ? [{ chave: 'destino' as const, texto: `Destino: ${f.destinos.map(rotuloDoDestino).join(', ')}` }] : []),
    ...(f.situacoes.length ? [{ chave: 'situacao' as const, texto: `Situação: ${f.situacoes.map(rotuloDaSituacao).join(', ')}` }] : []),
    ...(f.arquivo ? [{ chave: 'arquivo' as const, texto: `Arquivo: ${ARQUIVOS.find((a) => a.valor === f.arquivo)?.rotulo ?? f.arquivo}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDaImportacao, chave: ChaveDoFiltro): FiltrosDaImportacao {
  switch (chave) {
    case 'periodo': return { ...f, periodo: SEM_PERIODO };
    case 'destino': return { ...f, destinos: [] };
    case 'situacao': return { ...f, situacoes: [] };
    case 'arquivo': return { ...f, arquivo: '' };
  }
}
