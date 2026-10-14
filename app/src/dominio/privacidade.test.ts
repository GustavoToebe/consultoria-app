import { nomeConfere, nomeDoArquivoDeExportacao, textoDaExportacao } from './privacidade';

describe('anonimizar: nome digitado', () => {
  it('ignora espaços nas pontas e a caixa, mas não aceita vazio nem outro nome', () => {
    expect(nomeConfere('Maria Souza', '  maria souza ')).toBe(true);
    expect(nomeConfere('Maria Souza', 'MARIA SOUZA')).toBe(true);
    expect(nomeConfere('Maria Souza', 'Maria')).toBe(false);
    expect(nomeConfere('Maria Souza', '   ')).toBe(false);
    expect(nomeConfere('  ', '')).toBe(false);
  });
});

describe('exportar dados', () => {
  it('o nome do arquivo leva só a data', () => {
    expect(nomeDoArquivoDeExportacao(new Date(2026, 9, 5))).toBe('dados-do-aluno-2026-10-05.json');
  });
  it('o texto é JSON identado', () => {
    expect(textoDaExportacao({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});
