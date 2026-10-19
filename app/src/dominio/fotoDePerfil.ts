/**
 * Foto de perfil do aluno (opcional, reunião de 17/10): regras puras. A foto é pequena (fica no banco): o app reduz a
 * 512 px e o servidor recusa acima de 1024 px ou 300 KB. Sem foto, o círculo mostra as iniciais.
 */
export const LIMITES_FOTO_PERFIL = {
  /** Lados tentados, do maior para o menor, até caber em `bytesMaximo`. */
  lados: [512, 384, 256],
  /** O mesmo teto do servidor (`FotoPerfilService.BYTES_MAXIMO`). */
  bytesMaximo: 300_000,
} as const;

/** Até duas iniciais: a do primeiro e a do último nome ("Maria Fictícia Souza" → "MS"). Sem nome, "?". */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
