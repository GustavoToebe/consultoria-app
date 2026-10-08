import { ESTILOS_TEXTO, NUMERICO } from './tipografia';

it('escala 12, 13, 14, 15, 16, 24 e 28, com números tabulares', () => {
  expect([...new Set(Object.values(ESTILOS_TEXTO).map((e) => e.fontSize))].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([12, 13, 14, 15, 16, 24, 28]);
  expect(ESTILOS_TEXTO.destaque.lineHeight).toBe(34);
  expect(ESTILOS_TEXTO.numero.fontVariant).toEqual(['tabular-nums']);
  expect(NUMERICO.fontVariant).toEqual(['tabular-nums']);
  expect(ESTILOS_TEXTO.titulo).toMatchObject({ fontSize: 24, lineHeight: 30 });
  expect(ESTILOS_TEXTO.bloco).toMatchObject({ fontSize: 16, lineHeight: 22 });
  expect(ESTILOS_TEXTO.rotulo).toMatchObject({ fontSize: 13, lineHeight: 18 });
  expect(ESTILOS_TEXTO.secao.textTransform).toBe('uppercase');
});
