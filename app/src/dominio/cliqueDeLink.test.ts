import { deixarParaONavegador } from './cliqueDeLink';

it('o clique simples com o botão esquerdo navega dentro do app', () => {
  expect(deixarParaONavegador({ button: 0 })).toBe(false);
  expect(deixarParaONavegador({})).toBe(false);
  expect(deixarParaONavegador({ button: null, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })).toBe(false);
});
it('Ctrl, Cmd, Shift e Alt deixam o navegador abrir nova guia ou janela', () => {
  expect(deixarParaONavegador({ button: 0, ctrlKey: true })).toBe(true);
  expect(deixarParaONavegador({ button: 0, metaKey: true })).toBe(true);
  expect(deixarParaONavegador({ button: 0, shiftKey: true })).toBe(true);
  expect(deixarParaONavegador({ button: 0, altKey: true })).toBe(true);
});
it('botão do meio ou direito fica com o navegador', () => {
  expect(deixarParaONavegador({ button: 1 })).toBe(true);
  expect(deixarParaONavegador({ button: 2 })).toBe(true);
});
