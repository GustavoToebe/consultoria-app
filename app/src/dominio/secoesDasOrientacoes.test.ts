import { secoesDasOrientacoes } from './secoesDasOrientacoes';

describe('secoesDasOrientacoes', () => {
  it('vazio ou nulo: nada', () => {
    expect(secoesDasOrientacoes(null)).toEqual({ introducao: null, secoes: [] });
    expect(secoesDasOrientacoes('  \n ')).toEqual({ introducao: null, secoes: [] });
  });

  it('o formato da importação da planilha: "Coluna: texto" separados por linha em branco', () => {
    const texto = 'FS: Série de força, pesada.\n\nWS: Série de trabalho\naté a falha.\n\nCardio: 20 min depois do treino.';
    expect(secoesDasOrientacoes(texto)).toEqual({
      introducao: null,
      secoes: [
        { titulo: 'FS', texto: 'Série de força, pesada.' },
        { titulo: 'WS', texto: 'Série de trabalho\naté a falha.' },
        { titulo: 'Cardio', texto: '20 min depois do treino.' },
      ],
    });
  });

  it('título sozinho na linha, com o texto embaixo, e introdução antes do primeiro título (CRLF e linhas em branco a mais)', () => {
    const texto = 'Leia antes de começar.\r\n\r\n\r\n\r\nBack off:\r\nFaça com 80% da carga.\r\nRest pause:\r\n\r\n\r\n\r\nPausa de 15 s.';
    expect(secoesDasOrientacoes(texto)).toEqual({
      introducao: 'Leia antes de começar.',
      secoes: [
        { titulo: 'Back off', texto: 'Faça com 80% da carga.' },
        { titulo: 'Rest pause', texto: 'Pausa de 15 s.' },
      ],
    });
  });

  it('não confunde horário, link nem frase longa com título', () => {
    const texto = 'Treine às 10:30 quando puder.\nVídeo: https://exemplo.invalid/x\nLembre-se de que o mais importante de tudo é: dormir bem.\nCarga: aumente aos poucos.';
    expect(secoesDasOrientacoes(texto)).toEqual({
      introducao: 'Treine às 10:30 quando puder.',
      secoes: [
        { titulo: 'Vídeo', texto: 'https://exemplo.invalid/x\nLembre-se de que o mais importante de tudo é: dormir bem.' },
        { titulo: 'Carga', texto: 'aumente aos poucos.' },
      ],
    });
  });

  it('título que não começa com letra ou passa de 40 caracteres não conta', () => {
    const r = secoesDasOrientacoes('1ª semana: leve.\nUm título comprido demais para ser um título: x\nFS: pesada.');
    expect(r.secoes).toEqual([]);
    expect(r.introducao).toBe('1ª semana: leve.\nUm título comprido demais para ser um título: x\nFS: pesada.');
  });

  it('com menos de dois títulos o texto fica inteiro, sem seção', () => {
    expect(secoesDasOrientacoes('Obs: beba água durante o treino.\nDurma bem.')).toEqual({
      introducao: 'Obs: beba água durante o treino.\nDurma bem.',
      secoes: [],
    });
  });
});
