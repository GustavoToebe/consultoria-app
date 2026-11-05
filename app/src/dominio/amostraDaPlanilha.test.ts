import type { AlunoDaAmostra } from '../api/tipos';
import {
  FICA_DE_FORA, SELO_IGNORADO, SELO_INCLUIDO, TODOS_IGNORADOS, alternarIgnorado, resumoDosIgnorados, todosIgnorados, contarDieta, faixaDaAmostra, foraDaBiblioteca, pesosDoMaisRecente, restantesDaAmostra, resumoDoAluno, rotuloDosProximos,
  situacaoDoAluno, textoDaDieta, textoDaPasta, textoDaRefeicao, textoDoAtivo, textoDoCadastroExistente, textoDoExercicio, textoDoItem, textoDoPeso, textoDosPesos,
  textoDoSuplemento, textoDoTreino, valorDoCampo,
} from './amostraDaPlanilha';
import { etapasDaPlanilha } from './planilhaCompleta';

/** Dados fictícios. */
const ALUNO: AlunoDaAmostra = {
  numero: 3, situacao: 'NOVO', nome: 'Aluna Fictícia', ativo: true, email: null, telefone: null, objetivo: null, observacoes: null,
  pesos: 12, ultimosPesos: [{ data: '2026-09-01', kg: 70 }, { data: '2026-10-01', kg: 71.25 }],
  treino: { objetivo: null, orientacoes: null, sessoes: [{
    uid: 's', nome: 'A', diaSemana: null, tipo: 'TREINO' as never, frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
    exercicios: [
      { uid: 'e1', exercicioId: null, nome: 'Remada fictícia', modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series: [{} as never, {} as never] },
      { uid: 'e2', exercicioId: 'x', nome: 'Supino', modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series: [{} as never] },
    ],
  }] },
  dieta: null,
};

