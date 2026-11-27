import type { Atualizacao, FatoDeAtencao } from '../api/tipos';
import { todasAsPerguntas } from './atualizacaoQuestionario';
import { numeroParaTela } from './formatos';
import type { MudancaDaAtualizacao, MudancasDaAtualizacao } from './mudancasDaAtualizacao';
import { ehTipoDeRegra, legendaDaRegra, rotuloDaPergunta, TIPOS_DE_REGRA } from './regrasDeAtencao';
import { itensDaResposta } from './respostasAtualizacao';
import { pesoComCasas } from './variacaoDoPeso';

/**
 * "Pontos de atenção" da revisão (R4 de `docs/planos/regras-de-atencao.md`): os fatos que o servidor gravou no envio viram
 * um grupo próprio no topo do "O que mudou", desenhado só com o detalhe (sem esperar o histórico). Quando o histórico chega,
 * o fato que tem linha no "O que mudou" ganha o "anterior → atual" dela. As chaves das linhas são as de
 * `mudancasDaAtualizacao`: o id da pergunta (inclusive a PESO) e `dias-com-treino`. A maioria dos fatos não tem linha (valor
 * igual ao anterior, primeira atualização, item marcado, peso sem pergunta), por isso o grupo próprio.
 *
 * Só mostra: nunca reavalia a regra. O rótulo é o da pergunta na versão do questionário da própria atualização e a legenda
 * usa o `limiteVigente` gravado. Os valores vêm das respostas da própria atualização e do resumo (a mesma medida da tela);
 * o `valorObservado` só entra onde não há resposta para ler (a nota de NOTA_ABAIXO e os dias com treino sem resumo). Tipo
 * que esta versão do app não conhece fica fora (não quebra). Pura.
 */

/** A chave da linha dos dias com treino no "O que mudou" (`mudancasDaAtualizacao`). */
export const CHAVE_DIAS_COM_TREINO = 'dias-com-treino';
const ROTULO_DIAS_COM_TREINO = 'Dias com treino registrado';

/** Uma linha do grupo de atenção; vários fatos da mesma pergunta (nota até 5 e nota que caiu) dividem a linha. */
export interface PontoDeAtencao {
  /** Chave da linha do "O que mudou" que este ponto ocupa; nula no peso sem pergunta (e no fato sem pergunta). */
  chave: string | null;
  /** Chave estável para a lista na tela (a `chave`, ou o tipo quando não há). */
  id: string;
  rotulo: string;
  /** Valor atual em texto de tela; nulo quando não há o que mostrar (peso sem pergunta: só a legenda). */
  valor: string | null;
  /** A linha do "O que mudou" ("anterior → atual"), quando o histórico já chegou e ela existe. */
  mudanca: MudancaDaAtualizacao | null;
  /** "Sua regra: …", uma por fato, na ordem dos modelos. */
  legendas: string[];
}

type ComAtencao = Pick<Atualizacao, 'modelo' | 'respostas' | 'resumo' | 'atencao'>;

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "1 ponto de atenção" ou "N pontos de atenção" (selo da lista e cabeça do "O que mudou"); nulo com 0, nulo ou ausente. */
export function textoDosPontos(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return null;
  return n === 1 ? '1 ponto de atenção' : `${n} pontos de atenção`;
}

/**
 * Os pontos de atenção da atualização, na ordem: perguntas na ordem do questionário, depois os fatos de pergunta que não
 * está nesta versão, depois os dias com treino e o peso por último. `mudancas` nulo = histórico ainda não chegou (ou falhou).
 */
