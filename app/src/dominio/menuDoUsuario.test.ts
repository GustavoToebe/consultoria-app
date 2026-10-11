import { itensDoMenuDoUsuario, voltarDasTelasDaConta } from './menuDoUsuario';

describe('menu do usuário', () => {
  it('traz Meus dados, Ajustes e Sair, com Sair por último e sem endereço', () => {
    const itens = itensDoMenuDoUsuario(() => false);
    expect(itens.map((i) => i.id)).toEqual(['meus-dados', 'ajustes', 'sair']);
    expect(itens[itens.length - 1].href).toBeNull();
    expect(itens.slice(0, -1).every((i) => i.href?.startsWith('/treinador/'))).toBe(true);
  });
});

describe('seta de voltar das telas da conta', () => {
  it('aparece só no celular, onde o Perfil é a porta de entrada', () => {
    expect(voltarDasTelasDaConta(390, 900)).toBe('/treinador/perfil');
    expect(voltarDasTelasDaConta(900, 900)).toBeUndefined();
    expect(voltarDasTelasDaConta(1280, 900)).toBeUndefined();
  });
});
