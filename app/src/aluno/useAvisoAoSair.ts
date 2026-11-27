import { avisoAoSairComPendencias, diasDeAguaNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from '../dominio/treinosNaoEnviados';
import { useAluno } from '../offline/AlunoProvider';

/**
 * O aviso do "Sair" do aluno: o que ainda não foi enviado (treinos, mobilidade, água) e que sair apagaria; nulo sem nada.
 * Um lugar só para a Conta e a tela de bloqueio do contrato (D19). Dentro do `AlunoProvider`.
 */
export function useAvisoAoSair(): string | null {
  const aluno = useAluno();
  return avisoAoSairComPendencias(
    treinosNaoEnviados(aluno.registros, aluno.sessoesConcluidasNoAparelho),
    diasDeMobilidadeNaoEnviados(aluno.mobilidadeNoAparelho),
    diasDeAguaNaoEnviados(aluno.aguaNoAparelho),
  );
}
