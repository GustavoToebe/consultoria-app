import { agruparGruposParecidos } from './gruposMusculares';
import {
  alternarGrupo, comContagemDasModalidades, comMarcadosNoTopo, emDuasColunas, estadoDoGrupo, gruposDaBuscaAgrupada,
} from './painelDeExercicios';

const GRUPOS = agruparGruposParecidos([
  { nome: 'Peito', contagem: 3 }, { nome: 'Panturrilhas', contagem: 5 }, { nome: 'Abdômen', contagem: 2 },
  { nome: 'Panturrilha', contagem: 1 }, { nome: 'Costas', contagem: 4 }, { nome: 'Glúteos', contagem: 2 },
]);
const PANTURRILHA = GRUPOS.find((g) => g.rotulo === 'Panturrilha')!;
const PEITO = GRUPOS.find((g) => g.rotulo === 'Peito')!;
const rotulos = (gs: readonly { rotulo: string }[]) => gs.map((g) => g.rotulo);

describe('estadoDoGrupo', () => {
  it('diz todos, alguns (misto) ou nenhum pelos nomes reais do grupo', () => {
    expect(estadoDoGrupo(PANTURRILHA, new Set())).toBe('nenhum');
    expect(estadoDoGrupo(PANTURRILHA, new Set(['Panturrilha']))).toBe('alguns');
    expect(estadoDoGrupo(PANTURRILHA, new Set(['Panturrilha', 'Panturrilhas']))).toBe('todos');
    expect(estadoDoGrupo(PEITO, new Set(['Peito']))).toBe('todos');
  });

  it('um nome marcado que não é do grupo não deixa a linha mista', () => {
    expect(estadoDoGrupo(PEITO, new Set(['Peitoral antigo', 'Costas']))).toBe('nenhum');
  });
});

describe('alternarGrupo', () => {
  it('vazia ou mista marca todos os nomes; cheia tira todos; os outros filtros ficam', () => {
    expect([...alternarGrupo(PANTURRILHA, new Set(['Costas']))].sort()).toEqual(['Costas', 'Panturrilha', 'Panturrilhas']);
    expect([...alternarGrupo(PANTURRILHA, new Set(['Panturrilhas']))].sort()).toEqual(['Panturrilha', 'Panturrilhas']);
    expect([...alternarGrupo(PANTURRILHA, new Set(['Panturrilha', 'Panturrilhas', 'Costas']))]).toEqual(['Costas']);
  });

  it('não muda o conjunto recebido', () => {
    const marcados = new Set(['Peito']);
    alternarGrupo(PEITO, marcados);
    expect([...marcados]).toEqual(['Peito']);
  });
});

describe('comMarcadosNoTopo', () => {
  it('os marcados (e os mistos) sobem, e cada bloco segue em ordem alfabética', () => {
    expect(rotulos(GRUPOS)).toEqual(['Abdômen', 'Costas', 'Glúteos', 'Panturrilha', 'Peito']);
    expect(rotulos(comMarcadosNoTopo(GRUPOS, new Set(['Peito', 'Panturrilhas'])))).toEqual(['Panturrilha', 'Peito', 'Abdômen', 'Costas', 'Glúteos']);
    expect(rotulos(comMarcadosNoTopo(GRUPOS, new Set()))).toEqual(rotulos(GRUPOS));
  });
});

describe('gruposDaBuscaAgrupada', () => {
  it('compara sem acento nem caixa, no rótulo e nas variações', () => {
    expect(rotulos(gruposDaBuscaAgrupada(GRUPOS, 'abdo', new Set()))).toEqual(['Abdômen']);
    expect(rotulos(gruposDaBuscaAgrupada(GRUPOS, 'GLUT', new Set()))).toEqual(['Glúteos']);
    expect(rotulos(gruposDaBuscaAgrupada(GRUPOS, 'rrilhas', new Set()))).toEqual(['Panturrilha']);
  });

  it('nunca esconde o grupo marcado ou misto; busca vazia devolve todos', () => {
    expect(rotulos(gruposDaBuscaAgrupada(GRUPOS, 'costas', new Set(['Panturrilha'])))).toEqual(['Costas', 'Panturrilha']);
    expect(gruposDaBuscaAgrupada(GRUPOS, '  ', new Set())).toHaveLength(GRUPOS.length);
  });
});

describe('emDuasColunas', () => {
  it('a esquerda fica com a metade arredondada para cima, na ordem', () => {
    expect(emDuasColunas([1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [4, 5]]);
    expect(emDuasColunas([1, 2])).toEqual([[1], [2]]);
    expect(emDuasColunas([1])).toEqual([[1], []]);
    expect(emDuasColunas([])).toEqual([[], []]);
  });
});

describe('comContagemDasModalidades', () => {
  const opcoes = [{ valor: 'LIVRE', rotulo: 'Peso livre' }, { valor: 'MAQUINA', rotulo: 'Máquina' }];
  it('conta os exercícios de cada modalidade; a que não aparece na lista fica com 0', () => {
    expect(comContagemDasModalidades(opcoes, [{ modalidade: 'LIVRE' }, { modalidade: 'LIVRE' }, { modalidade: 'CARDIO' }]))
      .toEqual([{ valor: 'LIVRE', rotulo: 'Peso livre', contagem: 2 }, { valor: 'MAQUINA', rotulo: 'Máquina', contagem: 0 }]);
  });
  it('sem a lista, as opções voltam sem contagem', () => {
    expect(comContagemDasModalidades(opcoes, null)).toEqual(opcoes);
  });
});
