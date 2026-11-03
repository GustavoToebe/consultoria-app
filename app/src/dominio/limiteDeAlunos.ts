/**
 * Limite de alunos por membro da equipe (supervisão da equipe, D2 a D8, D13, D14 e D22): só o Administrador grava, em
 * `PUT /usuarios/{id}/limite-de-alunos {limite}`. Em branco = sem limite (`null`); 0 = o membro não recebe aluno novo.
 * O limite conta só alunos ativos; quem já passou dele não perde aluno (D4). A API confere de novo.
 */

export const LIMITE_MAXIMO_DE_ALUNOS = 999;

/** Mesmo texto do 422 da API (campo `limite`), sem repetir o valor digitado. */
export const ERRO_DO_LIMITE = `Informe um número inteiro de 0 a ${LIMITE_MAXIMO_DE_ALUNOS}, ou deixe em branco para não ter limite.`;

/** Ajuda do campo: o que conta, o que o 0 faz e o que nunca é barrado (D4, D6, D8). */
export const AJUDA_DO_LIMITE =
  'Conta só alunos ativos com este membro como responsável. Em branco: sem limite. 0: não recebe aluno novo. '
  + 'Baixar o limite não tira aluno de ninguém: só impede receber novos.';

export type LeituraDoLimite = { ok: true; limite: number | null } | { ok: false; erro: string };

/** Texto do campo → limite. Só dígitos (nada de `1,5`, `-1` ou `+3`), de 0 a 999; vazio = sem limite. */
export function lerLimiteDeAlunos(texto: string): LeituraDoLimite {
  const t = texto.trim();
  if (t === '') return { ok: true, limite: null };
  if (!/^\d{1,3}$/.test(t)) return { ok: false, erro: ERRO_DO_LIMITE };
  return { ok: true, limite: Number(t) };
}

/** Limite gravado → texto do campo (nulo = vazio). */
export const limiteParaCampo = (limite: number | null | undefined): string => (typeof limite === 'number' ? String(limite) : '');

/** "Sem limite de alunos", "Limite: 1 aluno", "Limite: 30 alunos", "Limite: 0 (não recebe aluno novo)". */
export function textoDoLimite(limite: number | null | undefined): string {
  if (typeof limite !== 'number') return 'Sem limite de alunos';
  if (limite === 0) return 'Limite: 0 (não recebe aluno novo)';
  return `Limite: ${limite} ${limite === 1 ? 'aluno' : 'alunos'}`;
}

/** Situação de quem tem limite: abaixo dele, cheio (não recebe mais) ou acima (D4: ninguém perde aluno). */
export type SituacaoDoLimite = 'sem-limite' | 'com-vaga' | 'cheio' | 'acima';

export function situacaoDoLimite(alunosAtivos: number, limite: number | null | undefined): SituacaoDoLimite {
  if (typeof limite !== 'number') return 'sem-limite';
  if (alunosAtivos > limite) return 'acima';
  return alunosAtivos === limite ? 'cheio' : 'com-vaga';
}
