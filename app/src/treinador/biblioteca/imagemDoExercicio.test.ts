import { Platform } from 'react-native';

import { instalarAmbienteDoRn, multipartDe } from '../../api/multipartDeTeste.apoioTeste';
import { anexarImagemDoExercicio, type ImagemDoExercicioEscolhida } from './imagemDoExercicio';

// Bytes fictícios: cabeçalho de um GIF ("GIF89a").
const mockBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

jest.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return mockBytes.buffer.slice(0);
    }
  },
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

let restaurar: () => void;
beforeEach(() => { restaurar = instalarAmbienteDoRn(); });
afterEach(() => {
  restaurar();
  jest.restoreAllMocks();
});

const imagem = (tipo: ImagemDoExercicioEscolhida['tipo']): ImagemDoExercicioEscolhida =>
  ({ uri: 'file:///cache/original-do-aluno.bin', arquivo: null, tipo, temporaria: true });

describe('anexarImagemDoExercicio no celular', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); });

  it.each([
    ['image/jpeg', 'imagem.jpg'],
    ['image/png', 'imagem.png'],
    ['image/gif', 'imagem.gif'],
  ] as const)('manda os bytes de %s como %s, com o tipo no cabeçalho', async (tipo, nome) => {
    const dados = new FormData();
    await anexarImagemDoExercicio(dados, imagem(tipo));
    const { texto } = await multipartDe(dados);
    expect(texto).toContain(`content-disposition: form-data; name="arquivo"; filename="${nome}"`);
    expect(texto).toContain(`content-type: ${tipo}`);
    expect(texto).toContain('GIF89a');
    expect(texto).not.toContain('original-do-aluno');
  });
});

describe('anexarImagemDoExercicio na web', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'web'); });

  it('continua anexando o Blob em memória com o nome da imagem', async () => {
    const dados = new FormData();
    const arquivo = new Blob(['x'], { type: 'image/gif' });
    await anexarImagemDoExercicio(dados, { ...imagem('image/gif'), arquivo });
    expect(dados.get('arquivo')).toBe(arquivo);
    expect((arquivo as unknown as { name: string }).name).toBe('imagem.gif');
  });

  it('recusa imagem sem conteúdo', async () => {
    await expect(Promise.resolve().then(() => anexarImagemDoExercicio(new FormData(), imagem('image/png')))).rejects.toThrow('Imagem sem conteúdo para enviar.');
  });
});
