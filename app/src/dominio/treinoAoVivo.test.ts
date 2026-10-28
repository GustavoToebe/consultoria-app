import { exercicio, serie } from './exemplosDeTreino.apoioTeste';
import {
  duracaoDaFaixa,
  duracaoFalada,
  textoDaDuracaoAoVivo,
  textoDoVolumeAoVivo,
  volumeDaSessao,
  type RegistroDoVolume,
} from './treinoAoVivo';

const r = (carga: number | null, repeticoes: number | null, extra: Partial<RegistroDoVolume> = {}): RegistroDoVolume => ({
  carga,
  repeticoes,
  concluida: true,
  etapas: null,
  ...extra,
});

describe('faixa do treino ao vivo (Engajamento 0.3)', () => {
  const sessao = {
    exercicios: [
      exercicio('a', { series: [serie('a1'), serie('a2'), serie('a3')] }),
      exercicio('b', { unidade: 'nenhuma', series: [serie('b1')] }),
      exercicio('c', { modalidade: 'CARDIO', series: [serie('c1')] }),
      exercicio('d', { series: [serie('d1')] }),
    ],
  };

  it('volume: carga × repetições do que foi marcado; sem carga, cardio e não feita ficam fora', () => {
    const registros: Record<string, RegistroDoVolume> = {
      a1: r(60, 10),
      a2: r(70, 5, { concluida: false }),
      b1: r(null, 20),
      c1: r(null, null),
      d1: r(40, 8, {
        concluida: false,
        etapas: [
          { posicao: 1, repeticoes: 4, carga: 40, situacao: 'FEITA' },
          { posicao: 2, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' },
        ],
      }),
    };
    const v = volumeDaSessao(sessao, (uid) => registros[uid]);
    expect(v).toEqual({ valor: 760, completo: true });
    expect(textoDoVolumeAoVivo(v)).toBe('760 kg');
    expect(textoDoVolumeAoVivo({ valor: 3450.5, completo: true })).toBe('3.450,5 kg');
    expect(volumeDaSessao(sessao, () => undefined)).toBeNull();
    expect(textoDoVolumeAoVivo(null)).toBe('—');
  });

  it('volume sem número em alguma série vira subtotal (nunca inventa)', () => {
    expect(volumeDaSessao(sessao, (uid) => (uid === 'a1' ? r(60, 10) : uid === 'a3' ? r(null, 8) : undefined))).toEqual({ valor: 600, completo: false });
  });

  it('duração: relógio, falada e "—"', () => {
    expect(textoDaDuracaoAoVivo(45)).toBe('0:45');
    expect(textoDaDuracaoAoVivo(725)).toBe('12:05');
    expect(textoDaDuracaoAoVivo(3730)).toBe('1:02:10');
    expect(textoDaDuracaoAoVivo(null)).toBe('—');
    expect(duracaoFalada(30)).toBe('menos de 1 minuto');
    expect(duracaoFalada(60)).toBe('1 minuto');
    expect(duracaoFalada(3730)).toBe('1 hora e 2 minutos');
    expect(duracaoFalada(null)).toBe('sem duração');
  });

  it('qual duração: a da conclusão, a contada só hoje, ou nenhuma', () => {
    expect(duracaoDaFaixa({ concluida: { duracaoSegundos: 3000 }, data: '2026-10-28', hoje: '2026-10-28', contada: 4000 })).toEqual({ segundos: 3000, aoVivo: false });
    expect(duracaoDaFaixa({ concluida: { duracaoSegundos: null }, data: '2026-10-28', hoje: '2026-10-28', contada: 4000 })).toEqual({ segundos: null, aoVivo: false });
    expect(duracaoDaFaixa({ concluida: null, data: '2026-10-28', hoje: '2026-10-28', contada: 600 })).toEqual({ segundos: 600, aoVivo: true });
    expect(duracaoDaFaixa({ concluida: null, data: '2026-10-28', hoje: '2026-10-28', contada: null })).toEqual({ segundos: null, aoVivo: false });
    expect(duracaoDaFaixa({ concluida: null, data: '2026-10-27', hoje: '2026-10-28', contada: 600 })).toEqual({ segundos: null, aoVivo: false });
  });
});
