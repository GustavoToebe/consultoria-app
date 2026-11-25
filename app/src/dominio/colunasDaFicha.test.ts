import { LARGURA_EDITOR_DE_CAMPOS } from '../tema/tokens';
import { ABAIXO_DAS_DUAS_COLUNAS, abaixoDasColunas, colunaUnica, colunasDaAbaDados, COLUNAS_DA_FICHA, emDuasColunas, larguraMaximaDasColunas, ordemNumaColuna, pilhasDaAba, PROPORCAO_DAS_COLUNAS, resumoEmTresColunas, tetoDaColunaUnica, TRES_COLUNAS_DA_FICHA } from './colunasDaFicha';
import type { BlocoDaFicha } from './fichaDoAluno';

// ficha: colunas independentes (24/11)
const TODOS: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp', 'planoContratado', 'anamnese', 'lesoes'];
// Larguras medidas da aba com o menu aberto: 1280 (~928), 1920 (~1632), 2560 (~2272) e 3440 (~3150).
const VAO = 24;

describe('colunasDaFicha', () => {
  it('as duas e as três colunas na ordem pedida, cada peça num lugar só', () => {
    expect(COLUNAS_DA_FICHA.esquerda).toEqual(['identificacao', 'contato', 'planoContratado']);
    expect(COLUNAS_DA_FICHA.direita).toEqual(['acompanhamento', 'objetivo', 'acessoAoApp', 'anamnese']);
    expect(ABAIXO_DAS_DUAS_COLUNAS).toEqual(['lesoes']);
    expect(TRES_COLUNAS_DA_FICHA).toEqual([
      ['identificacao', 'contato', 'objetivo'], ['planoContratado', 'lesoes'], ['acompanhamento', 'acessoAoApp', 'anamnese'],
    ]);
    for (const todas of [[...COLUNAS_DA_FICHA.esquerda, ...COLUNAS_DA_FICHA.direita, ...ABAIXO_DAS_DUAS_COLUNAS], TRES_COLUNAS_DA_FICHA.flat()]) {
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

  it('duas colunas (1280, 1920): seções e depois os blocos de cada uma, 3:2, e o Histórico de lesões abaixo das duas', () => {
    for (const largura of [928, 1632, 3 * 640 + 2 * VAO - 1]) {
      const colunas = colunasDaAbaDados('larga', largura, VAO, TODOS);
      expect(colunas).toEqual([
        { secoes: ['identificacao', 'contato'], blocos: ['planoContratado'], proporcao: 3 },
        { secoes: ['acompanhamento', 'objetivo'], blocos: ['acessoAoApp', 'anamnese'], proporcao: 2 },
      ]);
      expect(abaixoDasColunas(colunas, TODOS)).toEqual(['lesoes']);
    }
  });

  it('abaixo das colunas: só em duas e só com as lesões na aba; em três elas seguem na do meio, numa coluna na ordem do celular', () => {
    expect(abaixoDasColunas(colunasDaAbaDados('normal', 928, VAO, ['dadosDoAluno', 'acessoAoApp']), ['dadosDoAluno', 'acessoAoApp'])).toEqual([]);
    const tres = colunasDaAbaDados('larga', 2272, VAO, TODOS);
    expect(abaixoDasColunas(tres, TODOS)).toEqual([]);
    expect(tres?.[1].blocos).toEqual(['planoContratado', 'lesoes']);
    expect(abaixoDasColunas(null, TODOS)).toEqual([]);
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
    expect(colunasDaAbaDados('larga', 1632, VAO, ['lesoes', 'dadosDoAluno', 'planoContratado'])?.[0].blocos).toEqual(['planoContratado']);
    // Sem o financeiro: a coluna do meio fica só com as lesões, e as três continuam.
    expect(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp', 'lesoes'])?.map((c) => c.blocos)).toEqual([[], ['lesoes'], ['acessoAoApp']]);
  });

  it('a coluna do meio vazia (sem financeiro nem lesões) volta às duas colunas de 3:2', () => {
    expect(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp'])).toEqual([
      { secoes: ['identificacao', 'contato'], blocos: [], proporcao: 3 },
      { secoes: ['acompanhamento', 'objetivo'], blocos: ['acessoAoApp'], proporcao: 2 },
    ]);
  });

  it('sem os Dados na aba, as colunas ficam só com os blocos; a primeira das três, vazia, volta às duas (lesões embaixo)', () => {
    const blocos: BlocoDaFicha[] = ['acessoAoApp', 'planoContratado', 'lesoes'];
    const colunas = colunasDaAbaDados('larga', 2272, VAO, blocos);
    expect(colunas).toEqual([
      { secoes: [], blocos: ['planoContratado'], proporcao: 3 },
      { secoes: [], blocos: ['acessoAoApp'], proporcao: 2 },
    ]);
    expect(abaixoDasColunas(colunas, blocos)).toEqual(['lesoes']);
  });

  it('numa coluna: lesões ativas no topo, plano, acesso, anamnese e as recuperadas no fim', () => {
    expect(ordemNumaColuna(TODOS)).toEqual(['lesoesAtivas', 'planoContratado', 'acessoAoApp', 'anamnese', 'lesoesRecuperadas']);
    expect(ordemNumaColuna(['dadosDoAluno', 'acessoAoApp'])).toEqual(['acessoAoApp']);
    expect(ordemNumaColuna(['acessoAoApp', 'lesoes'])).toEqual(['lesoesAtivas', 'acessoAoApp', 'lesoesRecuperadas']);
  });

  it('teto: sem teto em duas colunas (normal e larga), o do editor de campos se a ultralarga volta às duas, a soma de três no arranjo de três', () => {
    expect(larguraMaximaDasColunas(null, VAO, 'compacta')).toBeUndefined();
    // D1 (25/11): em 1280 e 1920 as duas colunas ocupam a largura do conteúdo (só a `Tela` limita).
    expect(larguraMaximaDasColunas(colunasDaAbaDados('normal', 928, VAO, TODOS), VAO, 'normal')).toBeUndefined();
    expect(larguraMaximaDasColunas(colunasDaAbaDados('larga', 1632, VAO, TODOS), VAO, 'larga')).toBeUndefined();
    // 2560 com o menu aberto (larga) com a do meio vazia: duas colunas na largura toda.
    expect(larguraMaximaDasColunas(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp']), VAO, 'larga')).toBeUndefined();
    expect(larguraMaximaDasColunas(colunasDaAbaDados('ultralarga', 3150, VAO, ['dadosDoAluno', 'acessoAoApp']), VAO, 'ultralarga')).toBe(LARGURA_EDITOR_DE_CAMPOS);
    expect(larguraMaximaDasColunas(colunasDaAbaDados('ultralarga', 3150, VAO, TODOS), VAO, 'ultralarga')).toBe(3 * LARGURA_EDITOR_DE_CAMPOS + 2 * VAO);
  });

  it('coluna única: só com a esquerda vazia em duas colunas (na leitura as seções 1 e 2 a seguram)', () => {
    const SEM_PLANO: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp', 'anamnese', 'lesoes'];
    const SEM_SENSIVEL: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp', 'planoContratado'];
    const SEM_OS_DOIS: BlocoDaFicha[] = ['dadosDoAluno', 'acessoAoApp'];
    for (const largura of [928, 1632]) {
      // Leitura: sem plano contratado, sem sensível ou sem os dois, a esquerda continua com Identificação e Contato.
      for (const blocos of [TODOS, SEM_PLANO, SEM_SENSIVEL, SEM_OS_DOIS]) expect(colunaUnica(colunasDaAbaDados('normal', largura, VAO, blocos), false)).toBe(false);
      // Edição: as seções saem; sem o Plano contratado a esquerda fica vazia.
      expect(colunaUnica(colunasDaAbaDados('normal', largura, VAO, SEM_PLANO), true)).toBe(true);
      expect(colunaUnica(colunasDaAbaDados('normal', largura, VAO, SEM_OS_DOIS), true)).toBe(true);
      expect(colunaUnica(colunasDaAbaDados('normal', largura, VAO, SEM_SENSIVEL), true)).toBe(false);
      expect(colunaUnica(colunasDaAbaDados('normal', largura, VAO, TODOS), true)).toBe(false);
    }
    // Sem os Dados na aba nem o plano, também na leitura.
    expect(colunaUnica(colunasDaAbaDados('larga', 1632, VAO, ['acessoAoApp', 'lesoes']), false)).toBe(true);
    // Três pilhas com a do meio vazia (sem financeiro nem lesões) voltam às duas: na edição, também a coluna única.
    expect(colunaUnica(colunasDaAbaDados('larga', 2272, VAO, ['dadosDoAluno', 'acessoAoApp']), true)).toBe(true);
    // Três colunas e compacta não mudam.
    expect(colunaUnica(colunasDaAbaDados('larga', 2272, VAO, TODOS), true)).toBe(false);
    expect(colunaUnica(null, true)).toBe(false);
  });

  it('teto da coluna única: a largura da esquerda (3/5) no arranjo de duas com a mesma aba, sem o teto de 1400', () => {
    expect(tetoDaColunaUnica(928, VAO)).toBeCloseTo(542.4);
    expect(tetoDaColunaUnica(1632, VAO)).toBeCloseTo(964.8);
    expect(tetoDaColunaUnica(LARGURA_EDITOR_DE_CAMPOS, VAO)).toBeCloseTo((LARGURA_EDITOR_DE_CAMPOS - VAO) * 0.6);
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
