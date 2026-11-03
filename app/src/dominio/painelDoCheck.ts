import { numeroParaTela } from './formatos';

/**
 * Painel do ✓ (D2, 02/11): marcar a série feita com a carga vazia e com sugestão não grava no escuro. Abre na própria
 * tela (nunca `alert`) "Fez com 60 kg?" com [Sim, 60 kg] [Outra carga] [Sem carga]. Regra pura, sem rede: funciona offline.
 * A carga só entra no registro por escolha do aluno (a sugestão nunca preenche o campo) e as repetições seguem como o
 * aluno digitou (D3). "Sem carga" grava a série feita com carga nula, que o histórico mostra como "Feito, sem carga" (D4).
 */

export type EscolhaDoPainel = 'SIM' | 'OUTRA_CARGA' | 'SEM_CARGA';

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

/** Textos do painel: "Fez com 60 kg?" e as três opções, nesta ordem. */
export function painelDoCheck(sugestaoKg: number): PainelDoCheck {
  const kg = `${numeroParaTela(sugestaoKg)} kg`;
  return {
    pergunta: `Fez com ${kg}?`,
    opcoes: [
      { escolha: 'SIM', rotulo: `Sim, ${kg}` },
      { escolha: 'OUTRA_CARGA', rotulo: 'Outra carga' },
      { escolha: 'SEM_CARGA', rotulo: 'Sem carga' },
    ],
  };
}

export type ResultadoDaEscolha = { gravar: GravacaoDaSerie } | { gravar: null; focarCarga: true };

/**
 * O que cada escolha faz, com as repetições que o aluno já digitou: "Sim" grava a sugestão como carga, "Sem carga" grava
 * a série feita sem carga, "Outra carga" não grava: fecha o painel e leva o aluno ao campo de carga.
 */
export function aplicarEscolhaDoPainel(escolha: EscolhaDoPainel, sugestaoKg: number, repeticoes: number | null): ResultadoDaEscolha {
  switch (escolha) {
    case 'SIM':
      return { gravar: { carga: sugestaoKg, repeticoes, concluida: true } };
    case 'SEM_CARGA':
      return { gravar: { carga: null, repeticoes, concluida: true } };
    case 'OUTRA_CARGA':
      return { gravar: null, focarCarga: true };
  }
}
