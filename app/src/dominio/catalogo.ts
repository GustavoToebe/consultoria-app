import { numeroParaTela } from './formatos';

export const CREDITOS_CATALOGO = {
  alimentos:
    'Alimentos: Tabela Brasileira de Composição de Alimentos – TACO, 4ª ed. (2011), NEPA/UNICAMP. Valores por 100 g.',
  exercicios: 'Exercícios: exercicios-bd-ptbr (CC0), tradução do free-exercise-db (domínio público).',
};

interface NutrientesDoCatalogo {
  baseQuantidade: number;
  baseUnidade: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  tracos: string[];
}

/** Nutriente que a fonte marca como traço (`Tr`) vem 0 da API e aparece como "Tr", nunca como 0. */
function nutriente(valor: number, nome: string, tracos: string[], casas: number): string {
  return tracos.includes(nome) ? 'Tr' : numeroParaTela(valor, casas);
}

/** "100 g · 128 kcal · P 2,5 · C 28,1 · G Tr" */
export function resumoNutrientes(a: NutrientesDoCatalogo): string {
  return `${numeroParaTela(a.baseQuantidade)} ${a.baseUnidade} · ${numeroParaTela(a.kcal, 0)} kcal · `
    + `P ${nutriente(a.proteina, 'proteina', a.tracos, 1)} · C ${nutriente(a.carboidrato, 'carboidrato', a.tracos, 1)} · `
    + `G ${nutriente(a.gordura, 'gordura', a.tracos, 1)}`;
}

/** Rodapé da lista: só aparece quando a busca tem mais resultados do que os mostrados. */
export function textoMostrando(mostrados: number, total: number): string | null {
  if (total <= mostrados) return null;
  return `Mostrando ${mostrados} de ${total}. Refine a busca ou escolha um grupo para ver mais.`;
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
