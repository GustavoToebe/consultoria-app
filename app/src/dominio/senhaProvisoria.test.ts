import { ALFABETO_SENHA, errosDaNovaSenha, gerarSenhaProvisoria, pedeNovaSenha, senhaDosBytes, TAMANHO_SENHA } from './senhaProvisoria';

describe('senha provisória', () => {
  it('só o erro TROCA_DE_SENHA_NECESSARIA pede a senha nova', () => {
    expect(pedeNovaSenha({ codigo: 'TROCA_DE_SENHA_NECESSARIA', status: 401 })).toBe(true);
    expect(pedeNovaSenha({ codigo: 'CREDENCIAIS_INVALIDAS' })).toBe(false);
    expect(pedeNovaSenha({ codigo: 'MFA_NECESSARIO' })).toBe(false);
    expect(pedeNovaSenha(null)).toBe(false);
    expect(pedeNovaSenha('TROCA_DE_SENHA_NECESSARIA')).toBe(false);
  });

  it('confere tamanho e as duas senhas', () => {
    expect(errosDaNovaSenha('curta', 'curta')).toEqual({ nova: 'A senha precisa ter pelo menos 8 caracteres.' });
    expect(errosDaNovaSenha('senha-boa-1', 'senha-boa-2')).toEqual({ repetida: 'As senhas não conferem.' });
    expect(errosDaNovaSenha('senha-boa-1', 'senha-boa-1')).toEqual({});
  });

  it('o alfabeto não tem letras nem números ambíguos', () => {
    for (const c of '0Oo1lI') expect(ALFABETO_SENHA).not.toContain(c);
    expect(new Set(ALFABETO_SENHA).size).toBe(ALFABETO_SENHA.length);
  });

  it('descarta os bytes que dariam viés e para no tamanho', () => {
    const limite = 256 - (256 % ALFABETO_SENHA.length);
    const bytes = Uint8Array.from([255, limite, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(senhaDosBytes(bytes)).toBe(ALFABETO_SENHA.slice(0, 10));
    expect(senhaDosBytes(Uint8Array.from([255, 254, 0]))).toBeNull();
  });

  it('pede mais bytes até completar', () => {
    const sorteios = [new Uint8Array(32).fill(255), new Uint8Array(32).fill(3)];
    const senha = gerarSenhaProvisoria(() => sorteios.shift()!);
    expect(senha).toBe(ALFABETO_SENHA[3].repeat(TAMANHO_SENHA));
  });

  it('com bytes de verdade sai do tamanho e do alfabeto', () => {
    const senha = gerarSenhaProvisoria((n) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)));
    expect(senha).toHaveLength(TAMANHO_SENHA);
    for (const c of senha) expect(ALFABETO_SENHA).toContain(c);
  });
});
