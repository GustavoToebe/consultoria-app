import { chipDeUmaOpcao, chipDeVarias } from './filtrosDaBiblioteca';

const FATORES = [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'sem', rotulo: 'Sem fatores' }];
const GRUPOS = [{ valor: 'Costas', rotulo: 'Costas' }, { valor: 'Peito', rotulo: 'Peito' }];

describe('chips da Biblioteca', () => {
  test('uma opção: nada com "todos"', () => {
    expect(chipDeUmaOpcao('Fatores', 'todos', 'todos', FATORES)).toEqual([]);
    expect(chipDeUmaOpcao('Fatores', 'sem', 'todos', FATORES)).toEqual([{ chave: 'filtro', texto: 'Fatores: Sem fatores' }]);
  });

  test('várias: as marcadas que existem, na ordem das opções', () => {
    expect(chipDeVarias('Grupo', new Set(), GRUPOS)).toEqual([]);
    expect(chipDeVarias('Grupo', new Set(['Peito', 'Sumiu', 'Costas']), GRUPOS)).toEqual([{ chave: 'filtro', texto: 'Grupo: Costas, Peito' }]);
  });
});
