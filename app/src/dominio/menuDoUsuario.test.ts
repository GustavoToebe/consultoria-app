import { itensDoMenuDoUsuario, voltarDasTelasDaConta } from './menuDoUsuario';

describe('menu do usuário', () => {
  it('traz Meus dados, Ajustes e Sair, com Sair por último e sem endereço', () => {
    const itens = itensDoMenuDoUsuario(() => false);
    expect(itens.map((i) => i.id)).toEqual(['meus-dados', 'ajustes', 'sair']);
    expect(itens[itens.length - 1].href).toBeNull();
    expect(itens.slice(0, -1).every((i) => i.href?.startsWith('/treinador/'))).toBe(true);
  });
  it('Minha conta entra entre Meus dados e Ajustes só com CONTA_LER', () => {
    const com = itensDoMenuDoUsuario((c) => c === 'CONTA_LER');
    expect(com.map((i) => i.id)).toEqual(['meus-dados', 'minha-conta', 'ajustes', 'sair']);
    expect(com[1].href).toBe('/treinador/minha-conta');
    expect(itensDoMenuDoUsuario(() => false).some((i) => i.id === 'minha-conta')).toBe(false);
  });
});

describe('seta de voltar das telas da conta', () => {
  it('aparece só no celular, onde o Perfil é a porta de entrada', () => {
    expect(voltarDasTelasDaConta(390, 900)).toBe('/treinador/perfil');
    expect(voltarDasTelasDaConta(900, 900)).toBeUndefined();
    expect(voltarDasTelasDaConta(1280, 900)).toBeUndefined();
  });
});
