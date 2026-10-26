import { Platform } from 'react-native';

import { instalarAmbienteDoRn, multipartDe } from '../../api/multipartDeTeste.apoioTeste';
import { anexarLogo } from './anexarLogo';

// Bytes fictícios: assinatura de um PNG.
const mockBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

jest.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return mockBytes.buffer.slice(0);
    }
  },
}));

let restaurar: () => void;
beforeEach(() => { restaurar = instalarAmbienteDoRn(); });
afterEach(() => {
  restaurar();
  jest.restoreAllMocks();
});

describe('anexarLogo no celular', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'ios'); });

  it('manda os bytes com o nome do seletor e o tipo no cabeçalho', async () => {
    const dados = new FormData();
    await anexarLogo(dados, { uri: 'file:///cache/escolhida.png', fileName: 'minha-logo.png' }, 'image/png');
    const { texto, bytes } = await multipartDe(dados);
    expect(texto).toContain('content-disposition: form-data; name="arquivo"; filename="minha-logo.png"');
    expect(texto).toContain('content-type: image/png');
    expect(bytes.join()).toContain('137,80,78,71,13,10');
  });

  it.each([
    ['image/png', 'logo.png'],
    ['image/jpeg', 'logo.jpg'],
  ] as const)('sem nome do seletor, usa %s como %s', async (tipo, nome) => {
    const dados = new FormData();
    await anexarLogo(dados, { uri: 'file:///cache/escolhida', fileName: null }, tipo);
    const { texto } = await multipartDe(dados);
    expect(texto).toContain(`filename="${nome}"`);
    expect(texto).toContain(`content-type: ${tipo}`);
  });
});

describe('anexarLogo na web', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'web'); });

  it('continua anexando o arquivo do navegador', async () => {
    const dados = new FormData();
    const file = new Blob(['x'], { type: 'image/png' });
    await anexarLogo(dados, { uri: 'blob:x', file }, 'image/png');
    expect(dados.get('arquivo')).toBe(file);
  });
});
