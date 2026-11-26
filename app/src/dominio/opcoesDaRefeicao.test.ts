import type { ItemDieta, OpcaoRefeicao } from '../api/tipos';
import { abaComProblema, chaveDosProblemas, gramasSemUnidade, kcalDaAba, letraDoMarcador, nomeDaAba, tituloDaOpcao, totaisDaOpcao } from './opcoesDaRefeicao';

// Opções em abas (19/11). Dados fictícios.
const item = (uid: string, kcal: number | null): ItemDieta =>
  ({ uid, alimentoId: null, nome: uid, quantidade: 100, unidade: 'g', kcal, proteina: 2, carboidrato: 10, gordura: 1, manual: true });
const opcao = (uid: string, rotulo: string, itens: ItemDieta[]): OpcaoRefeicao => ({ uid, rotulo, itens });

describe('aba da opção', () => {
  it('mostra a kcal da opção, "— kcal" quando falta valor e "vazia" sem item (nunca "0 kcal")', () => {
    expect(kcalDaAba(opcao('a', 'A', [item('i1', 60.4), item('i2', 37.7)]))).toBe('98 kcal');
    expect(kcalDaAba(opcao('b', 'B', [item('i3', 50), item('i4', null)]))).toBe('— kcal');
    expect(kcalDaAba(opcao('c', 'C', []))).toBe('vazia');
    expect(totaisDaOpcao(opcao('c', 'C', []))).toBeNull();
  });

  it('o nome acessível diz a kcal, se conta no total do dia e se tem problema', () => {
    expect(nomeDaAba(opcao('a', 'A', [item('i1', 98)]), true, false)).toBe('Opção A, 98 kcal, conta no total do dia');
    expect(nomeDaAba(opcao('c', 'C', []), false, true)).toBe('Opção C, vazia, com problema a corrigir');
  });

  it('o rótulo personalizado não ganha "Opção " na frente (a importação já grava "Opção Principal")', () => {
    expect(tituloDaOpcao(opcao('p', 'Opção Principal', []))).toBe('Opção Principal');
    expect(tituloDaOpcao(opcao('q', 'Café reforçado', []))).toBe('Café reforçado');
    expect(tituloDaOpcao(opcao('b', 'B', []))).toBe('Opção B');
    expect(tituloDaOpcao(opcao('s', '7', []))).toBe('Opção 7');
    expect(['B', '7', 'Opção Principal', 'café'].map(letraDoMarcador)).toEqual(['B', '7', 'P', 'C']);
    expect(nomeDaAba(opcao('p', 'Opção Principal', [item('i1', 98)]), true, false)).toBe('Opção Principal, 98 kcal, conta no total do dia');
  });
});

describe('comparação', () => {
  it('gramas com uma casa e sem unidade; "—" sem valor', () => {
    expect(gramasSemUnidade(12)).toBe('12,0');
    expect(gramasSemUnidade(2.46)).toBe('2,5');
    expect(gramasSemUnidade(null)).toBe('—');
  });
});

describe('aba aberta e os problemas da validação', () => {
  const opcoes = [opcao('a', 'A', [item('i1', 1)]), opcao('b', 'B', [item('i2', 1)]), opcao('c', 'C', [])];

  it('a aberta com problema fica; limpa, abre a primeira com problema; sem nenhum, fica', () => {
    expect(abaComProblema(opcoes, 'b', new Set(['b', 'c']))).toBe('b');
    expect(abaComProblema(opcoes, 'a', new Set(['r1', 'c', 'b']))).toBe('b');
    expect(abaComProblema(opcoes, 'a', new Set(['r1']))).toBe('a');
  });

  it('a chave só muda quando muda o conjunto de opções com problema', () => {
    expect(chaveDosProblemas(opcoes, new Set(['r1', 'i2', 'b']))).toBe('b');
    expect(chaveDosProblemas(opcoes, new Set(['b', 'x']))).toBe(chaveDosProblemas(opcoes, new Set(['b'])));
    expect(chaveDosProblemas(opcoes, new Set())).toBe('');
  });
});
