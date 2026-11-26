import type { ConteudoDieta, ItemDieta, OpcaoRefeicao, Refeicao } from '../api/tipos';
import { normalizarDieta } from './dieta';
import { soAVariacao } from './variacoesDaDieta';
import { alimentosDaDieta, comFatoresDaBiblioteca, detalheDaConversao, DIAS_DO_PERIODO, escolhasDaLista, listaDeCompras, NOTA_DA_LISTA, NOTA_DA_LISTA_ALUNO, NOTA_DA_LISTA_TREINADOR, quantidadeParaTela, refeicoesComEscolha, PERIODOS_DA_LISTA, textoDoPeriodo, textosDasOpcoes, tituloDaLista } from './listaDeCompras';

jest.mock('./uid', () => ({ novoUid: () => 'uid' }));

/** Alimentos e números fictícios. */
const item = (nome: string, quantidade: number | null, extra: Partial<ItemDieta> = {}): ItemDieta => ({
  uid: `i-${nome}`,
  alimentoId: null,
  nome,
  quantidade,
  unidade: 'g',
  kcal: null,
  proteina: null,
  carboidrato: null,
  gordura: null,
  manual: true,
  fatorCorrecao: null,
  fatorCoccao: null,
  ...extra,
});
const opcao = (uid: string, itens: ItemDieta[]): OpcaoRefeicao => ({ uid, rotulo: uid.toUpperCase(), itens });
const refeicao = (uid: string, opcoes: OpcaoRefeicao[]): Refeicao => ({ uid, nome: uid, horario: null, observacao: null, opcoes });
const dieta = (refeicoes: Refeicao[]): ConteudoDieta => ({ ...normalizarDieta(null), refeicoes });

