import type { ConteudoTreino, PastaModelo, Receita } from '../api/tipos';
import { filtrarModelos, SEM_COLECAO } from './colecoes';
import { DIAS_CURTOS, DIAS_SEMANA, normalizarTreino } from './editorTreino';
import { partesDaSessao } from './abasDasSessoes';

/**
 * A lista da folha "Usar semana de treino" (27/11, no padrão da "Usar receita"): duas abas pela forma do modelo (com
 * exercícios ou só a estrutura), chips de coleção e a faixa da semana da prévia. Só leitura. A escolha e as setas são as
 * da receita (`receitaEscolhida`, `idDaTecla` de `listaDeReceitas`).
 */

export type AbaDeSemanas = 'COMPLETAS' | 'ESTRUTURAS';

export const ABAS_DE_SEMANAS: readonly { valor: AbaDeSemanas; rotulo: string }[] = [
  { valor: 'COMPLETAS', rotulo: 'Semanas completas' },
  { valor: 'ESTRUTURAS', rotulo: 'Estruturas (sem exercícios)' },
];

/** Chip "Todas" (nenhum filtro de coleção) e o de quem não tem coleção (ou a coleção não existe mais). */
export const TODAS_AS_COLECOES = 'TODAS';
export const CHIP_SEM_COLECAO = 'SEM_COLECAO';

const totalDeExercicios = (conteudo: unknown) => normalizarTreino(conteudo).sessoes.reduce((n, s) => n + s.exercicios.length, 0);

/** Semana sem exercício nenhum é só a estrutura (os dias e os nomes das sessões). */
export function abaDaSemana(conteudo: unknown): AbaDeSemanas {
  return totalDeExercicios(conteudo) > 0 ? 'COMPLETAS' : 'ESTRUTURAS';
}

/** Quantas semanas de cada aba batem com a busca (o chip é da aba e não entra na contagem). */
export function contagemPorAba(semanas: readonly Receita[], busca: string): Record<AbaDeSemanas, number> {
  const contagem: Record<AbaDeSemanas, number> = { COMPLETAS: 0, ESTRUTURAS: 0 };
  for (const r of filtrarModelos(semanas, 'PLANO_TREINO', busca)) contagem[abaDaSemana(r.conteudo)] += 1;
  return contagem;
}

/** A aba em que a folha abre: Semanas completas, senão Estruturas, se só houver estruturas. */
export function abaInicial(semanas: readonly Receita[]): AbaDeSemanas {
  const doTipo = semanas.filter((r) => r.tipo === 'PLANO_TREINO');
  return doTipo.length && !doTipo.some((r) => abaDaSemana(r.conteudo) === 'COMPLETAS') ? 'ESTRUTURAS' : 'COMPLETAS';
}

/** As semanas da aba, na ordem da API (sem busca nem chip). */
export function semanasDaAba(semanas: readonly Receita[], aba: AbaDeSemanas): Receita[] {
  return semanas.filter((r) => r.tipo === 'PLANO_TREINO' && abaDaSemana(r.conteudo) === aba);
}

/** O chip da coleção do modelo: o id dela, ou "Sem coleção" sem coleção ou com uma que não existe mais (`agruparPorColecao`). */
function chipDoModelo(r: Receita, ids: ReadonlySet<string>): string {
  return r.pastaId && ids.has(r.pastaId) ? r.pastaId : CHIP_SEM_COLECAO;
}

/**
 * Os chips de coleção destes modelos: "Todas", as coleções que aparecem em algum, em ordem alfabética (português), e "Sem
 * coleção" por último, se houver modelo sem. Sem as coleções (erro ou ainda carregando) não há chips: os nomes faltariam.
 */
