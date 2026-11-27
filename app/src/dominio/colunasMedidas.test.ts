import { colunasMedidas, diferencaDasColunas, numeroDeColunasMedidas, toposMedidos } from './colunasMedidas';

describe('colunasMedidas', () => {
  it('Início de 1920 (alturas da captura de 27/11): Hoje e Dieta presos, pendências abrindo a última; fim das colunas a menos de 80 px', () => {
    // hoje, dieta, pendências, água, semana, nível, compromissos
    const alturas = [414, 330, 280, 235, 152, 170, 215];
    const regras = [{ coluna: 0 }, { coluna: 1 }, { abreAUltima: true }, { abreAUltima: true }, {}, {}, {}];
    const coluna = colunasMedidas(alturas, 3, 24, regras);
    expect(coluna.slice(0, 3)).toEqual([0, 1, 2]);
    expect(diferencaDasColunas(coluna, alturas, 3, 24)).toBeLessThan(80);
  });

  it('sem pendências (altura 0), a Água abre a última coluna; a peça vazia não leva coluna nem vão', () => {
    const alturas = [414, 330, 0, 235, 152, 170, 215];
    const regras = [{ coluna: 0 }, { coluna: 1 }, { abreAUltima: true }, { abreAUltima: true }, {}, {}, {}];
    const coluna = colunasMedidas(alturas, 3, 24, regras);
    expect(coluna[3]).toBe(2);
    const { topos } = toposMedidos(coluna, alturas, 3, 24);
    expect(topos[3]).toBe(0);
  });

  it('refeições em ordem: o topo de cada uma nunca fica acima do da anterior, e a Medicação pode fechar a coluna mais curta', () => {
    // A captura da Dieta em 3440: café, lanche, almoço (com opções, mais alto), lanche, jantar, medicação, plano.
    const alturas = [295, 295, 430, 285, 295, 230, 70];
    const regras = [{ emOrdem: true, coluna: 0 }, { emOrdem: true }, { emOrdem: true }, { emOrdem: true }, { emOrdem: true }, {}, {}];
    const coluna = colunasMedidas(alturas, 2, 16, regras);
    const { topos } = toposMedidos(coluna, alturas, 2, 16);
    for (let i = 1; i < 5; i++) expect(topos[i]).toBeGreaterThanOrEqual(topos[i - 1]);
    expect(diferencaDasColunas(coluna, alturas, 2, 16)).toBeLessThan(80);
    // A grade antiga (linhas de mesma altura e a Medicação ao lado do jantar) deixava 235 px de diferença.
  });

  it('número de colunas: fica com três quando fecham; com poucos blocos (Início sem pendências nem compromissos), duas', () => {
    const regras = [{ coluna: 0 }, { coluna: 1 }, { abreAUltima: true }, { abreAUltima: true }, {}, {}, {}];
    expect(numeroDeColunasMedidas([414, 330, 280, 235, 152, 170, 215], 3, 2, 24, regras, 80)).toBe(3);
    // Alturas da captura de 1920 sem pendências: hoje, dieta, (pendências 0), água, semana, nível, (compromissos 0).
    const poucos = [409, 330, 0, 222, 150, 145, 0];
    expect(diferencaDasColunas(colunasMedidas(poucos, 3, 24, regras), poucos, 3, 24)).toBeGreaterThan(80);
    expect(numeroDeColunasMedidas(poucos, 3, 2, 24, regras, 80)).toBe(2);
    expect(diferencaDasColunas(colunasMedidas(poucos, 2, 24, regras), poucos, 2, 24)).toBeLessThan(80);
  });

  it('uma coluna, nenhuma peça ou coluna fixa fora do intervalo', () => {
    expect(colunasMedidas([10, 20], 1, 8)).toEqual([0, 0]);
    expect(colunasMedidas([], 3, 8)).toEqual([]);
    expect(colunasMedidas([10, 20, 30], 2, 8, [{ coluna: 5 }, { coluna: -1 }])[0]).toBe(1);
  });

  it('muitas peças: cai na coluna mais baixa na hora, sem travar', () => {
    const alturas = Array.from({ length: 30 }, (_, i) => 100 + (i % 7) * 10);
    const coluna = colunasMedidas(alturas, 3, 8);
    expect(coluna).toHaveLength(30);
    expect(new Set(coluna).size).toBe(3);
  });
});
