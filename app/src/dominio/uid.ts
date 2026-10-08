import { getRandomBytes, randomUUID } from 'expo-crypto';

/**
 * Todo item do plano nasce com um UUID gerado aqui e o mantém ao ser editado: é ele que liga o registro do aluno à
 * série (seção 7). Receita aplicada, cópia e replicação ganham uids novos.
 *
 * Na web, `crypto.randomUUID` só existe em origem segura (https/localhost); acessando pelo IP da rede em http ele some
 * e quebraria "Adicionar sessão" e as receitas. `getRandomValues` funciona em qualquer origem.
 */
export function novoUid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return randomUUID();
  const b = getRandomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
