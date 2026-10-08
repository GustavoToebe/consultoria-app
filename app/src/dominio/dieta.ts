import type { Alimento, ConteudoDieta, ItemDieta, OpcaoRefeicao, Refeicao, UnidadeAlimento } from '../api/tipos';
import { novoUid } from './uid';

/**
 * Contas da dieta (seção 7.2): o valor do item vem do alimento da biblioteca proporcional à quantidade, calculado ao
 * editar e gravado no item (a versão publicada não recalcula). Sem dado para calcular, o valor fica vazio ("—"):
 * nunca inventar valor nutricional.
 */

export type Macro = 'kcal' | 'proteina' | 'carboidrato' | 'gordura';
export const MACROS: Macro[] = ['kcal', 'proteina', 'carboidrato', 'gordura'];

export type Totais = Record<Macro, number | null>;

/** Quantidade do item na unidade-base do alimento; `null` se não há como converter (ex.: "un" sem gramas). */
export function quantidadeNaBase(alimento: Alimento, quantidade: number, unidade: UnidadeAlimento): number | null {
  if (unidade === alimento.baseUnidade) return quantidade;
  const porUnidade = alimento.gramasPorUnidade;
  if (!porUnidade) return null;
  if (unidade === 'un' && alimento.baseUnidade === 'g') return quantidade * porUnidade;
  if (unidade === 'g' && alimento.baseUnidade === 'un') return quantidade / porUnidade;
  return null;
}

const arredondar = (n: number) => Math.round(n * 1000) / 1000;

/** Item recalculado a partir do alimento (não mexe em item manual). */
export function recalcularItem(item: ItemDieta, alimento: Alimento | undefined): ItemDieta {
  if (item.manual || !alimento) return item;
  const base = item.quantidade && item.quantidade > 0 ? quantidadeNaBase(alimento, item.quantidade, item.unidade) : null;
  const fator = base === null ? null : base / alimento.baseQuantidade;
  const valor = (v: number) => (fator === null ? null : arredondar(v * fator));
  return {
    ...item,
    kcal: valor(alimento.kcal),
    proteina: valor(alimento.proteina),
    carboidrato: valor(alimento.carboidrato),
    gordura: valor(alimento.gordura),
  };
}

/** Soma os valores sem arredondar (arredonda só na tela). Algum item sem valor → aquele total fica `null`. */
export function somar(itens: ItemDieta[]): Totais {
  const totais: Totais = { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0 };
  for (const item of itens) {
    for (const m of MACROS) {
      const atual = totais[m];
      const valor = item[m];
      totais[m] = atual === null || valor === null || valor === undefined ? null : atual + valor;
    }
  }
  return totais;
}

/** Total do dia = primeira opção de cada refeição (nunca somar alternativas como se todas fossem consumidas). */
export function totalDoDia(conteudo: ConteudoDieta): Totais {
  return somar(conteudo.refeicoes.flatMap((r) => r.opcoes[0]?.itens ?? []));
}

const LETRAS = 'ABCDEF';

export function novaOpcao(existentes: OpcaoRefeicao[]): OpcaoRefeicao {
  const usadas = new Set(existentes.map((o) => o.rotulo));
  const rotulo = [...LETRAS].find((l) => !usadas.has(l)) ?? String(existentes.length + 1);
  return { uid: novoUid(), rotulo, itens: [] };
}

export function novaRefeicao(nome = ''): Refeicao {
  return { uid: novoUid(), nome, horario: null, observacao: null, opcoes: [novaOpcao([])] };
}

export function novoItem(alimento?: Alimento): ItemDieta {
  if (!alimento) {
    return {
      uid: novoUid(),
      alimentoId: null,
      nome: '',
      quantidade: null,
      unidade: 'g',
      kcal: null,
      proteina: null,
      carboidrato: null,
      gordura: null,
      manual: true,
    };
  }
  return recalcularItem(
    {
      uid: novoUid(),
      alimentoId: alimento.id,
      nome: alimento.nome,
      quantidade: alimento.baseQuantidade,
      unidade: alimento.baseUnidade,
      kcal: null,
      proteina: null,
      carboidrato: null,
      gordura: null,
      manual: false,
    },
    alimento,
  );
}

export function normalizarDieta(conteudo: unknown): ConteudoDieta {
  const c = (conteudo ?? {}) as Partial<ConteudoDieta>;
  return {
    objetivo: c.objetivo ?? null,
    dataInicio: c.dataInicio ?? null,
    profissional: c.profissional ?? null,
    refeicoes: (c.refeicoes ?? []).map((r) => ({
      uid: r.uid ?? novoUid(),
      nome: r.nome ?? '',
      horario: r.horario ?? null,
      observacao: r.observacao ?? null,
      opcoes: (r.opcoes ?? []).map((o) => ({
        uid: o.uid ?? novoUid(),
        rotulo: o.rotulo ?? '',
        itens: (o.itens ?? []).map((i) => ({
          uid: i.uid ?? novoUid(),
          alimentoId: i.alimentoId ?? null,
          nome: i.nome ?? '',
          quantidade: i.quantidade ?? null,
          unidade: i.unidade ?? 'g',
          kcal: i.kcal ?? null,
          proteina: i.proteina ?? null,
          carboidrato: i.carboidrato ?? null,
          gordura: i.gordura ?? null,
          manual: i.manual ?? i.alimentoId == null,
        })),
      })),
    })),
    orientacoes: (c.orientacoes ?? []).map((o) => ({ titulo: o.titulo ?? '', texto: o.texto ?? '' })),
    observacoes: c.observacoes ?? null,
    suplementacao: (c.suplementacao ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      nome: s.nome ?? '',
      dose: s.dose ?? '',
      horario: s.horario ?? '',
      observacao: s.observacao ?? '',
    })),
  };
}

/** Receita de dieta: troca as refeições pelas da receita (uids novos); o resto do plano fica. */
export function aplicarReceitaDeDieta(atual: ConteudoDieta, receita: unknown): ConteudoDieta {
  const daReceita = normalizarDieta(receita);
  return {
    ...atual,
    refeicoes: daReceita.refeicoes.map((r) => ({
      ...r,
      uid: novoUid(),
      opcoes: r.opcoes.map((o) => ({ ...o, uid: novoUid(), itens: o.itens.map((i) => ({ ...i, uid: novoUid() })) })),
    })),
  };
}
