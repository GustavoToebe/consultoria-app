import {
  chaveDoPlanoVisto, destinoDoPlanoNovo, lerVersoesVistas, planosNovos, precisaDaBase, textoDoPlanoNovo, versoesParaGravar,
} from './avisoDePlanoNovo';

describe('avisoDePlanoNovo', () => {
  it('chave por usuário, no padrão das preferências', () => {
    expect(chaveDoPlanoVisto('u1')).toBe('treinos:u1:planoVisto');
  });

  it('lê o gravado; nada gravado ou formato estranho é null', () => {
    expect(lerVersoesVistas(JSON.stringify({ treino: 't1', dieta: null }))).toEqual({ treino: 't1', dieta: null });
    expect(lerVersoesVistas(null)).toBeNull();
    expect(lerVersoesVistas('não é json')).toBeNull();
    expect(lerVersoesVistas('"texto"')).toBeNull();
    expect(lerVersoesVistas(JSON.stringify({ treino: 3 }))).toEqual({ treino: null, dieta: null });
  });

  it('versão em uso diferente da vista é plano novo; desconhecida (undefined) não conta; sem plano (null) também não', () => {
    const vistas = { treino: 't1', dieta: 'd1' };
    expect(planosNovos({ treino: 't1', dieta: 'd1' }, vistas)).toEqual([]);
    expect(planosNovos({ treino: 't2', dieta: 'd1' }, vistas)).toEqual(['treino']);
    expect(planosNovos({ treino: 't2', dieta: 'd2' }, vistas)).toEqual(['treino', 'dieta']);
    expect(planosNovos({ treino: undefined, dieta: 'd2' }, vistas)).toEqual(['dieta']);
    expect(planosNovos({ treino: null, dieta: null }, vistas)).toEqual([]);
    // A primeira dieta publicada depois da base (gravada sem dieta) é plano novo.
    expect(planosNovos({ treino: 't1', dieta: 'd1' }, { treino: 't1', dieta: null })).toEqual(['dieta']);
  });

  it('sem nada gravado não avisa e grava a base só com as duas versões conhecidas', () => {
    expect(planosNovos({ treino: 't1', dieta: 'd1' }, null)).toEqual([]);
    expect(precisaDaBase({ treino: 't1', dieta: null }, null)).toBe(true);
    expect(precisaDaBase({ treino: 't1', dieta: undefined }, null)).toBe(false);
    expect(precisaDaBase({ treino: 't1', dieta: 'd1' }, { treino: 't1', dieta: 'd1' })).toBe(false);
  });

  it('ao ver, grava as atuais e mantém o gravado do tipo desconhecido', () => {
    expect(versoesParaGravar({ treino: 't2', dieta: undefined }, { treino: 't1', dieta: 'd1' })).toEqual({ treino: 't2', dieta: 'd1' });
    expect(versoesParaGravar({ treino: null, dieta: 'd2' }, null)).toEqual({ treino: null, dieta: 'd2' });
  });

  it('texto e destino do "Ver o plano"', () => {
    expect(textoDoPlanoNovo(['treino'])).toBe('Seu treinador publicou um treino novo.');
    expect(textoDoPlanoNovo(['dieta'])).toBe('Seu treinador publicou uma dieta nova.');
    expect(textoDoPlanoNovo(['treino', 'dieta'])).toBe('Seu treinador publicou um treino e uma dieta novos.');
    expect(destinoDoPlanoNovo(['dieta'])).toBe('/aluno/dieta');
    expect(destinoDoPlanoNovo(['treino', 'dieta'])).toBe('/aluno/treino');
  });
});
