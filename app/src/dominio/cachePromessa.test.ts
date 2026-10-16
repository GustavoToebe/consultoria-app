import { criarCachePromessa } from './cachePromessa';

describe('cache de promessa', () => {
  it('quem chega durante a busca recebe a mesma promessa, e depois do sucesso não busca de novo', async () => {
    const buscar = jest.fn().mockResolvedValue({ ligada: true });
    const cache = criarCachePromessa(buscar);
    const a = cache.obter();
    const b = cache.obter();
    expect(a).toBe(b);
    await a;
    await cache.obter();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(cache.atual()).toEqual({ ligada: true });
  });

  it('não guarda a falha: a próxima chamada busca outra vez', async () => {
    const buscar = jest.fn().mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce('ok');
    const cache = criarCachePromessa<string>(buscar);
    await expect(cache.obter()).rejects.toThrow('sem rede');
    expect(cache.atual()).toBeNull();
    await expect(cache.obter()).resolves.toBe('ok');
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('forçar descarta o guardado e busca de novo', async () => {
    const buscar = jest.fn().mockResolvedValueOnce('antigo').mockResolvedValueOnce('novo');
    const cache = criarCachePromessa<string>(buscar);
    await cache.obter();
    await expect(cache.obter(true)).resolves.toBe('novo');
    expect(buscar).toHaveBeenLastCalledWith(true);
    expect(cache.atual()).toBe('novo');
    await expect(cache.obter()).resolves.toBe('novo');
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it('falha de uma busca forçada também não fica guardada', async () => {
    const buscar = jest.fn().mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('c');
    const cache = criarCachePromessa<string>(buscar);
    await cache.obter();
    await expect(cache.obter(true)).rejects.toThrow('x');
    expect(cache.atual()).toBeNull();
    await expect(cache.obter()).resolves.toBe('c');
  });
});
