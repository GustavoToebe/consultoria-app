import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConteudoQuestionario, RespostasAtualizacao } from '../api/tipos';
import { LIMITES_QUESTIONARIO, validarQuestionario } from './questionario';
import { errosRespostasAtualizacao } from './respostasAtualizacao';

/**
 * Paridade com o Java: lê as mesmas fixtures de `ParidadeQuestionarioTest`
 * (`api/src/test/resources/paridade-questionario/`). Compara só caminhos/campos, nunca mensagens.
 */
const ler = <T,>(nome: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../api/src/test/resources/paridade-questionario/', nome), 'utf8')) as T;

interface CasoQuestionario { nome: string; conteudo: ConteudoQuestionario; erros: string[]; avisos: string[] }
interface CasoRespostas { nome: string; modelo: ConteudoQuestionario; respostas: RespostasAtualizacao; camposComErro: string[] }

it('limites iguais aos do Java', () => {
  expect(LIMITES_QUESTIONARIO).toEqual(ler('limites.json'));
});

const questionarios = ler<CasoQuestionario[]>('questionarios.json');
it('há casos de questionário', () => expect(questionarios.length).toBeGreaterThan(50));
it.each(questionarios.map((c) => [c.nome, c] as const))('questionário: %s', (_nome, caso) => {
  const r = validarQuestionario(caso.conteudo);
  expect([...new Set(r.erros.map((e) => e.caminho))].sort()).toEqual([...caso.erros].sort());
  expect(r.avisos.map((a) => a.caminho)).toEqual(caso.avisos);
});

const respostas = ler<CasoRespostas[]>('respostas.json');
it('há casos de respostas', () => expect(respostas.length).toBeGreaterThan(25));
it.each(respostas.map((c) => [c.nome, c] as const))('respostas: %s', (_nome, caso) => {
  expect(Object.keys(errosRespostasAtualizacao(caso.modelo, caso.respostas)).sort()).toEqual([...caso.camposComErro].sort());
});
