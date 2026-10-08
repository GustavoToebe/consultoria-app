import type { Alimento, ConteudoDieta, ItemDieta } from '../api/tipos';
import { novoItem, recalcularItem, somar, totalDoDia } from './dieta';
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
