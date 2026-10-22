import type { ExercicioPlano, Grupo } from '../api/tipos';
import { grupoEmSequencia, type GrupoDeExercicios } from './combinacoes';
import { rotuloDescanso } from './descanso';

/**
 * Texto dos grupos de exercícios (superset, circuito, pré e pós-exaustão...) na tela do aluno e no PDF. Só repete o que o
 * treinador escreveu no grupo (ordem, voltas, descanso); a explicação da combinação vem da metodologia.
 */

/** "A → B → C": a ordem dos exercícios do grupo (exercício sem nome entra como "exercício N"). */
export function ordemDoGrupo(exercicios: readonly Pick<ExercicioPlano, 'nome'>[]): string {
  return exercicios.map((e, i) => e.nome?.trim() || `exercício ${i + 1}`).join(' → ');
}

/** "3 voltas" / "1 volta"; vazio sem voltas. */
export function textoDasVoltas(voltas: number | null | undefined): string {
  if (!voltas || voltas < 1) return '';
  return voltas === 1 ? '1 volta' : `${voltas} voltas`;
}

/**
 * O descanso do grupo: depois de cada volta (superset, agonista-antagonista, tri-set, giant set, circuito) o descanso do
 * grupo vale no lugar do descanso por série dos membros; em pré e pós-exaustão cada série mantém o seu. Vazio quando o
 * treinador não informou o descanso do grupo.
 */
export function textoDoDescansoDoGrupo(g: Pick<Grupo, 'tecnica' | 'descansoAposSegundos'>): string {
  if (grupoEmSequencia(g.tecnica)) return 'cada série mantém o seu descanso';
  if (g.descansoAposSegundos == null) return '';
  if (g.descansoAposSegundos <= 0) return 'sem descanso depois do grupo';
  return `descanso de ${rotuloDescanso(g.descansoAposSegundos)} depois de cada volta do grupo`;
}

/** O descanso por série dos membros não vale (o do grupo vale no lugar): todos os grupos, menos pré e pós-exaustão. */
export const descansoSoDoGrupo = (g: Pick<Grupo, 'tecnica'>): boolean => !grupoEmSequencia(g.tecnica);

/**
 * Descrição do bloco por extenso: "2 exercícios, nesta ordem: Supino → Remada · descanso de 1 min 30 s depois de cada
 * volta do grupo". O nome da combinação fica de fora (quem mostra põe o nome em destaque). Vazio para exercício solto.
 */
export function detalheDoBloco(bloco: GrupoDeExercicios): string {
  if (!bloco.grupo || !bloco.nome) return '';
  const n = bloco.exercicios.length;
  const partes = [`${n} exercícios, nesta ordem: ${ordemDoGrupo(bloco.exercicios)}`];
  const voltas = bloco.grupo.tecnica === 'CIRCUITO' ? textoDasVoltas(bloco.grupo.voltas) : '';
  if (voltas) partes.push(voltas);
  const descanso = textoDoDescansoDoGrupo(bloco.grupo);
  if (descanso) partes.push(descanso);
  return partes.join(' · ');
}
