import type { Carga, Serie } from '../api/tipos';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { avisoDeRepeticoes as avisar } from './avisoDeRepeticoes';

const avisoDeRepeticoes = (s: Serie, r: number | null) => avisar(s, r, CONFIGURACAO_PADRAO);

const carga = (modo: Carga['modo']): Carga => ({ modo, percentualMin: null, percentualMax: null, referenciaUid: null });
const serie = (p: Partial<Serie> = {}): Serie => ({ uid: 's', tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: carga('CARGA_TRABALHO'), esforco: null, descansoSegundos: null, ...p });

describe('aviso "passou de N repetições" (D11)', () => {
  it('passou do máximo da meta: só texto, sem kg', () => {
    const aviso = avisoDeRepeticoes(serie(), 9);
    expect(aviso).toBe('Passou de 8 repetições, o máximo da meta.');
    expect(aviso).not.toMatch(/kg/i);
  });

  it('no máximo, abaixo, sem repetições: sem aviso', () => {
    expect(avisoDeRepeticoes(serie(), 8)).toBeNull();
    expect(avisoDeRepeticoes(serie(), 5)).toBeNull();
    expect(avisoDeRepeticoes(serie(), null)).toBeNull();
    expect(avisoDeRepeticoes(serie(), 0)).toBeNull();
  });

  it('singular quando o máximo é 1', () => {
    expect(avisoDeRepeticoes(serie({ repsMin: 1, repsMax: 1 }), 2)).toBe('Passou de 1 repetição, o máximo da meta.');
  });

  it('sem máximo, AMRAP, cardio, técnica e série que não é de trabalho: sem aviso', () => {
    expect(avisoDeRepeticoes(serie({ repsMax: null }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ amrap: true }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ cardio: { duracaoMin: 20 } }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 } as Serie['tecnica'] }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'WARM_UP', carga: carga('NENHUMA') }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'TIPO_QUE_NAO_EXISTE' }), 30)).toBeNull();
    expect(avisar(serie(), 30, null)).toBeNull();
  });

  it('vale para trabalho e pós-trabalho em qualquer modo de carga (fixa, mesma carga, % da WS)', () => {
    expect(avisoDeRepeticoes(serie({ carga: carga('PERCENTUAL_WS') }), 9)).toBe('Passou de 8 repetições, o máximo da meta.');
    expect(avisoDeRepeticoes(serie({ carga: carga('MESMA_CARGA') }), 9)).not.toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA') }), 9)).not.toBeNull();
  });
});
