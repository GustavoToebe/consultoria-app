import type { PassoDaTrilha } from '../../ui/Cabecalho';

/**
 * Trilha do topo dos editores de plano. O plano não traz o nome do aluno, então o passo do meio é "Ficha do aluno"
 * (sem rota nova só para isso). Modelo do Planejamento não tem aluno.
 */
export function trilhaDoPlano(modelo: boolean, alunoId: string | null | undefined, rotulo: string): PassoDaTrilha[] {
  if (modelo || !alunoId) return [{ rotulo: 'Planejamento', href: '/treinador/planejamento' }, { rotulo }];
  return [
    { rotulo: 'Alunos', href: '/treinador/alunos' },
    { rotulo: 'Ficha do aluno', href: `/treinador/alunos/${alunoId}` },
    { rotulo },
  ];
}
