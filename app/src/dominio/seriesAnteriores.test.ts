import type { AnterioresDoPacote } from '../api/tipos';
import { exercicio, serie } from './exemplosDeTreino.apoioTeste';
import {
  anteriorDaSerie,
  posicoesNoTipo,
  textoDaUltimaVez,
  textoDoAnterior,
  ultimaVez,
  type EntradaDaUltimaVez,
  type RegistroParaAnterior,
} from './seriesAnteriores';

const supino = exercicio('e1', {
  exercicioId: 'sup',
  series: [serie('fs', { tipo: 'FEEDER' }), serie('w1'), serie('w2'), serie('bo', { tipo: 'BACK_OFF' })],
});
const pacote: AnterioresDoPacote = {
  ate: '2026-10-28',
  exercicios: {
    sup: {
      data: '2026-10-24',
      series: [
        { tipo: 'FEEDER', ordem: 1, carga: 30, repeticoes: 3, etapas: null },
        { tipo: 'WORKING', ordem: 1, carga: 60, repeticoes: 8, etapas: null },
        { tipo: 'WORKING', ordem: 2, carga: 62.5, repeticoes: 6, etapas: null },
      ],
    },
  },
};
const reg = (serieUid: string, data: string, carga: number | null, repeticoes: number | null, extra: Partial<RegistroParaAnterior> = {}): RegistroParaAnterior => ({
  planoVersaoId: 'v2',
  exercicioUid: 'e1',
  serieUid,
  exercicioId: 'sup',
  data,
  carga,
  repeticoes,
  concluida: true,
  etapas: null,
  ...extra,
});
const entrada = (extra: Partial<EntradaDaUltimaVez> = {}): EntradaDaUltimaVez => ({
  anteriores: pacote,
  exercicio: supino,
  versaoId: 'v2',
  data: '2026-10-28',
  registros: [],
  exerciciosDaVersao: [supino],
  ...extra,
});

