import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConteudoQuestionario, FinalidadeQuestionario, RespostasAtualizacao } from '../api/tipos';
import { hojeIso } from './formatos';
import { LIMITES_QUESTIONARIO, validarQuestionario } from './questionario';
import { avaliarRespostas, errosRespostasAtualizacao } from './respostasAtualizacao';

/**
 * Paridade com o Java: lê as mesmas fixtures de `ParidadeQuestionarioTest`
 * (`api/src/test/resources/paridade-questionario/`). Compara só caminhos/campos, nunca mensagens.
 */
const ler = <T,>(nome: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../api/src/test/resources/paridade-questionario/', nome), 'utf8')) as T;

interface CasoQuestionario { nome: string; conteudo: ConteudoQuestionario; erros: string[]; avisos: string[]; finalidade?: FinalidadeQuestionario }
interface CasoRespostas {
  nome: string; modelo: ConteudoQuestionario; respostas: RespostasAtualizacao; camposComErro: string[];
  /** Ausente = ligadas (o caso é sobre a validação das fotos). */
  fotosLigadas?: boolean;
  /** Ausente = hoje (só importa para DATA com `somentePassado`). */
  hoje?: string;
  /** Sem erro: as respostas que sobram depois de descartar as escondidas por condição. */
  chavesAceitas?: string[];
}

it('limites iguais aos do Java', () => {
  expect(LIMITES_QUESTIONARIO).toEqual(ler('limites.json'));
});

const questionarios = ler<CasoQuestionario[]>('questionarios.json');
it('há casos de questionário', () => expect(questionarios.length).toBeGreaterThan(50));
it.each(questionarios.map((c) => [c.nome, c] as const))('questionário: %s', (_nome, caso) => {
  const r = validarQuestionario(caso.conteudo, caso.finalidade ?? 'ATUALIZACAO');
  expect([...new Set(r.erros.map((e) => e.caminho))].sort()).toEqual([...caso.erros].sort());
  expect(r.avisos.map((a) => a.caminho)).toEqual(caso.avisos);
});

const respostas = ler<CasoRespostas[]>('respostas.json');
it('há casos de respostas', () => expect(respostas.length).toBeGreaterThan(25));
it.each(respostas.map((c) => [c.nome, c] as const))('respostas: %s', (_nome, caso) => {
  const hoje = caso.hoje ?? hojeIso();
  expect(Object.keys(errosRespostasAtualizacao(caso.modelo, caso.respostas, caso.fotosLigadas ?? true, {}, hoje)).sort()).toEqual([...caso.camposComErro].sort());
  if (caso.chavesAceitas) {
    expect(Object.keys(avaliarRespostas(caso.modelo, caso.respostas, caso.fotosLigadas ?? true, {}, hoje).aceitas).sort()).toEqual([...caso.chavesAceitas].sort());
  }
});
