import type { EtapaRegistrada, Sessao } from '../api/tipos';
import { somarVolumes, volumeDaSerie, type Volume } from './etapas';
import { numeroParaTela } from './formatos';

/**
 * Faixa do treino ao vivo (frente Engajamento, passo 0.3): duração, volume e séries feitas da sessão no dia, contadas
 * só com o que o aluno marcou. Nada é estimado: volume = carga × repetições das séries (e etapas) registradas com os
 * dois números, sem os exercícios sem carga e o cardio; nenhum número = "—".
 */

/** O que a conta usa de um registro da série. */
export interface RegistroDoVolume {
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  etapas: EtapaRegistrada[] | null;
}

/** Volume do dia na sessão; `null` sem carga e repetições registradas. */
export function volumeDaSessao(sessao: Pick<Sessao, 'exercicios'>, registroDe: (serieUid: string) => RegistroDoVolume | undefined): Volume | null {
  const volumes: (Volume | null)[] = [];
  for (const e of sessao.exercicios) {
    if (e.modalidade === 'CARDIO' || e.unidade === 'nenhuma') continue;
    for (const s of e.series) {
      if (s.cardio) continue;
      const r = registroDe(s.uid);
      const registrada = r ? (r.etapas ? r.etapas.some((x) => x.situacao === 'FEITA') : r.concluida) : false;
      if (registrada) volumes.push(volumeDaSerie(r!, false));
    }
  }
  return somarVolumes(volumes, volumes.length);
}

/** "3.450 kg" (milhar com ponto, até duas casas); `null` = "—". */
export function textoDoVolumeAoVivo(v: Volume | null): string {
  if (!v) return '—';
  const [inteiro, decimais] = numeroParaTela(v.valor).split(',');
  return `${inteiro!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimais ? `,${decimais}` : ''} kg`;
}

/** "0:45", "12:05", "1:02:10"; `null` = "—". */
export function textoDaDuracaoAoVivo(segundos: number | null): string {
  if (segundos == null || segundos < 0) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/** O que o leitor de tela ouve: "12 minutos", "1 hora e 2 minutos", "menos de 1 minuto". */
export function duracaoFalada(segundos: number | null): string {
  if (segundos == null || segundos < 0) return 'sem duração';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const horas = h ? `${h} ${h === 1 ? 'hora' : 'horas'}` : '';
  const minutos = m ? `${m} ${m === 1 ? 'minuto' : 'minutos'}` : '';
  if (!horas && !minutos) return 'menos de 1 minuto';
  return [horas, minutos].filter(Boolean).join(' e ');
}

/**
 * Qual duração a faixa mostra: a declarada na conclusão (treino concluído), a contada desde a primeira série marcada
 * (só hoje, enquanto não concluiu) ou nenhuma.
 */
export function duracaoDaFaixa(p: {
  concluida: { duracaoSegundos: number | null } | null;
  data: string;
  hoje: string;
  /** Segundos desde a primeira série marcada (`duracaoDoTreino`); `null` sem início ou acima de 6 h. */
  contada: number | null;
}): { segundos: number | null; aoVivo: boolean } {
  if (p.concluida) return { segundos: p.concluida.duracaoSegundos, aoVivo: false };
  if (p.data !== p.hoje) return { segundos: null, aoVivo: false };
  return { segundos: p.contada, aoVivo: p.contada != null };
}
