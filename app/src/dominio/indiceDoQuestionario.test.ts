import type { ConteudoQuestionario, PerguntaAtualizacao } from '../api/tipos';
import { agruparProblemas } from './editorQuestionario';
import {
  arranjoDoEditor, chaveDaSecao, colunasDoEditor, itensDoIndice, itemVisivel, LARGURA_DA_PREVIA, LARGURA_DO_INDICE, LARGURA_MAXIMA_DOS_ITENS,
  LARGURA_MINIMA_DO_INDICE_LARGO, MAXIMO_DO_EDITOR, quantasPerguntas, secaoDaChave, VAO_DAS_COLUNAS,
} from './indiceDoQuestionario';

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

describe('colunasDoEditor', () => {
  const soma = (c: ReturnType<typeof colunasDoEditor>) => c.indice + c.editor + c.previa + 2 * c.vao;
  it('na faixa do índice ele tem 240 e o editor fica com o resto', () => {
    expect(colunasDoEditor(1250, 'indice')).toEqual({ indice: LARGURA_DO_INDICE, editor: 1250 - LARGURA_DO_INDICE - VAO_DAS_COLUNAS, previa: 0, vao: VAO_DAS_COLUNAS });
  });
  it('em 1440 o índice fica no mínimo, a prévia tem 560 e o editor o resto, com o vão normal', () => {
    expect(colunasDoEditor(1440, 'tres')).toEqual({ indice: LARGURA_MINIMA_DO_INDICE_LARGO, editor: 572, previa: LARGURA_DA_PREVIA, vao: VAO_DAS_COLUNAS });
    expect(LARGURA_DA_PREVIA).toBe(560);
  });
  it('o editor para em 1400 e o índice em 320; só depois disso a sobra vira vão, igual dos dois lados', () => {
    expect(MAXIMO_DO_EDITOR).toBe(1400);
    expect(colunasDoEditor(2268, 'tres')).toEqual({ indice: 260, editor: 1400, previa: 560, vao: 24 });
    expect(colunasDoEditor(2300, 'tres')).toEqual({ indice: 292, editor: 1400, previa: 560, vao: 24 });
    const c = colunasDoEditor(3089, 'tres');
    expect([c.indice, c.editor, c.previa]).toEqual([LARGURA_MAXIMA_DOS_ITENS, 1400, 560]);
    expect(c.vao).toBe(24 + (3089 - 560 - 48 - 1400 - 320) / 2);
  });
  it('as colunas e os vãos somam sempre a área', () => {
    for (const area of [1440, 1633, 2268, 2500, 3089]) expect(soma(colunasDoEditor(area, 'tres'))).toBe(area);
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
