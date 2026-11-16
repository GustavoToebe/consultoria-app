import { ajustarAChave, cortarGrupos, faltaMostrar, limiteInicial, mostrarMaisUm, PASSO_DO_MOSTRAR_MAIS, textoMostrando } from './mostrarMais';

describe('mostrarMais', () => {
  it('cresce de 80 em 80 (80, 160, 240) e só oferece o botão enquanto faltam itens', () => {
    let e = limiteInicial('');
    expect(e.limite).toBe(PASSO_DO_MOSTRAR_MAIS);
    expect(faltaMostrar(e.limite, 200)).toBe(true);
    e = mostrarMaisUm(e);
    expect(e.limite).toBe(160);
    expect(faltaMostrar(e.limite, 200)).toBe(true);
    e = mostrarMaisUm(e);
    expect(e.limite).toBe(240);
    expect(faltaMostrar(e.limite, 200)).toBe(false);
    expect(faltaMostrar(80, 80)).toBe(false);
  });

  it('a contagem volta a 80 quando a busca muda e fica quando é a mesma', () => {
    const cresceu = mostrarMaisUm(mostrarMaisUm(limiteInicial('arroz')));
    expect(ajustarAChave(cresceu, 'arroz')).toBe(cresceu);
    expect(ajustarAChave(cresceu, 'arro')).toEqual({ chave: 'arro', limite: 80 });
  });

  it('"Mostrando N de M" nunca passa do total e usa ponto de milhar', () => {
    expect(textoMostrando(80, 200)).toBe('Mostrando 80 de 200.');
    expect(textoMostrando(160, 1200)).toBe('Mostrando 160 de 1.200.');
    expect(textoMostrando(240, 200)).toBe('Mostrando 200 de 200.');
  });

  it('corta grupos pelo total de itens, na ordem, e some com o grupo que fica vazio', () => {
    const grupos = [{ nome: 'A', itens: [1, 2, 3] }, { nome: 'B', itens: [4, 5] }, { nome: 'C', itens: [6] }];
    expect(cortarGrupos(grupos, 4)).toEqual([{ nome: 'A', itens: [1, 2, 3] }, { nome: 'B', itens: [4] }]);
    expect(cortarGrupos(grupos, 3)).toEqual([{ nome: 'A', itens: [1, 2, 3] }]);
    expect(cortarGrupos(grupos, 80)).toEqual(grupos);
    expect(cortarGrupos([], 80)).toEqual([]);
  });
});
