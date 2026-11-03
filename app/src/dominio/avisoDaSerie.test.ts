import { AVISO_SEM_CARGA, avisoDeSerieSemCarga, textoDoNumeroInvalido } from './avisoDaSerie';

const base = { feita: true, carga: null, semCampoDePeso: false, ehTrabalho: true };

describe('aviso da série sem carga (N6)', () => {
  it('avisa quando a série de trabalho de um exercício com carga é marcada com o kg vazio', () => {
    expect(avisoDeSerieSemCarga(base)).toBe(AVISO_SEM_CARGA);
  });
  it('não avisa com kg preenchido (mesmo sem repetições) nem enquanto a série não foi marcada', () => {
    expect(avisoDeSerieSemCarga({ ...base, carga: 40 })).toBeNull();
    expect(avisoDeSerieSemCarga({ ...base, carga: 0 })).toBeNull();
    expect(avisoDeSerieSemCarga({ ...base, feita: false })).toBeNull();
  });
  it('não avisa em exercício sem carga, de carga desconhecida ou em série que o progresso nem conta', () => {
    expect(avisoDeSerieSemCarga({ ...base, semCampoDePeso: true })).toBeNull();
    expect(avisoDeSerieSemCarga({ ...base, ehTrabalho: false })).toBeNull();
  });
});

describe('texto do número inválido (N7)', () => {
  it('diz qual campo precisa de número, ou nada quando está tudo certo', () => {
    expect(textoDoNumeroInvalido(true, false)).toBe('Peso: use só números.');
    expect(textoDoNumeroInvalido(false, true)).toBe('Repetições: use só números.');
    expect(textoDoNumeroInvalido(true, true)).toBe('Use só números no peso e nas repetições.');
    expect(textoDoNumeroInvalido(false, false)).toBeNull();
  });
});