describe('listaDeCompras', () => {
  it('cozido vira cru pelo FCc e bruto pelo FC, vezes os dias do período', () => {
    const arroz = item('Arroz cozido', 150, { alimentoId: 'arroz', manual: false, fatorCoccao: 2.5 });
    const abacaxi = item('Abacaxi', 100, { alimentoId: 'abacaxi', manual: false, fatorCorrecao: 1.75 });
    const frango = item('Frango grelhado', 140, { alimentoId: 'frango', manual: false, fatorCoccao: 0.7, fatorCorrecao: 1.1 });
    const c = dieta([refeicao('almoco', [opcao('a', [arroz, abacaxi, frango])])]);
    const semana = listaDeCompras(c, {}, 'semana');
    expect(semana.map((l) => [l.nome, l.quantidade, l.cru, l.bruto, l.semFator])).toEqual([
      ['Abacaxi', 100 * 1.75 * 7, false, true, false],
      ['Arroz cozido', (150 / 2.5) * 7, true, false, false],
      ['Frango grelhado', expect.closeTo((140 / 0.7) * 1.1 * 7, 6), true, true, false],
    ]);
    expect(listaDeCompras(c, {}, 'mes')[1].quantidade).toBeCloseTo((150 / 2.5) * 30, 6);
    expect(listaDeCompras(c, {}, 'duasSemanas')[1].quantidade).toBeCloseTo((150 / 2.5) * 14, 6);
    expect(DIAS_DO_PERIODO).toEqual({ semana: 7, duasSemanas: 14, mes: 30 });
  });

  it('item em gramas sem fator é estimado pelo nome (banana: casca grossa, peso pronto)', () => {
    const [linha] = listaDeCompras(dieta([refeicao('r', [opcao('a', [item('Banana', 120)])])]), {}, 'semana');
    expect(linha).toMatchObject({ quantidade: 120 * 1.45 * 7, cru: false, bruto: true, semFator: false });
  });

  it('fatores só valem em gramas; ml e unidade ficam como estão', () => {
    const c = dieta([
      refeicao('r', [
        opcao('a', [
          item('Leite', 200, { unidade: 'ml', fatorCoccao: 2, fatorCorrecao: 2 }),
          item('Ovo', 3, { unidade: 'un', fatorCorrecao: 1.2 }),
        ]),
      ]),
    ]);
    expect(listaDeCompras(c, {}, 'semana').map((l) => [l.nome, l.unidade, l.quantidade, l.semFator])).toEqual([
      ['Leite', 'ml', 1400, true],
      ['Ovo', 'un', 21, true],
    ]);
  });

  it('soma o mesmo alimento entre refeições, e o manual pelo nome sem acento; unidades diferentes ficam separadas', () => {
    const c = dieta([
      refeicao('cafe', [opcao('a', [item('Pão', 50, { alimentoId: 'pao', manual: false }), item('Maçã', 1, { unidade: 'un' })])]),
      refeicao('lanche', [opcao('a', [item('Pão de forma', 25, { alimentoId: 'pao', manual: false }), item(' maca ', 1, { unidade: 'un' }), item('Pão', 2, { alimentoId: 'pao', manual: false, unidade: 'un' })])]),
    ]);
    expect(listaDeCompras(c, {}, 'semana').map((l) => [l.nome, l.unidade, l.quantidade])).toEqual([
      ['Maçã', 'un', 14],
      ['Pão', 'g', 525],
      ['Pão', 'un', 14],
    ]);
  });

  it('usa a opção escolhida de cada refeição; sem escolha ou escolha que sumiu, a primeira; sem opções, ignora', () => {
    const c = dieta([
      refeicao('cafe', [opcao('a', [item('Aveia', 40)]), opcao('b', [item('Iogurte', 170)])]),
      refeicao('ceia', [opcao('a', [item('Castanha', 10)]), opcao('b', [item('Queijo', 30)])]),
      refeicao('vazia', []),
    ]);
    expect(listaDeCompras(c, { cafe: 'b', ceia: 'sumiu' }, 'semana').map((l) => l.nome)).toEqual(['Castanha', 'Iogurte']);
    expect(listaDeCompras(c, {}, 'semana').map((l) => l.nome)).toEqual(['Aveia', 'Castanha']);
    expect(refeicoesComEscolha(c).map((r) => r.uid)).toEqual(['cafe', 'ceia']);
  });

  it('item sem quantidade ou sem nome não entra (e não vira zero)', () => {
    const c = dieta([refeicao('r', [opcao('a', [item('Sem quantidade', null), item('Zero', 0), item('  ', 100), item('Ok', 10)])])]);
    expect(listaDeCompras(c, {}, 'semana').map((l) => l.nome)).toEqual(['Ok']);
  });

  it('ordem alfabética sem acento', () => {
    const c = dieta([refeicao('r', [opcao('a', [item('Óleo', 5), item('abobrinha', 5), item('Ervilha', 5), item('Açaí', 5)])])]);
    expect(listaDeCompras(c, {}, 'semana').map((l) => l.nome)).toEqual(['abobrinha', 'Açaí', 'Ervilha', 'Óleo']);
  });

  it('dieta publicada vinda da API passa pelo normalizador sem perder os fatores', () => {
    const c = normalizarDieta({ refeicoes: [{ uid: 'r', nome: 'Almoço', opcoes: [{ uid: 'a', rotulo: 'A', itens: [{ uid: 'i', alimentoId: 'x', nome: 'Arroz cozido', quantidade: 100, unidade: 'g', fatorCoccao: 2.5 }] }] }] });
    expect(listaDeCompras(c, {}, 'semana')[0]).toMatchObject({ quantidade: 280, cru: true, bruto: false });
  });
});

