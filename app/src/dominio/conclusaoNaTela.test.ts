import {
  campoDaDuracao,
  disponivelAPartirDe,
  resumoDaConclusao,
  segundosDoCampo,
  soMinutos,
  textoDaDuracao,
  textoDasSeriesMarcadas,
} from './conclusaoNaTela';

describe('textos de "Concluir treino"', () => {
  it('resume o resultado e a duração; sem duração, só o resultado', () => {
    expect(resumoDaConclusao({ resultado: 'COMPLETA', duracaoSegundos: 3120 })).toBe('Fiz tudo · 52 min');
    expect(resumoDaConclusao({ resultado: 'PARCIAL', duracaoSegundos: null })).toBe('Fiz em parte');
    expect(resumoDaConclusao({ resultado: null, duracaoSegundos: null })).toBe('');
  });

  it('a duração nunca sai "0 min"', () => {
    expect(textoDaDuracao(60)).toBe('1 min');
    expect(textoDaDuracao(20)).toBe('1 min');
    expect(textoDaDuracao(90 * 60)).toBe('90 min');
  });

  it('o campo em minutos aceita só dígitos e vazio é sem duração', () => {
    expect(soMinutos('5 2a')).toBe('52');
    expect(soMinutos('12345')).toBe('123');
    expect(segundosDoCampo('')).toBeNull();
    expect(segundosDoCampo('52')).toBe(3120);
    expect(segundosDoCampo('0')).toBe(0);
  });

  it('a duração medida vira o texto do campo em minutos', () => {
    expect(campoDaDuracao(null)).toBe('');
    expect(campoDaDuracao(3120)).toBe('52');
    expect(campoDaDuracao(20)).toBe('0');
  });

  it('data futura e séries marcadas', () => {
    expect(disponivelAPartirDe('2026-10-21')).toBe('Você poderá concluir este treino a partir de 21/10/2026.');
    expect(textoDasSeriesMarcadas(3, 15)).toBe('Você marcou 3 de 15 séries.');
    expect(textoDasSeriesMarcadas(1, 1)).toBe('Você marcou 1 de 1 série.');
    expect(textoDasSeriesMarcadas(0, 0)).toBe('Este treino não tem séries para marcar.');
  });
});
