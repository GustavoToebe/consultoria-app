import { ESTILOS_TEXTO, NUMERICO } from './tipografia';

// Visual-ponytail (17/11): título de cartão 16, de página 26 e número de indicador 30.
it('escala 12, 13, 14, 15, 16, 26 e 30, com números tabulares', () => {
  expect([...new Set(Object.values(ESTILOS_TEXTO).map((e) => e.fontSize))].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([12, 13, 14, 15, 16, 26, 30]);
  expect(ESTILOS_TEXTO.destaque.lineHeight).toBe(36);
  expect(ESTILOS_TEXTO.numero.fontVariant).toEqual(['tabular-nums']);
  expect(NUMERICO.fontVariant).toEqual(['tabular-nums']);
  expect(ESTILOS_TEXTO.titulo).toMatchObject({ fontSize: 26, lineHeight: 32 });
  expect(ESTILOS_TEXTO.bloco).toMatchObject({ fontSize: 16, lineHeight: 22 });
  expect(ESTILOS_TEXTO.pequeno).toMatchObject({ fontSize: 13, lineHeight: 18 });
  expect(ESTILOS_TEXTO.rotulo).toMatchObject({ fontSize: 13, lineHeight: 18 });
  expect(ESTILOS_TEXTO.secao.textTransform).toBe('uppercase');
});
