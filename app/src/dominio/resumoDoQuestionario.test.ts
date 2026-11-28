import type { ConteudoQuestionario, PerguntaAtualizacao } from '../api/tipos';
import {
  camposDoSeuContato, camposFixosDaPrevia, chaveDaPergunta, problemasDoIndice, quantosCamposFixos, resumoDoQuestionario, situacaoDoRascunho,
} from './resumoDoQuestionario';

const p = (id: string, rotulo: string, extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao =>
  ({ id, tipo: 'TEXTO', rotulo, obrigatoria: false, ...extra });
const conteudo = (secoes: { titulo: string; perguntas: PerguntaAtualizacao[] }[], instrucoes: string[] = []): ConteudoQuestionario =>
  ({ formato: 2, instrucoes, secoes: secoes.map((s, i) => ({ uid: `s${i}`, ...s })) });

describe('resumo do questionário', () => {
  it('conta perguntas, seções e obrigatórias, com o plural certo', () => {
    const c = conteudo([
      { titulo: 'A', perguntas: [p('a', 'Um', { obrigatoria: true }), p('b', 'Dois', { obrigatoria: true }), p('c', 'Três')] },
      { titulo: 'B', perguntas: [p('d', 'Quatro', { obrigatoria: true })] },
    ]);
    expect(resumoDoQuestionario(c)).toBe('4 perguntas · 2 seções · 3 obrigatórias');
    expect(resumoDoQuestionario(conteudo([{ titulo: 'A', perguntas: [p('a', 'Um', { obrigatoria: true })] }]))).toBe('1 pergunta · 1 seção · 1 obrigatória');
    expect(resumoDoQuestionario(conteudo([{ titulo: 'A', perguntas: [] }]))).toBe('Nenhuma pergunta · 1 seção · nenhuma obrigatória');
  });

  it('obrigatória só onde o tipo aceita (o informativo marcado não conta)', () => {
    const c = conteudo([{ titulo: 'A', perguntas: [p('a', 'Leia', { tipo: 'INFORMATIVO', obrigatoria: true })] }]);
    expect(resumoDoQuestionario(c)).toBe('1 pergunta · 1 seção · nenhuma obrigatória');
  });

  it('situação: versão publicada e se o rascunho mudou; sem versão, ainda não publicado', () => {
    expect(situacaoDoRascunho(1, true)).toBe('Publicado v1 · rascunho com alterações');
    expect(situacaoDoRascunho(3, false)).toBe('Publicado v3 · sem alterações');
    expect(situacaoDoRascunho(0, true)).toBe('Ainda não publicado');
  });
});

describe('problemas do índice', () => {
  it('agrupa por tipo, com o plural e o caminho do primeiro', () => {
    const c = conteudo([
      { titulo: 'A', perguntas: [p('a', 'Ok'), p('b', ' ')] },
      { titulo: '', perguntas: [p('c', '')] },
    ]);
    expect(problemasDoIndice(c, 'ANAMNESE')).toEqual([
      { rotulo: '2 perguntas sem texto', caminho: 'secoes[0].perguntas[1].rotulo' },
      { rotulo: '1 seção sem título', caminho: 'secoes[1].titulo' },
    ]);
  });

  it('sem problema, lista vazia', () => {
    expect(problemasDoIndice(conteudo([{ titulo: 'A', perguntas: [p('a', 'Ok')] }]), 'ANAMNESE')).toEqual([]);
  });

  it('na inscrição, a pergunta parecida com o Instagram entra como problema, com o id dela', () => {
    const c = conteudo([{ titulo: 'A', perguntas: [p('a', 'Ok'), p('b', 'Qual seu Instagram?')] }]);
    expect(problemasDoIndice(c, 'INSCRICAO')).toEqual([
      { rotulo: '1 pergunta repete o campo fixo Instagram', caminho: 'secoes[0].perguntas[1].rotulo', perguntaId: 'b' },
    ]);
    expect(problemasDoIndice(c, 'ANAMNESE')).toEqual([]);
  });

  it('chave da pergunta para o link', () => {
    expect(chaveDaPergunta('x1')).toBe('pergunta:x1');
  });
});

describe('campos fixos da prévia', () => {
  it('os três que nunca saem e os não escondidos, na ordem da página', () => {
    expect(camposFixosDaPrevia(['SEXO', 'OBJETIVO', 'INTERESSE', 'MODALIDADE', 'PREVISAO_INICIO', 'ORIGEM'])).toEqual(['NOME', 'WHATSAPP', 'EMAIL', 'INSTAGRAM']);
    expect(camposFixosDaPrevia([])).toHaveLength(10);
    expect(camposDoSeuContato(camposFixosDaPrevia([]))).toEqual(['NOME', 'WHATSAPP', 'EMAIL', 'INSTAGRAM']);
    expect(camposDoSeuContato(camposFixosDaPrevia(['EMAIL']))).toEqual(['NOME', 'WHATSAPP', 'INSTAGRAM']);
    expect(quantosCamposFixos(4)).toBe('4 campos fixos');
    expect(quantosCamposFixos(1)).toBe('1 campo fixo');
  });
});
