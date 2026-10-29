import type { CompromissoDoAluno } from '../api/agendaTipos';

/**
 * Lembretes locais dos compromissos presenciais do aluno (D13): 1 dia antes e 2 horas antes. Regra pura; o agendamento no
 * aparelho (`expo-notifications`) fica em `aluno/compromissos/lembretes.ts`. O texto nunca traz o horário (P7: o lembrete só
 * se acerta quando o app abre e baixa a lista, então um horário já poderia estar velho), nem observação, local ou nome.
 */

/** O iOS guarda no máximo 64 notificações locais por app; as de todos os lembretes do app dividem esse teto. */
export const LIMITE_DE_NOTIFICACOES_LOCAIS = 64;

/**
 * Quantas notificações outros lembretes do app já usam: os da atualização do período, no máximo 3 por vez
 * (`lembretesDaAtualizacao`: 3 dias antes, no dia e no dia seguinte).
 */
export const NOTIFICACOES_DA_ATUALIZACAO = 3;

export type AntecedenciaDoLembrete = '1d' | '2h';

const MS_POR_HORA = 3_600_000;
const ANTECEDENCIAS: readonly { chave: AntecedenciaDoLembrete; antes: number; texto: string }[] = [
  { chave: '1d', antes: 24 * MS_POR_HORA, texto: 'Você tem um compromisso amanhã. Abra o app para ver.' },
  { chave: '2h', antes: 2 * MS_POR_HORA, texto: 'Você tem um compromisso daqui a pouco. Abra o app para ver.' },
];

export const TITULO_DO_LEMBRETE_DE_COMPROMISSO = 'Seu compromisso';

export interface LembreteDeCompromisso {
  /** `<compromissoId>:<1d|2h>`: o mesmo compromisso e antecedência sempre dão a mesma chave. */
  chave: string;
  compromissoId: string;
  antecedencia: AntecedenciaDoLembrete;
  /** Instante do disparo (não depende do fuso do aparelho). */
  data: Date;
  texto: string;
}

/** Prefixo dos identificadores de um usuário no aparelho: cancelar tudo dele é cancelar o que começa assim. */
export const prefixoDosLembretesDeCompromisso = (usuarioId: string): string => `treinos:compromisso:${usuarioId}:`;

/** `treinos:compromisso:<usuarioId>:<compromissoId>:<1d|2h>`: determinístico, para cancelar e reagendar. */
export const identificadorDoLembreteDeCompromisso = (usuarioId: string, lembrete: Pick<LembreteDeCompromisso, 'chave'>): string =>
  `${prefixoDosLembretesDeCompromisso(usuarioId)}${lembrete.chave}`;

/**
 * Os lembretes a agendar para a lista de compromissos que o app baixou: só os `AGENDADO` (cancelado, realizado e falta não
 * lembram), só os que ainda vão disparar (o que já passou é descartado; um compromisso daqui a 3 h só ganha o de 2 h), do
 * mais próximo para o mais distante (empate por chave). Se passar do que cabe, ficam os mais próximos: `limite` é o
 * teto do iOS menos o que outros lembretes usam (`reservadas`, por padrão as 3 da atualização). Compromisso repetido na
 * lista conta uma vez. A cada carga o chamador cancela os do usuário e agenda esta lista de novo, então cancelar e remarcar
 * valem na próxima abertura.
 */
export function lembretesDeCompromissos(
  compromissos: readonly Pick<CompromissoDoAluno, 'id' | 'inicio' | 'situacao'>[] | null | undefined,
  agora: Date = new Date(),
  reservadas: number = NOTIFICACOES_DA_ATUALIZACAO,
): LembreteDeCompromisso[] {
  const limite = Math.max(0, LIMITE_DE_NOTIFICACOES_LOCAIS - Math.max(0, reservadas));
  const lembretes = new Map<string, LembreteDeCompromisso>();
  for (const c of compromissos ?? []) {
    const inicio = Date.parse(c.inicio);
    if (c.situacao !== 'AGENDADO' || Number.isNaN(inicio)) continue;
    for (const { chave, antes, texto } of ANTECEDENCIAS) {
      const quando = inicio - antes;
      if (quando <= agora.getTime()) continue;
      const completa = `${c.id}:${chave}`;
      if (!lembretes.has(completa)) {
        lembretes.set(completa, { chave: completa, compromissoId: c.id, antecedencia: chave, data: new Date(quando), texto });
      }
    }
  }
  return [...lembretes.values()]
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.chave.localeCompare(b.chave))
    .slice(0, limite);
}
