import { estiloDaColuna, LARGURA_AO_LADO, LARGURA_DA_CAIXA, LARGURA_DA_SETA, margensDoCabecalho, RECUO_DA_LINHA } from './colunasDaLista';

describe('colunas da lista', () => {
  it('cada coluna divide o espaço pelo peso, com a largura mínima', () => {
    expect(estiloDaColuna({ chave: 'aluno', rotulo: 'Aluno', peso: 2.2, minima: 220 })).toEqual({ flexGrow: 2.2, flexShrink: 1, flexBasis: 0, minWidth: 220 });
    expect(estiloDaColuna({ chave: 'plano', rotulo: 'Plano', peso: 1.6 }).minWidth).toBe(0);
  });

  it('o cabeçalho desconta o que a linha tem fora das colunas', () => {
    // Link: a seta (e o espaço antes dela) e, com o lápis, a ação ao lado.
    expect(margensDoCabecalho({})).toEqual({ antes: 0, depois: RECUO_DA_LINHA + LARGURA_DA_SETA });
    expect(margensDoCabecalho({ aoLado: true })).toEqual({ antes: 0, depois: RECUO_DA_LINHA + LARGURA_DA_SETA + LARGURA_AO_LADO });
    // Selecionar: só a caixa à esquerda; sem seta e sem lápis, mesmo que a lista os tenha fora dele.
    expect(margensDoCabecalho({ marcar: true, aoLado: true })).toEqual({ antes: LARGURA_DA_CAIXA + RECUO_DA_LINHA, depois: 0 });
  });
});
