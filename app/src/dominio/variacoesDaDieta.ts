import type { ConteudoDieta, Refeicao, VariacaoDaDieta } from '../api/tipos';
import { hojeEmBrasilia } from './agendaPresencial';
import { comUidsNovos } from './dieta';
import { diaDaSemanaIso } from './formatos';
import { novoUid } from './uid';

/**
 * Dieta por dia da semana (ciclo de carbo). Sem variações, `refeicoes` da raiz vale nos 7 dias; com variações, cada uma
 * guarda as suas e a raiz fica vazia. Dia: 1 = segunda ... 7 = domingo (o mesmo do treino). Quem consome (tela do aluno,
 * PDF, lista de compras) usa estas funções e não lê `refeicoes` direto.
 */

export const DIAS_DA_SEMANA = [1, 2, 3, 4, 5, 6, 7] as const;
/** Os mesmos limites do servidor (`ConteudoDieta.Variacao`). */
export const LIMITE_DE_VARIACOES = 7;
export const ROTULO_MAXIMO = 40;

const SUFIXO_DA_COPIA = ' (cópia)';

/** Variação que vale no dia; `null` sem variações **e** em dia descoberto (quem chama distingue por `c.variacoes.length`). */
export function variacaoDoDia(c: ConteudoDieta, dia: number): VariacaoDaDieta | null {
  return c.variacoes.find((v) => v.dias.includes(dia)) ?? null;
}

/** Refeições do dia: a raiz sem variações; com variações, as da variação do dia (`[]` em dia descoberto). */
export function refeicoesDoDia(c: ConteudoDieta, dia: number): Refeicao[] {
  if (c.variacoes.length === 0) return c.refeicoes;
  return variacaoDoDia(c, dia)?.refeicoes ?? [];
}

/** Uma parte da dieta com seus dias: serve PDF, lista de compras e editor. `uid` e `rotulo` nulos = a dieta sem variação. */
export interface SecaoDaDieta {
  uid: string | null;
  rotulo: string | null;
  dias: number[];
  refeicoes: Refeicao[];
}

/** Sem variações, uma seção com os 7 dias; com variações, uma por variação, na ordem da dieta. */
export function secoesDaDieta(c: ConteudoDieta): SecaoDaDieta[] {
  if (c.variacoes.length === 0) return [{ uid: null, rotulo: null, dias: [...DIAS_DA_SEMANA], refeicoes: c.refeicoes }];
  return c.variacoes.map((v) => ({ uid: v.uid, rotulo: v.rotulo, dias: v.dias, refeicoes: v.refeicoes }));
}

/** Dias sem variação marcada (publicar exige `[]`). Sem variações todos os dias valem, então também `[]`. */
export function diasSemVariacao(c: ConteudoDieta): number[] {
  if (c.variacoes.length === 0) return [];
  return DIAS_DA_SEMANA.filter((d) => !c.variacoes.some((v) => v.dias.includes(d)));
}

/**
 * Marca ou desmarca o dia na variação. Marcar tira o dia de qualquer outra (um dia, uma variação). Uid desconhecido não
 * muda nada.
 */
export function alternarDia(c: ConteudoDieta, uid: string, dia: number): ConteudoDieta {
  const alvo = c.variacoes.find((v) => v.uid === uid);
  if (!alvo || !DIAS_DA_SEMANA.includes(dia as (typeof DIAS_DA_SEMANA)[number])) return c;
  const marcando = !alvo.dias.includes(dia);
  return {
    ...c,
    variacoes: c.variacoes.map((v) => {
      if (v.uid === uid) {
        return { ...v, dias: marcando ? [...v.dias, dia].sort((a, b) => a - b) : v.dias.filter((d) => d !== dia) };
      }
      return marcando && v.dias.includes(dia) ? { ...v, dias: v.dias.filter((d) => d !== dia) } : v;
    }),
  };
}

/**
 * Duplica a variação logo depois dela: uids novos, **dias vazios** (o treinador marca; assim nunca nascem dois dias na
 * mesma variação) e rótulo "… (cópia)" cortado em {@link ROTULO_MAXIMO}. No limite de variações, não muda nada.
 */
export function duplicarVariacao(c: ConteudoDieta, uid: string): ConteudoDieta {
  const indice = c.variacoes.findIndex((v) => v.uid === uid);
  if (indice < 0 || c.variacoes.length >= LIMITE_DE_VARIACOES) return c;
  const origem = c.variacoes[indice];
  const copia: VariacaoDaDieta = {
    uid: novoUid(),
    rotulo: origem.rotulo.slice(0, ROTULO_MAXIMO - SUFIXO_DA_COPIA.length) + SUFIXO_DA_COPIA,
    dias: [],
    refeicoes: comUidsNovos(origem.refeicoes),
  };
  return { ...c, variacoes: [...c.variacoes.slice(0, indice + 1), copia, ...c.variacoes.slice(indice + 1)] };
}

/** Dieta sem variação vira a variação 1: a raiz vai para ela, com os 7 dias, e a raiz fica vazia. Já tem variações: igual. */
export function criarVariacoes(c: ConteudoDieta, rotulo = 'Variação 1'): ConteudoDieta {
  if (c.variacoes.length > 0) return c;
  return {
    ...c,
    refeicoes: [],
    variacoes: [{ uid: novoUid(), rotulo: rotulo.slice(0, ROTULO_MAXIMO), dias: [...DIAS_DA_SEMANA], refeicoes: c.refeicoes }],
  };
}

/** Dia de hoje (1 a 7) pela data de **Brasília**, não pelo fuso do aparelho; `agora` injetável para teste. */
export function diaDeHojeEmBrasilia(agora: Date = new Date()): number {
  return diaDaSemanaIso(hojeEmBrasilia(agora));
}
