/** Nomes dos grupos do menu lateral do treinador (N29), na ordem em que aparecem. */
export const GRUPOS_DO_MENU = ['Alunos e acompanhamento', 'Negócio', 'Configurações'] as const;
export type GrupoDoMenu = (typeof GRUPOS_DO_MENU)[number];

export interface BlocoDoMenu<T> {
  /** Sem título: itens fora de grupo (o Início, no topo). */
  grupo?: GrupoDoMenu;
  itens: T[];
}

/**
 * Junta os itens do menu por grupo, na ordem em que cada grupo aparece pela primeira vez no array e mantendo a ordem dos
 * itens dentro dele. Recebe os itens já filtrados pela permissão: grupo sem item não vira bloco (some com o título).
 * Sem `grupo` em nenhum item, devolve um bloco só, sem título (o menu fica como era).
 */
export function gruposDoMenu<T extends { grupo?: GrupoDoMenu }>(itens: readonly T[]): BlocoDoMenu<T>[] {
  const blocos: BlocoDoMenu<T>[] = [];
  for (const item of itens) {
    const bloco = blocos.find((b) => b.grupo === item.grupo);
    if (bloco) bloco.itens.push(item);
    else blocos.push({ grupo: item.grupo, itens: [item] });
  }
  return blocos;
}

/** Rótulo do trilho do tablet e da barra do celular: o curto, quando existe (cerca de 10 letras cabem embaixo do ícone). */
export function rotuloCurtoDoMenu(item: { rotulo: string; rotuloCurto?: string }): string {
  return item.rotuloCurto ?? item.rotulo;
}
