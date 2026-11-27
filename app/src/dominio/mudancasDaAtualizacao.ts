import type { Atualizacao, PerguntaAtualizacao } from '../api/tipos';
import { todasAsPerguntas } from './atualizacaoQuestionario';
import { numeroParaTela } from './formatos';
import { pesoComCasas } from './variacaoDoPeso';

/**
 * "O que mudou desde a última atualização" da revisão do treinador (bloco D, decisão D5 de
 * `docs/planos/atualizacao-pasta-e-questionarios.md`): só fatos, a resposta anterior e a atual da MESMA pergunta (mesmo id e
 * mesmo tipo), e só quando são diferentes. Sem limiar, sem "fora do padrão", sem cor de bom ou ruim: o app não opina sobre
 * saúde. Pura (sem rede nem relógio).
 *
 * Entra: peso (pergunta PESO), notas (NOTA), números (NUMERO), Sim/Não (SIM_NAO) e os dias com treino registrado no período
 * (do resumo da API). Fica de fora o resto (texto, escolhas, fotos) e tipo que esta versão do app não conhece (ex.: o
 * `ITENS_DO_PLANO` do bloco C, que ainda não chegou ao app): não quebra, só não aparece.
 */

/** Uma linha do bloco: "Sono: 7 → 4". `anterior` e `atual` já vêm em texto de tela. */
export interface MudancaDaAtualizacao {
  chave: string;
  rotulo: string;
  anterior: string;
  atual: string;
}

export type MudancasDaAtualizacao =
  /** Nenhuma atualização enviada antes desta. */
  | { tipo: 'primeira' }
  /** Há anterior: `mudancas` vazia = nada do que se compara mudou. */
  | { tipo: 'comparada'; dataAnterior: string | null; mudancas: MudancaDaAtualizacao[] };

export const TEXTO_PRIMEIRA_ATUALIZACAO = 'Primeira atualização deste aluno.';
export const TEXTO_NADA_MUDOU = 'Nenhuma resposta comparável mudou desde a atualização anterior.';

type Comparavel = Pick<Atualizacao, 'id' | 'dataAtualizacao' | 'enviadaEm' | 'fase' | 'modelo' | 'respostas' | 'resumo'>;

const enviada = (a: Pick<Atualizacao, 'fase' | 'enviadaEm'>) => !!a.enviadaEm && (a.fase === 'ENVIADA' || a.fase === 'REVISADA');

/**
 * A atualização enviada (ou revisada) mais recente com data ANTES da atual; `null` sem nenhuma. A lista da API vem em ordem de
 * data decrescente, mas a regra não confia nela. Mesma data: a de envio mais recente (o caso de duas pastas no mesmo dia).
 */
export function atualizacaoAnterior<T extends Comparavel>(lista: readonly T[], atual: Pick<Atualizacao, 'id' | 'dataAtualizacao'>): T | null {
  if (!atual.dataAtualizacao) return null;
  const data = atual.dataAtualizacao;
  const candidatas = lista.filter((a) => a.id !== atual.id && enviada(a) && !!a.dataAtualizacao && a.dataAtualizacao < data);
  return candidatas.reduce<T | null>((melhor, a) => {
    if (!melhor) return a;
    if (a.dataAtualizacao! !== melhor.dataAtualizacao!) return a.dataAtualizacao! > melhor.dataAtualizacao! ? a : melhor;
    return (a.enviadaEm ?? '') > (melhor.enviadaEm ?? '') ? a : melhor;
  }, null);
}

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const simNao = (v: unknown) => (v === true ? 'Sim' : v === false ? 'Não' : null);
const rotuloDe = (p: PerguntaAtualizacao) => (p.rotuloCurto?.trim() || p.rotulo.trim() || 'Pergunta');

/** Texto de tela da resposta, só dos tipos que se comparam; `null` = sem resposta ou tipo que não entra. */
function valorComparavel(p: PerguntaAtualizacao, v: unknown): string | null {
  switch (p.tipo) {
    case 'PESO': { const n = numero(v); return n === null ? null : `${pesoComCasas(n)} kg`; }
    case 'NOTA': { const n = numero(v); return n === null ? null : numeroParaTela(n, 1); }
    case 'NUMERO': {
      const n = numero(v);
      if (n === null) return null;
      const unidade = p.unidade?.trim();
      return `${numeroParaTela(n, p.casas ?? 2)}${unidade ? ` ${unidade}` : ''}`;
    }
    case 'SIM_NAO': return simNao(v);
    default: return null;
  }
}

/**
 * Compara a atual com a anterior (`atualizacaoAnterior`). As perguntas e os rótulos são os do questionário da atual; a pergunta
 * da anterior só vale com o mesmo id E o mesmo tipo (outra versão pode ter reaproveitado o id). Ordem: a do questionário, e os
 * dias com treino por último.
 */
export function mudancasDaAtualizacao(atual: Comparavel, anterior: Comparavel | null): MudancasDaAtualizacao {
  if (!anterior) return { tipo: 'primeira' };
  const mudancas: MudancaDaAtualizacao[] = [];
  const tiposAntes = new Map((anterior.modelo ? todasAsPerguntas(anterior.modelo) : []).map((p) => [p.id, p.tipo]));
  for (const p of atual.modelo ? todasAsPerguntas(atual.modelo) : []) {
    if (tiposAntes.get(p.id) !== p.tipo) continue;
    const agora = valorComparavel(p, atual.respostas?.[p.id]);
    const antes = valorComparavel(p, anterior.respostas?.[p.id]);
    if (agora === null || antes === null || agora === antes) continue;
    mudancas.push({ chave: p.id, rotulo: rotuloDe(p), anterior: antes, atual: agora });
  }
  const dias = atual.resumo?.diasComTreino;
  const diasAntes = anterior.resumo?.diasComTreino;
  if (typeof dias === 'number' && typeof diasAntes === 'number' && dias !== diasAntes) {
    mudancas.push({ chave: 'dias-com-treino', rotulo: 'Dias com treino registrado', anterior: String(diasAntes), atual: String(dias) });
  }
  return { tipo: 'comparada', dataAnterior: anterior.dataAtualizacao, mudancas };
}