describe('dieta com variações por dia da semana', () => {
  const leite = (quantidade: number) => item('Leite', quantidade, { unidade: 'ml' });
  const variacao = (uid: string, rotulo: string, dias: number[], refeicoes: Refeicao[]) => ({ uid, rotulo, dias, refeicoes });
  const comVariacoes = (variacoes: ConteudoDieta['variacoes']): ConteudoDieta => ({ ...normalizarDieta(null), refeicoes: [], variacoes });
  // 5 dias com 100 ml e 2 dias com 50 ml (e ovo só na segunda).
  const cinco = comVariacoes([
    variacao('v1', 'Carbo alto', [1, 2, 3, 4, 5], [refeicao('cafe1', [opcao('a', [leite(100)])])]),
    variacao('v2', 'Carbo baixo', [6, 7], [refeicao('cafe2', [opcao('a', [leite(50), item('Ovo', 30, { unidade: 'un' })])])]),
  ]);

  it('cada variação entra pelos dias dela: dias × período ÷ 7, somando o mesmo alimento entre variações', () => {
    const quantidade = (periodo: 'semana' | 'duasSemanas' | 'mes') => listaDeCompras(cinco, {}, periodo).find((l) => l.nome === 'Leite')?.quantidade;
    expect(quantidade('semana')).toBe(100 * 5 + 50 * 2);
    expect(quantidade('duasSemanas')).toBe(100 * 10 + 50 * 4);
    expect(quantidade('mes')).toBeCloseTo((100 * 5 + 50 * 2) * (30 / 7), 6);
    expect(listaDeCompras(cinco, {}, 'semana').find((l) => l.nome === 'Ovo')?.quantidade).toBe(30 * 2);
  });

  it('dieta sem variação e a mesma dieta numa variação com os 7 dias dão exatamente a mesma lista', () => {
    const refs = [refeicao('r', [opcao('a', [item('Arroz cozido', 150, { alimentoId: 'arroz', manual: false, fatorCoccao: 2.5 }), leite(250)])])];
    const semVariacao = dieta(refs);
    const umaVariacao = comVariacoes([variacao('v', 'Única', [1, 2, 3, 4, 5, 6, 7], refs)]);
    for (const periodo of PERIODOS_DA_LISTA) {
      expect(listaDeCompras(umaVariacao, {}, periodo)).toEqual(listaDeCompras(semVariacao, {}, periodo));
    }
  });

  it('variação sem dia marcado (rascunho) não entra, e sem nenhuma a lista fica vazia', () => {
    const rascunho = comVariacoes([
      variacao('v1', 'Marcada', [1, 2], [refeicao('r1', [opcao('a', [leite(100)])])]),
      variacao('v2', 'Sem dia', [], [refeicao('r2', [opcao('a', [item('Suco', 200, { unidade: 'ml' })])])]),
    ]);
    expect(listaDeCompras(rascunho, {}, 'semana').map((l) => [l.nome, l.quantidade])).toEqual([['Leite', 200]]);
    expect(listaDeCompras(comVariacoes([variacao('v', 'Vazia', [], [])]), {}, 'semana')).toEqual([]);
  });

  it('a escolha de opção vale por refeição de qualquer variação, e o texto diz de qual variação é', () => {
    const duas = comVariacoes([
      variacao('v1', 'Carbo alto', [1, 2, 3], [refeicao('r1', [opcao('a', [leite(100)]), opcao('b', [leite(300)])])]),
      variacao('v2', 'Carbo baixo', [4, 5, 6, 7], [refeicao('r2', [opcao('a', [leite(50)]), opcao('b', [leite(70)])])]),
    ]);
    expect(refeicoesComEscolha(duas).map((r) => r.uid)).toEqual(['r1', 'r2']);
    expect(textosDasOpcoes(duas, { r1: 'b' })).toEqual(['Carbo alto · r1: opção B', 'Carbo baixo · r2: opção A']);
    expect(listaDeCompras(duas, { r1: 'b', r2: 'b' }, 'semana')[0].quantidade).toBe(300 * 3 + 70 * 4);
    // Sem variação o texto é o de antes, sem prefixo.
    expect(textosDasOpcoes(dieta([refeicao('r', [opcao('a', []), opcao('b', [])])]), {})).toEqual(['r: opção A']);
  });

  it('escolhasDaLista diz de qual variação é cada refeição (e dos dias dela); sem variação, sem rótulo', () => {
    const duas = comVariacoes([
      variacao('v1', 'Carbo alto', [1, 3, 5], [refeicao('r1', [opcao('a', [leite(100)]), opcao('b', [leite(300)])])]),
      variacao('v2', ' ', [2, 4], [refeicao('r2', [opcao('a', [leite(50)]), opcao('b', [leite(70)])]), refeicao('r3', [opcao('a', [leite(1)])])]),
    ]);
    expect(escolhasDaLista(duas).map((e) => [e.refeicao.uid, e.variacao])).toEqual([['r1', 'Carbo alto'], ['r2', 'Variação sem nome']]);
    expect(escolhasDaLista(soAVariacao(duas, 'v1')).map((e) => e.refeicao.uid)).toEqual(['r1']);
    expect(escolhasDaLista(dieta([refeicao('r', [opcao('a', []), opcao('b', [])])])).map((e) => [e.refeicao.uid, e.variacao])).toEqual([['r', null]]);
  });

  it('os ids dos alimentos e os fatores da biblioteca alcançam as variações (e a raiz continua vazia)', () => {
    const c = comVariacoes([
      variacao('v1', 'A', [1, 2, 3], [refeicao('r1', [opcao('a', [item('Arroz cozido', 100, { alimentoId: 'arroz', manual: false })])])]),
      variacao('v2', 'B', [4, 5, 6, 7], [refeicao('r2', [opcao('a', [item('Feijão', 100, { alimentoId: 'feijao', manual: false })])])]),
    ]);
    expect(alimentosDaDieta(c)).toEqual(['arroz', 'feijao']);
    const comFatores = comFatoresDaBiblioteca(c, [{ alimentoId: 'feijao', fatorCorrecao: 1.1, fatorCoccao: null, grupo: 'Leguminosas' }]);
    expect(comFatores.refeicoes).toEqual([]);
    expect(comFatores.variacoes.map((v) => v.rotulo)).toEqual(['A', 'B']);
    expect(comFatores.variacoes.flatMap((v) => v.refeicoes.flatMap((r) => r.opcoes.flatMap((o) => o.itens))).map((i) => [i.nome, i.fatorCorrecao, i.grupo]))
      .toEqual([['Arroz cozido', null, null], ['Feijão', 1.1, 'Leguminosas']]);
    // O conteúdo recebido não muda.
    expect(c.variacoes[1].refeicoes[0].opcoes[0].itens[0].fatorCorrecao).toBeNull();
  });
});

