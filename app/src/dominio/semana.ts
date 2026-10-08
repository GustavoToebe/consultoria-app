import type { ConteudoTreino, Sessao } from '../api/tipos';
import { DIAS_SEMANA, TIPOS_SESSAO } from './editorTreino';
import { diaDaSemanaIso, somarDias } from './formatos';

/** Sessão marcada para o dia da semana (1 = segunda). Sem sessão naquele dia → `null`. */
export function sessaoDoDia(conteudo: ConteudoTreino, dia: number): Sessao | null {
  return conteudo.sessoes.find((s) => s.diaSemana === dia) ?? null;
}

/** Sessões na ordem da semana; as sem dia fixo (acessórios) vão no fim. */
export function sessoesDaSemana(conteudo: ConteudoTreino): Sessao[] {
  return [...conteudo.sessoes].sort((a, b) => (a.diaSemana ?? 99) - (b.diaSemana ?? 99));
}

export function rotuloDoDia(s: Sessao): string {
  if (s.diaSemana) return DIAS_SEMANA[s.diaSemana - 1];
  if (s.frequenciaSemanal) return `${s.frequenciaSemanal}x na semana`;
  return 'Sem dia fixo';
}

export function rotuloDoTipo(s: Sessao): string {
  return TIPOS_SESSAO.find((t) => t.valor === s.tipo)?.rotulo ?? s.tipo;
}

/** Total de séries da sessão (para "3 de 18 séries feitas"). */
export function totalDeSeries(s: Sessao): number {
  return s.exercicios.reduce((n, e) => n + e.series.length, 0);
}

/** Quantos dias para trás e para frente a API aceita registro (igual a `SincronizacaoService.DIAS_PARA_TRAS`). */
export const DIAS_PARA_TRAS = 60;

/** O aluno pode registrar nesta data? Até 60 dias para trás ou para frente de hoje. */
export function podeRegistrarEm(data: string, hoje: string): boolean {
  return data <= somarDias(hoje, DIAS_PARA_TRAS) && data >= somarDias(hoje, -DIAS_PARA_TRAS);
}

/**
 * Datas em que a sessão cai dentro do período do plano (chips "05/10 · 12/10 · 19/10"). Sem período,
 * duas semanas para cada lado de hoje. Com muitas datas, mostra uma janela de `max` em volta de hoje.
 */
export function datasDaSessao(s: Sessao, inicio: string | null, fim: string | null, hoje: string, max = 6): string[] {
  if (!s.diaSemana) return [];
  const de = inicio ?? somarDias(hoje, -7 - 6);
  const ate = fim ?? somarDias(hoje, 7 + 6);
  if (de > ate) return [];
  const primeira = somarDias(de, (s.diaSemana - diaDaSemanaIso(de) + 7) % 7);
  const datas: string[] = [];
  for (let d = primeira; d <= ate; d = somarDias(d, 7)) datas.push(d);
  if (datas.length <= max) return datas;
  const passadas = datas.filter((d) => d < hoje).length;
  const comeco = Math.min(Math.max(passadas - (max - 2), 0), datas.length - max);
  return datas.slice(comeco, comeco + max);
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "Quarta · Pernas"; se o nome já começa com o dia ("Quarta - Pernas"), fica como está. Sem dia fixo, só o nome. */
export function nomeComDia(s: Sessao, separador = ' · '): string {
  if (!s.diaSemana) return s.nome;
  const dia = DIAS_SEMANA[s.diaSemana - 1];
  return semAcento(s.nome).startsWith(semAcento(dia)) ? s.nome : `${dia}${separador}${s.nome}`;
}
