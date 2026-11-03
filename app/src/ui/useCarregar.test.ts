import { leituraDoCarregamento } from './useCarregar';

describe('leituraDoCarregamento', () => {
  const velho = { chave: 'dias:7', rodada: 0, dados: { n: 7 } };

  it('trocar a chave esconde os dados anteriores e fica carregando', () => {
    expect(leituraDoCarregamento(velho, 'dias:14', 0)).toEqual({
      dados: undefined, erro: undefined, carregando: true,
    });
  });

  it('recarregar a mesma chave mantém os dados até a resposta nova', () => {
    expect(leituraDoCarregamento(velho, 'dias:7', 1)).toEqual({
      dados: { n: 7 }, erro: undefined, carregando: true,
    });
  });

  it('a resposta da chave atual entrega os dados e a falha', () => {
    expect(leituraDoCarregamento({ chave: 'dias:14', rodada: 0, dados: { n: 14 } }, 'dias:14', 0)).toEqual({
      dados: { n: 14 }, erro: undefined, carregando: false,
    });
    expect(leituraDoCarregamento({ chave: 'dias:14', rodada: 0, erro: 'rede' }, 'dias:14', 0)).toEqual({
      dados: undefined, erro: 'rede', carregando: false,
    });
  });

  it('sem chave não carrega', () => {
    expect(leituraDoCarregamento(null, null, 0)).toEqual({
      dados: undefined, erro: undefined, carregando: false,
    });
  });
});
