import { visaoGeralComColunaDeApoio } from './colunasDaVisaoGeral';

// tela larga: revisão (24/11)
describe('visaoGeralComColunaDeApoio', () => {
  it('abre a coluna de apoio só com 1800 + 16 + 480 px de contêiner', () => {
    expect(visaoGeralComColunaDeApoio(0)).toBe(false);
    // 2560 com o menu aberto (~2288 px de conteúdo): continua em uma coluna.
    expect(visaoGeralComColunaDeApoio(2288)).toBe(false);
    expect(visaoGeralComColunaDeApoio(2295)).toBe(false);
    expect(visaoGeralComColunaDeApoio(2296)).toBe(true);
    // 3440 com o menu aberto (~3104 px).
    expect(visaoGeralComColunaDeApoio(3104)).toBe(true);
  });
  it('em "Limitada" o conteúdo para em 1800 e a coluna não abre', () => {
    expect(visaoGeralComColunaDeApoio(1800)).toBe(false);
  });
});
