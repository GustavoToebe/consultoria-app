import { itensDoMenuDoUsuario } from './menuDoUsuario';

describe('menu do usuário', () => {
  it('traz Configurações, Meus dados, Segurança, Aparência e preferências e Sair, com Sair por último e sem endereço', () => {
    const itens = itensDoMenuDoUsuario(() => false);
    expect(itens.map((i) => i.id)).toEqual(['configuracoes', 'meus-dados', 'seguranca', 'ajustes', 'sair']);
    expect(itens[itens.length - 1].href).toBeNull();
    expect(itens.slice(0, -1).every((i) => i.href?.startsWith('/treinador/'))).toBe(true);
  });
  it('Configurações é o primeiro item, para todo membro, e leva ao hub', () => {
    for (const itens of [itensDoMenuDoUsuario(() => false), itensDoMenuDoUsuario(() => true, true)]) {
      expect(itens[0]).toEqual({ id: 'configuracoes', rotulo: 'Configurações', href: '/treinador/configuracoes' });
    }
  });
  it('Assinatura e faturas entra entre Segurança e Aparência e preferências só com CONTA_LER', () => {
    const com = itensDoMenuDoUsuario((c) => c === 'CONTA_LER');
    expect(com.map((i) => i.id)).toEqual(['configuracoes', 'meus-dados', 'seguranca', 'minha-conta', 'ajustes', 'sair']);
    expect(com[3].href).toBe('/treinador/minha-conta');
    expect(itensDoMenuDoUsuario(() => false).some((i) => i.id === 'minha-conta')).toBe(false);
  });
  it('Marca entra antes de Aparência e preferências só para o perfil Administrador', () => {
    const admin = itensDoMenuDoUsuario(() => false, true);
    expect(admin.map((i) => i.id)).toEqual(['configuracoes', 'meus-dados', 'seguranca', 'marca', 'ajustes', 'sair']);
    expect(admin.find((i) => i.id === 'marca')?.href).toBe('/treinador/marca');
    expect(itensDoMenuDoUsuario((c) => c === 'MARCA_ALTERAR').some((i) => i.id === 'marca')).toBe(false);
  });
});
