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

/** A partir desta largura (a do menu lateral) o círculo do topo da ficha é grande. */
export const LARGURA_FOTO_GRANDE = 768;
export const TAMANHO_FOTO_FICHA = { grande: 96, pequena: 72 } as const;

/**
 * Como a equipe troca a foto no círculo do topo da ficha: `camada` (escura por cima, no hover ou foco, com câmera e
 * lixeira lado a lado), `canto` (botão da câmera sempre visível, que abre a Folha) ou `nenhuma` (só a foto).
 */
export type EdicaoDaFotoNaFicha = 'nenhuma' | 'camada' | 'canto';

export interface FotoNaFicha {
  tamanho: number;
  edicao: EdicaoDaFotoNaFicha;
  /** Remover só aparece quando se sabe que há foto (`temFoto` nulo = ainda baixando). */
  lixeira: boolean;
}

/**
 * Regra do círculo do topo da ficha. Edita quem tem `ALUNO_ALTERAR` em aluno não anonimizado. A camada só vale com mouse
 * (sem hover não há como revelá-la) e no círculo grande: no de 72 px os dois botões de 44 px não cabem lado a lado.
 */
export function fotoNaFicha(o: { largura: number; comMouse: boolean; podeAlterar: boolean; anonimizado: boolean; temFoto: boolean | null }): FotoNaFicha {
  const grande = o.largura >= LARGURA_FOTO_GRANDE;
  const tamanho = grande ? TAMANHO_FOTO_FICHA.grande : TAMANHO_FOTO_FICHA.pequena;
  if (!o.podeAlterar || o.anonimizado) return { tamanho, edicao: 'nenhuma', lixeira: false };
  return { tamanho, edicao: o.comMouse && grande ? 'camada' : 'canto', lixeira: o.temFoto === true };
}

/** Até duas iniciais: a do primeiro e a do último nome ("Maria Fictícia Souza" → "MS"). Sem nome, "?". */
export function iniciais(nome: string | null | undefined): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primeira + ultima).toLocaleUpperCase('pt-BR');
}
