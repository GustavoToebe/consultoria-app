import { colunasDosVideos, descricaoDoCartao, destinosDoVideo } from './gradeDosVideos';

describe('colunasDosVideos', () => {
  it('1 no celular (e antes da medida), 2 abaixo de 1024, 3 de 1024 a 1600, 4 a partir de 1600', () => {
    expect(colunasDosVideos(0)).toBe(1);
    expect(colunasDosVideos(390)).toBe(1);
    expect(colunasDosVideos(599)).toBe(1);
    expect(colunasDosVideos(600)).toBe(2);
    expect(colunasDosVideos(1023)).toBe(2);
    expect(colunasDosVideos(1024)).toBe(3);
    expect(colunasDosVideos(1040)).toBe(3);
    expect(colunasDosVideos(1599)).toBe(3);
    expect(colunasDosVideos(1600)).toBe(4);
    // tela larga: revisão (24/11): 5 e 6 colunas no monitor grande.
    expect(colunasDosVideos(1999)).toBe(4);
    expect(colunasDosVideos(2000)).toBe(5);
    expect(colunasDosVideos(2399)).toBe(5);
    expect(colunasDosVideos(2400)).toBe(6);
    expect(colunasDosVideos(3200)).toBe(6);
  });
});

describe('descricaoDoCartao', () => {
  it('omite a descrição vazia ou igual ao título, sem diferença de caixa e espaços', () => {
    expect(descricaoDoCartao('Agachamento', null)).toBeNull();
    expect(descricaoDoCartao('Agachamento', '   ')).toBeNull();
    expect(descricaoDoCartao('Agachamento livre', '  agachamento   LIVRE ')).toBeNull();
    expect(descricaoDoCartao('Agachamento livre', 'Agachamento livre com barra')).toBe('Agachamento livre com barra');
    expect(descricaoDoCartao('Título', ' Outra coisa ')).toBe('Outra coisa');
  });
});

describe('destinosDoVideo', () => {
  const colecoes = [
    { id: 'b', nome: 'Pernas', ordem: 1, totalAulas: 0 },
    { id: 'a', nome: 'Costas', ordem: 0, totalAulas: 2 },
  ];
  it('as outras coleções na ordem do treinador e "Sem coleção" por último', () => {
    expect(destinosDoVideo('a', colecoes)).toEqual([{ id: 'b', rotulo: 'Pernas' }, { id: null, rotulo: 'Sem coleção' }]);
  });
  it('vídeo sem coleção: só as coleções', () => {
    expect(destinosDoVideo(null, colecoes)).toEqual([{ id: 'a', rotulo: 'Costas' }, { id: 'b', rotulo: 'Pernas' }]);
  });
});
