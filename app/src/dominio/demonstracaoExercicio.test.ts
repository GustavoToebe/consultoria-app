import {
  caminhosValidosDoCatalogo,
  demonstracaoDe,
  deveAlternar,
  fotoDaVez,
  INTERVALO_ALTERNANCIA_MS,
  LIMITES_IMAGEM_EXERCICIO,
  problemaDoGif,
  textoAlternativoDaDemonstracao,
  tipoDaImagemEscolhida,
  urlDaFotoDoCatalogo,
} from './demonstracaoExercicio';

describe('demonstração do exercício', () => {
  it('a imagem própria vem antes das fotos do catálogo, e sem nada não sobra espaço', () => {
    const catalogo = ['Air_Bike/0.jpg', 'Air_Bike/1.jpg'];
    expect(demonstracaoDe({ imagens: catalogo, imagemPropriaEm: '2026-10-20T12:00:00Z' })).toEqual({
      tipo: 'PROPRIA',
      versao: '2026-10-20T12:00:00Z',
    });
    expect(demonstracaoDe({ imagens: catalogo, imagemPropriaEm: null })).toEqual({ tipo: 'CATALOGO', caminhos: catalogo });
    expect(demonstracaoDe({ imagens: [], imagemPropriaEm: null })).toBeNull();
    expect(demonstracaoDe({})).toBeNull();
    expect(demonstracaoDe(null)).toBeNull();
    expect(demonstracaoDe(undefined)).toBeNull();
  });

  it('só aceita caminho no formato do catálogo e no máximo duas fotos', () => {
    expect(caminhosValidosDoCatalogo(['A_b-1/0.jpg', 'A_b-1/1.jpg', 'A_b-1/0.jpg'])).toEqual(['A_b-1/0.jpg', 'A_b-1/1.jpg']);
    for (const ruim of ['../segredo/0.jpg', 'a/../0.jpg', '/a/0.jpg', 'a/2.jpg', 'a/0.png', 'https://x.test/a/0.jpg', 'a//0.jpg', 'a b/0.jpg', '']) {
      expect(caminhosValidosDoCatalogo([ruim])).toEqual([]);
    }
    expect(caminhosValidosDoCatalogo(null)).toEqual([]);
    expect(demonstracaoDe({ imagens: ['../x/0.jpg'] })).toBeNull();
  });

  it('alterna a cada 0,8 s e, com movimento reduzido, fica na primeira', () => {
    expect(INTERVALO_ALTERNANCIA_MS).toBe(800);
    expect([0, 1, 2, 3].map((p) => fotoDaVez(2, p, false))).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3].map((p) => fotoDaVez(2, p, true))).toEqual([0, 0, 0, 0]);
    expect(fotoDaVez(1, 5, false)).toBe(0);
    expect(fotoDaVez(0, 5, false)).toBe(0);
    expect(fotoDaVez(2, -1, false)).toBe(1);
    expect(deveAlternar(2, false)).toBe(true);
    expect(deveAlternar(2, true)).toBe(false);
    expect(deveAlternar(1, false)).toBe(false);
    expect(deveAlternar(0, false)).toBe(false);
  });

  it('texto alternativo pelo nome do exercício', () => {
    expect(textoAlternativoDaDemonstracao('Remada baixa')).toBe('Demonstração: Remada baixa');
    expect(textoAlternativoDaDemonstracao('  ')).toBe('Demonstração: exercício');
  });

  it('a foto do catálogo é endereçada no próprio site, nunca no GitHub', () => {
    expect(urlDaFotoDoCatalogo('https://consultoria.exemplo.test/', 'Air_Bike/0.jpg')).toBe(
      'https://consultoria.exemplo.test/catalogo/exercicios/Air_Bike/0.jpg',
    );
    expect(urlDaFotoDoCatalogo('http://localhost:8088', 'Air_Bike/1.jpg')).toBe('http://localhost:8088/catalogo/exercicios/Air_Bike/1.jpg');
    expect(urlDaFotoDoCatalogo('http://localhost:8088', '../x/0.jpg')).toBeNull();
  });

  it('descobre o tipo pelo seletor ou pela extensão e recusa o resto', () => {
    expect(tipoDaImagemEscolhida('image/gif', 'a.bin')).toBe('image/gif');
    expect(tipoDaImagemEscolhida('image/JPG', null)).toBe('image/jpeg');
    expect(tipoDaImagemEscolhida(null, 'Foto.PNG')).toBe('image/png');
    expect(tipoDaImagemEscolhida('', 'anim.gif')).toBe('image/gif');
    expect(tipoDaImagemEscolhida('image/svg+xml', 'a.svg')).toBeNull();
    expect(tipoDaImagemEscolhida(null, null)).toBeNull();
  });

  it('GIF acima de 1 MB é recusado antes de subir; os limites são os do servidor', () => {
    expect(LIMITES_IMAGEM_EXERCICIO.bytesMaximo).toBe(1_000_000);
    expect(LIMITES_IMAGEM_EXERCICIO.ladoMaximo).toBe(800);
    expect(Math.max(...LIMITES_IMAGEM_EXERCICIO.lados)).toBe(800);
    expect(problemaDoGif(1_000_000)).toBeNull();
    expect(problemaDoGif(1_000_001)).toMatch(/1 MB/);
  });
});
