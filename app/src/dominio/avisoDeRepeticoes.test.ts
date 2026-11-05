import type { Carga, Serie } from '../api/tipos';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { avisoDeRepeticoes as avisar } from './avisoDeRepeticoes';

const avisoDeRepeticoes = (s: Serie, r: number | null) => avisar(s, r, CONFIGURACAO_PADRAO);

const carga = (modo: Carga['modo']): Carga => ({ modo, percentualMin: null, percentualMax: null });
const serie = (p: Partial<Serie> = {}): Serie => ({ uid: 's', tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: carga('CARGA_TRABALHO'), esforco: null, descansoSegundos: null, ...p });

describe('aviso "passou de N repetições" (D11)', () => {
  it('na série de trabalho, bater ou passar a meta avisa o passo do próximo treino', () => {
    expect(avisoDeRepeticoes(serie(), 8)).toBe('Meta de 8 repetições atingida! No próximo treino a sugestão sobe +0,5 kg.');
    expect(avisoDeRepeticoes(serie(), 9)).toBe('Passou de 8 repetições (meta atingida)! No próximo treino a sugestão sobe +0,5 kg.');
    expect(avisar(serie({ repsMin: 5, repsMax: 5 }), 5, CONFIGURACAO_PADRAO, 2.5)).toBe('Meta de 5 repetições atingida! No próximo treino a sugestão sobe +2,5 kg.');
  });

  it('abaixo da meta ou sem repetições: sem aviso', () => {
    expect(avisoDeRepeticoes(serie(), 5)).toBeNull();
    expect(avisoDeRepeticoes(serie(), null)).toBeNull();
    expect(avisoDeRepeticoes(serie(), 0)).toBeNull();
  });

  it('singular quando o máximo é 1', () => {
    expect(avisoDeRepeticoes(serie({ repsMin: 1, repsMax: 1 }), 2)).toBe('Passou de 1 repetição (meta atingida)! No próximo treino a sugestão sobe +0,5 kg.');
  });

  it('sem máximo, AMRAP, cardio, técnica e série que não é de trabalho: sem aviso', () => {
    expect(avisoDeRepeticoes(serie({ repsMin: null, repsMax: null }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ amrap: true }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ cardio: { duracaoMin: 20 } }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 } as Serie['tecnica'] }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'WARM_UP', carga: carga('NENHUMA') }), 30)).toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'TIPO_QUE_NAO_EXISTE' }), 30)).toBeNull();
    expect(avisar(serie(), 30, null)).toBeNull();
  });

  it('vale para trabalho e pós-trabalho em qualquer modo de carga (fixa, % da WS)', () => {
    expect(avisoDeRepeticoes(serie({ carga: carga('PERCENTUAL_WS') }), 9)).toBe('Passou de 8 repetições, o máximo da meta.');
    expect(avisoDeRepeticoes(serie({ carga: carga('CARGA_FIXA') }), 9)).not.toBeNull();
    expect(avisoDeRepeticoes(serie({ tipo: 'BACK_OFF', carga: carga('PERCENTUAL_WS') }), 9)).not.toBeNull();
  });
});
