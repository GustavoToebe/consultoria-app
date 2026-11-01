import type { FiltroDeSituacao, TipoDeLancamento } from '../api/financeiroTipos';
import {
  ehId, lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, um, validos, type Parametro, type Periodo,
} from './filtrosComuns';
import { FILTROS_DE_SITUACAO } from './financeiro';
import { dataParaTela, somarDias } from './formatos';

/**
 * Filtros do Financeiro (`docs/planos/filtros-nas-listas.md`, D7, D8 e lote 2): Cobranças (responsável, situações,
 * vencimento, aluno, plano e forma da baixa; a busca pelo aluno mora na tela) e Lançamentos (período, tipo e categorias;
 * a busca na descrição mora na tela). Tudo no endereço, junto do `?aba=`. A rota de cobranças filtra o vencimento por
 * `de`/`ate`; os "próximos 7 dias" (`?vencimento=PROXIMOS_7_DIAS`, o mini-cartão "Vencendo" do Início) são de hoje a
 * hoje + 7, a mesma janela do painel. Funções puras.
 */
export const PROXIMOS_7_DIAS = 'PROXIMOS_7_DIAS';
export const DIAS_DA_JANELA = 7;

/** As situações do filtro (sem "Todas": nada marcado = todas). */
export type SituacaoDoFiltro = Exclude<FiltroDeSituacao, 'TODAS'>;
export const SITUACOES_DO_FILTRO = FILTROS_DE_SITUACAO.filter((o): o is { valor: SituacaoDoFiltro; rotulo: string } => o.valor !== 'TODAS');

/** Forma da baixa: registrada pelo treinador ou confirmada pelo provedor. */
export type FormaDoFiltro = 'MANUAL' | 'ONLINE';
export const FORMAS_DO_FILTRO: { valor: FormaDoFiltro; rotulo: string }[] = [
  { valor: 'MANUAL', rotulo: 'Pagamento registrado à mão' },
  { valor: 'ONLINE', rotulo: 'Pagamento online' },
];

export interface FiltrosDeCobrancas {
  /** Vazio = todas. "Em aberto" já inclui as vencidas (a API junta). */
  situacoes: SituacaoDoFiltro[];
  meus: boolean;
  /** Vencimento de hoje a hoje + 7 (vale mais que o período). */
  proximos7Dias: boolean;
  /** Vencimento entre estas datas. */
  periodo: Periodo;
  /** Um aluno (vem do endereço, da ficha: `?alunoId=`). */
  alunoId: string | null;
  planoId: string | null;
  forma: FormaDoFiltro | null;
}

export type ChaveDoFiltroDeCobrancas = 'responsavel' | 'situacao' | 'vencimento' | 'aluno' | 'plano' | 'forma';

export const SEM_FILTROS_DE_COBRANCAS: FiltrosDeCobrancas = {
  situacoes: [], meus: false, proximos7Dias: false, periodo: SEM_PERIODO, alunoId: null, planoId: null, forma: null,
};

export const CHAVES_DE_COBRANCAS = ['situacao', 'meus', 'vencimento', 'de', 'ate', 'alunoId', 'planoId', 'forma'] as const;

export interface ParametrosDeCobrancas {
  situacao?: Parametro;
  meus?: Parametro;
  vencimento?: Parametro;
  de?: Parametro;
  ate?: Parametro;
  alunoId?: Parametro;
  planoId?: Parametro;
  forma?: Parametro;
}

export function lerCobrancasDoEndereco(q: ParametrosDeCobrancas): FiltrosDeCobrancas {
  const proximos7Dias = lista(q.vencimento)[0] === PROXIMOS_7_DIAS;
  const id = (v: Parametro) => lista(v).find(ehId) ?? null;
  return {
    situacoes: validos(q.situacao, SITUACOES_DO_FILTRO),
    meus: lista(q.meus)[0] === 'true',
    proximos7Dias,
    periodo: proximos7Dias ? SEM_PERIODO : periodoDoEndereco(q.de, q.ate),
    alunoId: id(q.alunoId),
    planoId: id(q.planoId),
    forma: um(q.forma, FORMAS_DO_FILTRO),
  };
}

