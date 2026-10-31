import { caminhoDaPasta, idSeguro } from './caminhoDaPasta';

const ALUNO = 'a0000000-0000-4000-8000-000000000002';
const PASTA = 'f0000000-0000-4000-8000-000000000003';

describe('caminhoDaPasta', () => {
  it('leva à ficha do aluno com a Folha da pasta aberta', () => {
    expect(caminhoDaPasta(ALUNO, PASTA)).toBe(`/treinador/alunos/${ALUNO}?pastaId=${PASTA}`);
    expect(caminhoDaPasta('a1', 'p2')).toBe('/treinador/alunos/a1?pastaId=p2');
  });

  it('sem aluno ou sem pasta não há caminho (o botão não aparece)', () => {
    expect(caminhoDaPasta(ALUNO, null)).toBeNull();
    expect(caminhoDaPasta(ALUNO, undefined)).toBeNull();
    expect(caminhoDaPasta(ALUNO, '')).toBeNull();
    expect(caminhoDaPasta(null, PASTA)).toBeNull();
    expect(caminhoDaPasta(undefined, PASTA)).toBeNull();
  });

  it('recusa id que mudaria o caminho ou o parâmetro', () => {
    for (const ruim of ['..', '.', '../x', 'a/b', 'a?b=1', 'a&pastaId=x', 'a b', '%2e%2e', 'a#b']) {
      expect(caminhoDaPasta(ruim, PASTA)).toBeNull();
      expect(caminhoDaPasta(ALUNO, ruim)).toBeNull();
    }
  });

  it('idSeguro aceita só letras, números, hífen e sublinhado', () => {
    expect(idSeguro(PASTA)).toBe(true);
    expect(idSeguro('p_1')).toBe(true);
    expect(idSeguro('p.1')).toBe(false);
    expect(idSeguro(null)).toBe(false);
  });
});
