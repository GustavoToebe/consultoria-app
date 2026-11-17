import type { Compromisso, CompromissoDoAluno } from '../api/agendaTipos';

/**
 * Lembretes locais dos compromissos presenciais, do aluno e do treinador responsável: um por antecedência escolhida no
 * compromisso (`lembretesMinutos`, 0 a 5; lista vazia = nenhum). Regra pura; o agendamento no aparelho (`expo-notifications`)
 * fica em `aluno/compromissos/lembretes.ts`. O texto é um só e nunca traz horário (o lembrete só se acerta quando o app abre
 * e baixa a lista, então um horário já poderia estar velho), nem nome, observação, local ou "amanhã" (a antecedência é livre).
 */

/** O iOS guarda no máximo 64 notificações locais por app; as de todos os lembretes do app dividem esse teto. */
export const LIMITE_DE_NOTIFICACOES_LOCAIS = 64;

/**
 * Quantas notificações outros lembretes do app já usam: os da atualização do período, no máximo 3 por vez
 * (`lembretesDaAtualizacao`: 3 dias antes, no dia e no dia seguinte).
 */
export const NOTIFICACOES_DA_ATUALIZACAO = 3;

const MS_POR_MINUTO = 60_000;
const TEXTO_DO_LEMBRETE = 'Você tem um compromisso chegando. Abra o app para ver.';

export const TITULO_DO_LEMBRETE_DE_COMPROMISSO = 'Seu compromisso';

/** O que a regra lê de um compromisso: o do aluno já serve; o da equipe é reduzido por `treinador/agenda/lembretes`. */
export type CompromissoParaLembrete = Pick<CompromissoDoAluno, 'id' | 'inicio' | 'situacao' | 'lembretesMinutos'>;

export interface LembreteDeCompromisso {
  /** `<compromissoId>:<minutos>`: o mesmo compromisso e antecedência sempre dão a mesma chave. */
  chave: string;
  compromissoId: string;
  /** Antecedência em minutos antes do início. */
  minutos: number;
  /** Instante do disparo (não depende do fuso do aparelho). */
  data: Date;
  texto: string;
}

/** Prefixo dos identificadores de um usuário no aparelho: cancelar tudo dele é cancelar o que começa assim. */
export const prefixoDosLembretesDeCompromisso = (usuarioId: string): string => `treinos:compromisso:${usuarioId}:`;

/** `treinos:compromisso:<usuarioId>:<compromissoId>:<minutos>`: determinístico, para cancelar e reagendar. */
export const identificadorDoLembreteDeCompromisso = (usuarioId: string, lembrete: Pick<LembreteDeCompromisso, 'chave'>): string =>
  `${prefixoDosLembretesDeCompromisso(usuarioId)}${lembrete.chave}`;

/**
 * Os lembretes a agendar para a lista de compromissos que o app baixou: só os `AGENDADO` (cancelado, realizado e falta não
 * lembram), só os que ainda vão disparar (o que já passou é descartado), do disparo mais próximo para o mais distante
 * (empate por chave). Se passar do que cabe, ficam os mais próximos: `limite` é o teto do iOS menos o que outros lembretes
 * usam (`reservadas`, por padrão as 3 da atualização). Compromisso ou minuto repetido conta uma vez. A cada carga o chamador
 * cancela os do usuário e agenda esta lista de novo, então cancelar e remarcar valem na próxima abertura.
 */
export function lembretesDeCompromissos(
  compromissos: readonly CompromissoParaLembrete[] | null | undefined,
  agora: Date = new Date(),
  reservadas: number = NOTIFICACOES_DA_ATUALIZACAO,
): LembreteDeCompromisso[] {
  const limite = Math.max(0, LIMITE_DE_NOTIFICACOES_LOCAIS - Math.max(0, reservadas));
  const lembretes = new Map<string, LembreteDeCompromisso>();
  for (const c of compromissos ?? []) {
    const inicio = Date.parse(c.inicio);
    if (c.situacao !== 'AGENDADO' || Number.isNaN(inicio)) continue;
    for (const minutos of c.lembretesMinutos) {
      const quando = inicio - minutos * MS_POR_MINUTO;
      if (quando <= agora.getTime()) continue;
      const chave = `${c.id}:${minutos}`;
      if (!lembretes.has(chave)) lembretes.set(chave, { chave, compromissoId: c.id, minutos, data: new Date(quando), texto: TEXTO_DO_LEMBRETE });
    }
  }
  return [...lembretes.values()]
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.chave.localeCompare(b.chave))
    .slice(0, limite);
}

/**
 * Compromissos da equipe que lembram o treinador logado: só os dele como responsável. Sem situação própria (ela é de cada
 * aluno), o compromisso lembra enquanto não foi cancelado e algum participante segue `AGENDADO`.
 */
export function compromissosDoResponsavelParaLembrete(
  compromissos: readonly Pick<Compromisso, 'id' | 'inicio' | 'responsavelId' | 'cancelado' | 'participantes' | 'lembretesMinutos'>[],
  usuarioId: string,
): CompromissoParaLembrete[] {
  return compromissos.filter((c) => c.responsavelId === usuarioId).map((c) => ({
    id: c.id,
    inicio: c.inicio,
    lembretesMinutos: c.lembretesMinutos,
    situacao: c.cancelado ? 'CANCELADO' : c.participantes.some((p) => p.situacao === 'AGENDADO') ? 'AGENDADO' : 'REALIZADO',
  }));
}
