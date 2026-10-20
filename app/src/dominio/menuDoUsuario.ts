export type IdDoItemDoMenu = 'meus-dados' | 'seguranca' | 'minha-conta' | 'ajustes' | 'sair';

export interface ItemDoMenuDoUsuario {
  id: IdDoItemDoMenu;
  rotulo: string;
  /** `null` em Sair: não abre tela, pede a confirmação. */
  href: string | null;
}

/**
 * Itens do menu do cartão do usuário (PC) e da tela Perfil (celular), na ordem em que aparecem. A Minha conta só entra com `CONTA_LER`. A tela de cada
 * item segue `podeAcessarTela`; Sair vem sempre por último, separado dos demais.
 */
export function itensDoMenuDoUsuario(pode: (codigo: string) => boolean): ItemDoMenuDoUsuario[] {
  return [
    { id: 'meus-dados', rotulo: 'Meus dados', href: '/treinador/meus-dados' },
    { id: 'seguranca', rotulo: 'Segurança', href: '/treinador/seguranca' },
    ...(pode('CONTA_LER') ? [{ id: 'minha-conta' as const, rotulo: 'Minha conta', href: '/treinador/minha-conta' }] : []),
    { id: 'ajustes', rotulo: 'Ajustes', href: '/treinador/ajustes' },
    { id: 'sair', rotulo: 'Sair', href: null },
  ];
}
