import { LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { colunasDaAbaDados, COLUNAS_DA_FICHA, emDuasColunas, larguraMaximaDasColunas, ordemNumaColuna, pilhasDaAba, PROPORCAO_DAS_COLUNAS, resumoEmTresColunas, TRES_COLUNAS_DA_FICHA } from './colunasDaFicha';
import type { BlocoDaFicha } from './fichaDoAluno';

// ficha: colunas independentes (24/11)
const TODOS: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp', 'planoContratado', 'anamnese', 'lesoes'];
// Larguras medidas da aba com o menu aberto: 1280 (~928), 1920 (~1632), 2560 (~2272) e 3440 (~3150).
const VAO = 24;

describe('colunasDaFicha', () => {
  it('as duas e as três colunas na ordem pedida, cada peça num lugar só', () => {
    expect(COLUNAS_DA_FICHA.esquerda).toEqual(['identificacao', 'contato', 'planoContratado', 'lesoes']);
    expect(COLUNAS_DA_FICHA.direita).toEqual(['acompanhamento', 'objetivo', 'acessoAoApp', 'anamnese']);
    expect(TRES_COLUNAS_DA_FICHA).toEqual([
      ['identificacao', 'contato', 'objetivo'], ['planoContratado', 'lesoes'], ['acompanhamento', 'acessoAoApp', 'anamnese'],
    ]);
    for (const todas of [[...COLUNAS_DA_FICHA.esquerda, ...COLUNAS_DA_FICHA.direita], TRES_COLUNAS_DA_FICHA.flat()]) {
      expect(new Set(todas).size).toBe(8);
      expect(todas).toHaveLength(8);
    }
  });

  it('uma proporção para a página toda em duas colunas: 3 para 2', () => {
    expect(PROPORCAO_DAS_COLUNAS.esquerda / PROPORCAO_DAS_COLUNAS.direita).toBe(1.5);
  });

  it('duas colunas a partir da faixa normal', () => {
    expect(emDuasColunas('compacta')).toBe(false);
    expect(emDuasColunas('normal')).toBe(true);
    expect(emDuasColunas('larga')).toBe(true);
    expect(emDuasColunas('ultralarga')).toBe(true);
  });

  it('compacta: nenhuma coluna (a ordem do celular), mesmo com a aba larga', () => {
    expect(colunasDaAbaDados('compacta', 3000, VAO, TODOS)).toBeNull();
  });

  it('duas colunas (1280, 1920): seções e depois os blocos de cada uma, 3:2', () => {
    for (const largura of [928, 1632, 3 * 640 + 2 * VAO - 1]) {
      expect(colunasDaAbaDados('larga', largura, VAO, TODOS)).toEqual([
        { secoes: ['identificacao', 'contato'], blocos: ['planoContratado', 'lesoes'], proporcao: 3 },
        { secoes: ['acompanhamento', 'objetivo'], blocos: ['acessoAoApp', 'anamnese'], proporcao: 2 },
      ]);
    }
  });

  it('três colunas pela largura medida (2560 e 3440 com o menu aberto), não pela faixa', () => {
    const tres = [
      { secoes: ['identificacao', 'contato', 'objetivo'], blocos: [], proporcao: 1 },
      { secoes: [], blocos: ['planoContratado', 'lesoes'], proporcao: 1.2 },
      { secoes: ['acompanhamento'], blocos: ['acessoAoApp', 'anamnese'], proporcao: 1 },
    ];
    // 2560 com o menu aberto é a faixa `larga` (~2368 px de área): a largura decide.
    expect(colunasDaAbaDados('larga', 2272, VAO, TODOS)).toEqual(tres);
    expect(colunasDaAbaDados('ultralarga', 3150, VAO, TODOS)).toEqual(tres);
    expect(colunasDaAbaDados('larga', 3 * 640 + 2 * VAO, VAO, TODOS)).toHaveLength(3);
  });

  it('só os blocos que a aba mostra, na ordem da coluna (não a de `blocos`)', () => {
    expect(colunasDaAbaDados('larga', 1632, VAO, ['lesoes', 'dadosDoAluno', 'planoContratado'])?.[0].blocos).toEqual(['planoContratado', 'lesoes']);
    // Sem o financeiro: a coluna do meio fica só com as lesões, e as três continuam.
    expect(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp', 'lesoes'])?.map((c) => c.blocos)).toEqual([[], ['lesoes'], ['acessoAoApp']]);
  });

  it('a coluna do meio vazia (sem financeiro nem lesões) volta às duas colunas de 3:2', () => {
    expect(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp'])).toEqual([
      { secoes: ['identificacao', 'contato'], blocos: [], proporcao: 3 },
      { secoes: ['acompanhamento', 'objetivo'], blocos: ['acessoAoApp'], proporcao: 2 },
    ]);
  });

  it('sem os Dados na aba, as colunas ficam só com os blocos; a primeira das três, vazia, volta às duas', () => {
    expect(colunasDaAbaDados('larga', 2272, VAO, ['acessoAoApp', 'planoContratado', 'lesoes'])).toEqual([
      { secoes: [], blocos: ['planoContratado', 'lesoes'], proporcao: 3 },
      { secoes: [], blocos: ['acessoAoApp'], proporcao: 2 },
    ]);
  });

  it('numa coluna: lesões ativas no topo, plano, acesso, anamnese e as recuperadas no fim', () => {
    expect(ordemNumaColuna(TODOS)).toEqual(['lesoesAtivas', 'planoContratado', 'acessoAoApp', 'anamnese', 'lesoesRecuperadas']);
    expect(ordemNumaColuna(['dadosDoAluno', 'acessoAoApp'])).toEqual(['acessoAoApp']);
    expect(ordemNumaColuna(['acessoAoApp', 'lesoes'])).toEqual(['lesoesAtivas', 'acessoAoApp', 'lesoesRecuperadas']);
  });

  it('teto: a aba no editor de campos em duas colunas, a soma de três no arranjo de três, sem teto numa coluna', () => {
    expect(larguraMaximaDasColunas(null, VAO)).toBeUndefined();
    expect(larguraMaximaDasColunas(colunasDaAbaDados('normal', 928, VAO, TODOS), VAO)).toBe(LARGURA_EDITOR_DE_CAMPOS);
    expect(larguraMaximaDasColunas(colunasDaAbaDados('larga', 1632, VAO, TODOS), VAO)).toBe(LARGURA_EDITOR_DE_CAMPOS);
    expect(larguraMaximaDasColunas(colunasDaAbaDados('ultralarga', 3150, VAO, TODOS), VAO)).toBe(3 * LARGURA_EDITOR_DE_CAMPOS + 2 * VAO);
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
