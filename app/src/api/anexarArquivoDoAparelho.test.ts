import { anexarArquivoDoAparelho } from './anexarArquivoDoAparelho';
import { instalarAmbienteDoRn, multipartDe } from './multipartDeTeste.apoioTeste';

// Bytes fictícios, com valores acima de 127 para pegar conversão de texto indevida.
const mockBytes = new Uint8Array([0x00, 0x7f, 0x80, 0xff, 0x0d, 0x0a]);
const mockLidos: string[] = [];

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async arrayBuffer() {
      mockLidos.push(this.uri);
      return mockBytes.buffer.slice(0);
    }
  },
}));

let restaurar: () => void;
beforeEach(() => {
  mockLidos.length = 0;
  restaurar = instalarAmbienteDoRn();
});
afterEach(() => restaurar());

describe('anexarArquivoDoAparelho', () => {
  it('põe no campo um objeto com bytes(), nome e tipo, e não um Blob', async () => {
    const dados = new FormData();
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome: 'foto.jpg', tipo: 'image/jpeg', uri: 'file:///cache/a.jpg' });
    const parte = dados.get('arquivo') as unknown as { name: string; type: string; size: number; bytes: () => Promise<Uint8Array> };
    expect(parte).not.toBeInstanceOf(Blob);
    expect(parte.name).toBe('foto.jpg');
    expect(parte.type).toBe('image/jpeg');
    expect(parte.size).toBe(mockBytes.length);
    expect(Array.from(await parte.bytes())).toEqual(Array.from(mockBytes));
    expect(mockLidos).toEqual(['file:///cache/a.jpg']);
  });

  it('o multipart leva filename, content-type e os bytes sem alteração', async () => {
    const dados = new FormData();
    dados.append('pastaId', 'pasta-1');
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome: 'planilha.xlsx', tipo: 'application/octet-stream', uri: 'file:///cache/p' });
    const { texto, bytes } = await multipartDe(dados);
    expect(texto).toContain('name="pastaId"\r\n\r\npasta-1');
    expect(texto).toContain('content-disposition: form-data; name="arquivo"; filename="planilha.xlsx"\r\ncontent-type: application/octet-stream\r\n\r\n');
    const lista = bytes.join();
    expect(lista).toContain(Array.from(mockBytes).join());
  });

  it('usa o conteúdo em memória, quando vem, em vez de ler a uri', async () => {
    const dados = new FormData();
    const conteudo = { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome: 'foto.jpg', tipo: 'image/jpeg', uri: 'file:///cache/a.jpg', conteudo });
    expect(mockLidos).toEqual([]);
    const parte = dados.get('arquivo') as unknown as { bytes: () => Promise<Uint8Array> };
    expect(Array.from(await parte.bytes())).toEqual([1, 2, 3]);
  });

  it('falha na hora de anexar, e não dentro do fetch, se o arquivo não pode ser lido', async () => {
    const dados = new FormData();
    const conteudo = { arrayBuffer: async () => { throw new Error('arquivo sumiu'); } };
    await expect(anexarArquivoDoAparelho(dados, 'arquivo', { nome: 'a', tipo: 'b', uri: 'file:///x', conteudo })).rejects.toThrow('arquivo sumiu');
    expect(dados.get('arquivo')).toBeNull();
  });
});
