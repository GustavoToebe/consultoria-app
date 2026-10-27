import { aoTrocarUnidade, outraUnidade, pausaEmDuasUnidades, unidadeVisivel } from './pausaDaTecnica';

describe('pausa da técnica num controle só', () => {
  test('os dois valores gravados, ou o pedido do treinador, mostram dois campos', () => {
    expect(pausaEmDuasUnidades({ pausaSegundos: 15, pausaRespiracoes: 3 }, false)).toBe(true);
    expect(pausaEmDuasUnidades({ pausaSegundos: 15, pausaRespiracoes: null }, false)).toBe(false);
    expect(pausaEmDuasUnidades({ pausaSegundos: null, pausaRespiracoes: null }, true)).toBe(true);
    expect(pausaEmDuasUnidades({}, false)).toBe(false);
  });

  test('a unidade vem do valor gravado; sem valor, fica a escolhida', () => {
    expect(unidadeVisivel('RESPIRACOES', { pausaSegundos: 20, pausaRespiracoes: null })).toBe('SEGUNDOS');
    expect(unidadeVisivel('SEGUNDOS', { pausaSegundos: null, pausaRespiracoes: 4 })).toBe('RESPIRACOES');
    expect(unidadeVisivel('RESPIRACOES', { pausaSegundos: null, pausaRespiracoes: null })).toBe('RESPIRACOES');
    expect(unidadeVisivel('SEGUNDOS', {})).toBe('SEGUNDOS');
  });

  test('trocar a unidade com valor limpa o valor (15 s não são 15 respirações)', () => {
    expect(aoTrocarUnidade({ pausaSegundos: 15, pausaRespiracoes: null }, 'SEGUNDOS', 'RESPIRACOES')).toEqual({ pausaSegundos: null, pausaRespiracoes: null });
    expect(aoTrocarUnidade({ pausaSegundos: null, pausaRespiracoes: 5 }, 'RESPIRACOES', 'SEGUNDOS')).toEqual({ pausaSegundos: null, pausaRespiracoes: null });
  });

  test('sem valor ou na mesma unidade, nada a gravar', () => {
    expect(aoTrocarUnidade({ pausaSegundos: null, pausaRespiracoes: null }, 'SEGUNDOS', 'RESPIRACOES')).toBeNull();
    expect(aoTrocarUnidade({ pausaSegundos: 15 }, 'SEGUNDOS', 'SEGUNDOS')).toBeNull();
  });

  test('a outra unidade', () => {
    expect(outraUnidade('SEGUNDOS')).toBe('RESPIRACOES');
    expect(outraUnidade('RESPIRACOES')).toBe('SEGUNDOS');
  });
});