describe('prévia do editor com os fatores da biblioteca', () => {
  const c = dieta([
    refeicao('almoco', [
      opcao('a', [item('Arroz cozido', 150, { alimentoId: 'arroz', manual: false }), item('Feijão', 100, { alimentoId: 'feijao', manual: false, fatorCoccao: 9 })]),
      opcao('b', [item('Arroz cozido', 100, { alimentoId: 'arroz', manual: false }), item('Manual', 50, { fatorCorrecao: 9 })]),
    ]),
    refeicao('jantar', [opcao('a', [item('Sumido', 80, { alimentoId: 'sumido', manual: false, fatorCorrecao: 9 })])]),
  ]);

  it('ids distintos dos alimentos de todas as opções, sem os itens manuais', () => {
    expect(alimentosDaDieta(c)).toEqual(['arroz', 'feijao', 'sumido']);
  });

  it('aplica os fatores achados e tira o que o rascunho tinha (manual ou não achado fica sem fator), como a publicação', () => {
    const fatores = [
      { alimentoId: 'arroz', fatorCorrecao: null, fatorCoccao: 2.5, grupo: 'Cereais e derivados' },
      { alimentoId: 'feijao', fatorCorrecao: 1.1, fatorCoccao: null, grupo: null },
    ];
    const comFatores = comFatoresDaBiblioteca(c, fatores);
    const itens = comFatores.refeicoes.flatMap((r) => r.opcoes.flatMap((o) => o.itens));
    expect(itens.map((i) => [i.nome, i.fatorCorrecao, i.fatorCoccao])).toEqual([
      ['Arroz cozido', null, 2.5],
      ['Feijão', 1.1, null],
      ['Arroz cozido', null, 2.5],
      ['Manual', null, null],
      ['Sumido', null, null],
    ]);
    // O grupo segue a mesma regra: o da biblioteca, nulo no manual e no não achado.
    expect(itens.map((i) => i.grupo)).toEqual(['Cereais e derivados', null, 'Cereais e derivados', null, null]);
    // O conteúdo da tela não muda.
    expect(c.refeicoes[0].opcoes[0].itens[1].fatorCoccao).toBe(9);
    expect(listaDeCompras(comFatores, {}, 'semana').map((l) => [l.nome, l.quantidade, l.semFator])).toEqual([
      ['Arroz cozido', (150 / 2.5) * 7, false],
      ['Feijão', expect.closeTo((100 / 1.85) * 1.1 * 7, 6), false],
      ['Sumido', 560, false],
    ]);
  });
});

