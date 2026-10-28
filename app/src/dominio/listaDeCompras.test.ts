import type { ConteudoDieta, ItemDieta, OpcaoRefeicao, Refeicao } from '../api/tipos';
import { normalizarDieta } from './dieta';
import { alimentosDaDieta, comFatoresDaBiblioteca, DIAS_DO_PERIODO, listaDeCompras, marcaSemFator, NOTA_DA_LISTA_ALUNO, NOTA_DA_LISTA_TREINADOR, quantidadeParaTela, refeicoesComEscolha, PERIODOS_DA_LISTA, textoDoPeriodo, tituloDaLista } from './listaDeCompras';

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

  it('sem fator, vale a quantidade da dieta (nada vira 1 nem é inventado)', () => {
    const [linha] = listaDeCompras(dieta([refeicao('r', [opcao('a', [item('Banana', 120)])])]), {}, 'semana');
    expect(linha).toMatchObject({ quantidade: 840, cru: false, bruto: false, semFator: true });
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
      { alimentoId: 'arroz', fatorCorrecao: null, fatorCoccao: 2.5 },
      { alimentoId: 'feijao', fatorCorrecao: 1.1, fatorCoccao: null },
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
    // O conteúdo da tela não muda.
    expect(c.refeicoes[0].opcoes[0].itens[1].fatorCoccao).toBe(9);
    expect(listaDeCompras(comFatores, {}, 'semana').map((l) => [l.nome, l.quantidade, l.semFator])).toEqual([
      ['Arroz cozido', (150 / 2.5) * 7, false],
      ['Feijão', expect.closeTo(100 * 1.1 * 7, 6), false],
      ['Sumido', 560, true],
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

  it('texto do período', () => {
    expect(textoDoPeriodo('semana')).toBe('Semana (7 dias)');
    expect(textoDoPeriodo('duasSemanas')).toBe('2 semanas (14 dias)');
    expect(textoDoPeriodo('mes')).toBe('Mês (30 dias)');
    expect(PERIODOS_DA_LISTA.map(tituloDaLista)).toEqual(['Lista da semana', 'Lista de 2 semanas', 'Lista do mês']);
  });
});

describe('textos da lista pelo papel', () => {
  it('aluno lê "como na dieta"; treinador, "Sem fator" e onde cadastrar', () => {
    expect(marcaSemFator('aluno')).toBe('como na dieta');
    expect(marcaSemFator('treinador')).toBe('Sem fator');
    expect(NOTA_DA_LISTA_ALUNO).toMatch(/seu treinador/);
    expect(NOTA_DA_LISTA_TREINADOR).toMatch(/Biblioteca › Alimentos/);
  });
});
