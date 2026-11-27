import type { EventoAuditoria } from '../api/equipeTipos';
import { inteiroComMilhar } from './formatos';
import { textoDoObjeto } from './objetoDaAuditoria';

/**
 * Leitura da lista da Auditoria (27/11): datas e horas de Brasília (UTC−3 fixo, a mesma regra do `hojeEmBrasilia` do
 * Financeiro; um evento às 23:30 de Brasília nunca pula para o dia seguinte pelo fuso do aparelho), grupos por dia, o
 * resumo da linha e a junção das páginas. Funções puras.
 */
const BRASILIA_MS = 3 * 3600 * 1000;
const doisDigitos = (n: number) => String(n).padStart(2, '0');

function emBrasilia(instante: string): Date | null {
  const t = new Date(instante).getTime();
  return Number.isNaN(t) ? null : new Date(t - BRASILIA_MS);
}

/** O dia de Brasília do instante, em ISO (`2026-11-27`); instante inválido = `null`. */
export function diaEmBrasilia(instante: string): string | null {
  return emBrasilia(instante)?.toISOString().slice(0, 10) ?? null;
}

/** A hora de Brasília (`14:05`); inválido = "—". */
export function horaEmBrasilia(instante: string): string {
  const d = emBrasilia(instante);
  return d ? `${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}` : '—';
}

const dataIsoParaTela = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Data e hora completas de Brasília: "27/11/2026 às 14:05:09" (o detalhe; a linha mostra só a hora). */
export function quandoCompleto(instante: string): string {
  const d = emBrasilia(instante);
  if (!d) return '—';
  return `${dataIsoParaTela(d.toISOString().slice(0, 10))} às ${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}:${doisDigitos(d.getUTCSeconds())}`;
}

const diaAnterior = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** O subtítulo do dia: "Hoje", "Ontem" ou a data ("26/11/2026"); `hoje` é o dia de Brasília. */
export function tituloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje';
  if (dia === diaAnterior(hoje)) return 'Ontem';
  return dataIsoParaTela(dia);
}

export interface GrupoDoDia { dia: string; titulo: string; eventos: EventoAuditoria[] }

/** Os eventos (já do mais novo para o mais antigo, como a API manda) em grupos de dia, na mesma ordem. */
export function agruparPorDia(eventos: readonly EventoAuditoria[], hoje: string): GrupoDoDia[] {
  const grupos: GrupoDoDia[] = [];
  for (const e of eventos) {
    const dia = diaEmBrasilia(e.criadoEm) ?? '';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.eventos.push(e);
    else grupos.push({ dia, titulo: dia ? tituloDoDia(dia, hoje) : 'Sem data', eventos: [e] });
  }
  return grupos;
}

/**
 * O que a linha diz além da ação: o objeto afetado ("Aluno Vitor Luiz Santos") ou, sem objeto, de onde veio ("Web",
 * "App Android"); sem os dois, vazio. Nunca o `resumo` da API, que repete a ação.
 */
export function resumoDaLinha(e: EventoAuditoria): string {
  return textoDoObjeto(e) ?? e.origem?.trim() ?? '';
}

/**
 * "Carregar mais" acrescenta a página seguinte à lista. A paginação é por posição e a lista começa pelo mais novo: um
 * evento novo entre uma página e outra empurra tudo uma posição, e o último da página anterior volta no começo da
 * seguinte. Repetido (mesmo `id`) sai.
 */
export function juntarPaginas(atuais: readonly EventoAuditoria[], novos: readonly EventoAuditoria[]): EventoAuditoria[] {
  const vistos = new Set(atuais.map((e) => e.id));
  return [...atuais, ...novos.filter((e) => !vistos.has(e.id))];
}

/** "252 eventos neste filtro" / "1 evento neste filtro". */
export function textoDaContagem(total: number): string {
  return `${inteiroComMilhar(total)} ${total === 1 ? 'evento' : 'eventos'} neste filtro`;
}