describe('coluna "Anterior" (Engajamento 0.3, espelho de SeriesAnterioresTest)', () => {
  it('posição no tipo: a ordem conta dentro de cada código; cardio fica sem', () => {
    expect(posicoesNoTipo(supino)).toEqual([
      { tipo: 'FEEDER', ordem: 1 },
      { tipo: 'WORKING', ordem: 1 },
      { tipo: 'WORKING', ordem: 2 },
      { tipo: 'BACK_OFF', ordem: 1 },
    ]);
    expect(posicoesNoTipo(exercicio('c', { modalidade: 'CARDIO', series: [serie('x', { tipo: null as never })] }))).toEqual([null]);
  });

  it('do pacote, a mesma série pelo tipo e a ordem; a que não casa fica sem', () => {
    const u = ultimaVez(entrada());
    expect(u?.data).toBe('2026-10-24');
    expect(textoDoAnterior(anteriorDaSerie(u, supino, 2), false)).toBe('62,5 kg × 6');
    expect(anteriorDaSerie(u, supino, 3)).toBeNull();
    expect(textoDoAnterior(null, false)).toBe('—');
    expect(textoDaUltimaVez(u)).toBe('Anterior: o que você fez em 24/10.');
  });

  it('o plano mudou: a 2ª WS continua casando com a 2ª WS, mesmo com outra série na frente', () => {
    const mudado = exercicio('e9', { exercicioId: 'sup', series: [serie('a1', { tipo: 'WARM_UP' }), serie('b1'), serie('b2')] });
    const u = ultimaVez(entrada({ exercicio: mudado, exerciciosDaVersao: [mudado] }));
    expect(textoDoAnterior(anteriorDaSerie(u, mudado, 2), false)).toBe('62,5 kg × 6');
    expect(anteriorDaSerie(u, mudado, 0)).toBeNull();
  });

  it('o que o app conhece da versão em uso ganha quando é mais recente (ou do mesmo dia)', () => {
    const registros = [reg('w1', '2026-10-27', 65, 7), reg('w2', '2026-10-27', 65, 5, { concluida: false }), reg('w1', '2026-10-28', 70, 5)];
    const u = ultimaVez(entrada({ registros }));
    expect(u?.data).toBe('2026-10-27');
    expect(textoDoAnterior(anteriorDaSerie(u, supino, 1), false)).toBe('65 kg × 7');
    // A não feita não entra; o de hoje (a data na tela) também não.
    expect(anteriorDaSerie(u, supino, 2)).toBeNull();
    const antigo = ultimaVez(entrada({ registros: [reg('w1', '2026-10-20', 50, 10)] }));
    expect(antigo?.data).toBe('2026-10-24');
  });

  it('registro de outra versão não entra (sem o conteúdo dela não se sabe qual série era)', () => {
    expect(ultimaVez(entrada({ registros: [reg('w1', '2026-10-27', 99, 1, { planoVersaoId: 'v1' })] }))?.data).toBe('2026-10-24');
  });

  it('data anterior ao pacote na tela: o pacote só vale se for antes dela', () => {
    expect(ultimaVez(entrada({ data: '2026-10-24' }))).toBeNull();
    expect(ultimaVez(entrada({ data: '2026-10-24', registros: [reg('w1', '2026-10-22', 55, 9)] }))?.series).toHaveLength(1);
  });

  it('exercício em duas linhas no mesmo dia: vale a primeira do plano', () => {
    const outra = exercicio('e2', { exercicioId: 'sup', series: [serie('z1')] });
    const registros = [reg('z1', '2026-10-27', 40, 12, { exercicioUid: 'e2' }), reg('w1', '2026-10-27', 60, 9)];
    const u = ultimaVez(entrada({ registros, exerciciosDaVersao: [supino, outra] }));
    expect(textoDoAnterior(anteriorDaSerie(u, supino, 1), false)).toBe('60 kg × 9');
  });

  it('sem chave (pacote sem o campo) ou cardio, não há coluna', () => {
    expect(ultimaVez(entrada({ anteriores: undefined }))).toBeNull();
    expect(ultimaVez(entrada({ exercicio: { ...supino, modalidade: 'CARDIO' } }))).toBeNull();
  });

  it('textos: sem carga, faltando número e etapas', () => {
    const base = { tipo: 'WORKING', ordem: 1, etapas: null };
    expect(textoDoAnterior({ ...base, carga: null, repeticoes: 15 }, true)).toBe('15 reps');
    expect(textoDoAnterior({ ...base, carga: 40, repeticoes: 15 }, true)).toBe('15 reps');
    expect(textoDoAnterior({ ...base, carga: 40, repeticoes: null }, false)).toBe('40 kg × —');
    expect(textoDoAnterior({ ...base, carga: null, repeticoes: null }, false)).toBe('—');
    const etapa = (posicao: number, repeticoes: number | null, carga: number | null, situacao: 'FEITA' | 'NAO_REALIZADA' = 'FEITA') => ({ posicao, repeticoes, carga, situacao });
    expect(textoDoAnterior({ ...base, carga: 40, repeticoes: 10, etapas: [etapa(2, 4, 40), etapa(1, 4, 40), etapa(3, 2, 40)] }, false)).toBe('40 kg × 4+4+2');
    expect(textoDoAnterior({ ...base, carga: null, repeticoes: 8, etapas: [etapa(1, 4, 40), etapa(2, 4, 35)] }, false)).toBe('4+4 (carga variável)');
    expect(textoDoAnterior({ ...base, carga: null, repeticoes: null, etapas: [etapa(1, 4, 40), etapa(2, null, null, 'NAO_REALIZADA')] }, false)).toBe('40 kg × 4');
    expect(textoDoAnterior({ ...base, carga: null, repeticoes: null, etapas: [etapa(1, null, null, 'NAO_REALIZADA')] }, false)).toBe('—');
  });
});