export function filtrosDeColecao(daAba: readonly Receita[], colecoes: readonly PastaModelo[] | null): { valor: string; rotulo: string }[] {
  if (!colecoes) return [];
  const ids = new Set(colecoes.map((c) => c.id));
  const presentes = new Set(daAba.map((r) => chipDoModelo(r, ids)));
  const comModelo = colecoes.filter((c) => presentes.has(c.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => ({ valor: c.id, rotulo: c.nome }));
  return [
    { valor: TODAS_AS_COLECOES, rotulo: 'Todas' },
    ...comModelo,
    ...(presentes.has(CHIP_SEM_COLECAO) ? [{ valor: CHIP_SEM_COLECAO, rotulo: SEM_COLECAO }] : []),
  ];
}

/** O chip que vale: o escolhido, se ele existe entre estes modelos; senão "Todas". */
export function filtroEfetivo(daAba: readonly Receita[], filtro: string, colecoes: readonly PastaModelo[] | null): string {
  return filtrosDeColecao(daAba, colecoes).some((f) => f.valor === filtro) ? filtro : TODAS_AS_COLECOES;
}

/** As semanas que a lista mostra: as da aba, que batem com a busca (nome e descrição, sem acento) e são da coleção do chip. */
export function semanasDaLista(semanas: readonly Receita[], { aba, busca, filtro }: { aba: AbaDeSemanas; busca: string; filtro: string },
  colecoes: readonly PastaModelo[] | null): Receita[] {
  const daAba = semanasDaAba(semanas, aba);
  const efetivo = filtroEfetivo(daAba, filtro, colecoes);
  const ids = new Set((colecoes ?? []).map((c) => c.id));
  return filtrarModelos(daAba, 'PLANO_TREINO', busca).filter((r) => efetivo === TODAS_AS_COLECOES || chipDoModelo(r, ids) === efetivo);
}

/** Uma sessão na faixa da semana. `abre` = tem exercício para mostrar embaixo (descanso sem exercício não abre). */
export interface SessaoDaFaixa {
  /** Posição em `conteudo.sessoes`. */
  indice: number;
  nome: string;
  exercicios: number;
  descanso: boolean;
  abre: boolean;
}

export interface DiaDaFaixa {
  /** 1 = segunda … 7 = domingo. */
  dia: number;
  curto: string;
  inteiro: string;
  /** Nenhuma = "Descanso" (discreto); mais de uma, quando o modelo marcou duas no mesmo dia. */
  sessoes: SessaoDaFaixa[];
}

/**
 * A faixa da semana da prévia: os 7 dias, de segunda a domingo, cada um com as sessões marcadas nele; e, à parte, as sem
 * dia fixo (semana salva pela equipe pode ter), para nenhuma sessão sumir da prévia. O nome é o da aba do editor
 * (`partesDaSessao`: sem o prefixo do dia; o descanso sem nome vira "Descanso").
 */
export function faixaDaSemana(conteudo: ConteudoTreino): { dias: DiaDaFaixa[]; semDia: SessaoDaFaixa[] } {
  const daFaixa = conteudo.sessoes.map((s, indice): SessaoDaFaixa => {
    const p = partesDaSessao(s, indice);
    return { indice, nome: p.nome, exercicios: s.exercicios.length, descanso: p.descanso, abre: s.exercicios.length > 0 };
  });
  const doDia = (dia: number | null) => daFaixa.filter((s) => conteudo.sessoes[s.indice].diaSemana === dia);
  const comDia = new Set(DIAS_SEMANA.map((_, i) => i + 1));
  return {
    dias: DIAS_SEMANA.map((inteiro, i) => ({ dia: i + 1, curto: DIAS_CURTOS[i], inteiro, sessoes: doDia(i + 1) })),
    semDia: daFaixa.filter((s) => !comDia.has(conteudo.sessoes[s.indice].diaSemana ?? 0)),
  };
}

/** A sessão que a prévia abre: a primeira com exercício na ordem da semana (as sem dia por último); nenhuma = `null`. */
export function sessaoInicial(conteudo: ConteudoTreino): number | null {
  const { dias, semDia } = faixaDaSemana(conteudo);
  return [...dias.flatMap((d) => d.sessoes), ...semDia].find((s) => s.abre)?.indice ?? null;
}
