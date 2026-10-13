import type { ConteudoQuestionario } from '../api/tipos';
import { errosDoQuestionario, LIMITES_QUESTIONARIO, normalizarOpcao, tiposQueMudaram, validarQuestionario } from './questionario';

/** Dados fictícios. As regras uma a uma estão nas fixtures de paridade (`paridadeQuestionario.test.ts`). */
const base = (): ConteudoQuestionario => ({
  formato: 2,
  instrucoes: [],
  secoes: [{ uid: 's1', titulo: 'Geral', perguntas: [
    { id: 'peso', tipo: 'PESO', rotulo: 'Peso', obrigatoria: true },
    { id: 'sono', tipo: 'NOTA', rotulo: 'Sono', obrigatoria: false },
  ] }],
});

it('questionário válido não tem erro nem aviso', () => {
  expect(validarQuestionario(base())).toEqual({ erros: [], avisos: [] });
});

it('conteúdo sem listas não quebra e aponta as seções', () => {
  expect(errosDoQuestionario({}).map((e) => e.caminho)).toEqual(['secoes']);
});

it('sem pergunta de peso só avisa', () => {
  const c = base();
  c.secoes[0].perguntas.shift();
  const r = validarQuestionario(c);
  expect(r.erros).toEqual([]);
  expect(r.avisos.map((a) => a.caminho)).toEqual(['secoes']);
});

it('tipo fora da lista é erro no campo tipo', () => {
  const c = base();
  (c.secoes[0].perguntas[1] as { tipo: string }).tipo = 'VOADOR';
  expect(errosDoQuestionario(c).map((e) => e.caminho)).toEqual(['secoes[0].perguntas[1].tipo']);
});

it('mensagens existem e não repetem o conteúdo digitado', () => {
  const c = base();
  c.secoes[0].perguntas[1].rotulo = 'x'.repeat(LIMITES_QUESTIONARIO.rotuloTamanho + 1);
  const [e] = errosDoQuestionario(c);
  expect(e.mensagem.length).toBeGreaterThan(0);
  expect(e.mensagem).not.toContain('xxx');
});

it('normaliza caixa, acento e espaços das opções', () => {
  expect(normalizarOpcao('  Não ')).toBe('nao');
});

it('o tipo de um id não muda entre versões', () => {
  const v1 = base();
  const atual = base();
  atual.secoes[0].perguntas[1].tipo = 'TEXTO';
  atual.secoes[0].perguntas.push({ id: 'novo', tipo: 'NUMERO', rotulo: 'Novo', obrigatoria: false });
  expect(tiposQueMudaram(atual, [v1])).toEqual(['sono']);
  expect(tiposQueMudaram(v1, [v1])).toEqual([]);
  expect(tiposQueMudaram(atual, [])).toEqual([]);
});
