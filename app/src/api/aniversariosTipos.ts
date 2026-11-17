/**
 * `GET /alunos/aniversariantes?dias=&meus=` (`ALUNO_LER`): só nome, dia e mês. Nunca o ano nem a idade (D1 de
 * `docs/planos/aniversarios.md`); `diasAte` 0 = hoje.
 */
export interface AniversarianteDoAluno {
  alunoId: string;
  nome: string;
  dia: number;
  mes: number;
  diasAte: number;
}
