import type { ConteudoQuestionario, PerguntaAtualizacao } from '../api/tipos';
import { agruparProblemas } from './editorQuestionario';
import { arranjoDoEditor, chaveDaSecao, itensDoIndice, itemVisivel, quantasPerguntas, secaoDaChave } from './indiceDoQuestionario';

const p = (id: string): PerguntaAtualizacao => ({ id, tipo: 'TEXTO', rotulo: `Pergunta ${id}`, obrigatoria: false });
const conteudo: ConteudoQuestionario = {
  formato: 2, instrucoes: ['Leia antes.'],
  secoes: [{ uid: 's1', titulo: 'Saúde', perguntas: [p('a'), p('b')] }, { uid: 's2', titulo: '  ', perguntas: [] }, { uid: 's3', titulo: 'Rotina', perguntas: [p('c')] }],
};

describe('arranjoDoEditor', () => {
  it('só editor abaixo de 1000, índice de 1000 a < 1440 e três colunas de 1440 em diante', () => {
    expect(arranjoDoEditor(999, true)).toBe('simples');
    expect(arranjoDoEditor(1000, true)).toBe('indice');
    expect(arranjoDoEditor(1439, true)).toBe('indice');
    expect(arranjoDoEditor(1440, true)).toBe('tres');
    expect(arranjoDoEditor(3300, true)).toBe('tres');
  });
  it('antes da medida e fora da web (celular, tablet nativo) nada muda', () => {
    expect(arranjoDoEditor(null, true)).toBe('simples');
    expect(arranjoDoEditor(2000, false)).toBe('simples');
  });
});

describe('itensDoIndice', () => {
  it('Instruções e cada seção com a contagem; sem título vira "Seção N"', () => {
    const itens = itensDoIndice(conteudo, agruparProblemas(conteudo, []));
    expect(itens.map((i) => [i.titulo, i.resumo, i.erro])).toEqual([
      ['Instruções', null, false], ['Saúde', '2 perguntas', false], ['Seção 2', 'Sem pergunta', false], ['Rotina', '1 pergunta', false],
    ]);
    expect(itens[2].chave).toBe(chaveDaSecao(1));
  });
  it('erro na pergunta, no título da seção ou numa instrução marca o item certo', () => {
    const problemas = agruparProblemas(conteudo, [
      { caminho: 'secoes[2].perguntas[0].rotulo', mensagem: 'Pergunta sem texto.' },
      { caminho: 'secoes[1].titulo', mensagem: 'Seção sem título.' },
      { caminho: 'instrucoes[0]', mensagem: 'Instrução vazia.' },
    ]);
    expect(itensDoIndice(conteudo, problemas).map((i) => i.erro)).toEqual([true, false, true, true]);
  });
});

describe('chaves', () => {
  it('a chave da seção devolve a posição; a das Instruções, nula', () => {
    expect(secaoDaChave(chaveDaSecao(4))).toBe(4);
    expect(secaoDaChave('instrucoes')).toBeNull();
    expect(quantasPerguntas(0)).toBe('Sem pergunta');
  });
});

describe('itemVisivel', () => {
  it('o último cujo topo passou da linha; antes de todos, o primeiro', () => {
    expect(itemVisivel([100, 500, 900], 120, false)).toBe(0);
    expect(itemVisivel([-400, 80, 900], 120, false)).toBe(1);
    expect(itemVisivel([300, 500], 120, false)).toBe(0);
  });
  it('no fim da rolagem, o último (seção curta no fim nunca chega à linha)', () => {
    expect(itemVisivel([-900, -200, 400], 120, true)).toBe(2);
    expect(itemVisivel([], 120, true)).toBe(0);
  });
});
