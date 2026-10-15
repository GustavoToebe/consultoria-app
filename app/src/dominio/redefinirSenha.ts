/** Regras puras da redefinição de senha ("esqueci a senha"): leitura do link do e-mail e conferência dos campos. */

/**
 * Token do link do e-mail: vem no fragmento (`/redefinir-senha#token=...`), que não vai ao servidor nem ao Referer. Aceita o
 * `#` na frente ou não; sem o parâmetro `token`, ou vazio, não há link.
 */
export function tokenDoFragmento(fragmento: string | null | undefined): string | null {
  if (!fragmento) return null;
  const token = new URLSearchParams(fragmento.replace(/^#/, '')).get('token');
  return token && token.trim() ? token.trim() : null;
}

/** Primeiro problema dos campos (a API confere de novo e é quem manda), ou `null` se dá para enviar. */
export function problemaDaNovaSenha(senha: string, confirmacao: string, email?: string): string | null {
  if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (new TextEncoder().encode(senha).length > 72) return 'A senha pode ter no máximo 72 bytes (cerca de 72 letras sem acento).';
  if (email && senha.trim().toLowerCase() === email.trim().toLowerCase()) return 'A senha não pode ser igual ao e-mail.';
  if (senha !== confirmacao) return 'As senhas não conferem.';
  return null;
}
