import type { Modalidade } from '../api/tipos';
import { chipDeUmaOpcao, chipDeVarias } from './filtrosDaBiblioteca';
import { chipsDosExercicios, nomeDaModalidade, semOFiltro, SEM_FILTROS_DE_EXERCICIOS, type FiltrosDeExercicios } from './exerciciosDaBiblioteca';
import { inteiroComMilhar } from './formatos';

export const CREDITOS_CATALOGO = {
  alimentos:
    'Alimentos: Tabela Brasileira de Composição de Alimentos – TACO, 4ª ed. (2011), NEPA/UNICAMP. Valores por 100 g. Preparações do Batel Grill: tabela da casa, só a caloria.',
  exercicios: 'Exercícios: exercicios-bd-ptbr (CC0), tradução do free-exercise-db (domínio público).',
};

/** Rodapé da lista: só aparece quando a busca tem mais resultados do que os mostrados. */
export function textoMostrando(mostrados: number, total: number): string | null {
  if (total <= mostrados) return null;
  return `Mostrando ${mostrados} de ${inteiroComMilhar(total)}. Refine a busca ou escolha um grupo para ver mais.`;
}

/** Instruções vêm separadas por quebra de linha, um passo por linha. */
export function passosDasInstrucoes(instrucoes: string | null | undefined): string[] {
  return (instrucoes ?? '').split('\n').map((p) => p.trim()).filter(Boolean);
}

/** Grupos musculares distintos da lista, em ordem alfabética (sem acento), para o filtro; sem grupo fica de fora. */
export function gruposDosExercicios(exercicios: { grupoMuscular: string | null }[]): string[] {
  const grupos = new Set(exercicios.map((e) => e.grupoMuscular?.trim()).filter((g): g is string => !!g));
  return [...grupos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Equipamento que só repete a modalidade ("Peso corporal · Abdômen · Peso corporal") sai da linha do catálogo; o
 * resto fica como a fonte manda. A aba Exercícios não passa por aqui: lá o equipamento é o que o treinador digitou.
 */
export function equipamentoDoCatalogo(modalidade: Modalidade, equipamento: string | null): string | null {
  const e = equipamento?.trim();
  return !e || e.toLowerCase() === nomeDaModalidade(modalidade).toLowerCase() ? null : e;
}

// ---- Traço (Tr) da TACO ----

/** Nutrientes que a linha mostra e que a fonte pode marcar como traço (o valor vem 0 e a tela diz "Tr", nunca 0). */
const NUTRIENTES_DA_LINHA = ['proteina', 'carboidrato', 'gordura', 'fibra'];

/** O item tem algum "Tr" à vista: a legenda só explica o "Tr" quando a página mostra algum. */
export const temTracoNaLinha = (a: { tracos: readonly string[] }): boolean => a.tracos.some((t) => NUTRIENTES_DA_LINHA.includes(t));

export const LEGENDA_DO_TRACO = 'Tr = traço (quantidade mínima)';

// ---- Filtro "Na biblioteca" ----

export type FiltroNaBiblioteca = 'TODOS' | 'NAO' | 'SIM';
export const OPCOES_NA_BIBLIOTECA: { valor: FiltroNaBiblioteca; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' }, { valor: 'NAO', rotulo: 'Ainda não' }, { valor: 'SIM', rotulo: 'Já tenho' },
];
/** No formato da API (`naBiblioteca`): `SIM` = `true`, `NAO` = `false`, `TODOS` = ausente. */
export const naBibliotecaParaApi = (f: FiltroNaBiblioteca): boolean | undefined => (f === 'TODOS' ? undefined : f === 'SIM');
const chipNaBiblioteca = (f: FiltroNaBiblioteca) =>
  chipDeUmaOpcao('Na biblioteca', f, 'TODOS', OPCOES_NA_BIBLIOTECA).map((c) => ({ ...c, chave: 'naBiblioteca' as const }));

/** Exercícios do catálogo: os filtros da aba Exercícios (o vídeo fica sempre em "Todos": o catálogo não tem vídeo) e o "Na biblioteca". */
export interface FiltrosDoCatalogoDeExercicios extends FiltrosDeExercicios { naBiblioteca: FiltroNaBiblioteca }
export const SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS: FiltrosDoCatalogoDeExercicios = { ...SEM_FILTROS_DE_EXERCICIOS, naBiblioteca: 'TODOS' };

export const chipsDoCatalogoDeExercicios = (f: FiltrosDoCatalogoDeExercicios, opcoesDeGrupo: readonly { valor: string; rotulo: string }[]) =>
  [...chipsDosExercicios(f, opcoesDeGrupo), ...chipNaBiblioteca(f.naBiblioteca)];

export function semOFiltroDoCatalogoDeExercicios(f: FiltrosDoCatalogoDeExercicios, chave: string): FiltrosDoCatalogoDeExercicios {
  return chave === 'naBiblioteca' ? { ...f, naBiblioteca: 'TODOS' } : { ...semOFiltro(f, chave), naBiblioteca: f.naBiblioteca };
}

/**
 * Alimentos do catálogo: Grupo e Unidade da aba Alimentos e o "Na biblioteca". Fonte e Preparo ficam de fora: a fonte é
 * um texto por item e o fator de cocção do catálogo quase sempre vem vazio (a importação o estima).
 */
export interface FiltrosDoCatalogoDeAlimentos { grupos: ReadonlySet<string>; unidades: ReadonlySet<string>; naBiblioteca: FiltroNaBiblioteca }
export const SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS: FiltrosDoCatalogoDeAlimentos = { grupos: new Set(), unidades: new Set(), naBiblioteca: 'TODOS' };
/** O catálogo só tem gramas e mililitros (as preparações do Batel em ml). */
export const UNIDADES_DO_CATALOGO = [{ valor: 'g', rotulo: 'Gramas (g)' }, { valor: 'ml', rotulo: 'Mililitros (ml)' }];

export const chipsDoCatalogoDeAlimentos = (f: FiltrosDoCatalogoDeAlimentos, opcoesDeGrupo: readonly { valor: string; rotulo: string }[]) => [
  ...chipDeVarias('Grupo', f.grupos, opcoesDeGrupo).map((c) => ({ ...c, chave: 'grupos' as const })),
  ...chipDeVarias('Unidade', f.unidades, UNIDADES_DO_CATALOGO).map((c) => ({ ...c, chave: 'unidades' as const })),
  ...chipNaBiblioteca(f.naBiblioteca),
];

export function semOFiltroDoCatalogoDeAlimentos(f: FiltrosDoCatalogoDeAlimentos, chave: string): FiltrosDoCatalogoDeAlimentos {
  if (chave === 'grupos') return { ...f, grupos: new Set() };
  if (chave === 'unidades') return { ...f, unidades: new Set() };
  if (chave === 'naBiblioteca') return { ...f, naBiblioteca: 'TODOS' };
  return f;
}
