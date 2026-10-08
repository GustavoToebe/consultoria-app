import { ESTILOS_TEXTO, NUMERICO } from './tipografia';

it('preserva a escala anterior e acrescenta destaque, com números tabulares', () => {
  expect([...new Set(Object.values(ESTILOS_TEXTO).map((e) => e.fontSize))].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([12, 14, 15, 16, 22, 28]);
  expect(ESTILOS_TEXTO.destaque.lineHeight).toBe(34);
  expect(ESTILOS_TEXTO.numero.fontVariant).toEqual(['tabular-nums']);
  expect(NUMERICO.fontVariant).toEqual(['tabular-nums']);
  expect(ESTILOS_TEXTO.secao.textTransform).toBe('uppercase');
});
