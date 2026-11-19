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

/** Círculo ao lado do nome, no cabeçalho da ficha (18/11): 56 px em qualquer largura, acima do alvo de toque de 44. */
export const TAMANHO_FOTO_FICHA = 56;

/**
 * Como a equipe troca a foto no círculo do cabeçalho da ficha: `canto` (o círculo inteiro é o botão "Trocar foto", com a
 * câmera pequena no canto só no hover e no foco, e abre a Folha "Foto de perfil") ou `nenhuma` (só a foto).
 */
export type EdicaoDaFotoNaFicha = 'nenhuma' | 'canto';

export interface FotoNaFicha {
  tamanho: number;
  edicao: EdicaoDaFotoNaFicha;
  /** Remover só aparece quando se sabe que há foto (`temFoto` nulo = ainda baixando). */
  lixeira: boolean;
}

/** Regra do círculo do cabeçalho da ficha. Edita quem tem `ALUNO_ALTERAR` em aluno não anonimizado. */
export function fotoNaFicha(o: { podeAlterar: boolean; anonimizado: boolean; temFoto: boolean | null }): FotoNaFicha {
  const tamanho = TAMANHO_FOTO_FICHA;
  if (!o.podeAlterar || o.anonimizado) return { tamanho, edicao: 'nenhuma', lixeira: false };
  return { tamanho, edicao: 'canto', lixeira: o.temFoto === true };
}

/** Até duas iniciais: a do primeiro e a do último nome ("Maria Fictícia Souza" → "MS"). Sem nome, "?". */
export function iniciais(nome: string | null | undefined): string {
  // A inicial é a primeira letra ou dígito de cada parte: "Ana (Aninha)" → "AA", nunca "A(".
  const partes = (nome ?? '').trim().split(/\s+/).map((p) => p.match(/[\p{L}\p{N}]/u)?.[0] ?? '').filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0];
  const ultima = partes.length > 1 ? partes[partes.length - 1] : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