describe('grupo do alimento na linha', () => {
  it('a linha leva o grupo do item (sem espaços sobrando), sem mudar a conta; sem grupo = null', () => {
    const c = dieta([
      refeicao('almoco', [opcao('a', [
        item('Arroz cozido', 150, { alimentoId: 'arroz', manual: false, fatorCorrecao: 1, fatorCoccao: 1, grupo: ' Cereais e derivados ' }),
        item('Sal', 5, { fatorCorrecao: 1, fatorCoccao: 1, grupo: '   ' }),
      ])]),
      refeicao('jantar', [opcao('a', [item('Arroz cozido', 100, { alimentoId: 'arroz', manual: false, fatorCorrecao: 1, fatorCoccao: 1, grupo: null })])]),
    ]);
    expect(listaDeCompras(c, {}, 'semana').map((l) => [l.nome, l.quantidade, l.grupo])).toEqual([
      ['Arroz cozido', 250 * 7, 'Cereais e derivados'],
      ['Sal', 35, null],
    ]);
  });
});

describe('quantidadeParaTela', () => {
  it('g e ml para cima de 10 em 10; a partir de 1.000, kg ou L com duas casas', () => {
    expect(quantidadeParaTela(420, 'g')).toBe('420 g');
    expect(quantidadeParaTela(419.99999999, 'g')).toBe('420 g');
    expect(quantidadeParaTela(421, 'g')).toBe('430 g');
    expect(quantidadeParaTela(0.4, 'g')).toBe('10 g');
    expect(quantidadeParaTela(995, 'g')).toBe('1,00 kg');
    expect(quantidadeParaTela(1225, 'g')).toBe('1,23 kg');
    expect(quantidadeParaTela(12250, 'g')).toBe('12,25 kg');
    expect(quantidadeParaTela(1400, 'ml')).toBe('1,40 L');
    expect(quantidadeParaTela(350, 'ml')).toBe('350 ml');
  });

  it('unidade para cima no inteiro', () => {
    expect(quantidadeParaTela(21, 'un')).toBe('21 un');
    expect(quantidadeParaTela(10.5, 'un')).toBe('11 un');
  });

  it('texto do período: o número de dias da conta (7, 14 e 30)', () => {
    expect(PERIODOS_DA_LISTA.map(textoDoPeriodo)).toEqual(['7 dias', '14 dias', '30 dias']);
    expect(PERIODOS_DA_LISTA.map(tituloDaLista)).toEqual(['Lista de 7 dias', 'Lista de 14 dias', 'Lista de 30 dias']);
  });
});

describe('textos da lista', () => {
  it('aluno, treinador e PDF usam a mesma nota de cálculo estimado', () => {
    expect(NOTA_DA_LISTA_ALUNO).toBe(NOTA_DA_LISTA);
    expect(NOTA_DA_LISTA_TREINADOR).toBe(NOTA_DA_LISTA);
    expect(NOTA_DA_LISTA).toMatch(/cálculo estimado/);
  });

  it('detalhe diz de onde veio o peso a comprar', () => {
    const base = { unidade: 'g' as const, naDieta: 1000, quantidadeCru: 1282, cru: true, bruto: true };
    expect(detalheDaConversao(base)).toMatch(/pronto/);
    expect(detalheDaConversao(base)).toMatch(/cru limpo/);
    expect(detalheDaConversao({ ...base, bruto: false, quantidadeCru: 400 })).toMatch(/cozido/);
    expect(detalheDaConversao({ ...base, cru: false, bruto: true, quantidadeCru: null })).toMatch(/limpo\/descascado/);
    expect(detalheDaConversao({ ...base, cru: false, bruto: false })).toBeNull();
  });
});
