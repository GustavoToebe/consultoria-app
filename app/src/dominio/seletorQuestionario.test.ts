import type { OpcaoQuestionario } from '../api/tipos';
import { opcoesDoSeletor, textoDoQuestionarioEscolhido } from './seletorQuestionario';

const OPCOES: OpcaoQuestionario[] = [
  { id: 'a', nome: 'Padrão', padrao: true },
  { id: 'b', nome: 'Mensal', padrao: false },
];

describe('seletor de questionário', () => {
  it('a primeira opção é a sem escolha e só o padrão leva detalhe', () => {
    const lista = opcoesDoSeletor(OPCOES, 'O do aluno');
    expect(lista.map((o) => o.valor)).toEqual([null, 'a', 'b']);
    expect(lista[0].rotulo).toBe('O do aluno');
    expect(lista[1].detalhe).toBe('Padrão da consultoria');
    expect(lista[2].detalhe).toBeUndefined();
  });

  it('mostra o rótulo do nulo, o nome escolhido ou avisa que o escolhido não vale mais', () => {
    expect(textoDoQuestionarioEscolhido(null, OPCOES, 'O do aluno')).toBe('O do aluno');
    expect(textoDoQuestionarioEscolhido(undefined, OPCOES, 'O do aluno')).toBe('O do aluno');
    expect(textoDoQuestionarioEscolhido('b', OPCOES, 'O do aluno')).toBe('Mensal');
    expect(textoDoQuestionarioEscolhido('arquivado', OPCOES, 'Padrão da consultoria')).toBe('Arquivado; vale: Padrão da consultoria');
  });
});
