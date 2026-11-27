import { abaDoHistorico, ABAS_DO_HISTORICO, NO_TOPO_DE_TODA_ABA, ARRANJO_DA_ABA, historicoEmAbas, ORDEM_NUMA_COLUNA } from './abasDoHistorico';

describe('abaDoHistorico', () => {
  it('abre Treinos sem parâmetro ou com valor desconhecido', () => {
    expect(abaDoHistorico(undefined)).toBe('treinos');
    expect(abaDoHistorico('')).toBe('treinos');
    expect(abaDoHistorico('peso')).toBe('treinos');
  });

  it('as abas são Treinos | Corpo | Atualizações, nessa ordem, com os valores do endereço (decisão do Gustavo, 26/11)', () => {
    expect(ABAS_DO_HISTORICO).toEqual([
      { valor: 'treinos', rotulo: 'Treinos' },
      { valor: 'corpo', rotulo: 'Corpo' },
      { valor: 'atualizacoes', rotulo: 'Atualizações' },
    ]);
  });

  it('aceita cada aba e o primeiro valor de uma lista', () => {
    for (const { valor } of ABAS_DO_HISTORICO) expect(abaDoHistorico(valor)).toBe(valor);
    expect(abaDoHistorico(['corpo', 'treinos'])).toBe('corpo');
  });
});

describe('ARRANJO_DA_ABA', () => {
  it('nenhum cartão some nem se repete: as abas mais o topo são a mesma lista da coluna única', () => {
    const nasAbas = [...NO_TOPO_DE_TODA_ABA, ...ABAS_DO_HISTORICO.flatMap(({ valor }) => [...ARRANJO_DA_ABA[valor].principal, ...ARRANJO_DA_ABA[valor].apoio])];
    expect([...nasAbas].sort()).toEqual([...ORDEM_NUMA_COLUNA].sort());
    expect(new Set(nasAbas).size).toBe(nasAbas.length);
  });

  it('Treinos tem os registros na principal e o progresso ao lado; Corpo em colunas; Atualizações na largura do contêiner', () => {
    expect(ARRANJO_DA_ABA.treinos).toEqual({ principal: ['registros'], apoio: ['progresso'], rotuloDoApoio: 'Progresso por exercício', emColunas: false });
    expect(ARRANJO_DA_ABA.corpo.principal).toEqual(['peso', 'avaliacao', 'fotos']);
    expect(ARRANJO_DA_ABA.corpo.emColunas).toBe(true);
    expect(ARRANJO_DA_ABA.atualizacoes.emColunas).toBe(false);
    // Toda aba com apoio dá nome à região; sem apoio, nome nulo.
    for (const { valor } of ABAS_DO_HISTORICO) expect(ARRANJO_DA_ABA[valor].rotuloDoApoio === null).toBe(ARRANJO_DA_ABA[valor].apoio.length === 0);
  });
});

describe('historicoEmAbas', () => {
  it('só na web com o menu lateral (768 px de janela ou mais)', () => {
    expect(historicoEmAbas(true, 390)).toBe(false);
    expect(historicoEmAbas(true, 767)).toBe(false);
    expect(historicoEmAbas(true, 768)).toBe(true);
    expect(historicoEmAbas(true, 2560)).toBe(true);
    expect(historicoEmAbas(false, 1280)).toBe(false);
  });
});
