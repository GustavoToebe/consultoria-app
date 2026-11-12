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

/** A partir desta largura (a do menu lateral) o círculo ao lado do nome é o maior. */
export const LARGURA_FOTO_GRANDE = 768;
/**
 * Círculo ao lado do nome, no cabeçalho da ficha (guia de 11/11, pág. 31): no PC acompanha a trilha e o título; no celular,
 * a seta de voltar. Os dois têm o alvo de toque de 44 px.
 */
export const TAMANHO_FOTO_FICHA = { grande: 56, pequena: 44 } as const;

/**
 * Como a equipe troca a foto no círculo do cabeçalho da ficha: `canto` (o círculo inteiro é o botão, com a câmera pequena
 * no canto, e abre a Folha "Foto de perfil") ou `nenhuma` (só a foto). A camada escura com dois botões saiu: no círculo
 * pequeno os dois alvos de 44 px não cabem.
 */
export type EdicaoDaFotoNaFicha = 'nenhuma' | 'canto';

export interface FotoNaFicha {
  tamanho: number;
  edicao: EdicaoDaFotoNaFicha;
  /** Remover só aparece quando se sabe que há foto (`temFoto` nulo = ainda baixando). */
  lixeira: boolean;
}

/** Regra do círculo do cabeçalho da ficha. Edita quem tem `ALUNO_ALTERAR` em aluno não anonimizado. */
export function fotoNaFicha(o: { largura: number; podeAlterar: boolean; anonimizado: boolean; temFoto: boolean | null }): FotoNaFicha {
  const tamanho = o.largura >= LARGURA_FOTO_GRANDE ? TAMANHO_FOTO_FICHA.grande : TAMANHO_FOTO_FICHA.pequena;
  if (!o.podeAlterar || o.anonimizado) return { tamanho, edicao: 'nenhuma', lixeira: false };
  return { tamanho, edicao: 'canto', lixeira: o.temFoto === true };
}

/** Até duas iniciais: a do primeiro e a do último nome ("Maria Fictícia Souza" → "MS"). Sem nome, "?". */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
