import { LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { blocosDaColuna, COLUNAS_DA_FICHA, emDuasColunas, larguraMaximaDasColunas, ordemNumaColuna, pilhasDaAba, PROPORCAO_DAS_COLUNAS, resumoEmTresColunas } from './colunasDaFicha';
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

  it('teto do editor de campos sempre que há duas colunas (tela larga, 24/11); numa coluna, sem teto', () => {
    expect(larguraMaximaDasColunas('compacta')).toBeUndefined();
    expect(larguraMaximaDasColunas('normal')).toBe(LARGURA_EDITOR_DE_CAMPOS);
    expect(larguraMaximaDasColunas('larga')).toBe(LARGURA_EDITOR_DE_CAMPOS);
    expect(larguraMaximaDasColunas('ultralarga')).toBe(LARGURA_EDITOR_DE_CAMPOS);
  });

  it('Resumo em três colunas pela largura medida: 2560 abre, 1920 não', () => {
    expect(resumoEmTresColunas(0, 24)).toBe(false);
    expect(resumoEmTresColunas(1632, 24)).toBe(false);
    expect(resumoEmTresColunas(3 * 640 + 48 - 1, 24)).toBe(false);
    expect(resumoEmTresColunas(3 * 640 + 48, 24)).toBe(true);
    expect(resumoEmTresColunas(2272, 24)).toBe(true);
  });

  it('pilhas do Acompanhamento e da Evolução só com 1000 px em cada, na ordem de cada pilha', () => {
    const acompanhamento: BlocoDaFicha[] = ['frequencia', 'agua', 'treinosConcluidos', 'recordesDaSemana', 'trocasDeExercicio', 'evolucaoDasRespostas'];
    expect(pilhasDaAba('acompanhamento', acompanhamento, 1632, 24)).toBeNull();
    expect(pilhasDaAba('acompanhamento', acompanhamento, 2023, 24)).toBeNull();
    expect(pilhasDaAba('acompanhamento', acompanhamento, 2024, 24)).toEqual({
      esquerda: ['frequencia', 'treinosConcluidos', 'recordesDaSemana', 'trocasDeExercicio'], direita: ['agua', 'evolucaoDasRespostas'],
    });
    expect(pilhasDaAba('evolucao', ['peso', 'progresso', 'avaliacaoFisica', 'fotos'], 2272, 24)).toEqual({
      esquerda: ['peso', 'progresso', 'fotos'], direita: ['avaliacaoFisica'],
    });
  });

  it('pilhas: sem um dos lados, uma coluna; Planos e Ficha não têm pilhas', () => {
    // Sem ALUNO_SENSIVEL_LER: Evolução só com o progresso.
    expect(pilhasDaAba('evolucao', ['progresso'], 3000, 24)).toBeNull();
    // Sem água nem respostas (sem dado sensível): a direita ficaria vazia.
    expect(pilhasDaAba('acompanhamento', ['frequencia', 'trocasDeExercicio'], 3000, 24)).toBeNull();
    expect(pilhasDaAba('planos', ['pastas'], 3000, 24)).toBeNull();
    expect(pilhasDaAba('ficha', ['dadosDoAluno', 'acessoAoApp'], 3000, 24)).toBeNull();
  });
});
