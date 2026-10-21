import { alternarVisiveis, estadoDosVisiveis, filtrarOpcoes, marcadosExistentes, resumoDosMarcados, textoDosMarcados } from './selecaoMultiplaSuspensa';

const opcoes = [
  { valor: 'peito', rotulo: 'Peito' },
  { valor: 'costas', rotulo: 'Costas' },
  { valor: 'quadriceps', rotulo: 'Quadríceps' },
  { valor: 'triceps', rotulo: 'Tríceps' },
];

describe('filtrarOpcoes', () => {
  it('ignora acento e maiúsculas', () => {
    expect(filtrarOpcoes(opcoes, 'TRICEPS').map((o) => o.valor)).toEqual(['triceps']);
    expect(filtrarOpcoes(opcoes, 'ceps').map((o) => o.valor)).toEqual(['quadriceps', 'triceps']);
  });
  it('filtro vazio ou só espaços devolve tudo, sem alterar a lista original', () => {
    expect(filtrarOpcoes(opcoes, '  ')).toEqual(opcoes);
    expect(filtrarOpcoes(opcoes, '')).not.toBe(opcoes);
  });
});

describe('estadoDosVisiveis e alternarVisiveis', () => {
  it('estado olha só os visíveis', () => {
    const visiveis = filtrarOpcoes(opcoes, 'ceps');
    expect(estadoDosVisiveis(visiveis, new Set(['peito']))).toBe('nenhum');
    expect(estadoDosVisiveis(visiveis, new Set(['triceps']))).toBe('alguns');
    expect(estadoDosVisiveis(visiveis, new Set(['triceps', 'quadriceps']))).toBe('todos');
  });
  it('marcar todos marca os visíveis e preserva o que o filtro esconde', () => {
    const r = alternarVisiveis(filtrarOpcoes(opcoes, 'ceps'), new Set(['peito', 'triceps']));
    expect([...r].sort()).toEqual(['peito', 'quadriceps', 'triceps']);
  });
  it('com todos os visíveis marcados, desmarca só eles', () => {
    const r = alternarVisiveis(filtrarOpcoes(opcoes, 'ceps'), new Set(['peito', 'triceps', 'quadriceps']));
    expect([...r]).toEqual(['peito']);
  });
  it('sem opções visíveis não muda nada', () => {
    expect([...alternarVisiveis([], new Set(['peito']))]).toEqual(['peito']);
  });
});

describe('marcadosExistentes', () => {
  it('tira o que já não está nas opções', () => {
    expect([...marcadosExistentes(opcoes, new Set(['peito', 'sumiu']))]).toEqual(['peito']);
  });
});

describe('resumoDosMarcados e textoDosMarcados', () => {
  it('mostra dois chips e conta o resto, na ordem da lista', () => {
    const r = resumoDosMarcados(opcoes, new Set(['triceps', 'peito', 'costas']));
    expect(r).toEqual({ chips: ['Peito', 'Costas'], restantes: 1 });
  });
  it('texto: todos, um, dois e vários', () => {
    expect(textoDosMarcados(opcoes, new Set())).toBe('Todos');
    expect(textoDosMarcados(opcoes, new Set(), 'Todos os grupos')).toBe('Todos os grupos');
    expect(textoDosMarcados(opcoes, new Set(['peito']))).toBe('Peito');
    expect(textoDosMarcados(opcoes, new Set(['peito', 'costas']))).toBe('Peito, Costas');
    expect(textoDosMarcados(opcoes, new Set(['peito', 'costas', 'triceps', 'quadriceps']))).toBe('Peito, Costas e mais 2');
  });
});
