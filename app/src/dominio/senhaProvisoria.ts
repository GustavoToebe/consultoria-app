import { getRandomBytes } from 'expo-crypto';

/** Senha provisória que o treinador define para o aluno: o primeiro login pede uma senha nova antes de entrar. */

/** O login respondeu "crie a sua senha": a tela de entrar passa ao passo da senha nova. */
export function pedeNovaSenha(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && (erro as { codigo?: unknown }).codigo === 'TROCA_DE_SENHA_NECESSARIA';
}

/** Conferência antes de enviar (o servidor confere de novo): mínimo de 8 caracteres e as duas iguais. */
export function errosDaNovaSenha(nova: string, repetida: string): { nova?: string; repetida?: string } {
  const erros: { nova?: string; repetida?: string } = {};
  if (nova.length < 8) erros.nova = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (nova !== repetida) erros.repetida = 'As senhas não conferem.';
  return erros;
}

/** Sem 0/O/o, 1/l/I: o treinador dita ou copia a senha para o aluno. */
export const ALFABETO_SENHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TAMANHO_SENHA = 10;

/**
 * Parte pura: aproveita os bytes que caem abaixo do maior múltiplo do alfabeto (sem viés) até juntar o tamanho.
 * Devolve `null` se os bytes não bastaram.
 */
export function senhaDosBytes(bytes: Uint8Array, tamanho = TAMANHO_SENHA): string | null {
  const limite = 256 - (256 % ALFABETO_SENHA.length);
  let senha = '';
  for (const b of bytes) {
    if (b >= limite) continue;
    senha += ALFABETO_SENHA[b % ALFABETO_SENHA.length];
    if (senha.length === tamanho) return senha;
  }
  return null;
}

export function gerarSenhaProvisoria(sortear: (n: number) => Uint8Array = getRandomBytes): string {
  for (;;) {
    const senha = senhaDosBytes(sortear(32));
    if (senha) return senha;
  }
}
