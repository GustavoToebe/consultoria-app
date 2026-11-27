import {
  arranjoDoInicioLargo, COLUNAS_DO_INICIO_LARGO, fileiraDaVitrine, mapaAoLadoDaVitrine, PECAS_DAS_COLUNAS, PECAS_DE_DUAS, REGRAS_DAS_COLUNAS,
} from './arranjoDoInicioLargo';
import { colunasMedidas } from './colunasMedidas';

describe('arranjoDoInicioLargo', () => {
  it('abaixo da área lado a lado (972), o celular e o tablet; até a faixa normal, duas colunas; larga e ultralarga, colunas medidas', () => {
    expect(arranjoDoInicioLargo(971, 'compacta')).toBe('comum');
    // 1280 com o menu aberto: ~1000 de área, ainda `compacta` pela Tela, mas já lado a lado.
    expect(arranjoDoInicioLargo(1000, 'compacta')).toBe('duas');
    expect(arranjoDoInicioLargo(1500, 'normal')).toBe('duas');
    expect(arranjoDoInicioLargo(1650, 'larga')).toBe('colunas');
    expect(arranjoDoInicioLargo(3100, 'ultralarga')).toBe('colunas');
    expect(arranjoDoInicioLargo(0, 'compacta')).toBe('comum');
  });

  it('duas: apoio só com pendências e Água, o resto numa pilha', () => {
    expect(PECAS_DE_DUAS).toEqual({ principal: ['hoje', 'dieta', 'compromissos', 'semana', 'nivel'], apoio: ['pendencias', 'agua'] });
  });

  it('colunas: Hoje abre a primeira, Dieta a segunda e as pendências a última', () => {
    const alturas = PECAS_DAS_COLUNAS.map((b) => ({ hoje: 414, dieta: 330, pendencias: 280, agua: 235, semana: 152, nivel: 170, compromissos: 215 })[b]);
    const coluna = colunasMedidas(alturas, COLUNAS_DO_INICIO_LARGO, 24, PECAS_DAS_COLUNAS.map((b) => REGRAS_DAS_COLUNAS[b]));
    expect([coluna[PECAS_DAS_COLUNAS.indexOf('hoje')], coluna[PECAS_DAS_COLUNAS.indexOf('dieta')], coluna[PECAS_DAS_COLUNAS.indexOf('pendencias')]]).toEqual([0, 1, 2]);
  });

  it('o mapa só divide a linha com a vitrine quando cabem dois produtos ao lado do mapa cheio', () => {
    expect(mapaAoLadoDaVitrine(1600, true, true, 24)).toBe(false);
    expect(mapaAoLadoDaVitrine(1919, true, true, 24)).toBe(false);
    expect(mapaAoLadoDaVitrine(1920, true, true, 24)).toBe(true);
    expect(mapaAoLadoDaVitrine(3000, false, true, 24)).toBe(false);
    expect(mapaAoLadoDaVitrine(3000, true, false, 24)).toBe(false);
  });

  it('fileira da vitrine: quantos cabem com 240, no máximo os itens, cada um até 320', () => {
    expect(fileiraDaVitrine(1000, 10, 16)).toEqual({ quantos: 3, celula: 320 });
    expect(fileiraDaVitrine(760, 10, 16)).toEqual({ quantos: 3, celula: (760 - 32) / 3 });
    expect(fileiraDaVitrine(3000, 2, 16)).toEqual({ quantos: 2, celula: 320 });
    expect(fileiraDaVitrine(200, 3, 16)).toEqual({ quantos: 1, celula: 200 });
    expect(fileiraDaVitrine(0, 3, 16).quantos).toBe(1);
    expect(fileiraDaVitrine(800, 0, 16).quantos).toBe(0);
  });
});
