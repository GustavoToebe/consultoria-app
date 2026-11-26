import { tituloDoPlano } from './tituloDoPlano';

// Espelha TituloDoPlanoPublicadoTest (API). Nomes fictícios.
const dieta = (titulo: string | null, nome: string | null) => tituloDoPlano(titulo, 'dieta', nome);

describe('tituloDoPlano', () => {
  it('tira o (rascunho) sem diferença de caixa nem espaços', () => {
    expect(dieta('Dieta A (rascunho)', 'Ana')).toBe('Dieta A');
    expect(dieta('x (RASCUNHO)', 'Ana')).toBe('x');
    expect(dieta('  Dieta   A  ( Rascunho )  ', 'Ana')).toBe('Dieta A');
    expect(dieta('Dieta (rascunho) de cutting', 'Ana')).toBe('Dieta de cutting');
  });

  it('o nome padrão da importação vira "<Tipo> de <aluno>"', () => {
    expect(dieta('Importada da planilha (rascunho)', 'Ana Lima')).toBe('Dieta de Ana Lima');
    expect(dieta('Importada da planilha', 'Ana Lima')).toBe('Dieta de Ana Lima');
    expect(dieta('  IMPORTADA  da   planilha (Rascunho)', '  Ana   Lima ')).toBe('Dieta de Ana Lima');
    expect(tituloDoPlano('Importada da planilha (rascunho)', 'treino', 'Ana Lima')).toBe('Treino de Ana Lima');
    expect(tituloDoPlano('Importada da planilha (rascunho)', 'mobilidade', 'Ana Lima')).toBe('Mobilidade de Ana Lima');
  });

  it('o título do treinador fica como está', () => {
    expect(dieta('Dieta do Saraiva', 'Ana')).toBe('Dieta do Saraiva');
    expect(dieta('Importada da planilha 2', 'Ana')).toBe('Importada da planilha 2');
    expect(dieta('Plano Atual (Importado)', 'Ana')).toBe('Plano Atual (Importado)');
  });

  it('título vazio, nulo ou só (rascunho) usa o padrão do aluno', () => {
    expect(dieta(null, 'Ana')).toBe('Dieta de Ana');
    expect(dieta('  ', 'Ana')).toBe('Dieta de Ana');
    expect(dieta('(rascunho)', 'Ana')).toBe('Dieta de Ana');
  });

  it('sem o nome do aluno usa o formato genérico', () => {
    expect(dieta('Importada da planilha', null)).toBe('Dieta do aluno');
    expect(tituloDoPlano('(rascunho)', 'treino', '  ')).toBe('Treino do aluno');
    expect(tituloDoPlano('', 'mobilidade', undefined)).toBe('Mobilidade do aluno');
  });

  it('nome longo corta o nome e mantém o título em 120 sem espaço no fim', () => {
    const titulo = dieta('Importada da planilha (rascunho)', 'Maria '.repeat(40));
    expect(titulo.startsWith('Dieta de Maria Maria')).toBe(true);
    expect(titulo.length).toBeLessThanOrEqual(120);
    expect(titulo.length).toBeGreaterThan(110);
    expect(titulo.endsWith(' ')).toBe(false);
  });
});
