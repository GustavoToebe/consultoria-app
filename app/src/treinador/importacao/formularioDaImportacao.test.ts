import { Platform } from 'react-native';

import { instalarAmbienteDoRn, multipartDe } from '../../api/multipartDeTeste.apoioTeste';
import { formulario } from './formularioDaImportacao';

// Conteúdo fictício de uma planilha CSV.
const mockCsv = new TextEncoder().encode('nome,email\nAluno Teste,aluno@exemplo.test\n');

jest.mock('expo-file-system', () => ({
  File: class {
    async arrayBuffer() {
      return mockCsv.buffer.slice(0);
    }
  },
}));

let restaurar: () => void;
beforeEach(() => { restaurar = instalarAmbienteDoRn(); });
afterEach(() => {
  restaurar();
  jest.restoreAllMocks();
});

const CSV = { nome: 'alunos.csv', parte: { uri: 'file:///cache/alunos.csv', name: 'alunos.csv', type: 'text/csv' } };

describe('formulario da importação no celular', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); });

  it('manda os bytes da planilha com o nome e o tipo do seletor e a configuração como texto', async () => {
    const dados = await formulario(CSV, { aba: 0, linhaDoCabecalho: 1 });
    const { texto } = await multipartDe(dados);
    expect(texto).toContain('content-disposition: form-data; name="arquivo"; filename="alunos.csv"');
    expect(texto).toContain('content-type: text/csv');
    expect(texto).toContain('aluno@exemplo.test');
    expect(texto).toContain('name="configuracao"\r\n\r\n{"aba":0,"linhaDoCabecalho":1}');
  });

  it('planilha sem tipo informado vai como application/octet-stream', async () => {
    const dados = await formulario({ nome: 'a.xlsx', parte: { uri: 'file:///cache/a.xlsx', name: 'a.xlsx', type: 'application/octet-stream' } });
    expect((await multipartDe(dados)).texto).toContain('content-type: application/octet-stream');
  });
});

describe('formulario da importação na web', () => {
  beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'web'); });

  it('continua anexando o arquivo e a configuração como Blob JSON', async () => {
    const arquivo = new Blob(['a,b'], { type: 'text/csv' });
    const dados = await formulario({ nome: 'alunos.csv', parte: arquivo }, { aba: 1 });
    expect(dados.get('arquivo')).toBe(arquivo);
    expect((arquivo as unknown as { name: string }).name).toBe('alunos.csv');
    expect(dados.get('configuracao')).toBeInstanceOf(Blob);
  });
});