export function cobrancasParaEndereco(f: FiltrosDeCobrancas): Record<string, string> {
  return {
    ...(f.situacoes.length ? { situacao: f.situacoes.join(',') } : {}),
    ...(f.meus ? { meus: 'true' } : {}),
    ...(f.proximos7Dias ? { vencimento: PROXIMOS_7_DIAS } : periodoParaEndereco(f.periodo)),
    ...(f.alunoId ? { alunoId: f.alunoId } : {}),
    ...(f.planoId ? { planoId: f.planoId } : {}),
    ...(f.forma ? { forma: f.forma } : {}),
  };
}

/** O pedido de `listarCobrancas` (sem a página nem a busca). */
export function cobrancasParaApi(f: FiltrosDeCobrancas, hoje: string) {
  return {
    situacoes: f.situacoes,
    meus: f.meus,
    ...vencimentoDaApi(f, hoje),
    ...(f.alunoId ? { alunoId: f.alunoId } : {}),
    ...(f.planoId ? { planoId: f.planoId } : {}),
    ...(f.forma ? { forma: f.forma } : {}),
  };
}

/** O vencimento que vai à API (`de`/`ate`), com a data de hoje de Brasília. */
export function vencimentoDaApi(f: FiltrosDeCobrancas, hoje: string): { de?: string; ate?: string } {
  if (f.proximos7Dias) return { de: hoje, ate: somarDias(hoje, DIAS_DA_JANELA) };
  return { ...(f.periodo.de ? { de: f.periodo.de } : {}), ...(f.periodo.ate ? { ate: f.periodo.ate } : {}) };
}

export const chaveDasCobrancas = (f: FiltrosDeCobrancas, busca = '') =>
  JSON.stringify([[...f.situacoes].sort(), f.meus, f.proximos7Dias, f.periodo.de, f.periodo.ate, f.alunoId, f.planoId, f.forma, busca.trim()]);

export const temVencimento = (f: FiltrosDeCobrancas) => f.proximos7Dias || temPeriodo(f.periodo);

/** "próximos 7 dias (até 26/10/2026)" ou o período. */
export function textoDoVencimento(f: FiltrosDeCobrancas, hoje: string): string {
  if (f.proximos7Dias) return `de hoje até ${dataParaTela(somarDias(hoje, DIAS_DA_JANELA))}`;
  return textoDoPeriodo(f.periodo);
}

export interface ChipDoFinanceiro<C extends string> { chave: C; texto: string }

/** Os nomes que a tela conhece (aluno da lista, planos comerciais); sem nome, um texto neutro. */
export interface NomesDasCobrancas { aluno?: string | null; plano?: (id: string) => string | null }

export function chipsDasCobrancas(f: FiltrosDeCobrancas, hoje: string, nomes: NomesDasCobrancas = {}): ChipDoFinanceiro<ChaveDoFiltroDeCobrancas>[] {
  return [
    ...(f.meus ? [{ chave: 'responsavel' as const, texto: 'Responsável: Meus' }] : []),
    ...(f.situacoes.length ? [{ chave: 'situacao' as const, texto: `Situação: ${textoDasSituacoes(f.situacoes)}` }] : []),
    ...(temVencimento(f) ? [{ chave: 'vencimento' as const, texto: `Vencimento: ${textoDoVencimento(f, hoje)}` }] : []),
    ...(f.alunoId ? [{ chave: 'aluno' as const, texto: `Aluno: ${nomes.aluno ?? 'escolhido'}` }] : []),
    ...(f.planoId ? [{ chave: 'plano' as const, texto: `Plano: ${nomes.plano?.(f.planoId) ?? 'escolhido'}` }] : []),
    ...(f.forma ? [{ chave: 'forma' as const, texto: `Forma: ${FORMAS_DO_FILTRO.find((o) => o.valor === f.forma)?.rotulo ?? f.forma}` }] : []),
  ];
}

export function semOFiltroDeCobrancas(f: FiltrosDeCobrancas, chave: ChaveDoFiltroDeCobrancas): FiltrosDeCobrancas {
  switch (chave) {
    case 'responsavel': return { ...f, meus: false };
    case 'situacao': return { ...f, situacoes: [] };
    case 'vencimento': return { ...f, proximos7Dias: false, periodo: SEM_PERIODO };
    case 'aluno': return { ...f, alunoId: null };
    case 'plano': return { ...f, planoId: null };
    case 'forma': return { ...f, forma: null };
  }
}

/** "Em aberto, Pagas", na ordem das opções; vazio = "Todas". */
export function textoDasSituacoes(situacoes: readonly SituacaoDoFiltro[]): string {
  const texto = SITUACOES_DO_FILTRO.filter((o) => situacoes.includes(o.valor)).map((o) => o.rotulo).join(', ');
  return texto || 'Todas';
}

