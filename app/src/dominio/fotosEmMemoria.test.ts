import { criarFotosEmMemoria } from './fotosEmMemoria';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('o mesmo id dentro do prazo (linha da lista e folha) pede uma vez só; outro id pede de novo', async () => {
  const buscar = jest.fn((id: string) => Promise.resolve(`foto-${id}`));
  const obter = criarFotosEmMemoria(buscar, 60_000);
  expect(await Promise.all([obter('a'), obter('a')])).toEqual(['foto-a', 'foto-a']);
  jest.advanceTimersByTime(59_000);
  await obter('a');
  await obter('b');
  expect(buscar.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
});

it('depois do prazo pede de novo', async () => {
  const buscar = jest.fn(() => Promise.resolve('x'));
  const obter = criarFotosEmMemoria(buscar, 60_000);
  await obter('a');
  jest.advanceTimersByTime(60_001);
  await obter('a');
  expect(buscar).toHaveBeenCalledTimes(2);
});

it('falha não fica guardada: a próxima chamada tenta de novo', async () => {
  const buscar = jest.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce('ok');
  const obter = criarFotosEmMemoria(buscar, 60_000);
  await expect(obter('a')).rejects.toThrow('429');
  await expect(obter('a')).resolves.toBe('ok');
  expect(buscar).toHaveBeenCalledTimes(2);
});