export function pontosDeAtencao(atual: ComAtencao, mudancas: MudancasDaAtualizacao | null): PontoDeAtencao[] {
  const fatos = (atual.atencao ?? []).filter((f) => ehTipoDeRegra(f.tipo));
  if (!fatos.length) return [];
  const perguntas = atual.modelo ? todasAsPerguntas(atual.modelo) : [];
  const posicao = new Map(perguntas.map((p, i) => [p.id, i]));
  const porId = new Map(perguntas.map((p) => [p.id, p]));
  const linhas = mudancas?.tipo === 'comparada' ? mudancas.mudancas : [];
  const resposta = (id: string | null) => (id ? atual.respostas?.[id] : undefined);

  const chaveDo = (f: FatoDeAtencao) => (f.tipo === 'POUCOS_TREINOS' ? CHAVE_DIAS_COM_TREINO : f.perguntaId || null);
  const grupoDo = (f: FatoDeAtencao) => {
    if (f.tipo === 'POUCOS_TREINOS') return 2;
    if (f.tipo === 'PESO_MUDOU') return 3;
    return f.perguntaId && posicao.has(f.perguntaId) ? 0 : 1;
  };
  const rotuloDo = (f: FatoDeAtencao) => {
    if (f.tipo === 'POUCOS_TREINOS') return ROTULO_DIAS_COM_TREINO;
    const p = f.perguntaId ? porId.get(f.perguntaId) : undefined;
    if (p) return rotuloDaPergunta(p);
    return f.tipo === 'PESO_MUDOU' ? 'Peso' : 'Pergunta';
  };
  const valorDo = (f: FatoDeAtencao): string | null => {
    switch (f.tipo) {
      case 'NOTA_ABAIXO': { const n = numero(resposta(f.perguntaId)) ?? numero(f.valorObservado); return n === null ? null : numeroParaTela(n, 1); }
      case 'NOTA_CAIU': { const n = numero(resposta(f.perguntaId)); return n === null ? null : numeroParaTela(n, 1); }
      case 'SIM': return 'Sim';
      case 'PESO_MUDOU': {
        const n = f.perguntaId && porId.get(f.perguntaId)?.tipo === 'PESO' ? numero(resposta(f.perguntaId)) : null;
        return n === null ? null : `${pesoComCasas(n)} kg`;
      }
      case 'POUCOS_TREINOS': { const n = numero(atual.resumo?.diasComTreino) ?? numero(f.valorObservado); return n === null ? null : String(n); }
      case 'ITEM_MARCADO': {
        const daResposta = itensDaResposta(resposta(f.perguntaId)).map((i) => i.nome?.trim() ?? '').filter(Boolean);
        const nomes = daResposta.length ? daResposta : (f.itensMarcados ?? []).map((n) => n.trim()).filter(Boolean);
        return nomes.length ? nomes.join(', ') : null;
      }
      default: return null;
    }
  };

  const ordenados = fatos
    .map((f, i) => ({ f, i }))
    .sort((a, b) => grupoDo(a.f) - grupoDo(b.f)
      || (posicao.get(a.f.perguntaId ?? '') ?? 0) - (posicao.get(b.f.perguntaId ?? '') ?? 0)
      || TIPOS_DE_REGRA.indexOf(a.f.tipo) - TIPOS_DE_REGRA.indexOf(b.f.tipo)
      || a.i - b.i)
    .map(({ f }) => f);

  const pontos = new Map<string, PontoDeAtencao>();
  for (const f of ordenados) {
    const chave = chaveDo(f);
    const id = chave ?? `#${f.tipo}`;
    const rotulo = rotuloDo(f);
    const legenda = legendaDaRegra(f.tipo, numero(f.limiteVigente), rotulo);
    const ja = pontos.get(id);
    if (ja) { ja.legendas.push(legenda); ja.valor ??= valorDo(f); continue; }
    pontos.set(id, {
      chave, id, rotulo, valor: valorDo(f), legendas: [legenda],
      mudanca: chave ? linhas.find((m) => m.chave === chave) ?? null : null,
    });
  }
  return [...pontos.values()];
}

/** As outras mudanças do "O que mudou", sem repetir as linhas que os pontos de atenção já mostram. */
export function outrasMudancas(mudancas: readonly MudancaDaAtualizacao[], pontos: readonly PontoDeAtencao[]): MudancaDaAtualizacao[] {
  const mostradas = new Set(pontos.map((p) => p.chave).filter((c): c is string => c !== null));
  return mudancas.filter((m) => !mostradas.has(m.chave));
}
