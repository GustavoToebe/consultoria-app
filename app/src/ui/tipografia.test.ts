import { ESTILOS_TEXTO, NUMERICO } from './tipografia';

it('mantém cinco tamanhos e alturas legíveis, com números tabulares', () => {
  expect([...new Set(Object.values(ESTILOS_TEXTO).map((e) => e.fontSize))].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([12, 15, 17, 22, 28]);
  expect(ESTILOS_TEXTO.destaque.lineHeight).toBe(34);
  expect(ESTILOS_TEXTO.numero.fontVariant).toEqual(['tabular-nums']);
  expect(NUMERICO.fontVariant).toEqual(['tabular-nums']);
  expect(ESTILOS_TEXTO.secao.textTransform).toBe('uppercase');
});
