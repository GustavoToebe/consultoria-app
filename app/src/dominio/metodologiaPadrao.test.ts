import { CONFIGURACAO_PADRAO as c } from './metodologiaPadrao';

describe('CONFIGURACAO_PADRAO', () => {
  it('tem tipos de trabalho e de preparação na lista de tipos', () => {
    expect(c.tiposSerie).toContain(c.tipoTrabalho);
    expect(c.tiposSerie).toContain(c.tipoPreparacao);
  });

  it('só tem faixa de repetições para tipo da lista, e cada regra de FS tem um percentual por série', () => {
    for (const tipo of Object.keys(c.repeticoes ?? {})) expect(c.tiposSerie).toContain(tipo);
    for (const [quantidade, percentuais] of Object.entries(c.regraPreparacao)) expect(percentuais).toHaveLength(Number(quantidade));
  });
});
