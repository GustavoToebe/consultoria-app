import { avisoDoEditor, erroDoQueInclui, ERRO_DO_QUE_INCLUI, linhaDosPlanosAtivos, textoDoQueInclui } from './planosAtivos';

const TUDO = { incluiTreino: true, incluiDieta: true };
const SO_TREINO = { incluiTreino: true, incluiDieta: false };
const SO_DIETA = { incluiTreino: false, incluiDieta: true };
const NENHUM = { incluiTreino: false, incluiDieta: false };

describe('textoDoQueInclui', () => {
  it('diz o que o plano inclui, em texto neutro', () => {
    expect(textoDoQueInclui(TUDO)).toBe('Treino e dieta');
    expect(textoDoQueInclui(SO_TREINO)).toBe('Só treino');
    expect(textoDoQueInclui(SO_DIETA)).toBe('Só dieta');
  });
  it('sem o dado ou com os dois desligados, não diz nada (nunca "Só dieta" por engano)', () => {
    expect(textoDoQueInclui(NENHUM)).toBeNull();
    expect(textoDoQueInclui({})).toBeNull();
    expect(textoDoQueInclui({ incluiDieta: null, incluiTreino: null })).toBeNull();
    expect(textoDoQueInclui(null)).toBeNull();
  });
});

describe('linhaDosPlanosAtivos', () => {
  it('só o que está incluído', () => {
    expect(linhaDosPlanosAtivos(TUDO)).toBe('Treino · Dieta');
    expect(linhaDosPlanosAtivos(SO_TREINO)).toBe('Treino');
    expect(linhaDosPlanosAtivos(SO_DIETA)).toBe('Dieta');
  });
  it('nulo, ausente ou os dois desligados: a linha some', () => {
    expect(linhaDosPlanosAtivos(null)).toBeNull();
    expect(linhaDosPlanosAtivos(undefined)).toBeNull();
    expect(linhaDosPlanosAtivos(NENHUM)).toBeNull();
  });
});

describe('avisoDoEditor', () => {
  it('avisa no editor do item que o plano atual não inclui', () => {
    expect(avisoDoEditor('dieta', SO_TREINO)).toBe('Este aluno não contratou dieta no plano atual.');
    expect(avisoDoEditor('treino', SO_DIETA)).toBe('Este aluno não contratou treino no plano atual.');
  });
  it('não avisa quando o item está incluído', () => {
    expect(avisoDoEditor('treino', TUDO)).toBeNull();
    expect(avisoDoEditor('dieta', TUDO)).toBeNull();
    expect(avisoDoEditor('treino', SO_TREINO)).toBeNull();
    expect(avisoDoEditor('dieta', SO_DIETA)).toBeNull();
  });
  it('sem planosAtivos (sem contratação ativa, pausada ou Financeiro desligado) nunca diz "não contratou"', () => {
    expect(avisoDoEditor('treino', null)).toBeNull();
    expect(avisoDoEditor('dieta', undefined)).toBeNull();
    expect(avisoDoEditor('dieta', NENHUM)).toBeNull();
    expect(avisoDoEditor('treino', NENHUM)).toBeNull();
  });
  it('a mobilidade segue com o treino e não tem aviso próprio', () => {
    expect(avisoDoEditor('mobilidade', SO_DIETA)).toBeNull();
    expect(avisoDoEditor('mobilidade', SO_TREINO)).toBeNull();
  });
});

describe('erroDoQueInclui', () => {
  it('pelo menos um ligado', () => {
    expect(erroDoQueInclui(true, true)).toBeNull();
    expect(erroDoQueInclui(true, false)).toBeNull();
    expect(erroDoQueInclui(false, true)).toBeNull();
    expect(erroDoQueInclui(false, false)).toBe(ERRO_DO_QUE_INCLUI);
  });
});
