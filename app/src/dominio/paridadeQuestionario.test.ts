import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConteudoQuestionario, FinalidadeQuestionario, ItensDisponiveis, RespostasAtualizacao } from '../api/tipos';
import { hojeIso } from './formatos';
import { LIMITES_QUESTIONARIO, validarQuestionario } from './questionario';
import { avaliarRespostas, conferirItens, errosRespostasAtualizacao } from './respostasAtualizacao';

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
  /** ITENS_DO_PLANO: a lista de cada fonte que o servidor leu do plano (ausente = sem lista, toda resposta é recusada). */
  itens?: ItensDisponiveis;
  /** ITENS_DO_PLANO: o que o servidor grava por pergunta (`[{id, nome, motivo?}]`, com o nome da lista). */
  respostaLimpa?: Record<string, unknown>;
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
  expect(Object.keys(errosRespostasAtualizacao(caso.modelo, caso.respostas, caso.fotosLigadas ?? true, {}, hoje, caso.itens)).sort()).toEqual([...caso.camposComErro].sort());
  if (caso.chavesAceitas) {
    expect(Object.keys(avaliarRespostas(caso.modelo, caso.respostas, caso.fotosLigadas ?? true, {}, hoje, caso.itens).aceitas).sort()).toEqual([...caso.chavesAceitas].sort());
  }
  const perguntas = caso.modelo.secoes.flatMap((s) => s.perguntas);
  for (const [id, limpa] of Object.entries(caso.respostaLimpa ?? {})) {
    const pergunta = perguntas.find((p) => p.id === id);
    expect(pergunta && conferirItens(pergunta, caso.respostas[id], caso.itens)).toEqual({ limpa });
  }
});
