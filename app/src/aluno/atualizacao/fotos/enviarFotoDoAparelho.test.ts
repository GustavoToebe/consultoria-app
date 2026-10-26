import { Platform } from 'react-native';

import { instalarAmbienteDoRn, multipartDe } from '../../../api/multipartDeTeste.apoioTeste';
import { enviarFoto } from '../../../api/rotas';
import { anexarFoto, enviarFotoDoAparelho } from './enviarFotoDoAparelho';

// Bytes fictícios: começo de um JPEG.
const mockJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
const mockLidos: string[] = [];

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async arrayBuffer() {
      mockLidos.push(this.uri);
      return mockJpeg.buffer.slice(mockJpeg.byteOffset, mockJpeg.byteOffset + mockJpeg.byteLength);
    }
  },
}));
jest.mock('../../../api/rotas', () => ({ enviarFoto: jest.fn(async () => ({ id: 'foto-1' })) }));

let restaurarAmbiente: () => void;
beforeEach(() => {
  mockLidos.length = 0;
  jest.mocked(enviarFoto).mockClear();
  restaurarAmbiente = instalarAmbienteDoRn();
});
afterEach(() => {
  restaurarAmbiente();
  jest.restoreAllMocks();
});

describe.each(['ios', 'android'] as const)('envio da foto no %s', (sistema) => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', sistema); });

  it('manda os bytes do arquivo como foto.jpg (image/jpeg) sem criar Blob de ArrayBuffer', async () => {
    const id = await enviarFotoDoAparelho({ pasta: 'p-1' } as never, { uri: 'file:///cache/qualquer-nome.jpg' });
    expect(id).toBe('foto-1');
    expect(mockLidos).toEqual(['file:///cache/qualquer-nome.jpg']);
    const dados = jest.mocked(enviarFoto).mock.calls[0]![1];
    const { texto, bytes } = await multipartDe(dados);
    expect(texto).toContain('content-disposition: form-data; name="arquivo"; filename="foto.jpg"');
    expect(texto).toContain('content-type: image/jpeg');
    expect(texto).not.toContain('qualquer-nome');
    const inicio = bytes.findIndex((_, i) => bytes.slice(i, i + mockJpeg.length).join() === Array.from(mockJpeg).join());
    expect(inicio).toBeGreaterThan(0);
  });

  it('usa os bytes do arquivo em memória quando ele vem junto da uri', async () => {
    const dados = new FormData();
    const arquivo = { arrayBuffer: async () => mockJpeg.buffer.slice(0) } as unknown as Blob;
    await anexarFoto(dados, { uri: 'file:///x.jpg', arquivo });
    expect(mockLidos).toEqual([]);
    expect((await multipartDe(dados)).texto).toContain('filename="foto.jpg"');
  });
});

describe('envio da foto na web', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'web'); });

  it('continua anexando o próprio Blob, com o nome foto.jpg, sem ler arquivo do aparelho', async () => {
    const dados = new FormData();
    const arquivo = new Blob(['jpeg'], { type: 'image/jpeg' });
    await anexarFoto(dados, { uri: 'blob:x', arquivo });
    expect(dados.get('arquivo')).toBe(arquivo);
    expect((arquivo as unknown as { name: string }).name).toBe('foto.jpg');
    expect(mockLidos).toEqual([]);
  });

  it('recusa foto sem conteúdo', async () => {
    await expect(anexarFoto(new FormData(), { uri: 'blob:x' })).rejects.toThrow('Foto sem conteúdo para enviar.');
  });
});
