import { entradaDoTelefone, erroDoCampoTelefone, NAO_E_TELEFONE } from './entradaDoTelefone';

describe('entrada do telefone', () => {
  it('aplica a máscara do pacote ao que é só número', () => {
    expect(entradaDoTelefone('45999998888', '')).toEqual({ valor: '(45) 99999-8888', erro: null });
    expect(entradaDoTelefone('+55 45 99999-8888', '')).toEqual({ valor: '(45) 99999-8888', erro: null });
    expect(entradaDoTelefone('4532221111', '')).toEqual({ valor: '(45) 3222-1111', erro: null });
    expect(entradaDoTelefone('', '(45) 9')).toEqual({ valor: '', erro: null });
  });

  it('recusa e-mail ou letras e mantém o valor anterior (a máscara apagaria o telefone)', () => {
    expect(entradaDoTelefone('treinadora@exemplo.test', '(45) 99999-8888')).toEqual({ valor: '(45) 99999-8888', erro: NAO_E_TELEFONE });
    expect(entradaDoTelefone('(45) 9999a', '(45) 9999')).toEqual({ valor: '(45) 9999', erro: NAO_E_TELEFONE });
    expect(entradaDoTelefone('Ana Fictícia', '')).toEqual({ valor: '', erro: NAO_E_TELEFONE });
    expect(entradaDoTelefone('@', '')).toEqual({ valor: '', erro: NAO_E_TELEFONE });
  });

  it('o erro do campo: a recusa vale mais; o telefone inválido só ao conferir; vazio é válido', () => {
    expect(erroDoCampoTelefone(NAO_E_TELEFONE, '(45) 99999-8888', false)).toBe(NAO_E_TELEFONE);
    expect(erroDoCampoTelefone(null, '(45) 9999', false)).toBeNull();
    expect(erroDoCampoTelefone(null, '(45) 9999', true)).toBe('Telefone inválido. Informe o DDD e o número.');
    expect(erroDoCampoTelefone(null, '(45) 99999-8888', true)).toBeNull();
    expect(erroDoCampoTelefone(null, '', true)).toBeNull();
  });
});
