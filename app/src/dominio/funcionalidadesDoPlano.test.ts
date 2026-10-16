import { FUNCIONALIDADES, temFuncionalidade } from './funcionalidadesDoPlano';

describe('temFuncionalidade', () => {
  it('sem a lista, tudo está liberado', () => {
    for (const codigo of FUNCIONALIDADES) expect(temFuncionalidade(undefined, codigo)).toBe(true);
  });

  it('com a lista, só o que está nela', () => {
    expect(temFuncionalidade(['PDF', 'EQUIPE'], 'PDF')).toBe(true);
    expect(temFuncionalidade(['PDF', 'EQUIPE'], 'MOBILIDADE')).toBe(false);
  });

  it('lista vazia desliga tudo', () => {
    for (const codigo of FUNCIONALIDADES) expect(temFuncionalidade([], codigo)).toBe(false);
  });
});
