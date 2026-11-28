import { modoDoTema, remetenteDosEmails, temaDaPrevia } from './previaDaMarca';

describe('temaDaPrevia', () => {
  it('no modo do tema padrão, mostra o próprio tema', () => {
    expect(temaDaPrevia('OCEANO', 'ESCURO')).toBe('OCEANO');
    expect(temaDaPrevia('AREIA', 'CLARO')).toBe('AREIA');
    expect(temaDaPrevia('ESCURO', 'ESCURO')).toBe('ESCURO');
  });

  it('no outro modo, a paleta base dele', () => {
    expect(temaDaPrevia('OCEANO', 'CLARO')).toBe('CLARO');
    expect(temaDaPrevia('AREIA', 'ESCURO')).toBe('ESCURO');
    expect(temaDaPrevia('CLARO', 'ESCURO')).toBe('ESCURO');
  });

  it('começa no modo do tema padrão', () => {
    expect(modoDoTema('AMEIXA')).toBe('ESCURO');
    expect(modoDoTema('ROSA')).toBe('CLARO');
  });
});

describe('remetenteDosEmails', () => {
  it('usa o nome de Contato, aparado', () => {
    expect(remetenteDosEmails('  Equipe Fictícia ', 'Consultoria Fictícia')).toBe('Equipe Fictícia');
  });

  it('vazio ou ausente, o nome da consultoria', () => {
    expect(remetenteDosEmails('   ', 'Consultoria Fictícia')).toBe('Consultoria Fictícia');
    expect(remetenteDosEmails(null, 'Consultoria Fictícia')).toBe('Consultoria Fictícia');
    expect(remetenteDosEmails(undefined, ' Consultoria Fictícia ')).toBe('Consultoria Fictícia');
  });
});
