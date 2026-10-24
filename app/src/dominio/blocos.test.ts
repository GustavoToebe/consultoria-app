import { blocosIguais, blocosValidos, lerBlocos, resumoDosBlocos, somaDosBlocos, textoDeBlocos } from './blocos';

test.each([['4+2', [4, 2]], ['3×4', [4, 4, 4]], ['3 x 4', [4, 4, 4]], [' 4 + 2 ', [4, 2]]])('lê blocos %s', (texto, esperado) => {
  expect(lerBlocos(texto as string)).toEqual(esperado);
});
test.each(['', '4+', '4-2', '2.5+2', '0x4'])('não aceita texto incompleto ou desconhecido: %s', (texto) => expect(lerBlocos(texto)).toBeNull());
test.each([[0, 2], [1], [51, 2], [1.5, 2], Array(11).fill(2)])('recusa blocos fora dos limites: %j', (...blocos) => expect(blocosValidos(blocos)).toBe(false));
test('formata blocos iguais e desiguais e soma as repetições sem alterar a entrada', () => {
  expect(textoDeBlocos([4, 2])).toBe('4+2');
  expect(textoDeBlocos([4, 4, 4])).toBe('3×4');
  expect(textoDeBlocos(null)).toBe('');
  expect(blocosValidos([4, 2])).toBe(true);
  expect(somaDosBlocos([4, 2])).toBe(6);
  expect(somaDosBlocos(null)).toBeNull();
  expect(blocosIguais([4, 4, 4])).toBe(true);
  expect(blocosIguais([4, 2])).toBe(false);
  expect(resumoDosBlocos([4, 4, 4, 4])).toEqual({ repeticoes: 16, blocos: 4, pausas: 3 });
  expect(resumoDosBlocos([4])).toBeNull();
  expect(resumoDosBlocos(null)).toBeNull();
});
