import { textoDaCarga, type UnidadeDeCarga } from './unidadeDeCarga';

/**
 * Painel do ✓ (D2, 02/11): marcar a série feita com a carga vazia e com sugestão não grava no escuro. Abre na própria
 * tela (nunca `alert`) "Fez com 60 kg?" com [Sim, 60 kg] [Outra carga] [Sem carga]. Regra pura, sem rede: funciona offline.
 * A carga só entra no registro por escolha do aluno (a sugestão nunca preenche o campo) e as repetições seguem como o
 * aluno digitou (D3). "Sem carga" grava a série feita com carga nula, que o histórico mostra como "Feito, sem carga" (D4).
 */

export type EscolhaDoPainel = 'SIM' | 'MANTER_ANTERIOR' | 'OUTRA_CARGA' | 'SEM_CARGA';

export interface EntradaDoCheck {
  /** A série já está marcada feita: tocar de novo desmarca. */
  feita: boolean;
  /** Carga que está no campo (`null` = vazio). */
  carga: number | null;
  /** Repetições que estão no campo (`null` = vazio). */
  repeticoes: number | null;
  /** `SerieCalculada.sugestao`. */
  sugestaoKg: number | null;
  /** Sem campo de peso (exercício sem carga ou cardio). */
  semCampoDePeso: boolean;
}

/** O que gravar (os mesmos campos do `aoRegistrar` da série). */
export interface GravacaoDaSerie {
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
}

export type DecisaoDoCheck = { acao: 'GRAVAR'; gravar: GravacaoDaSerie } | { acao: 'PAINEL'; sugestaoKg: number };

/**
 * O que o ✓ faz: abre o painel só ao MARCAR com a carga vazia, sugestão e campo de peso; em qualquer outro caso grava
 * direto o que está no campo (inclusive desmarcar), como antes.
 */
export function decidirCheck(e: EntradaDoCheck): DecisaoDoCheck {
  const abrePainel = !e.feita && !e.semCampoDePeso && e.carga === null && e.sugestaoKg !== null;
  if (abrePainel) return { acao: 'PAINEL', sugestaoKg: e.sugestaoKg as number };
  return {
    acao: 'GRAVAR',
    gravar: { carga: e.semCampoDePeso ? null : e.carga, repeticoes: e.repeticoes, concluida: !e.feita },
  };
}

export interface OpcaoDoPainel {
  escolha: EscolhaDoPainel;
  rotulo: string;
}

export interface PainelDoCheck {
  pergunta: string;
  opcoes: OpcaoDoPainel[];
}

export interface ExtraDoPainel {
  /** Repetições da progressão. Entram na pergunta só quando o campo de reps está vazio. */
  sugestaoReps?: number | null;
  /** O que o aluno já digitou em Reps (`null` = vazio). */
  repeticoesDigitadas?: number | null;
  /** Última carga. Com sugestão maior, o painel oferece "Manter X kg". */
  ultimaCargaKg?: number | null;
}

/** Textos do painel. Sem repetições sugeridas: "Fez com 60 kg?". Com elas e o campo vazio: "Fez 77,5 kg × 5 reps?". */
export function painelDoCheck(sugestaoKg: number, unidade: UnidadeDeCarga = 'kg', extra: ExtraDoPainel = {}): PainelDoCheck {
  // Só o texto muda: "Sim" continua gravando `sugestaoKg`, em kg, sem passar por libra.
  const kg = textoDaCarga(sugestaoKg, unidade);
  const comReps = extra.repeticoesDigitadas == null && extra.sugestaoReps != null;
  const reps = extra.sugestaoReps;
  const pergunta = comReps ? `Fez ${kg} × ${reps} ${reps === 1 ? 'rep' : 'reps'}?` : `Fez com ${kg}?`;
  const sim = comReps ? `Sim, ${kg} × ${reps}` : `Sim, ${kg}`;
  const opcoes: OpcaoDoPainel[] = [{ escolha: 'SIM', rotulo: sim }];
  if (extra.ultimaCargaKg != null && sugestaoKg > extra.ultimaCargaKg) {
    opcoes.push({ escolha: 'MANTER_ANTERIOR', rotulo: `Manter ${textoDaCarga(extra.ultimaCargaKg, unidade)}` });
  }
  opcoes.push({ escolha: 'OUTRA_CARGA', rotulo: 'Outra carga' }, { escolha: 'SEM_CARGA', rotulo: 'Sem carga' });
  return { pergunta, opcoes };
}

export type ResultadoDaEscolha = { gravar: GravacaoDaSerie } | { gravar: null; focarCarga: true };

/**
 * O que cada escolha faz, com as repetições que o aluno já digitou: "Sim" grava a sugestão como carga, "Sem carga" grava
 * a série feita sem carga, "Outra carga" não grava: fecha o painel e leva o aluno ao campo de carga.
 */
export function aplicarEscolhaDoPainel(
  escolha: EscolhaDoPainel,
  sugestaoKg: number,
  repeticoes: number | null,
  extra: { sugestaoReps?: number | null; ultimaCargaKg?: number | null } = {},
): ResultadoDaEscolha {
  // Reps digitadas vencem a sugestão. Campo vazio usa as repetições da progressão, quando há.
  const reps = repeticoes != null ? repeticoes : (extra.sugestaoReps ?? null);
  switch (escolha) {
    case 'SIM':
      return { gravar: { carga: sugestaoKg, repeticoes: reps, concluida: true } };
    case 'MANTER_ANTERIOR':
      return { gravar: { carga: extra.ultimaCargaKg ?? null, repeticoes: reps, concluida: true } };
    case 'SEM_CARGA':
      return { gravar: { carga: null, repeticoes, concluida: true } };
    case 'OUTRA_CARGA':
      return { gravar: null, focarCarga: true };
  }
}
