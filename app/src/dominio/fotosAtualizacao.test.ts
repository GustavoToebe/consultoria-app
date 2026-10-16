import {
  comFotoLocal, contagemDeFotos, idsDeFotos, LIMITES_FOTO, redimensionamento, reducoesDeFoto, semFotoLocal, todasAsFotosLocais, vagasDeFoto,
} from './fotosAtualizacao';

describe('reducoesDeFoto', () => {
  it('começa no lado máximo e na melhor qualidade, e só desce', () => {
    const r = reducoesDeFoto(4000, 3000);
    expect(r[0]).toEqual({ lado: LIMITES_FOTO.ladoMaximo, qualidade: 0.85 });
    const lados = r.map((x) => x.lado);
    expect([...lados].sort((a, b) => b - a)).toEqual(lados);
    expect(lados.at(-1)).toBe(640);
  });
  it('nunca amplia: foto pequena fica no tamanho dela', () => {
    const r = reducoesDeFoto(800, 600);
    expect(Math.max(...r.map((x) => x.lado))).toBe(800);
    expect(r[0].lado).toBe(800);
  });
  it('não repete lado igual', () => {
    const lados = reducoesDeFoto(500, 400).map((x) => x.lado);
    expect(new Set(lados).size).toBe(1);
  });
});

describe('redimensionamento', () => {
  it('limita o maior lado e deixa o outro acompanhar', () => {
    expect(redimensionamento(4000, 3000, 1600)).toEqual({ width: 1600 });
    expect(redimensionamento(3000, 4000, 1600)).toEqual({ height: 1600 });
    expect(redimensionamento(3000, 3000, 1600)).toEqual({ width: 1600 });
  });
  it('não mexe no que já cabe', () => {
    expect(redimensionamento(1600, 900, 1600)).toBeNull();
    expect(redimensionamento(0, 0, 1600)).toBeNull();
  });
});

describe('listas de fotos', () => {
  it('lê só ids de texto', () => {
    expect(idsDeFotos(['a', 'b'])).toEqual(['a', 'b']);
    expect(idsDeFotos(undefined)).toEqual([]);
    expect(idsDeFotos('a')).toEqual([]);
    expect(idsDeFotos(['a', 3 as unknown as string])).toEqual(['a']);
  });
  it('vagas contam enviadas e locais, sem passar de zero', () => {
    expect(vagasDeFoto(2, 1, 6)).toBe(3);
    expect(vagasDeFoto(6, 0, 6)).toBe(0);
    expect(vagasDeFoto(5, 5, 6)).toBe(0);
  });
  it('contagem no singular e no plural', () => {
    expect(contagemDeFotos(1, 6)).toBe('1 de 6 fotos');
    expect(contagemDeFotos(0, 1)).toBe('0 de 1 foto');
  });
});

describe('fotos locais do rascunho', () => {
  it('guarda por pergunta e tira sem deixar lista vazia', () => {
    let m = comFotoLocal(undefined, 'fotos', 'a.jpg');
    m = comFotoLocal(m, 'fotos', 'b.jpg');
    m = comFotoLocal(m, 'outra', 'c.jpg');
    expect(m).toEqual({ fotos: ['a.jpg', 'b.jpg'], outra: ['c.jpg'] });
    expect(todasAsFotosLocais(m).sort()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    m = semFotoLocal(m, 'outra', 'c.jpg');
    expect(m).toEqual({ fotos: ['a.jpg', 'b.jpg'] });
    expect(semFotoLocal(m, 'fotos', 'inexistente.jpg')).toEqual(m);
    expect(todasAsFotosLocais(undefined)).toEqual([]);
  });
  it('não altera o mapa recebido', () => {
    const m = { fotos: ['a.jpg'] };
    comFotoLocal(m, 'fotos', 'b.jpg');
    semFotoLocal(m, 'fotos', 'a.jpg');
    expect(m).toEqual({ fotos: ['a.jpg'] });
  });
});
