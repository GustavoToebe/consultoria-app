import type { ConteudoDieta, Refeicao } from '../api/tipos';
import { normalizarDieta } from './dieta';
import {
  alternarDia, criarVariacoes, diaDeHojeEmBrasilia, diasSemVariacao, duplicarVariacao, LIMITE_DE_VARIACOES, refeicoesDoDia,
  ROTULO_MAXIMO, secoesDaDieta, variacaoDoDia,
} from './variacoesDaDieta';

let mockProximo = 0;
jest.mock('./uid', () => ({ novoUid: () => `novo-${++mockProximo}` }));

const refeicao = (uid: string): Refeicao => ({
  uid, nome: `Refeição ${uid}`, horario: null, observacao: null, modoDePreparo: null,
  opcoes: [{ uid: `o-${uid}`, rotulo: 'A', itens: [{ uid: `i-${uid}`, alimentoId: null, nome: 'Item (fictício)', quantidade: 1, unidade: 'g', kcal: 1, proteina: 1, carboidrato: 1, gordura: 1, manual: true }] }],
});

const raiz = (): ConteudoDieta => ({ ...normalizarDieta(null), refeicoes: [refeicao('raiz')] });
const duas = (): ConteudoDieta => ({
  ...normalizarDieta(null),
  variacoes: [
    { uid: 'alto', rotulo: 'Dia de carbo alto', dias: [1, 3, 5, 7], refeicoes: [refeicao('a')] },
    { uid: 'zero', rotulo: 'Zero carbo', dias: [2, 4, 6], refeicoes: [refeicao('z')] },
  ],
});

beforeEach(() => { mockProximo = 0; });

describe('qual variação vale em cada dia', () => {
  it('sem variações a raiz vale nos 7 dias e nenhuma variação é inventada', () => {
    const c = raiz();
    for (let dia = 1; dia <= 7; dia++) {
      expect(refeicoesDoDia(c, dia)).toBe(c.refeicoes);
      expect(variacaoDoDia(c, dia)).toBeNull();
    }
    expect(diasSemVariacao(c)).toEqual([]);
  });

  it('o dia certo cai na variação certa', () => {
    const c = duas();
    expect(variacaoDoDia(c, 1)?.uid).toBe('alto');
    expect(variacaoDoDia(c, 4)?.uid).toBe('zero');
    expect(refeicoesDoDia(c, 7)[0].uid).toBe('a');
    expect(refeicoesDoDia(c, 6)[0].uid).toBe('z');
  });

  it('dia descoberto não tem variação nem refeições (e a raiz não entra)', () => {
    const c = duas();
    c.variacoes[1].dias = [2, 4];
    expect(variacaoDoDia(c, 6)).toBeNull();
    expect(refeicoesDoDia(c, 6)).toEqual([]);
    expect(diasSemVariacao(c)).toEqual([6]);
  });

  it('secoesDaDieta: uma seção com os 7 dias sem variações; uma por variação com elas', () => {
    expect(secoesDaDieta(raiz())).toEqual([{ uid: null, rotulo: null, dias: [1, 2, 3, 4, 5, 6, 7], refeicoes: raiz().refeicoes }]);
    expect(secoesDaDieta(duas()).map((s) => [s.uid, s.rotulo, s.dias])).toEqual([
      ['alto', 'Dia de carbo alto', [1, 3, 5, 7]],
      ['zero', 'Zero carbo', [2, 4, 6]],
    ]);
  });
});

