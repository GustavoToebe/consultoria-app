import { comDigitado, filtrarOpcoesSuspensas } from './escolhaSuspensa';
import { contarNomes, EQUIPAMENTOS_PADRAO, nomesDoSeletor, opcaoDoDigitado, opcoesDoSeletor, textoDaContagem } from './opcoesDoExercicio';

const GRUPOS = contarNomes(['Panturrilha', 'Panturrilha', 'Peito', ' Peito ', 'Costas', null, '', 'Panturrilhas']);

describe('contarNomes', () => {
  it('conta a grafia exata sem as pontas, em ordem alfabética, sem os vazios', () => {
    expect(GRUPOS).toEqual([
      { nome: 'Costas', contagem: 1 }, { nome: 'Panturrilha', contagem: 2 }, { nome: 'Panturrilhas', contagem: 1 }, { nome: 'Peito', contagem: 2 },
    ]);
  });
});

describe('textoDaContagem', () => {
  it('singular e plural', () => {
    expect(textoDaContagem(1)).toBe('1 exercício');
    expect(textoDaContagem(12)).toBe('12 exercícios');
  });
});

describe('nomesDoSeletor', () => {
  it('sem padrão: os existentes como vieram', () => {
    expect(nomesDoSeletor(GRUPOS).map((n) => n.nome)).toEqual(['Costas', 'Panturrilha', 'Panturrilhas', 'Peito']);
  });

  it('equipamentos: os padrão primeiro, na ordem, com a grafia gravada do parecido; depois os outros existentes', () => {
    const existentes = contarNomes(['halter', 'halter', 'Esteira', 'Barra', 'Barras']);
    const nomes = nomesDoSeletor(existentes, EQUIPAMENTOS_PADRAO);
    expect(nomes.slice(0, 3)).toEqual([{ nome: 'Barra', contagem: 1 }, { nome: 'halter', contagem: 2 }, { nome: 'Máquina', contagem: 0 }]);
    expect(nomes.map((n) => n.nome)).toEqual(['Barra', 'halter', 'Máquina', 'Polia', 'Smith', 'Elástico', 'Banco', 'Kettlebell', 'Anilha', 'Barras', 'Esteira']);
  });
});

describe('opcoesDoSeletor', () => {
  it('"Não informado" primeiro e a contagem no detalhe (o rótulo fica só o nome)', () => {
    const opcoes = opcoesDoSeletor(GRUPOS, 'Peito');
    expect(opcoes[0]).toEqual({ valor: '', rotulo: 'Não informado' });
    expect(opcoes).toContainEqual({ valor: 'Panturrilha', rotulo: 'Panturrilha', detalhe: '2 exercícios' });
    expect(opcoes).toHaveLength(5);
  });

  it('padrão sem uso fica sem detalhe', () => {
    expect(opcoesDoSeletor([{ nome: 'Smith', contagem: 0 }], '')).toEqual([{ valor: '', rotulo: 'Não informado' }, { valor: 'Smith', rotulo: 'Smith' }]);
  });

  it('o valor atual que não está na lista entra logo depois do "Não informado"', () => {
    expect(opcoesDoSeletor(GRUPOS, ' Glúteo médio ')[1]).toEqual({ valor: 'Glúteo médio', rotulo: 'Glúteo médio' });
    expect(opcoesDoSeletor([], 'Peito')).toEqual([{ valor: '', rotulo: 'Não informado' }, { valor: 'Peito', rotulo: 'Peito' }]);
  });
});

describe('opcaoDoDigitado', () => {
  const novo = 'Grupo muscular novo';

  it('vazio não oferece nada', () => {
    expect(opcaoDoDigitado('   ', GRUPOS, novo)).toBeNull();
  });

  it('igual a um nome: ele mesmo', () => {
    expect(opcaoDoDigitado('Peito', GRUPOS, novo)).toEqual({ valor: 'Peito', rotulo: 'Peito' });
  });

  it('parecido (caixa, acento, plural simples): sugere o existente mais usado, sem criar a variação', () => {
    expect(opcaoDoDigitado('peito', GRUPOS, novo)).toEqual({ valor: 'Peito', rotulo: 'Peito' });
    expect(opcaoDoDigitado('PANTURRILHAS', GRUPOS, novo)).toEqual({ valor: 'Panturrilha', rotulo: 'Panturrilha' });
    expect(opcaoDoDigitado('Abdomen', contarNomes(['Abdômen']), novo)).toEqual({ valor: 'Abdômen', rotulo: 'Abdômen' });
  });

  it('nome novo: "+ Usar “…”" com o nome limpo', () => {
    expect(opcaoDoDigitado('  Glúteo   médio ', GRUPOS, novo)).toEqual({ valor: 'Glúteo médio', rotulo: '+ Usar “Glúteo médio”', detalhe: novo });
  });

  it('"pantu": o filtro mostra a Panturrilha existente antes do "+ Usar “pantu”"', () => {
    const opcoes = opcoesDoSeletor(GRUPOS, '');
    const lista = comDigitado(filtrarOpcoesSuspensas(opcoes, 'pantu'), opcoes, opcaoDoDigitado('pantu', GRUPOS, novo));
    expect(lista.map((o) => o.rotulo)).toEqual(['Panturrilha', 'Panturrilhas', '+ Usar “pantu”']);
  });

  it('"panturrilhas" com só a Panturrilha gravada: a existente no topo e nada para criar', () => {
    const grupos = contarNomes(['Panturrilha', 'Peito']);
    const opcoes = opcoesDoSeletor(grupos, '');
    const lista = comDigitado(filtrarOpcoesSuspensas(opcoes, 'panturrilhas'), opcoes, opcaoDoDigitado('panturrilhas', grupos, novo));
    expect(lista.map((o) => o.valor)).toEqual(['Panturrilha']);
  });

  it('equipamento padrão ainda sem uso também é sugerido', () => {
    const nomes = nomesDoSeletor([], EQUIPAMENTOS_PADRAO);
    expect(opcaoDoDigitado('maquinas', nomes, 'Equipamento novo')).toEqual({ valor: 'Máquina', rotulo: 'Máquina' });
  });
});
