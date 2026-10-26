import { blocosGravados, blocosIguais, blocosSeValidos, blocosValidos, lerBlocos, listaDeBlocosIguais, listaDeBlocosIguaisSeValidos, rascunhoDoModoDiferente, resumoDosBlocos, somaDosBlocos, textoDeBlocos } from './blocos';

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

test('número inválido não reaproveita os blocos anteriores', () => {
  expect(listaDeBlocosIguais(4, 4)).toEqual([4, 4, 4, 4]);
  expect(listaDeBlocosIguais(null, 4)).toBeNull();
  expect(listaDeBlocosIguais(4, null)).toBeNull();
  expect(listaDeBlocosIguais(0, 4)).toBeNull();
  expect(listaDeBlocosIguais(11, 4)).toBeNull();
  expect(listaDeBlocosIguais(1.5, 4)).toBeNull();
  expect(listaDeBlocosIguais(4, 0)).toBeNull();
  expect(listaDeBlocosIguais(4, 51)).toBeNull();
  expect(blocosGravados([4, null, 4])).toBeNull();
  expect(blocosGravados([4, 0, 4])).toBeNull();
  expect(blocosGravados([4, 2])).toEqual([4, 2]);
});

test('texto inválido num campo não reaproveita o número que ficou por baixo', () => {
  expect(listaDeBlocosIguaisSeValidos(4, 5, true, false)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(3, 4, false, true)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(null, 4, false, false)).toBeNull();
  expect(listaDeBlocosIguaisSeValidos(3, 5, false, false)).toEqual([5, 5, 5]);
  expect(blocosSeValidos([4, 2], true)).toBeNull();
  expect(blocosSeValidos([6, 2], false)).toEqual([6, 2]);
});

test('voltar para blocos diferentes mostra a lista gravada, não a distribuição anterior', () => {
  expect(rascunhoDoModoDiferente([4, 4], [4, 2])).toEqual([4, 4]);
  expect(rascunhoDoModoDiferente(null, [4, 2])).toEqual([4, 2]);
});
