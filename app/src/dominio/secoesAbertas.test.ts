import { abrir, abrirTodas, alternar, buscar, estaAberta, estadoInicial, fecharTodas, sincronizar, type EstadoDeSecoes } from './secoesAbertas';

const abertas = (e: EstadoDeSecoes) => [...e.abertas].sort();

describe('secoesAbertas', () => {
  it('nasce tudo fechado', () => {
    const e = estadoInicial(['a', 'b', 'c']);
    expect(abertas(e)).toEqual([]);
    expect(estaAberta(e, 'a')).toBe(false);
  });

  it('uma seção só nasce aberta', () => {
    expect(abertas(estadoInicial(['a']))).toEqual(['a']);
  });

  it('os ids pedidos para abrir de partida nascem abertos (destino de link)', () => {
    expect(abertas(estadoInicial(['a', 'b', 'c'], ['b', 'x']))).toEqual(['b']);
  });

  it('alterna, abre (um ou vários), abre todas e fecha todas', () => {
    let e = estadoInicial(['a', 'b', 'c']);
    e = alternar(e, 'a');
    expect(abertas(e)).toEqual(['a']);
    e = alternar(e, 'a');
    expect(abertas(e)).toEqual([]);
    e = abrir(e, ['b', 'c']);
    expect(abertas(e)).toEqual(['b', 'c']);
    expect(abrir(e, ['b'])).toBe(e);
    e = fecharTodas(e);
    expect(abertas(e)).toEqual([]);
    e = abrirTodas(e, ['a', 'b', 'c']);
    expect(abertas(e)).toEqual(['a', 'b', 'c']);
  });

  it('busca abre exatamente as seções com resultado e limpar restaura o estado de antes', () => {
    let e = abrir(estadoInicial(['a', 'b', 'c']), ['a']);
    e = buscar(e, 'ca', ['b', 'c']);
    expect(abertas(e)).toEqual(['b', 'c']);
    e = buscar(e, '   ', []);
    expect(abertas(e)).toEqual(['a']);
    expect(e.antesDaBusca).toBeNull();
    // Limpar sem busca em andamento não muda nada.
    expect(buscar(e, '', [])).toBe(e);
  });

  it('o termo que muda reabre conforme o novo resultado sem perder o estado guardado', () => {
    let e = abrir(estadoInicial(['a', 'b', 'c']), ['a']);
    e = buscar(e, 'c', ['c']);
    e = buscar(e, 'ca', ['b']);
    expect(abertas(e)).toEqual(['b']);
    e = buscar(e, 'xyz', []);
    expect(abertas(e)).toEqual([]);
    expect(abertas(buscar(e, '', []))).toEqual(['a']);
  });

  it('alternar à mão durante a busca vale só durante a busca', () => {
    let e = estadoInicial(['a', 'b']);
    e = buscar(e, 'x', ['a']);
    e = alternar(alternar(e, 'a'), 'b');
    expect(abertas(e)).toEqual(['b']);
    expect(abertas(buscar(e, '', []))).toEqual([]);
  });

  it('seção que chega depois entra fechada; a única de uma lista vazia nasce aberta', () => {
    let e = estadoInicial([]);
    e = sincronizar(e, ['a']);
    expect(abertas(e)).toEqual(['a']);
    e = sincronizar(e, ['a', 'b']);
    expect(abertas(e)).toEqual(['a']);
    e = alternar(e, 'a');
    expect(abertas(sincronizar(e, ['a', 'b', 'c']))).toEqual([]);
  });

  it('seção que chega depois abre se foi pedida para abrir de partida', () => {
    const e = sincronizar(estadoInicial(['a', 'b']), ['a', 'b', 'c'], ['c']);
    expect(abertas(e)).toEqual(['c']);
  });

  it('ids que somem saem do estado (inclusive do guardado da busca) e voltam fechados', () => {
    let e = abrirTodas(estadoInicial(['a', 'b', 'c']), ['a', 'b', 'c']);
    e = buscar(e, 'x', ['b']);
    e = sincronizar(e, ['a', 'c']);
    expect(abertas(e)).toEqual([]);
    expect(abertas(buscar(e, '', []))).toEqual(['a', 'c']);
    const sem = sincronizar(abrirTodas(estadoInicial(['a', 'b']), ['a', 'b']), ['b']);
    expect(abertas(sem)).toEqual(['b']);
    expect(abertas(sincronizar(sem, ['b', 'a', 'c']))).toEqual(['b']);
  });

  it('sincronizar devolve o mesmo objeto quando nada muda', () => {
    const e = estadoInicial(['a', 'b']);
    expect(sincronizar(e, ['b', 'a'])).toBe(e);
  });
});
