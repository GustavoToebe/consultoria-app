import { FILTROS_PASTAS, type FiltroPastas } from './pastas';

/**
 * Filtros que moram num cartão ou numa folha (`docs/planos/filtros-laterais.md`, passo 7A): Pastas (situação), Registros e
 * cargas da pasta (período e plano), Registros do Histórico do aluno (período) e o grupo muscular das folhas de escolher
 * exercícios (editor de treino e Progresso por exercício). Cada um tem as etiquetas e o contador próprios; o aluno ou a
 * pasta do cartão são contexto (não contam nem viram etiqueta). Estado local da tela, como antes: nada vai ao endereço.
 * Funções puras.
 */

export interface ChipDoCartao<C extends string> { chave: C; texto: string }
interface Opcao<T extends string> { valor: T; rotulo: string }

const rotuloDe = <T extends string>(opcoes: readonly Opcao<T>[], valor: T): string | undefined => opcoes.find((o) => o.valor === valor)?.rotulo;

// Pastas de plano

export const PASTAS_SEM_FILTRO: FiltroPastas = 'todas';

/** "Situação: Abertas"; "Todas" não restringe. */
export function chipsDasPastas(filtro: FiltroPastas): ChipDoCartao<'situacao'>[] {
  if (filtro === PASTAS_SEM_FILTRO) return [];
  return [{ chave: 'situacao', texto: `Situação: ${rotuloDe(FILTROS_PASTAS, filtro) ?? filtro}` }];
}

// Registros e cargas (dentro da pasta)

export interface FiltrosDeRegistros {
  /** Dias para trás ('14', '30', '60'): só vale na pasta sem período. */
  dias: string;
  /** `'todos'` ou o id do plano de treino. */
  planoId: string;
}
export type ChaveDeRegistros = keyof FiltrosDeRegistros;
export const TODOS_OS_PLANOS = 'todos';
/** O período é obrigatório (D5): "Limpar filtros" volta aos 14 dias, que não contam no botão. */
export const REGISTROS_SEM_FILTRO: FiltrosDeRegistros = { dias: '14', planoId: TODOS_OS_PLANOS };

/**
 * Etiquetas dos Registros. O período só conta onde a pasta não tem o dela (`comPeriodo`) e fora do padrão; o plano, só
 * se ainda existe na lista (o que sumiu já vale como "Todos os planos" na tela).
 */
export function chipsDeRegistros(
  f: FiltrosDeRegistros,
  contexto: { comPeriodo: boolean; periodos: readonly Opcao<string>[]; planos: readonly Opcao<string>[] },
): ChipDoCartao<ChaveDeRegistros>[] {
  const plano = f.planoId === TODOS_OS_PLANOS ? undefined : rotuloDe(contexto.planos, f.planoId);
  return [
    ...(contexto.comPeriodo && f.dias !== REGISTROS_SEM_FILTRO.dias ? [{ chave: 'dias' as const, texto: `Período: ${rotuloDe(contexto.periodos, f.dias) ?? `${f.dias} dias`}` }] : []),
    ...(plano ? [{ chave: 'planoId' as const, texto: `Plano: ${plano}` }] : []),
  ];
}

export const semOFiltroDeRegistros = (f: FiltrosDeRegistros, chave: ChaveDeRegistros): FiltrosDeRegistros => ({ ...f, [chave]: REGISTROS_SEM_FILTRO[chave] });

// Período do Histórico do aluno

/**
 * O período do Histórico é obrigatório (D5): o padrão é a primeira opção (a pasta em uso, ou os últimos 30 dias) e não vira
 * etiqueta; qualquer outra vira "Período: Pasta anterior". `efetivo` é o que a tela usa (`periodoValido`).
 */
export function chipsDoPeriodoDoHistorico<T extends string>(efetivo: T, opcoes: readonly Opcao<T>[]): ChipDoCartao<'periodo'>[] {
  if (opcoes.length === 0 || efetivo === opcoes[0].valor) return [];
  return [{ chave: 'periodo', texto: `Período: ${rotuloDe(opcoes, efetivo) ?? efetivo}` }];
}

// Grupo muscular das folhas de escolher exercícios

/** "Grupo muscular: Peito"; `todos` (o valor de "Todos" daquela folha) não restringe. */
export function chipsDoGrupo(grupo: string, todos: string): ChipDoCartao<'grupo'>[] {
  return grupo === todos ? [] : [{ chave: 'grupo', texto: `Grupo muscular: ${grupo}` }];
}

/**
 * Seleção do "Escolher exercício" (editor de treino) depois de aplicar outros filtros (D9): só se adiciona o que passa neles,
 * então sai da seleção o que não passa, com aviso de quantos saíram. `passam` nulo = nenhum filtro (nada sai). `grupo` é o
 * nome quando o único filtro é um grupo só (a frase diz qual); senão a frase fala dos filtros. Aplicar o mesmo nem chega aqui.
 */
export function selecaoDepoisDoGrupo(marcados: ReadonlySet<string>, passam: ReadonlySet<string> | null, grupo: string | null):
  { marcados: ReadonlySet<string>; aviso: string | null } {
  if (!passam) return { marcados, aviso: null };
  const ficam = new Set([...marcados].filter((id) => passam.has(id)));
  const sairam = marcados.size - ficam.size;
  if (sairam === 0) return { marcados, aviso: null };
  const um = sairam === 1;
  const motivo = grupo ? (um ? `não é do grupo ${grupo}` : `não são do grupo ${grupo}`) : (um ? 'não passa nos filtros' : 'não passam nos filtros');
  return {
    marcados: ficam,
    aviso: um ? `1 exercício marcado saiu da seleção porque ${motivo}.` : `${sairam} exercícios marcados saíram da seleção porque ${motivo}.`,
  };
}
