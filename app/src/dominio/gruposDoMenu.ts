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

/** Uma tela do menu lateral do treinador: o caminho, o grupo e as telas que se abrem a partir dela (fora do menu). */
export interface LugarNoMenu {
  caminho: string;
  /** Sem grupo: fica no topo (o Início). */
  grupo?: GrupoDoMenu;
  /** Telas sem item próprio que acendem este item e entram no mesmo grupo de "Todas as telas". */
  tambem?: readonly string[];
}

/**
 * Fonte única da ordem e dos grupos do menu do treinador (D6 de `docs/planos/auditoria-ficha.md`): o menu lateral
 * (`app/treinador/_layout.tsx`) e "Todas as telas" (`dominio/telas.ts`, D24) saem daqui. A ordem de Início, Alunos,
 * Biblioteca, Planejamento e Perfil é a da barra do celular. O Perfil só aparece no menu lateral do tablet nativo; na web
 * as telas dele (Meus dados, Segurança, Ajustes, Assinatura e faturas, Marca) ficam no cartão do usuário e, em "Todas as
 * telas", em Configurações, depois dos itens do menu.
 */
export const MENU_DO_TREINADOR: readonly LugarNoMenu[] = [
  { caminho: '/treinador' },
  { caminho: '/treinador/alunos', grupo: 'Alunos e acompanhamento' },
  { caminho: '/treinador/atualizacoes', grupo: 'Alunos e acompanhamento' },
  { caminho: '/treinador/agenda', grupo: 'Alunos e acompanhamento' },
  { caminho: '/treinador/biblioteca', grupo: 'Alunos e acompanhamento' },
  { caminho: '/treinador/planejamento', grupo: 'Alunos e acompanhamento' },
  { caminho: '/treinador/interessados', grupo: 'Negócio' },
  { caminho: '/treinador/financeiro', grupo: 'Negócio' },
  { caminho: '/treinador/numeros', grupo: 'Negócio' },
  {
    caminho: '/treinador/perfil',
    grupo: 'Configurações',
    tambem: ['/treinador/meus-dados', '/treinador/seguranca', '/treinador/ajustes', '/treinador/minha-conta', '/treinador/marca'],
  },
  { caminho: '/treinador/equipe', grupo: 'Configurações' },
  { caminho: '/treinador/importacao', grupo: 'Configurações' },
  // Termos e privacidade abre pela Ajuda no PC.
  { caminho: '/treinador/ajuda', grupo: 'Configurações', tambem: ['/treinador/termos'] },
  { caminho: '/treinador/auditoria', grupo: 'Configurações' },
];

/**
 * Põe os itens do menu na ordem de `MENU_DO_TREINADOR` e preenche o grupo e o `tambem` de cada um. Item cujo caminho não
 * está lá é um erro de programação: falha logo, para o menu e "Todas as telas" não se separarem em silêncio.
 */
export function naOrdemDoMenu<T extends { caminho: string }>(
  itens: readonly T[],
  menu: readonly LugarNoMenu[] = MENU_DO_TREINADOR,
): (T & { grupo?: GrupoDoMenu; tambem?: string[] })[] {
  const posicao = (caminho: string) => {
    const i = menu.findIndex((m) => m.caminho === caminho);
    if (i < 0) throw new Error(`Item do menu fora de MENU_DO_TREINADOR: ${caminho}`);
    return i;
  };
  return [...itens]
    .sort((a, b) => posicao(a.caminho) - posicao(b.caminho))
    .map((item) => {
      const lugar = menu[posicao(item.caminho)];
      return { ...item, grupo: lugar.grupo, ...(lugar.tambem ? { tambem: [...lugar.tambem] } : {}) };
    });
}

/** Onde uma tela fica no menu: a posição do item (dela própria ou de quem a abre) e se ela é o próprio item. */
export interface PosicaoNoMenu {
  grupo?: GrupoDoMenu;
  /** Índice do item em `MENU_DO_TREINADOR`. */
  indice: number;
  /** `false` quando a tela só é aberta a partir do item (`tambem`) ou é uma subpágina dele. */
  propria: boolean;
}

/**
 * Lugar de um caminho do treinador no menu: o item igual a ele, senão o item que o lista em `tambem`, senão o item de que
 * ele é subpágina (o mais específico). Fora disso, `null`.
 */
export function posicaoNoMenu(caminho: string, menu: readonly LugarNoMenu[] = MENU_DO_TREINADOR): PosicaoNoMenu | null {
  const igual = menu.findIndex((m) => m.caminho === caminho);
  if (igual >= 0) return { grupo: menu[igual].grupo, indice: igual, propria: true };
  const casa = (base: string) => caminho === base || caminho.startsWith(`${base}/`);
  const porTambem = menu.findIndex((m) => m.tambem?.some(casa));
  if (porTambem >= 0) return { grupo: menu[porTambem].grupo, indice: porTambem, propria: false };
  let melhor = -1;
  menu.forEach((m, i) => {
    if (m.caminho !== '/treinador' && casa(m.caminho) && (melhor < 0 || m.caminho.length > menu[melhor].caminho.length)) melhor = i;
  });
  return melhor >= 0 ? { grupo: menu[melhor].grupo, indice: melhor, propria: false } : null;
}
