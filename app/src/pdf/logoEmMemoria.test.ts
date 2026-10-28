import { limparLogosEmMemoria, logoEmMemoria } from './logoEmMemoria';

const LOGO_V1 = '/publico/marcas/m/logo?v=1';
const LOGO_V2 = '/publico/marcas/m/logo?v=2';

beforeEach(() => limparLogosEmMemoria());

describe('cache da logo do PDF', () => {
  it('a mesma logoUrl baixa uma vez só', async () => {
    const preparar = jest.fn().mockResolvedValue('data:image/png;base64,AAAA');
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBe('data:image/png;base64,AAAA');
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBe('data:image/png;base64,AAAA');
    expect(preparar).toHaveBeenCalledTimes(1);
  });

  it('pedidos ao mesmo tempo dividem o mesmo download', async () => {
    let terminar: (v: string) => void = () => undefined;
    const preparar = jest.fn().mockReturnValue(new Promise<string>((r) => { terminar = r; }));
    const a = logoEmMemoria(LOGO_V1, preparar);
    const b = logoEmMemoria(LOGO_V1, preparar);
    terminar('data:image/png;base64,BBBB');
    expect(await Promise.all([a, b])).toEqual(['data:image/png;base64,BBBB', 'data:image/png;base64,BBBB']);
    expect(preparar).toHaveBeenCalledTimes(1);
  });

  it('versão nova da logo (outra logoUrl) baixa de novo', async () => {
    const preparar = jest.fn().mockImplementation(async (url: string) => `data:${url}`);
    await logoEmMemoria(LOGO_V1, preparar);
    await logoEmMemoria(LOGO_V2, preparar);
    expect(preparar).toHaveBeenCalledTimes(2);
    expect(await logoEmMemoria(LOGO_V2, preparar)).toBe(`data:${LOGO_V2}`);
    expect(preparar).toHaveBeenCalledTimes(2);
  });

  it('falha (null) não fica guardada: a próxima chamada tenta de novo', async () => {
    const preparar = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('data:image/png;base64,CCCC');
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBeNull();
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBe('data:image/png;base64,CCCC');
    expect(preparar).toHaveBeenCalledTimes(2);
  });

  it('o "Sair" limpa: a mesma logoUrl baixa de novo', async () => {
    const preparar = jest.fn().mockResolvedValue('data:image/png;base64,DDDD');
    await logoEmMemoria(LOGO_V1, preparar);
    limparLogosEmMemoria();
    await logoEmMemoria(LOGO_V1, preparar);
    expect(preparar).toHaveBeenCalledTimes(2);
  });

  it('download que termina depois do "Sair" não devolve a logo ao cache', async () => {
    let terminar: (v: string) => void = () => undefined;
    const lento = jest.fn().mockReturnValue(new Promise<string>((r) => { terminar = r; }));
    const pendente = logoEmMemoria(LOGO_V1, lento);
    limparLogosEmMemoria();
    terminar('data:image/png;base64,EEEE');
    await pendente;
    const preparar = jest.fn().mockResolvedValue('data:image/png;base64,FFFF');
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBe('data:image/png;base64,FFFF');
    expect(preparar).toHaveBeenCalledTimes(1);
  });

  it('erro do preparo chega a quem pediu e não trava as próximas', async () => {
    const preparar = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('data:image/png;base64,GGGG');
    await expect(logoEmMemoria(LOGO_V1, preparar)).rejects.toThrow('x');
    expect(await logoEmMemoria(LOGO_V1, preparar)).toBe('data:image/png;base64,GGGG');
  });
});
