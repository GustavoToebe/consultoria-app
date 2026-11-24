import { colunasDaListaDeAtualizacoes, MAXIMO_DE_COLUNAS, MINIMO_DA_LINHA, VAO_DA_LISTA } from './colunasDaListaDeAtualizacoes';

// tela larga: revisão (24/11): as linhas em caixa de Atualizações ganham colunas com o espaço, sem passar da célula mínima.
describe('colunasDaListaDeAtualizacoes', () => {
  it('sem medida ou estreita, uma coluna', () => {
    expect(colunasDaListaDeAtualizacoes(0)).toBe(1);
    expect(colunasDaListaDeAtualizacoes(NaN)).toBe(1);
    expect(colunasDaListaDeAtualizacoes(350)).toBe(1);
    expect(colunasDaListaDeAtualizacoes(895)).toBe(1);
  });

  it('larguras do cartão nas telas de referência (menu aberto): 1280 → 2, 1920 → 3, 2560 → 4, 3440 → 6', () => {
    expect(colunasDaListaDeAtualizacoes(966)).toBe(2);
    expect(colunasDaListaDeAtualizacoes(1606)).toBe(3);
    expect(colunasDaListaDeAtualizacoes(2246)).toBe(4);
    expect(colunasDaListaDeAtualizacoes(3062)).toBe(6);
  });

  it('nunca passa do teto e nenhuma célula fica abaixo do mínimo, também com o texto ampliado', () => {
    for (const fator of [1, 1.12, 1.25, 1.4]) {
      for (let largura = 300; largura <= 5000; largura += 13) {
        const n = colunasDaListaDeAtualizacoes(largura, fator);
        expect(n).toBeLessThanOrEqual(MAXIMO_DE_COLUNAS);
        if (n > 1) expect((largura - VAO_DA_LISTA * (n - 1)) / n).toBeGreaterThanOrEqual(Math.round(MINIMO_DA_LINHA * fator));
      }
    }
    expect(colunasDaListaDeAtualizacoes(1606, 1.4)).toBe(2);
  });
});
