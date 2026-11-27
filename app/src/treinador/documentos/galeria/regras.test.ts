import { colunasDaGaleria, enderecoDoEditor, larguraMaximaDaGaleria, modoDaEscolha } from './regras';

describe('colunasDaGaleria', () => {
  it('6, 3, 2 ou 1 por linha (nunca 4 ou 5), com célula de pelo menos 220', () => {
    expect([0, 358, 455].map((l) => colunasDaGaleria(l, 16))).toEqual([1, 1, 1]);
    expect([456, 691].map((l) => colunasDaGaleria(l, 16))).toEqual([2, 2]);
    expect([692, 1000, 1399].map((l) => colunasDaGaleria(l, 16))).toEqual([3, 3, 3]);
    expect([1400, 2400].map((l) => colunasDaGaleria(l, 16))).toEqual([6, 6]);
  });
  it('teto da grade: células de no máximo 320', () => {
    expect(larguraMaximaDaGaleria(1, 16)).toBe(320);
    expect(larguraMaximaDaGaleria(3, 16)).toBe(992);
    expect(larguraMaximaDaGaleria(6, 16)).toBe(2000);
  });
});

describe('modoDaEscolha', () => {
  it('nativo sempre confirma e grava', () => {
    expect(modoDaEscolha({ web: false, janela: 2000, faixaDaTela: 'larga' })).toBe('confirmar');
  });
  it('web: a faixa da tela normal ou maior abre o editor', () => {
    expect(modoDaEscolha({ web: true, janela: 1200, faixaDaTela: 'normal' })).toBe('editor');
  });
  it('web compacta pela tela (coluna de Configurações): decide pela janela menos o menu aberto', () => {
    expect(modoDaEscolha({ web: true, janela: 390, faixaDaTela: 'compacta' })).toBe('confirmar');
    expect(modoDaEscolha({ web: true, janela: 1024, faixaDaTela: 'compacta' })).toBe('confirmar');
    expect(modoDaEscolha({ web: true, janela: 1263, faixaDaTela: 'compacta' })).toBe('confirmar');
    expect(modoDaEscolha({ web: true, janela: 1264, faixaDaTela: 'compacta' })).toBe('editor');
    expect(modoDaEscolha({ web: true, janela: 1280, faixaDaTela: 'compacta' })).toBe('editor');
  });
});

describe('enderecoDoEditor', () => {
  it('com o modelo escolhido, ou sem nada para a configuração gravada', () => {
    expect(enderecoDoEditor('MINIMALISTA')).toBe('/treinador/documentos/personalizar?modelo=MINIMALISTA');
    expect(enderecoDoEditor()).toBe('/treinador/documentos/personalizar');
  });
});
