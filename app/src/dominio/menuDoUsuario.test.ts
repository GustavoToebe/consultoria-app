import { itensDoMenuDoUsuario } from './menuDoUsuario';

describe('menu do usuário', () => {
  it('traz Meus dados, Segurança, Ajustes e Sair, com Sair por último e sem endereço', () => {
    const itens = itensDoMenuDoUsuario(() => false);
    expect(itens.map((i) => i.id)).toEqual(['meus-dados', 'seguranca', 'ajustes', 'sair']);
    expect(itens[itens.length - 1].href).toBeNull();
    expect(itens.slice(0, -1).every((i) => i.href?.startsWith('/treinador/'))).toBe(true);
  });
  it('Minha conta entra entre Segurança e Ajustes só com CONTA_LER', () => {
    const com = itensDoMenuDoUsuario((c) => c === 'CONTA_LER');
    expect(com.map((i) => i.id)).toEqual(['meus-dados', 'seguranca', 'minha-conta', 'ajustes', 'sair']);
    expect(com[2].href).toBe('/treinador/minha-conta');
    expect(itensDoMenuDoUsuario(() => false).some((i) => i.id === 'minha-conta')).toBe(false);
  });
});
