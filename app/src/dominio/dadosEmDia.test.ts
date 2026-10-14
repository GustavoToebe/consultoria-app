import { dadosEmDia } from './dadosEmDia';

describe('dadosEmDia', () => {
  const pagina1 = { itens: ['Ana', 'Bia'] };

  it('com tudo carregado devolve os dados', () => {
    expect(dadosEmDia(pagina1, false)).toBe(pagina1);
  });

  it('enquanto carrega a chave nova não devolve os dados da anterior', () => {
    expect(dadosEmDia(pagina1, true)).toBeUndefined();
  });

  it('sem dados devolve nada, carregando ou não', () => {
    expect(dadosEmDia(undefined, false)).toBeUndefined();
    expect(dadosEmDia(undefined, true)).toBeUndefined();
  });
});
