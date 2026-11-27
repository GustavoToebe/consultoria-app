import {
  linhasDoModoDePreparo,
  OBSERVACAO_DA_REFEICAO_MAXIMO,
  observacaoDaRefeicaoValida,
  resumoDaObservacaoEPreparo,
  temObservacaoOuPreparo,
  textoDoResumo,
} from './observacaoEPreparo';

describe('observacaoEPreparo', () => {
  it('conta só as linhas não vazias do modo de preparo', () => {
    expect(linhasDoModoDePreparo(null)).toBe(0);
    expect(linhasDoModoDePreparo('')).toBe(0);
    expect(linhasDoModoDePreparo('   \n\n  ')).toBe(0);
    expect(linhasDoModoDePreparo('Bata tudo.')).toBe(1);
    expect(linhasDoModoDePreparo('1. Lave.\n\n2. Corte.\r\n   \n3. Asse.')).toBe(3);
  });

  it('vazio (ou só espaços) não tem conteúdo e o resumo diz "Nenhuma"', () => {
    expect(temObservacaoOuPreparo(null, undefined)).toBe(false);
    expect(temObservacaoOuPreparo('  ', '\n')).toBe(false);
    const r = resumoDaObservacaoEPreparo('  ', null);
    expect(r).toEqual({ observacao: null, preparo: null, vazio: true });
    expect(textoDoResumo(r)).toBe('Nenhuma');
  });

  it('só observação: o começo dela numa linha, sem as quebras', () => {
    expect(temObservacaoOuPreparo('Pode trocar a fruta.', null)).toBe(true);
    const r = resumoDaObservacaoEPreparo('  Pode trocar\na fruta.  ', null);
    expect(r).toEqual({ observacao: 'Pode trocar a fruta.', preparo: null, vazio: false });
    expect(textoDoResumo(r)).toBe('Pode trocar a fruta.');
  });

  it('só preparo: "Modo de preparo: N linhas", no singular com uma', () => {
    expect(temObservacaoOuPreparo(null, 'Grelhe.')).toBe(true);
    expect(textoDoResumo(resumoDaObservacaoEPreparo(null, 'Grelhe.'))).toBe('Modo de preparo: 1 linha');
    expect(textoDoResumo(resumoDaObservacaoEPreparo(null, 'Lave.\nAsse.'))).toBe('Modo de preparo: 2 linhas');
  });

  it('os dois: a observação e as linhas do preparo', () => {
    expect(textoDoResumo(resumoDaObservacaoEPreparo('Sem sal.', 'Lave.\n\nAsse.'))).toBe('Sem sal. · Modo de preparo: 2 linhas');
  });

  it('observação até o limite da API', () => {
    expect(observacaoDaRefeicaoValida(null)).toBe(true);
    expect(observacaoDaRefeicaoValida('x'.repeat(OBSERVACAO_DA_REFEICAO_MAXIMO))).toBe(true);
    expect(observacaoDaRefeicaoValida('x'.repeat(OBSERVACAO_DA_REFEICAO_MAXIMO + 1))).toBe(false);
  });
});
