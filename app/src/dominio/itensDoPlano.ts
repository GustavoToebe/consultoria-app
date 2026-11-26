import type { ConteudoDieta, ConteudoQuestionario, FonteDeItens, ItemDaLista, ItensDisponiveis, TreinoAtual, VersaoDetalhe } from '../api/tipos';
import { dataCurta, diaDaSemanaIso } from './formatos';
import type { RegistroLocal } from '../offline/repositorioLocal';
import { nomeNormalizadoDeItem } from './respostasAtualizacao';
import { secoesDaDieta } from './variacoesDaDieta';

/**
 * Lista da pergunta ITENS_DO_PLANO montada NO APARELHO (funciona sem internet), pelo pacote salvo e pelos registros locais.
 * É o espelho do `ItensDoPlanoService` do Java, que confere a resposta contra a mesma lista: se as regras de id ou de nome
 * mudarem lá, mudam aqui (ver `ItensDoPlano.java`). O id é o que vai no envio; o nome é só para mostrar.
 */

export interface EntradaDosItens {
  /** Treino liberado da pasta (o do pacote salvo); nulo = o aluno não tem. */
  treino: Pick<TreinoAtual, 'conteudo' | 'inicio'> | null | undefined;
  /** Dieta liberada da pasta (a que o `lerDieta` guarda); nula = o aluno não tem. */
  dieta: Pick<VersaoDetalhe<ConteudoDieta>, 'conteudo' | 'inicio'> | null | undefined;
  /**
   * Registros de série: os do aparelho fundidos com os do servidor (`fundirComServidor`). Só `concluida` entra na conta dos
   * dias treinados, como no servidor.
   */
  registros: readonly Pick<RegistroLocal, 'data' | 'concluida' | 'sessaoUid'>[];
  /** Data da atualização (AAAA-MM-DD): o fim do período dos dias treinados. */
  dataDaAtualizacao: string;
}

const DIAS_ABREVIADOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const DIAS_POR_EXTENSO = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'] as const;

/** "Seg 17/11": o rótulo do dia, igual ao do servidor. */
export const rotuloDoDia = (iso: string) => `${DIAS_ABREVIADOS[diaDaSemanaIso(iso) - 1]} ${dataCurta(iso)}`;

/** Um item por nome (o primeiro na ordem), sem item sem uid ou sem nome: o aluno nunca vê "Frango" duas vezes. */
function umPorNome(itens: readonly { uid?: string | null; nome?: string | null }[]): ItemDaLista[] {
  const vistos = new Set<string>();
  const lista: ItemDaLista[] = [];
  for (const { uid, nome } of itens) {
    const texto = nome?.trim() ?? '';
    if (!uid || !texto || vistos.has(nomeNormalizadoDeItem(texto))) continue;
    vistos.add(nomeNormalizadoDeItem(texto));
    lista.push({ id: uid, nome: texto });
  }
  return lista;
}

/** Todo item de todas as opções das refeições, da raiz e das variações (o servidor aceita o uid de qualquer um). */
function alimentos(entrada: EntradaDosItens): ItemDaLista[] {
  const dieta = entrada.dieta?.conteudo;
  if (!dieta) return [];
  return umPorNome(secoesDaDieta(dieta).flatMap((s) => s.refeicoes.flatMap((r) => (r.opcoes ?? []).flatMap((o) => o.itens ?? []))));
}

/** Exercícios principais do treino (as alternativas não têm uid). */
function exercicios(entrada: EntradaDosItens): ItemDaLista[] {
  return umPorNome((entrada.treino?.conteudo.sessoes ?? []).flatMap((s) => s.exercicios ?? []));
}

/**
 * Dias com série concluída entre o início da pasta e a data da atualização (id = data ISO; nome = "Seg 17/11" mais as sessões
 * do treino que ele treinou). Sem nenhum registro no período, a semana ("1" segunda a "7" domingo): o check-in pode chegar
 * ao servidor antes das séries, e lá a semana vale.
 * shortcut: não oferece "qualquer data do período" (o servidor a aceita sem registro); trocar se o treinador pedir.
 */
function diasTreinados(entrada: EntradaDosItens): ItemDaLista[] {
  const inicio = entrada.treino?.inicio ?? entrada.dieta?.inicio ?? null;
  const fim = entrada.dataDaAtualizacao;
  const periodoValido = !!inicio && !!fim && fim >= inicio;
  const sessoesPorDia = new Map<string, Set<string>>();
  if (periodoValido) {
    for (const r of entrada.registros) {
      if (!r.concluida || r.data < inicio || r.data > fim) continue;
      sessoesPorDia.set(r.data, (sessoesPorDia.get(r.data) ?? new Set()).add(r.sessaoUid));
    }
  }
  if (sessoesPorDia.size === 0) return DIAS_POR_EXTENSO.map((nome, i) => ({ id: String(i + 1), nome }));
  const nomesDasSessoes = new Map((entrada.treino?.conteudo.sessoes ?? []).filter((s) => s.nome?.trim()).map((s) => [s.uid, s.nome.trim()] as const));
  return [...sessoesPorDia.keys()].sort().map((dia) => {
    const nomes = [...new Set([...(sessoesPorDia.get(dia) ?? [])].map((uid) => nomesDasSessoes.get(uid)).filter((n): n is string => !!n))];
    return { id: dia, nome: nomes.length ? `${rotuloDoDia(dia)} · ${nomes.join(', ')}` : rotuloDoDia(dia) };
  });
}

/** Itens de uma fonte. */
export function itensDaFonte(fonte: FonteDeItens, entrada: EntradaDosItens): ItemDaLista[] {
  switch (fonte) {
    case 'ALIMENTOS_DA_DIETA': return alimentos(entrada);
    case 'EXERCICIOS_DO_TREINO': return exercicios(entrada);
    case 'DIAS_TREINADOS': return diasTreinados(entrada);
    default: return [];
  }
}

/** As fontes que as perguntas ITENS_DO_PLANO do questionário usam (sem repetir). */
export function fontesDoQuestionario(modelo: ConteudoQuestionario): FonteDeItens[] {
  const fontes = modelo.secoes.flatMap((s) => s.perguntas).flatMap((p) => (p.tipo === 'ITENS_DO_PLANO' && p.fonte ? [p.fonte] : []));
  return [...new Set(fontes)];
}

/** Lista de cada fonte que o questionário usa, pronta para `errosRespostasAtualizacao`/`avaliarRespostas` e para o campo do aluno. */
export function itensDoQuestionario(modelo: ConteudoQuestionario, entrada: EntradaDosItens): ItensDisponiveis {
  return Object.fromEntries(fontesDoQuestionario(modelo).map((f) => [f, itensDaFonte(f, entrada)]));
}
