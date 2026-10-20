import { contagem } from './contagens';

it('concorda o número com a palavra', () => {
  expect(contagem(1, 'exercício', 'exercícios')).toBe('1 exercício');
  expect(contagem(4, 'exercício', 'exercícios')).toBe('4 exercícios');
  expect(contagem(0, 'série', 'séries')).toBe('0 séries');
});
