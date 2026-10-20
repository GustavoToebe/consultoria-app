import type { ConteudoQuestionario } from '../api/tipos';
import {
  errosDaPagina, paginaCompleta, paginasVisiveis, posicaoSegura, primeiraPaginaComErro, secaoDaPergunta, textoDaParte,
} from './paginasDoQuestionario';
import { errosRespostasAtualizacao } from './respostasAtualizacao';

/** Quatro seções: a 2 só aparece com "treina = sim"; a 3 tem só uma pergunta condicional e nenhum texto. */
const MODELO: ConteudoQuestionario = {
  formato: 2,
  instrucoes: [],
  secoes: [
    { uid: 's0', titulo: 'Dados', perguntas: [{ id: 'nome', tipo: 'TEXTO', rotulo: 'Nome', obrigatoria: true }] },
    { uid: 's1', titulo: 'Treino', perguntas: [{ id: 'treina', tipo: 'SIM_NAO', rotulo: 'Treina?', obrigatoria: true }] },
    {
      uid: 's2', titulo: 'Rotina de treino', descricao: 'Conte **como** é.', mostrarSe: { perguntaId: 'treina', valores: ['sim'] },
      perguntas: [{ id: 'dias', tipo: 'NUMERO', rotulo: 'Dias por semana', obrigatoria: true, min: 1, max: 7 }],
    },
    {
      uid: 's3', titulo: 'Lesões',
      perguntas: [{ id: 'qual', tipo: 'TEXTO', rotulo: 'Qual?', obrigatoria: false, mostrarSe: { perguntaId: 'treina', valores: ['nao'] } }],
    },
    { uid: 's4', titulo: 'Regras', perguntas: [{ id: 'aceite', tipo: 'ACEITE', rotulo: 'Regras', texto: 'Leia.', declaracao: 'Li.', obrigatoria: true }] },
  ],
};

describe('paginasDoQuestionario', () => {
  it('só as seções visíveis viram página; seção sem nada visível nem texto fica de fora', () => {
    expect(paginasVisiveis(MODELO, {})).toEqual([0, 1, 4]);
    expect(paginasVisiveis(MODELO, { treina: true })).toEqual([0, 1, 2, 4]);
    expect(paginasVisiveis(MODELO, { treina: false })).toEqual([0, 1, 3, 4]);
  });

  it('seção visível só com descrição continua sendo página', () => {
    const soTexto: ConteudoQuestionario = { formato: 2, instrucoes: [], secoes: [{ titulo: 'Boas-vindas', descricao: 'Olá!', perguntas: [] }] };
    expect(paginasVisiveis(soTexto, {})).toEqual([0]);
    expect(paginasVisiveis({ ...soTexto, secoes: [{ titulo: 'Vazia', descricao: '  ', perguntas: [] }] }, {})).toEqual([]);
  });

  it('posição segura: a seção atual, ou a última visível antes dela quando some', () => {
    expect(posicaoSegura([0, 1, 2, 4], 2)).toBe(2);
    expect(posicaoSegura([0, 1, 4], 2)).toBe(1);
    expect(posicaoSegura([0, 1, 4], 3)).toBe(1);
    expect(posicaoSegura([2, 4], 0)).toBe(0);
    expect(posicaoSegura([], 3)).toBe(0);
  });

  it('erros e "página completa" olham só as perguntas da seção', () => {
    const erros = errosRespostasAtualizacao(MODELO, { treina: true });
    expect(erros).toEqual({ nome: 'Preencha este campo.', dias: 'Preencha este campo.', aceite: 'Preencha este campo.' });
    expect(errosDaPagina(MODELO, 0, erros)).toEqual({ nome: 'Preencha este campo.' });
    expect(errosDaPagina(MODELO, 1, erros)).toEqual({});
    expect(paginaCompleta(MODELO, 1, erros)).toBe(true);
    expect(paginaCompleta(MODELO, 2, erros)).toBe(false);
    expect(errosDaPagina(MODELO, 99, erros)).toEqual({});
  });

  it('primeira página com erro, pela posição entre as visíveis', () => {
    const paginas = paginasVisiveis(MODELO, { nome: 'Fulano', treina: true });
    const erros = errosRespostasAtualizacao(MODELO, { nome: 'Fulano', treina: true });
    expect(primeiraPaginaComErro(MODELO, paginas, erros)).toBe(2);
    const completas = { nome: 'Fulano', treina: true, dias: 3, aceite: true };
    expect(primeiraPaginaComErro(MODELO, paginas, errosRespostasAtualizacao(MODELO, completas))).toBeNull();
  });

  it('seção de uma pergunta e texto da parte', () => {
    expect(secaoDaPergunta(MODELO, 'dias')).toBe(2);
    expect(secaoDaPergunta(MODELO, 'respostas')).toBeNull();
    expect(textoDaParte(1, 9)).toBe('Parte 2 de 9');
  });
});
