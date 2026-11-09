import { curtidoPorMim, EMOJI_DA_CURTIDA, textoDaPosicao, totalDeCurtidas } from './comunidade';

describe('curtida do mural', () => {
  it('conta só a curtida e ignora as outras reações', () => {
    expect(totalDeCurtidas({ reacoes: { [EMOJI_DA_CURTIDA]: 3, '🔥': 9 } })).toBe(3);
    expect(totalDeCurtidas({ reacoes: { '🔥': 9 } })).toBe(0);
    expect(totalDeCurtidas({ reacoes: {} })).toBe(0);
  });
  it('sabe se a curtida é minha', () => {
    expect(curtidoPorMim({ minhasReacoes: ['🔥', EMOJI_DA_CURTIDA] })).toBe(true);
    expect(curtidoPorMim({ minhasReacoes: ['🔥'] })).toBe(false);
  });
});

describe('textoDaPosicao', () => {
  it('concorda o plural', () => {
    expect(textoDaPosicao(3, 12)).toBe('3º de 12 participantes');
    expect(textoDaPosicao(1, 1)).toBe('1º de 1 participante');
  });
});
