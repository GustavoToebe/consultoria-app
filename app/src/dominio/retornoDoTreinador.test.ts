import { metadadosDoTreino, textoDaSerieComRecorde, textoDoTotalDeRecordes, textoDoTotalDeTreinos, treinosConcluidos } from './retornoDoTreinador';

describe('retorno do treinador (Engajamento 0.5)', () => {
  it('textos dos recordes', () => {
    expect(textoDaSerieComRecorde({ exercicioNome: 'Supino', recordes: [
      { tipo: 'MAIOR_CARGA', carga: 70, repeticoes: 10, valor: 70 },
      { tipo: 'MAIOR_VOLUME', carga: 70, repeticoes: 10, valor: 700 },
    ] })).toBe('Supino: Maior carga · 70 kg · Maior volume · 700 kg');
    expect(textoDoTotalDeRecordes(1)).toBe('1 série com recorde nos últimos 7 dias');
    expect(textoDoTotalDeRecordes(3)).toBe('3 séries com recorde nos últimos 7 dias');
  });

  it('lista de treinos: só os concluídos (com id), e os textos', () => {
    const base = { planoVersaoId: 'v', sessaoUid: 's', data: '2026-10-28', resultado: 'COMPLETA' as const, duracaoSegundos: 3120, comentario: null };
    const lista = treinosConcluidos([
      { ...base, id: 'a', concluida: true },
      { ...base, id: 'b', concluida: false, resultado: null, duracaoSegundos: null },
      { ...base, concluida: true },
    ]);
    expect(lista.map((s) => s.id)).toEqual(['a']);
    expect(metadadosDoTreino(base)).toBe('Fiz tudo · 52 min');
    expect(textoDoTotalDeTreinos(1)).toBe('1 treino concluído no total');
    expect(textoDoTotalDeTreinos(12)).toBe('12 treinos concluídos no total');
  });
});
