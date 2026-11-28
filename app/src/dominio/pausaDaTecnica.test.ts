import { aoTrocarUnidade, aplicarPausa, dicaDaPausaEntreBlocos, outraUnidade, pausaEmDuasUnidades, unidadeVisivel } from './pausaDaTecnica';
import { problemasDaTecnica } from './validacaoDeSerie';

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

describe('pausa entre blocos da série aberta (dois campos fixos)', () => {
  test('dica com o texto do aluno, tempo primeiro', () => {
    const resto = 'Deixe as respirações em branco para usar só o tempo.';
    expect(dicaDaPausaEntreBlocos({ pausaSegundos: 20, pausaRespiracoes: 4 })).toBe(`O aluno vê "20 s ou 4 respirações". ${resto}`);
    expect(dicaDaPausaEntreBlocos({ pausaSegundos: null, pausaRespiracoes: null })).toBe(`O aluno vê "15 s ou 3 respirações". ${resto}`);
    expect(dicaDaPausaEntreBlocos({})).toBe(`O aluno vê "15 s ou 3 respirações". ${resto}`);
    expect(dicaDaPausaEntreBlocos({ pausaSegundos: 15, pausaRespiracoes: null })).toBe('O aluno vê "15 s".');
    expect(dicaDaPausaEntreBlocos({ pausaSegundos: null, pausaRespiracoes: 3 })).toBe('O aluno vê "3 respirações".');
    expect(dicaDaPausaEntreBlocos({ pausaRespiracoes: 1 })).toBe('O aluno vê "1 respiração".');
  });

  test('preencher um campo não apaga nem converte o outro', () => {
    expect(aplicarPausa({ pausaSegundos: null, pausaRespiracoes: 3 }, { segundos: 15 })).toEqual({ pausaSegundos: 15, pausaRespiracoes: 3 });
    expect(aplicarPausa({ pausaSegundos: 15, pausaRespiracoes: null }, { respiracoes: 3 })).toEqual({ pausaSegundos: 15, pausaRespiracoes: 3 });
    expect(aplicarPausa({}, { segundos: 20 })).toEqual({ pausaSegundos: 20, pausaRespiracoes: null });
  });

  test('esvaziar um campo mantém o outro; os dois vazios ficam sem pausa', () => {
    const ambos = { pausaSegundos: 15, pausaRespiracoes: 3 };
    expect(aplicarPausa(ambos, { respiracoes: null })).toEqual({ pausaSegundos: 15, pausaRespiracoes: null });
    expect(aplicarPausa(ambos, { segundos: null })).toEqual({ pausaSegundos: null, pausaRespiracoes: 3 });
    const vazia = aplicarPausa(aplicarPausa(ambos, { segundos: null }), { respiracoes: null });
    expect(vazia).toEqual({ pausaSegundos: null, pausaRespiracoes: null });
    expect(problemasDaTecnica({ tipo: 'REST_PAUSE', ...vazia }).pausaSegundos).toBe('Informe a pausa em segundos ou em respirações.');
  });

  test('os limites continuam com a validação (5 a 600 s, 1 a 30 respirações)', () => {
    const fora = aplicarPausa({}, { segundos: 601, respiracoes: 31 });
    expect(fora).toEqual({ pausaSegundos: 601, pausaRespiracoes: 31 });
    const p = problemasDaTecnica({ tipo: 'REST_PAUSE', ...fora });
    expect(p.pausaSegundos).toBe('Pausa de 5 a 600 segundos.');
    expect(p.pausaRespiracoes).toBe('Pausa de 1 a 30 respirações.');
    expect(problemasDaTecnica({ tipo: 'REST_PAUSE', ...aplicarPausa({}, { segundos: 5, respiracoes: 30 }) })).toEqual({});
  });
});
