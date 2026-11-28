import { forcaDaSenha, motivoDaTrocaDeSenha, PARTES_DO_NIVEL, problemaNoCampoDaNovaSenha, textoDaForca } from './trocaDeSenha';

describe('quando "Trocar senha" habilita', () => {
  it('pede as duas senhas e a nova pela regra da API (8+, até 72 bytes, diferente do e-mail)', () => {
    expect(motivoDaTrocaDeSenha('', 'senha-nova-1', 'a@exemplo.test')).toBe('Preencha a senha atual e a nova.');
    expect(motivoDaTrocaDeSenha('atual-123', '', 'a@exemplo.test')).toBe('Preencha a senha atual e a nova.');
    expect(motivoDaTrocaDeSenha('atual-123', 'curta', 'a@exemplo.test')).toBe('A senha precisa ter pelo menos 8 caracteres.');
    expect(motivoDaTrocaDeSenha('atual-123', 'A@Exemplo.test ', 'a@exemplo.test')).toBe('Corrija a nova senha.');
    expect(motivoDaTrocaDeSenha('atual-123', 'é'.repeat(37), null)).toBe('Corrija a nova senha.');
    expect(motivoDaTrocaDeSenha('atual-123', 'senha-nova-1', 'a@exemplo.test')).toBeNull();
    expect(motivoDaTrocaDeSenha('atual-123', 'senha-nova-1', undefined)).toBeNull();
  });

  it('no campo vai o problema além do tamanho (o tamanho fica com o indicador)', () => {
    expect(problemaNoCampoDaNovaSenha('curta', 'a@exemplo.test')).toBeNull();
    expect(problemaNoCampoDaNovaSenha('a@exemplo.test', 'a@exemplo.test')).toBe('A senha não pode ser igual ao e-mail.');
    expect(problemaNoCampoDaNovaSenha('é'.repeat(37), null)).toMatch(/72 bytes/);
    expect(problemaNoCampoDaNovaSenha('senha-nova-1', 'a@exemplo.test')).toBeNull();
  });
});

describe('força da senha', () => {
  it('sem nada digitado não há indicador; abaixo de 8 é curta', () => {
    expect(forcaDaSenha('')).toBeNull();
    expect(forcaDaSenha('Ab1!')).toBe('curta');
    expect(forcaDaSenha('abcdefg')).toBe('curta');
  });

  it('conta só tamanho e variedade', () => {
    expect(forcaDaSenha('abcdefgh')).toBe('fraca');
    expect(forcaDaSenha('abcdefg1')).toBe('fraca');
    expect(forcaDaSenha('aaaaaaaaaaaa')).toBe('fraca');
    expect(forcaDaSenha('Abcdefg1')).toBe('media');
    expect(forcaDaSenha('aaaaaaaaaaaaaaaa')).toBe('media');
    expect(forcaDaSenha('abcdefghij12')).toBe('media');
    expect(forcaDaSenha('Abcdefgh123!')).toBe('forte');
    expect(forcaDaSenha('uma frase bem comprida')).toBe('forte');
  });

  it('acentos e emoji contam como letra e símbolo; o tamanho é por caractere, não por unidade de código', () => {
    expect(forcaDaSenha('ação')).toBe('curta');
    expect(forcaDaSenha('🔒🔒🔒🔒')).toBe('curta');
    expect(forcaDaSenha('Ação9876')).toBe('media');
  });

  it('a barra e o texto acompanham o nível', () => {
    expect(PARTES_DO_NIVEL.curta).toBe(0);
    expect(PARTES_DO_NIVEL.forte).toBe(3);
    expect(textoDaForca('curta')).toBe('Força da senha: curta. Use pelo menos 8 caracteres.');
    expect(textoDaForca('media')).toMatch(/^Força da senha: média\./);
    expect(textoDaForca('forte')).toBe('Força da senha: forte.');
  });
});
