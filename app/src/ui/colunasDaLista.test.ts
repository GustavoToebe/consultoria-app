import {
  DIREITA_DO_BOTAO_AO_LADO, estiloDaColuna, LARGURA_AO_LADO, LARGURA_DA_CAIXA, LARGURA_DA_SETA, LARGURA_DO_BOTAO_AO_LADO, margensDoCabecalho, RECUO_DA_LINHA,
} from './colunasDaLista';

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

  it('o lápis fica antes da seta: por cima do lugar vazio do link, entre o fim das colunas e a seta', () => {
    // Da direita para a esquerda: recuo do link, seta, espaço, botão. O cabeçalho desconta a mesma soma.
    expect(DIREITA_DO_BOTAO_AO_LADO).toBe(RECUO_DA_LINHA + LARGURA_DA_SETA + RECUO_DA_LINHA);
    expect(LARGURA_AO_LADO).toBe(LARGURA_DO_BOTAO_AO_LADO + RECUO_DA_LINHA);
    const { depois } = margensDoCabecalho({ aoLado: true });
    expect(depois).toBe(DIREITA_DO_BOTAO_AO_LADO - RECUO_DA_LINHA + LARGURA_DO_BOTAO_AO_LADO + RECUO_DA_LINHA);
  });
});
