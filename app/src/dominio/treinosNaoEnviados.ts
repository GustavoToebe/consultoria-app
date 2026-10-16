import type { RegistroLocal } from '../offline/repositorioLocal';

/**
 * Treinos (dia + sessão) com ao menos um registro ainda não enviado: LOCAL (na fila) ou FALHOU (recusado, esperando
 * "tentar de novo"). É o que "Sair" apagaria; o aviso fala em treinos porque é o que o aluno reconhece, não em séries.
 */
export function treinosNaoEnviados(registros: readonly Pick<RegistroLocal, 'situacao' | 'data' | 'sessaoUid'>[]): number {
  const treinos = new Set<string>();
  for (const r of registros) {
    if (r.situacao !== 'ENVIADO') treinos.add(`${r.data}|${r.sessaoUid}`);
  }
  return treinos.size;
}

/** Texto do painel "Sair da conta?" do aluno; sem treino pendente não há aviso. */
export function avisoAoSairComPendencias(treinos: number): string | null {
  if (treinos <= 0) return null;
  const quantos = treinos === 1 ? '1 treino ainda não enviado' : `${treinos} treinos ainda não enviados`;
  const esses = treinos === 1 ? 'esse registro' : 'esses registros';
  return `Você tem ${quantos}. Sair apaga ${esses}. Conecte-se e sincronize antes, se puder.`;
}