describe('alternarDia', () => {
  it('marcar o dia tira o dia da outra variação; desmarcar só tira', () => {
    const c = alternarDia(duas(), 'zero', 1);
    expect(c.variacoes[0].dias).toEqual([3, 5, 7]);
    expect(c.variacoes[1].dias).toEqual([1, 2, 4, 6]);
    expect(alternarDia(c, 'zero', 1).variacoes.map((v) => v.dias)).toEqual([[3, 5, 7], [2, 4, 6]]);
  });

  it('uid desconhecido ou dia fora de 1 a 7 não muda nada', () => {
    const c = duas();
    expect(alternarDia(c, 'nao-existe', 1)).toBe(c);
    expect(alternarDia(c, 'zero', 0)).toBe(c);
    expect(alternarDia(c, 'zero', 8)).toBe(c);
    expect(alternarDia(c, 'zero', 1.5)).toBe(c);
  });

  it('não repete dia dentro da variação (nunca)', () => {
    let c = duas();
    for (const dia of [1, 1, 3, 3, 3]) c = alternarDia(c, 'zero', dia);
    const todos = c.variacoes.flatMap((v) => v.dias);
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe('duplicarVariacao e criarVariacoes', () => {
  it('duplicar: logo depois, uids novos, dias vazios e rótulo "(cópia)"; a original não muda', () => {
    const c = duas();
    const d = duplicarVariacao(c, 'alto');
    expect(d.variacoes.map((v) => v.uid)).toEqual(['alto', 'novo-1', 'zero']);
    const copia = d.variacoes[1];
    expect(copia).toMatchObject({ rotulo: 'Dia de carbo alto (cópia)', dias: [] });
    expect(copia.refeicoes[0].uid).not.toBe('a');
    expect(copia.refeicoes[0].opcoes[0].uid).not.toBe('o-a');
    expect(copia.refeicoes[0].opcoes[0].itens[0].uid).not.toBe('i-a');
    expect(copia.refeicoes[0].opcoes[0].itens[0].nome).toBe('Item (fictício)');
    expect(d.variacoes[0]).toBe(c.variacoes[0]);
    expect(copia.refeicoes[0]).not.toBe(c.variacoes[0].refeicoes[0]);
  });

  it('duplicar mantém o rótulo dentro de 40 caracteres e respeita o limite de 7 variações', () => {
    const c = duas();
    c.variacoes[0].rotulo = 'x'.repeat(ROTULO_MAXIMO);
    expect(duplicarVariacao(c, 'alto').variacoes[1].rotulo).toHaveLength(ROTULO_MAXIMO);
    let cheia = c;
    for (let i = c.variacoes.length; i < LIMITE_DE_VARIACOES; i++) cheia = duplicarVariacao(cheia, 'zero');
    expect(cheia.variacoes).toHaveLength(LIMITE_DE_VARIACOES);
    expect(duplicarVariacao(cheia, 'zero')).toBe(cheia);
    expect(duplicarVariacao(c, 'nao-existe')).toBe(c);
  });

  it('criar variações move a raiz para a variação 1 com os 7 dias e deixa a raiz vazia', () => {
    const c = criarVariacoes(raiz());
    expect(c.refeicoes).toEqual([]);
    expect(c.variacoes).toHaveLength(1);
    expect(c.variacoes[0]).toMatchObject({ rotulo: 'Variação 1', dias: [1, 2, 3, 4, 5, 6, 7] });
    expect(c.variacoes[0].refeicoes[0].uid).toBe('raiz');
    expect(diasSemVariacao(c)).toEqual([]);
    expect(criarVariacoes(c)).toBe(c);
  });
});

describe('dia de hoje em Brasília (relógio falso)', () => {
  // Brasília = UTC-3, sem horário de verão.
  it('23:59 e 00:01 de Brasília caem em dias diferentes, qualquer que seja o fuso do aparelho', () => {
    // 2026-11-16 é segunda-feira (1); 2026-11-17, terça (2).
    expect(diaDeHojeEmBrasilia(new Date('2026-11-17T02:59:00Z'))).toBe(1); // 23:59 de segunda em Brasília
    expect(diaDeHojeEmBrasilia(new Date('2026-11-17T03:01:00Z'))).toBe(2); // 00:01 de terça em Brasília
  });

  it('domingo vale 7 e a virada de domingo para segunda vale 7 e 1', () => {
    expect(diaDeHojeEmBrasilia(new Date('2026-11-22T12:00:00Z'))).toBe(7);
    expect(diaDeHojeEmBrasilia(new Date('2026-11-23T02:59:00Z'))).toBe(7);
    expect(diaDeHojeEmBrasilia(new Date('2026-11-23T03:01:00Z'))).toBe(1);
  });
});