/** Texto da contagem do cartão ("Em aberto, vencimento de hoje até 26/10/2026: 3 cobranças"). */
export function descricaoDasCobrancas(f: FiltrosDeCobrancas, hoje: string, total: number): string {
  const situacao = textoDasSituacoes(f.situacoes);
  const vencimento = temVencimento(f) ? `, vencimento ${textoDoVencimento(f, hoje)}` : '';
  return `${situacao}${vencimento}: ${total} ${total === 1 ? 'cobrança' : 'cobranças'}, por vencimento. Toque na linha para abrir.`;
}

// ---- Lançamentos ----

export const TIPOS_DO_FILTRO: { valor: TipoDeLancamento; rotulo: string }[] = [
  { valor: 'ENTRADA', rotulo: 'Entradas' },
  { valor: 'SAIDA', rotulo: 'Saídas' },
];

export interface FiltrosDeLancamentos {
  periodo: Periodo;
  tipo: TipoDeLancamento | null;
  /** Categorias (texto livre, como gravadas); vazio = todas. */
  categorias: string[];
}
export type ChaveDoFiltroDeLancamentos = 'periodo' | 'tipo' | 'categoria';
export const SEM_FILTROS_DE_LANCAMENTOS: FiltrosDeLancamentos = { periodo: SEM_PERIODO, tipo: null, categorias: [] };
export const CHAVES_DE_LANCAMENTOS = ['de', 'ate', 'tipo', 'categoria'] as const;

/**
 * Categoria é texto livre e pode ter vírgula: no endereço as categorias vão separadas por vírgula, com `~` escrito `~0` e
 * a vírgula de dentro escrita `~1` (`categoria=Aluguel~1 luz,Aulas`); a leitura desfaz. Escape de `%` não serve: o
 * endereço decodifica `%2C` antes de a tela ler.
 */
const escaparCategoria = (c: string) => c.replace(/~/g, '~0').replace(/,/g, '~1');
function lerCategorias(valor: Parametro): string[] {
  const partes = (Array.isArray(valor) ? valor : valor ? [valor] : []).flatMap((v) => v.split(','));
  const lidas = partes.map((p) => p.replace(/~1/g, ',').replace(/~0/g, '~').trim()).filter((c) => c && c.length <= 60);
  return [...new Set(lidas)];
}

export function lerLancamentosDoEndereco(q: { de?: Parametro; ate?: Parametro; tipo?: Parametro; categoria?: Parametro }): FiltrosDeLancamentos {
  return { periodo: periodoDoEndereco(q.de, q.ate), tipo: um(q.tipo, TIPOS_DO_FILTRO), categorias: lerCategorias(q.categoria) };
}

export const lancamentosParaEndereco = (f: FiltrosDeLancamentos): Record<string, string> => ({
  ...periodoParaEndereco(f.periodo),
  ...(f.tipo ? { tipo: f.tipo } : {}),
  ...(f.categorias.length ? { categoria: f.categorias.map(escaparCategoria).join(',') } : {}),
});

export const chaveDosLancamentos = (f: FiltrosDeLancamentos, busca = '') =>
  JSON.stringify([f.periodo.de, f.periodo.ate, f.tipo, [...f.categorias].sort(), busca.trim()]);

export const temFiltroDeLancamentos = (f: FiltrosDeLancamentos) => temPeriodo(f.periodo) || !!f.tipo || f.categorias.length > 0;

export function chipsDosLancamentos(f: FiltrosDeLancamentos): ChipDoFinanceiro<ChaveDoFiltroDeLancamentos>[] {
  return [
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : []),
    ...(f.tipo ? [{ chave: 'tipo' as const, texto: `Tipo: ${TIPOS_DO_FILTRO.find((o) => o.valor === f.tipo)?.rotulo ?? f.tipo}` }] : []),
    ...(f.categorias.length ? [{ chave: 'categoria' as const, texto: `Categoria: ${f.categorias.join(', ')}` }] : []),
  ];
}

export function semOFiltroDeLancamentos(f: FiltrosDeLancamentos, chave: ChaveDoFiltroDeLancamentos): FiltrosDeLancamentos {
  if (chave === 'periodo') return { ...f, periodo: SEM_PERIODO };
  if (chave === 'tipo') return { ...f, tipo: null };
  return { ...f, categorias: [] };
}
