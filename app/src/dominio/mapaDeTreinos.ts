import { fundirConclusoes, chaveDaConclusao, type ConclusaoDoTreino, type ConclusaoLocal } from './sessoesConcluidas';
import { nomeDoMes } from './agendaCalendario';
import { somarDias } from './formatos';
import { periodoDaSemana } from './progressoSemana';

// Mapa de treinos do aluno (plano `comunidade-organizada-e-mapa`, M1 a M5): grade de semanas (segunda a domingo, como o
// "Sua semana") com um dia por célula, a partir das conclusões que a API devolve e das que ainda estão só no aparelho.

export const DIAS_DO_MAPA = 365;
/** A API aceita no máximo 366 dias entre `de` e `ate` (`SessaoConcluidaService.PERIODO_MAXIMO_DIAS`). */
const ALCANCE_DA_API_EM_DIAS = 366;
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;
const TEXTO_DO_RESULTADO = { COMPLETA: 'fiz tudo', PARCIAL: 'fiz em parte' } as const;

export type ResultadoDoTreino = 'COMPLETA' | 'PARCIAL';
export interface TreinoDoDia { nome: string; resultado: ResultadoDoTreino }
/** 0 = sem treino; 1 = só "fiz em parte" no dia; 2 = ao menos um "fiz tudo". */
export interface CelulaDoMapa { data: string; nivel: 0 | 1 | 2; treinos: TreinoDoDia[]; futuro: boolean }
/** Uma semana: sempre 7 células (segunda a domingo); `mes` só na primeira semana de cada mês (a que traz o dia 1), ex. "mar". */
export interface SemanaDoMapa { mes: string | null; dias: CelulaDoMapa[] }
export interface MapaDeTreinos { semanas: SemanaDoMapa[]; diasTreinados: number }

/**
 * Do início da semana de `hoje − 364` até `hoje`. `de` é o que se pede à API: o início do mapa limitado ao alcance dela (até
 * 4 dias da primeira semana, anteriores aos 12 meses, podem ficar sem dado).
 */
export function periodoDoMapa(hoje: string): { inicio: string; fim: string; de: string } {
  const inicio = periodoDaSemana(somarDias(hoje, 1 - DIAS_DO_MAPA)).inicio;
  const limite = somarDias(hoje, -ALCANCE_DA_API_EM_DIAS);
  return { inicio, fim: hoje, de: inicio > limite ? inicio : limite };
}

/**
 * Conclusões da API e do aparelho numa lista só (`fundirConclusoes`: a do aparelho ganha, a que falhou não conta), mantendo o
 * nome da sessão que a API trouxe. Conclusão só do aparelho fica sem nome (o mapa mostra "Treino").
 */
export function juntarConclusoes(doServidor: readonly ConclusaoDoTreino[], locais: readonly ConclusaoLocal[]): ConclusaoDoTreino[] {
  const nomes = new Map(doServidor.map((c) => [chaveDaConclusao(c), c.sessaoNome ?? null]));
  return fundirConclusoes(locais, doServidor).map((c) => ({ ...c, sessaoNome: nomes.get(chaveDaConclusao(c)) ?? null }));
}

/** Reaberta (`concluida` falso) não conta; fora do período ou depois de hoje também não. */
export function montarMapa(conclusoes: readonly ConclusaoDoTreino[], hoje: string): MapaDeTreinos {
  const { inicio } = periodoDoMapa(hoje);
  const fim = periodoDaSemana(hoje).fim;
  const porDia = new Map<string, TreinoDoDia[]>();
  for (const c of conclusoes) {
    if (!c.concluida || !c.resultado || c.data < inicio || c.data > hoje) continue;
    porDia.set(c.data, [...(porDia.get(c.data) ?? []), { nome: c.sessaoNome || 'Treino', resultado: c.resultado }]);
  }
  const semanas: SemanaDoMapa[] = [];
  let diasTreinados = 0;
  for (let primeiro = inicio; primeiro <= fim; primeiro = somarDias(primeiro, 7)) {
    const dias = Array.from({ length: 7 }, (_, i): CelulaDoMapa => {
      const data = somarDias(primeiro, i);
      const treinos = porDia.get(data) ?? [];
      const nivel = treinos.some((t) => t.resultado === 'COMPLETA') ? 2 : treinos.length ? 1 : 0;
      if (nivel) diasTreinados++;
      return { data, nivel, treinos, futuro: data > hoje };
    });
    const primeiroDoMes = dias.find((d) => d.data.endsWith('-01'));
    semanas.push({ mes: primeiroDoMes ? MESES_CURTOS[Number(primeiroDoMes.data.slice(5, 7)) - 1] : null, dias });
  }
  return { semanas, diasTreinados };
}

/** As últimas `n` semanas (a mais recente por último). */
export const semanasParaCelular = (mapa: MapaDeTreinos, n: number): SemanaDoMapa[] => (n > 0 ? mapa.semanas.slice(-n) : []);

/** "12 de março: Treino A, fiz tudo" / "12 de março: sem treino"; vários treinos separados por "; ". */
export function textoDaCelula(c: CelulaDoMapa): string {
  const dia = `${Number(c.data.slice(8, 10))} de ${nomeDoMes(Number(c.data.slice(5, 7)))}`;
  if (c.futuro) return `${dia}: ainda não chegou`;
  if (!c.treinos.length) return `${dia}: sem treino`;
  return `${dia}: ${c.treinos.map((t) => `${t.nome}, ${TEXTO_DO_RESULTADO[t.resultado]}`).join('; ')}`;
}
