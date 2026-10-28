import type { Marca } from '../api/tipos';
import { logoComoDataUri } from './logo';
import { limparLogosEmMemoria } from './logoEmMemoria';

const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
  SaveFormat: { PNG: 'png' },
}));
jest.mock('../aluno/atualizacao/fotos/fotosLocais', () => ({ apagarTemporaria: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../api/cliente', () => ({ urlDaApi: (p: string) => `http://api.teste${p}` }));

const marca = (logoUrl: string | null): Marca => ({ id: 'm', nome: 'Consultoria Teste', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl });
const LOGO = '/publico/marcas/m/logo?v=1';

/** Logo "baixada": o corpo só precisa virar um data URI; o conteúdo é fictício. */
function baixa(corpo = 'x'.repeat(5000)) {
  const fetchFalso = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([corpo], { type: 'image/png' }) });
  (globalThis as { fetch: unknown }).fetch = fetchFalso;
  return fetchFalso;
}

/** O que o `ImageManipulator` devolve: o tamanho lido e, depois do resize, o PNG salvo. */
function manipuladorDe(largura: number, altura: number, base64: string | undefined = 'cmVkdXppZGE=') {
  const resize = jest.fn();
  const saveAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/logo.png', base64 });
  const lida = { width: largura, height: altura };
  const reduzida = { saveAsync };
  const renders = [lida, reduzida];
  mockManipulate.mockImplementation(() => {
    const contexto = { resize: (a: unknown) => { resize(a); return contexto; }, renderAsync: async () => renders.shift() };
    return contexto;
  });
  return { resize, saveAsync };
}

/** O `FileReader` do ambiente de teste não lê o `Blob` do Node: este devolve o mesmo data URI que o navegador devolveria. */
class LeitorFalso {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.text().then((texto) => {
      this.result = `data:${blob.type};base64,${Buffer.from(texto).toString('base64')}`;
      this.onload?.();
    }, () => this.onerror?.());
  }
}

beforeAll(() => {
  (globalThis as { FileReader: unknown }).FileReader = LeitorFalso;
});

beforeEach(() => {
  limparLogosEmMemoria();
  mockManipulate.mockReset();
});

describe('logoComoDataUri', () => {
  it('sem logo, não baixa nada', async () => {
    const f = baixa();
    expect(await logoComoDataUri(null)).toBeNull();
    expect(await logoComoDataUri(marca(null))).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('logo grande vem reduzida a 800 px, em PNG, pelo base64 do saveAsync', async () => {
    baixa();
    const { resize, saveAsync } = manipuladorDe(2048, 1024);
    expect(await logoComoDataUri(marca(LOGO))).toBe('data:image/png;base64,cmVkdXppZGE=');
    expect(resize).toHaveBeenCalledWith({ width: 800 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'png', base64: true });
  });

  it('logo que já cabe em 800 px segue como veio (não amplia nem regrava)', async () => {
    baixa();
    const { resize, saveAsync } = manipuladorDe(400, 200);
    const logo = await logoComoDataUri(marca(LOGO));
    expect(logo).toMatch(/^data:image\/png;base64,/);
    expect(logo).not.toContain('cmVkdXppZGE=');
    expect(resize).not.toHaveBeenCalled();
    expect(saveAsync).not.toHaveBeenCalled();
  });

  it('se a redução ficou maior que o original, vale o original', async () => {
    baixa('x');
    manipuladorDe(2048, 1024, 'A'.repeat(4000));
    const logo = await logoComoDataUri(marca(LOGO));
    expect(logo).not.toContain('AAAA');
  });

  it('falhou ao reduzir → usa a logo original', async () => {
    baixa();
    mockManipulate.mockImplementation(() => { throw new Error('formato não lido'); });
    const logo = await logoComoDataUri(marca(LOGO));
    expect(logo).toMatch(/^data:image\/png;base64,/);
  });

  it('sem internet ou resposta com erro → null, e a falha não fica guardada', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await logoComoDataUri(marca(LOGO))).toBeNull();
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await logoComoDataUri(marca(LOGO))).toBeNull();
    const f = baixa();
    manipuladorDe(400, 200);
    expect(await logoComoDataUri(marca(LOGO))).not.toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('segundo PDF da sessão não baixa de novo, nem sem internet', async () => {
    const f = baixa();
    manipuladorDe(2048, 1024);
    const primeira = await logoComoDataUri(marca(LOGO));
    (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await logoComoDataUri(marca(LOGO))).toBe(primeira);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
