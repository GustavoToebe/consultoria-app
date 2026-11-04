import type { AbaDiagnosticada, DiagnosticoDoArquivo } from '../api/tipos';
import {
  colunasDaAba, contagensDaAba, detalheDoTipoDoArquivo, gravidadeDoProblema, nomeDaColuna, problemasEmOrdem, rotuloDoCampo,
  rotuloDoTipoDoArquivo, textoDoProblema, tituloDaAba, veredito,
} from './diagnosticoDoArquivo';

const ABA: AbaDiagnosticada = {
  indice: 0, nome: 'Alunos', tipo: 'ALUNOS', linhas: 3, linhasVazias: 1, linhasSemNome: 0, emailsInvalidos: 0, emailsDuplicados: 0,
  datasInvalidas: 0, celulasComErro: 0, problemas: [],
  colunas: [
    { letra: 'A', nome: 'Nome', campo: 'ALUNO' },
    { letra: 'B', nome: 'Email', campo: 'EMAIL' },
    { letra: 'C', nome: 'Plano Antigo', campo: null },
    { letra: 'D', nome: null, campo: null },
  ],
};
const DIAG = (o: Partial<DiagnosticoDoArquivo>): DiagnosticoDoArquivo => ({ tipo: 'CADASTRO_DE_ALUNOS', linhas: 3, abas: [ABA], problemas: [], ...o });

describe('texto do problema', () => {
  it('concorda singular e plural, sem nenhum valor', () => {
    expect(textoDoProblema({ codigo: 'EMAIL_INVALIDO', quantidade: 1 })).toBe('1 e-mail inválido.');
    expect(textoDoProblema({ codigo: 'EMAIL_INVALIDO', quantidade: 3 })).toBe('3 e-mails inválidos.');
    expect(textoDoProblema({ codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 })).toBe('1 coluna não reconhecida (fica de fora).');
    expect(textoDoProblema({ codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 2 })).toBe('2 colunas não reconhecidas (ficam de fora).');
    expect(textoDoProblema({ codigo: 'ACIMA_DO_LIMITE_DO_PLANO', quantidade: 2 })).toBe('Até 2 alunos não cabem no limite de alunos do plano.');
  });

  it('código que o app não conhece mostra só a contagem', () => {
    expect(textoDoProblema({ codigo: 'CODIGO_NOVO', quantidade: 4 })).toBe('Outro ponto de atenção (4).');
    expect(gravidadeDoProblema('CODIGO_NOVO')).toBe('atencao');
  });

  it('ordena: impede, atenção, informa; dentro do grupo, a ordem da API', () => {
    const ordem = problemasEmOrdem([
      { codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 1 }, { codigo: 'EMAIL_INVALIDO', quantidade: 1 },
      { codigo: 'ARQUIVO_SEM_DADOS', quantidade: 1 }, { codigo: 'DATA_INVALIDA', quantidade: 2 },
    ]).map((p) => p.codigo);
    expect(ordem).toEqual(['ARQUIVO_SEM_DADOS', 'EMAIL_INVALIDO', 'DATA_INVALIDA', 'COLUNA_NAO_RECONHECIDA']);
  });
});

describe('veredito', () => {
  it('arquivo desconhecido ou sem dados não dá para importar', () => {
    expect(veredito(DIAG({ tipo: 'DESCONHECIDO' })).tom).toBe('perigo');
    expect(veredito(DIAG({ problemas: [{ codigo: 'ARQUIVO_SEM_DADOS', quantidade: 1 }] })).tom).toBe('perigo');
  });

  it('ponto de atenção avisa; coluna não reconhecida sozinha só informa', () => {
    expect(veredito(DIAG({ problemas: [{ codigo: 'EMAIL_INVALIDO', quantidade: 2 }] })).tom).toBe('atencao');
    expect(veredito(DIAG({ problemas: [{ codigo: 'COLUNA_NAO_RECONHECIDA', quantidade: 2 }] })).tom).toBe('sucesso');
  });

  it('sem problema não promete que a importação dá certo', () => {
    const v = veredito(DIAG({}));
    expect(v.tom).toBe('sucesso');
    expect(v.texto).toContain('só lê o arquivo');
  });
});

describe('tipo do arquivo, colunas e contagens', () => {
  it('todo tipo tem título e detalhe; o desconhecido pede os nomes na primeira linha', () => {
    for (const t of ['CADASTRO_DE_ALUNOS', 'PLANILHA_COMPLETA', 'TREINO', 'DIETA', 'OUTRO', 'DESCONHECIDO'] as const) {
      expect(rotuloDoTipoDoArquivo(t)).not.toBe('');
      expect(detalheDoTipoDoArquivo(t)).not.toBe('');
    }
    expect(detalheDoTipoDoArquivo('DESCONHECIDO')).toContain('primeira linha');
  });

  it('separa as colunas reconhecidas das que ficam de fora e nomeia as sem cabeçalho pela letra', () => {
    expect(colunasDaAba(ABA)).toEqual({ reconhecidas: ['Nome: Nome do aluno', 'Email: E-mail'], naoReconhecidas: ['Plano Antigo', 'Coluna D'] });
    expect(nomeDaColuna({ letra: 'E', nome: '  ', campo: null })).toBe('Coluna E');
  });

  it('campo fora da lista vira texto legível', () => {
    expect(rotuloDoCampo('EMAIL')).toBe('E-mail');
    expect(rotuloDoCampo('ALGUM_CAMPO_NOVO')).toBe('Algum campo novo');
  });

  it('contagens da aba: zero não aparece', () => {
    expect(contagensDaAba(ABA)).toEqual(['3 linhas de dados', '1 linha em branco']);
    expect(contagensDaAba({ ...ABA, linhas: 1, linhasVazias: 0 })).toEqual(['1 linha de dados']);
  });

  it('título da aba com o tipo; aba sem nome (CSV) vira Planilha', () => {
    expect(tituloDaAba(ABA)).toBe('Alunos · Alunos');
    expect(tituloDaAba({ nome: ' ', tipo: 'DESCONHECIDA' })).toBe('Planilha · Não reconhecida (não entra)');
  });
});
