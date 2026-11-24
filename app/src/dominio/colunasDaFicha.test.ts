import { LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { blocosDaColuna, COLUNAS_DA_FICHA, emDuasColunas, larguraMaximaDasColunas, ordemNumaColuna, PROPORCAO_DAS_COLUNAS } from './colunasDaFicha';
import type { BlocoDaFicha } from './fichaDoAluno';

// ficha: colunas independentes (24/11)
const TODOS: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp', 'planoContratado', 'anamnese', 'lesoes'];

describe('colunasDaFicha', () => {
  it('as duas colunas na ordem pedida, uma peça em cada lugar', () => {
    expect(COLUNAS_DA_FICHA.esquerda).toEqual(['identificacao', 'contato', 'planoContratado', 'lesoes']);
    expect(COLUNAS_DA_FICHA.direita).toEqual(['acompanhamento', 'objetivo', 'acessoAoApp', 'anamnese']);
    const todas = [...COLUNAS_DA_FICHA.esquerda, ...COLUNAS_DA_FICHA.direita];
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('uma proporção para a página toda: 3 para 2', () => {
    expect(PROPORCAO_DAS_COLUNAS.esquerda / PROPORCAO_DAS_COLUNAS.direita).toBe(1.5);
  });

  it('duas colunas a partir da faixa normal', () => {
    expect(emDuasColunas('compacta')).toBe(false);
    expect(emDuasColunas('normal')).toBe(true);
    expect(emDuasColunas('larga')).toBe(true);
    expect(emDuasColunas('ultralarga')).toBe(true);
  });

  it('blocos de cada coluna depois das seções, só os que a aba mostra, na ordem da coluna', () => {
    expect(blocosDaColuna('esquerda', TODOS)).toEqual(['planoContratado', 'lesoes']);
    expect(blocosDaColuna('direita', TODOS)).toEqual(['acessoAoApp', 'anamnese']);
    // Sem o financeiro e sem o dado sensível: a esquerda fica só com as seções (curta) e a direita com o acesso.
    expect(blocosDaColuna('esquerda', ['dadosDoAluno', 'acessoAoApp'])).toEqual([]);
    expect(blocosDaColuna('direita', ['dadosDoAluno', 'acessoAoApp'])).toEqual(['acessoAoApp']);
    // A ordem é a da coluna, não a de `blocos`.
    expect(blocosDaColuna('esquerda', ['lesoes', 'planoContratado'])).toEqual(['planoContratado', 'lesoes']);
  });

  it('numa coluna: lesões ativas no topo, plano, acesso, anamnese e as recuperadas no fim', () => {
    expect(ordemNumaColuna(TODOS)).toEqual(['lesoesAtivas', 'planoContratado', 'acessoAoApp', 'anamnese', 'lesoesRecuperadas']);
    expect(ordemNumaColuna(['dadosDoAluno', 'acessoAoApp'])).toEqual(['acessoAoApp']);
    expect(ordemNumaColuna(['acessoAoApp', 'lesoes'])).toEqual(['lesoesAtivas', 'acessoAoApp', 'lesoesRecuperadas']);
  });

  it('teto só na ultralarga, com a largura do editor de campos', () => {
    expect(larguraMaximaDasColunas('normal')).toBeUndefined();
    expect(larguraMaximaDasColunas('larga')).toBeUndefined();
    expect(larguraMaximaDasColunas('ultralarga')).toBe(LARGURA_EDITOR_DE_CAMPOS);
  });
});