describe('amostra da planilha', () => {
  it('a faixa, os que faltam e o rótulo do botão', () => {
    expect(faixaDaAmostra({ total: 12, inicio: 5, alunos: [ALUNO, ALUNO, ALUNO, ALUNO, ALUNO] })).toBe('Alunos 6 a 10 de 12');
    expect(faixaDaAmostra({ total: 11, inicio: 10, alunos: [ALUNO] })).toBe('Aluno 11 de 11');
    expect(faixaDaAmostra({ total: 0, inicio: 0, alunos: [] })).toBe('Nenhum aluno para mostrar.');
    expect(restantesDaAmostra({ total: 12, inicio: 0, alunos: [ALUNO, ALUNO, ALUNO, ALUNO, ALUNO] })).toBe(5);
    expect(restantesDaAmostra({ total: 12, inicio: 5, alunos: [ALUNO, ALUNO, ALUNO, ALUNO, ALUNO] })).toBe(2);
    expect(restantesDaAmostra({ total: 12, inicio: 10, alunos: [ALUNO, ALUNO] })).toBe(0);
    expect(rotuloDosProximos(1)).toBe('Ver o próximo');
    expect(rotuloDosProximos(5)).toBe('Ver os próximos 5');
  });

  it('o texto fixo usa a pasta que a API mandou', () => {
    expect(textoDaPasta('Importada da planilha (rascunho)')).toBe(
      'Tudo entra em rascunho na pasta “Importada da planilha (rascunho)”; nada é publicado; aluno que já existe só ganha mais uma pasta.');
  });

  it('cadastro: ausente é "—" e a parte que o perfil não grava diz que fica de fora', () => {
    expect(situacaoDoAluno(ALUNO)).toBe('Novo');
    expect(situacaoDoAluno({ situacao: 'EXISTENTE' })).toBe('Já é seu aluno');
    expect(textoDoAtivo(true)).toBe('Ativo');
    expect(textoDoAtivo(false)).toBe('Inativo');
    expect(textoDoAtivo(null)).toBe('—');
    expect(valorDoCampo(null)).toBe('—');
    expect(valorDoCampo('  ')).toBe('—');
    expect(valorDoCampo(null, true)).toBe(FICA_DE_FORA);
    expect(valorDoCampo('Ganhar força', true)).toBe('Ganhar força');
  });

  it('pesos: do mais recente ao mais antigo, com o total', () => {
    expect(pesosDoMaisRecente(ALUNO).map(textoDoPeso)).toEqual(['01/10/2026 · 71,25 kg', '01/09/2026 · 70 kg']);
    expect(textoDosPesos(ALUNO)).toBe('12 pesos para gravar; os 2 mais recentes:');
    expect(textoDosPesos({ pesos: 1, ultimosPesos: [{ data: '2026-10-01', kg: 70 }] })).toBe('1 peso para gravar:');
  });

  it('treino e dieta: só contam o que veio', () => {
    expect(textoDoTreino(ALUNO.treino!)).toBe('1 sessão · 2 exercícios · 3 séries');
    expect(textoDoExercicio(ALUNO.treino!.sessoes[0].exercicios[0])).toBe('Remada fictícia · 2 séries');
    expect(foraDaBiblioteca(ALUNO.treino!.sessoes[0].exercicios[0])).toBe(true);
    expect(foraDaBiblioteca(ALUNO.treino!.sessoes[0].exercicios[1])).toBe(false);
    const item = { nome: 'Arroz fictício', quantidade: 100, unidade: 'g' as const };
    const dieta = {
      refeicoes: [{ opcoes: [{ itens: [item, item] }, { itens: [item] }] }, { opcoes: [] }],
      suplementacao: [{}], ergogenicos: null,
    } as never;
    expect(textoDaDieta(contarDieta(dieta))).toBe('2 refeições · 3 itens · 1 suplemento');
    expect(textoDaDieta({ refeicoes: 1, itens: 0, suplementos: 0, ergogenicos: 2 })).toBe('1 refeição · 0 itens · 0 suplementos · 2 medicações ou ergogênicos');
    expect(textoDoItem(item)).toBe('Arroz fictício · 100 g');
    expect(textoDoItem({ ...item, quantidade: null })).toBe('Arroz fictício · —');
    expect(textoDaRefeicao({ nome: 'Almoço', horario: '12:00' })).toBe('Almoço · 12:00');
    expect(textoDaRefeicao({ nome: 'Almoço', horario: null })).toBe('Almoço');
    expect(textoDoSuplemento({ nome: 'Creatina', dose: '' })).toBe('Creatina · —');
  });

  it('o resumo do cabeçalho do aluno', () => {
    expect(resumoDoAluno(ALUNO)).toBe('Nº 3 no arquivo · 12 pesos · treino com 1 sessão');
    expect(resumoDoAluno({ ...ALUNO, pesos: 0, treino: null })).toBe('Nº 3 no arquivo');
  });

  it('aluno que já existe e só recebe pesos: sem treino nem dieta, sem pasta', () => {
    const soPesos: AlunoDaAmostra = {
      ...ALUNO, situacao: 'EXISTENTE', ativo: null, treino: null, dieta: null, pesos: 2,
      ultimosPesos: [{ data: '2026-09-01', kg: 70 }, { data: '2026-10-01', kg: 71.25 }],
    };
    expect(situacaoDoAluno(soPesos)).toBe('Já é seu aluno');
    expect(resumoDoAluno(soPesos)).toBe('Nº 3 no arquivo · 2 pesos');
    expect(textoDosPesos(soPesos)).toBe('2 pesos para gravar:');
    expect(textoDoAtivo(soPesos.ativo)).toBe('—');
    expect(textoDoCadastroExistente(soPesos)).toBe('Já é seu aluno: o cadastro não muda. Só ganha os pesos abaixo, sem pasta nem plano.');
    expect(textoDoCadastroExistente({ treino: ALUNO.treino, dieta: null })).toContain('mais uma pasta');
  });

  it('as etapas: sem a amostra ficam as cinco de antes', () => {
    expect(etapasDaPlanilha(false).map((e) => e.rotulo)).toEqual(['Arquivo', 'Abas', 'Nomes', 'Prévia', 'Resultado']);
    expect(etapasDaPlanilha(true).map((e) => e.etapa)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(etapasDaPlanilha(false).at(-1)?.etapa).toBe(6);
  });
});

describe('alunos ignorados na amostra', () => {
  it('alterna o aluno na lista, em ordem e sem repetir', () => {
    expect(alternarIgnorado([], 3)).toEqual([3]);
    expect(alternarIgnorado([3], 1)).toEqual([1, 3]);
    expect(alternarIgnorado([1, 3], 3)).toEqual([1]);
    const original = [2];
    alternarIgnorado(original, 5);
    expect(original).toEqual([2]); // não muda a lista que recebeu
  });

  it('a faixa diz quantos entram e quantos ficam de fora; sem ignorados não diz nada', () => {
    expect(resumoDosIgnorados(7, [])).toBe('');
    expect(resumoDosIgnorados(7, [2])).toBe('6 alunos serão importados · 1 ignorado');
    expect(resumoDosIgnorados(2, [1])).toBe('1 aluno será importado · 1 ignorado');
    expect(resumoDosIgnorados(3, [1, 2, 3])).toBe('0 alunos serão importados · 3 ignorados');
  });

  it('ignorar todos trava a confirmação (a API responderia 422)', () => {
    expect(todosIgnorados(3, [1, 2])).toBe(false);
    expect(todosIgnorados(3, [1, 2, 3])).toBe(true);
    expect(todosIgnorados(0, [])).toBe(false);
    expect(TODOS_IGNORADOS).toBe('Marque pelo menos um aluno para importar.');
    expect([SELO_INCLUIDO, SELO_IGNORADO]).toEqual(['Incluído', 'Ignorado nesta importação']);
  });
});
