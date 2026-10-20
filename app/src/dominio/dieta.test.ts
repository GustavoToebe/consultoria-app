import type { Alimento, ConteudoDieta, ItemDieta } from '../api/tipos';
import { aguaValida, itensSemValorNoTotal, normalizarDieta, novoItem, recalcularItem, resumoDaDietaNoInicio, somar, textoDaAgua, textoDoMacro, textoItensSemValor, totalDoDia } from './dieta';
import { dataDaTela, dataParaTela, mascaraData, numeroDaTela, numeroParaTela } from './formatos';

jest.mock('./uid', () => ({ novoUid: () => 'uid' }));

const pao: Alimento = {
  id: 'p',
  nome: 'Pão de forma (fictício)',
  baseQuantidade: 100,
  baseUnidade: 'g',
  kcal: 266,
  proteina: 8.4,
  carboidrato: 49.6,
  gordura: 3.2,
  gramasPorUnidade: 25,
  fonte: null,
  origem: 'MANUAL',
  fatorCorrecao: null,
  fatorCoccao: null,
};

describe('dieta', () => {
  it('valor do item é proporcional à quantidade na base', () => {
    const item = recalcularItem({ ...novoItem(pao), quantidade: 50 }, pao);
    expect(item).toMatchObject({ kcal: 133, proteina: 4.2, carboidrato: 24.8, gordura: 1.6 });
  });

  it('converte unidade para gramas quando o alimento informa gramas por unidade', () => {
    const item = recalcularItem({ ...novoItem(pao), quantidade: 2, unidade: 'un' }, pao);
    expect(item.kcal).toBe(133);
  });

  it('sem como converter, o valor fica vazio (não inventa)', () => {
    const semGramas = { ...pao, gramasPorUnidade: null };
    const item = recalcularItem({ ...novoItem(semGramas), quantidade: 2, unidade: 'ml' }, semGramas);
    expect(item.kcal).toBeNull();
  });

  it('item manual não é recalculado', () => {
    const manual: ItemDieta = { ...novoItem(), nome: 'Outro', quantidade: 10, kcal: 99, manual: true };
    expect(recalcularItem(manual, pao).kcal).toBe(99);
  });

  it('total do dia soma só a primeira opção de cada refeição', () => {
    const item = (kcal: number): ItemDieta => ({ ...novoItem(), kcal, proteina: 1, carboidrato: 1, gordura: 1 });
    const conteudo = {
      refeicoes: [
        { opcoes: [{ itens: [item(100)] }, { itens: [item(999)] }] },
        { opcoes: [{ itens: [item(50), item(0.4)] }] },
      ],
    } as unknown as ConteudoDieta;
    expect(totalDoDia(conteudo).kcal).toBeCloseTo(150.4);
  });

  it('item sem valor deixa aquele total vazio', () => {
    expect(somar([{ ...novoItem(), kcal: null }]).kcal).toBeNull();
  });
});

describe('normalizarDieta: ergogenicos', () => {
  it('nulo continua nulo (sem acesso) e lista vira itens completos', () => {
    expect(normalizarDieta({}).ergogenicos).toBeNull();
    expect(normalizarDieta({ ergogenicos: null }).ergogenicos).toBeNull();
    expect(normalizarDieta({ ergogenicos: [] }).ergogenicos).toEqual([]);
    const [item] = normalizarDieta({ ergogenicos: [{ uid: 'u1', nome: 'Item de teste A' }] }).ergogenicos ?? [];
    expect(item).toEqual({
      uid: 'u1', nome: 'Item de teste A', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '',
    });
  });
});

describe('formatos', () => {
  it('datas DD/MM/AAAA ↔ ISO, recusando data impossível', () => {
    expect(dataParaTela('2026-10-11')).toBe('11/10/2026');
    expect(dataDaTela('11/10/2026')).toBe('2026-10-11');
    expect(dataDaTela('')).toBeNull();
    expect(dataDaTela('31/02/2026')).toBeUndefined();
    expect(dataDaTela('1/10/2026')).toBeUndefined();
    expect(mascaraData('11102026')).toBe('11/10/2026');
  });

  it('números com vírgula, sem parse de faixa', () => {
    expect(numeroDaTela('25,5')).toBe(25.5);
    expect(numeroDaTela('')).toBeNull();
    expect(numeroDaTela('3 a 6', true)).toBeUndefined();
    expect(numeroDaTela('2,5', true)).toBeUndefined();
    expect(numeroParaTela(28.8, 1)).toBe('28,8');
    expect(numeroParaTela(null)).toBe('—');
  });
});

describe('água por dia (reunião de 17/10)', () => {
  it('vazia é válida e não aparece; preenchida mostra o número do treinador', () => {
    expect(aguaValida(null)).toBe(true);
    expect(textoDaAgua(null)).toBeNull();
    expect(textoDaAgua(3.5)).toBe('3,5 L por dia');
    expect(textoDaAgua(3)).toBe('3 L por dia');
  });

  it('mesma faixa do servidor: 0,1 a 20 L, uma casa decimal', () => {
    expect([0.1, 2.5, 20].map(aguaValida)).toEqual([true, true, true]);
    expect([0.05, 21, 2.25, -1].map(aguaValida)).toEqual([false, false, false, false]);
  });

  it('resumo do cartão do início', () => {
    const base = normalizarDieta({ refeicoes: [{}, {}, {}] });
    expect(resumoDaDietaNoInicio(base)).toBe('3 refeições');
    expect(resumoDaDietaNoInicio({ ...base, aguaLitros: 3.5 })).toBe('3 refeições · Água: 3,5 L por dia');
    expect(resumoDaDietaNoInicio(normalizarDieta({ refeicoes: [{}] }))).toBe('1 refeição');
  });
});

describe('total do dia incompleto', () => {
  it('aponta só os itens da opção A sem valor', () => {
    const manual = { ...novoItem(), uid: 'm', nome: 'Item manual' };
    const comValor = { ...recalcularItem({ ...novoItem(pao), uid: 'c', quantidade: 50, unidade: 'g' as const }, pao) };
    const c: ConteudoDieta = normalizarDieta({ refeicoes: [
      { uid: 'r1', nome: 'Café', opcoes: [{ uid: 'a', rotulo: 'A', itens: [comValor, manual] }, { uid: 'b', rotulo: 'B', itens: [{ ...manual, uid: 'x' }] }] },
    ] });
    expect(itensSemValorNoTotal(c)).toEqual([{ refeicaoUid: 'r1', itemUid: 'm', nome: 'Item manual' }]);
    expect(textoItensSemValor(1)).toBe('1 item da opção A sem kcal, proteína, carboidrato ou gordura');
    expect(textoItensSemValor(2)).toMatch(/^2 itens/);
  });
  it('valor ausente não leva unidade', () => {
    expect(textoDoMacro('Proteína', null, 'g')).toBe('Proteína —');
    expect(textoDoMacro('Proteína', 180.25, 'g')).toBe('Proteína 180,3 g');
  });
});
