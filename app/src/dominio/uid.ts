import { randomUUID } from 'expo-crypto';

/**
 * Todo item do plano nasce com um UUID gerado aqui e o mantém ao ser editado: é ele que liga o registro do aluno à
 * série (seção 7). Receita aplicada, cópia e replicação ganham uids novos.
 */
export function novoUid(): string {
  return randomUUID();
}
