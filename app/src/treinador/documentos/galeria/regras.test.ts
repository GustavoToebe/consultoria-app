import { enderecoDoEditor, modoDaEscolha } from './regras';

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
