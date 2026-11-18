import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useSecoesAbertas } from './useSecoesAbertas';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Secoes = ReturnType<typeof useSecoesAbertas>;

/** Monta o gancho com uma lista que a tela pode trocar e devolve o último valor. */
function montar(ids: readonly string[], partida: readonly string[] = []) {
  const saida = { atual: undefined as unknown as Secoes };
  function Tela({ lista, abrirDe }: { lista: readonly string[]; abrirDe: readonly string[] }) {
    saida.atual = useSecoesAbertas(lista, abrirDe);
    return null;
  }
  let r!: ReactTestRenderer;
  act(() => { r = create(<Tela lista={ids} abrirDe={partida} />); });
  return { saida, trocar: (lista: readonly string[]) => act(() => r.update(<Tela lista={lista} abrirDe={partida} />)) };
}
const abertas = (s: Secoes, ids: readonly string[]) => ids.filter((id) => s.estaAberta(id));

it('nasce tudo fechado, a seção única nasce aberta e o destino do link abre', () => {
  expect(abertas(montar(['a', 'b']).saida.atual, ['a', 'b'])).toEqual([]);
  expect(abertas(montar(['a']).saida.atual, ['a'])).toEqual(['a']);
  expect(abertas(montar(['a', 'b'], ['b']).saida.atual, ['a', 'b'])).toEqual(['b']);
});

it('alterna, abre e abre/fecha todas', () => {
  const { saida } = montar(['a', 'b', 'c']);
  act(() => saida.atual.alternar('a'));
  expect(abertas(saida.atual, ['a', 'b', 'c'])).toEqual(['a']);
  act(() => saida.atual.abrir(['b', 'c']));
  expect(saida.atual.todasAbertas).toBe(true);
  act(() => saida.atual.fecharTodas());
  expect(abertas(saida.atual, ['a', 'b', 'c'])).toEqual([]);
  act(() => saida.atual.abrirTodas());
  expect(saida.atual.todasAbertas).toBe(true);
});

it('busca abre o que casou, muda com o termo e limpar restaura', () => {
  const { saida } = montar(['a', 'b', 'c']);
  act(() => saida.atual.alternar('a'));
  act(() => saida.atual.aoBuscar('x', ['b']));
  expect(abertas(saida.atual, ['a', 'b', 'c'])).toEqual(['b']);
  act(() => saida.atual.aoBuscar('xy', ['c']));
  expect(abertas(saida.atual, ['a', 'b', 'c'])).toEqual(['c']);
  act(() => saida.atual.aoBuscar('', []));
  expect(abertas(saida.atual, ['a', 'b', 'c'])).toEqual(['a']);
});

it('seção que chega depois entra fechada e a que some sai do estado', () => {
  const { saida, trocar } = montar(['a']);
  expect(saida.atual.estaAberta('a')).toBe(true);
  trocar(['a', 'b']);
  expect(abertas(saida.atual, ['a', 'b'])).toEqual(['a']);
  trocar(['b']);
  expect(saida.atual.estaAberta('a')).toBe(false);
  trocar(['a', 'b']);
  expect(abertas(saida.atual, ['a', 'b'])).toEqual([]);
});
