import { secaoEmEdicao } from './colunasDaMobilidade';

describe('secaoEmEdicao', () => {
  const secoes = [{ uid: 'a' }, { uid: 'b' }];
  test('a escolhida, se existe; senão a primeira; sem seções, nenhuma', () => {
    expect(secaoEmEdicao(secoes, 'b')?.uid).toBe('b');
    expect(secaoEmEdicao(secoes, 'sumiu')?.uid).toBe('a');
    expect(secaoEmEdicao(secoes, null)?.uid).toBe('a');
    expect(secaoEmEdicao([], 'a')).toBeNull();
  });
});
