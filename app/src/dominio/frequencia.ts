import type { DiaDeTreino, Sessao } from '../api/tipos';
import { dataCurta, somarDias } from './formatos';
import { periodoDaSemana } from './progressoSemana';

/** A API recusa consulta de execuções com mais de 366 dias entre as datas. */
const DIAS_MAXIMOS_DA_CONSULTA = 364;

export interface PastaDaFrequencia {
  titulo: string;
  inicio: string | null;
  fim: string | null;
}

export interface PeriodoContado {
  de: string;
  ate: string;
}

export interface PlanoDaFrequencia {
  semana: PeriodoContado;
  /** Segunda a domingo da semana anterior (o "Semana passada: N" dos indicadores). */
  semanaPassada: PeriodoContado;
  /** Nulo: sem pasta vigente, sem período ou com início no futuro (nada a contar ainda). */
  pasta: (PeriodoContado & { titulo: string; limitada: boolean }) | null;
  /** O que pedir à API: cobre a semana passada, a semana e a pasta de uma vez. */
  consulta: PeriodoContado;
}

export interface Frequencia {
  semana: number;
  semanaPassada: number;
  /** Data do último treino com série concluída na semana corrente e na pasta (não na semana passada); nulo se nenhum. */
  ultimo: string | null;
  /** Nulo: sem pasta contável. */
  pasta: { titulo: string; de: string; ate: string; limitada: boolean; treinos: number } | null;
}

const menor = (a: string, b: string) => (a < b ? a : b);

/**
 * Períodos contados na ficha: a semana corrente (segunda a hoje), a anterior (segunda a domingo) e a pasta vigente (do
 * início até o menor entre o fim e hoje; uma pasta com mais de um ano conta só os últimos 365 dias, que é o que a API entrega).
 */
export function planejarFrequencia(hoje: string, pasta: PastaDaFrequencia | null): PlanoDaFrequencia {
  const inicioDaSemana = periodoDaSemana(hoje).inicio;
  const semana = { de: inicioDaSemana, ate: hoje };
  const semanaPassada = { de: somarDias(inicioDaSemana, -7), ate: somarDias(inicioDaSemana, -1) };
  if (!pasta?.inicio || !pasta.fim || pasta.inicio > hoje) return { semana, semanaPassada, pasta: null, consulta: { de: semanaPassada.de, ate: hoje } };
  const ate = pasta.fim < hoje ? pasta.fim : hoje;
  const maisAntigo = somarDias(hoje, -DIAS_MAXIMOS_DA_CONSULTA);
  const de = pasta.inicio < maisAntigo ? maisAntigo : pasta.inicio;
  return {
    semana,
    semanaPassada,
    pasta: { de, ate, titulo: pasta.titulo, limitada: de !== pasta.inicio },
    consulta: { de: menor(de, semanaPassada.de), ate: hoje },
  };
}

/**
 * Quantos treinos têm registro no período: cada par (data, sessão) com pelo menos uma série concluída conta uma vez.
 * Só contagem; o previsto vem à parte (`treinosPrevistosNaSemana`).
 */
export function treinosComRegistro(dias: DiaDeTreino[], de: string, ate: string): number {
  const feitos = new Set<string>();
  for (const dia of dias) {
    if (dia.data < de || dia.data > ate) continue;
    for (const sessao of dia.sessoes) {
      if (sessao.exercicios.some((e) => e.series.some((s) => s.concluida))) feitos.add(`${dia.data}|${sessao.sessaoUid}`);
    }
  }
  return feitos.size;
}

export function frequenciaDe(dias: DiaDeTreino[], plano: PlanoDaFrequencia): Frequencia {
  // O "último treino" do Resumo continua sendo o da semana e da pasta: a semana passada só entra na contagem dela.
  const desde = plano.pasta ? menor(plano.pasta.de, plano.semana.de) : plano.semana.de;
  return {
    semana: treinosComRegistro(dias, plano.semana.de, plano.semana.ate),
    semanaPassada: treinosComRegistro(dias, plano.semanaPassada.de, plano.semanaPassada.ate),
    ultimo: ultimoDiaComRegistro(dias.filter((d) => d.data >= desde)),
    pasta: plano.pasta ? { ...plano.pasta, treinos: treinosComRegistro(dias, plano.pasta.de, plano.pasta.ate) } : null,
  };
}

/** Última data com pelo menos uma série concluída (os dias podem vir em qualquer ordem). */
export function ultimoDiaComRegistro(dias: DiaDeTreino[]): string | null {
  let ultimo: string | null = null;
  for (const dia of dias) {
    const feito = dia.sessoes.some((s) => s.exercicios.some((e) => e.series.some((x) => x.concluida)));
    if (feito && (ultimo === null || dia.data > ultimo)) ultimo = dia.data;
  }
  return ultimo;
}


/**
 * Treinos previstos por semana no plano de treino da pasta vigente: cada sessão do tipo TREINO com dia fixo conta 1, e a
 * sem dia fixo conta as "Vezes por semana" dela. Basta uma sessão de treino sem nenhum dos dois para o total ficar
 * desconhecido (`null`): o app não inventa o previsto. Sem sessão de treino, também `null`.
 */
export function treinosPrevistosNaSemana(sessoes: readonly Pick<Sessao, 'tipo' | 'diaSemana' | 'frequenciaSemanal'>[]): number | null {
  let total = 0;
  for (const s of sessoes) {
    if (s.tipo !== 'TREINO') continue;
    const vezes = s.diaSemana ? 1 : s.frequenciaSemanal;
    if (!vezes) return null;
    total += vezes;
  }
  return total > 0 ? total : null;
}

/** Um indicador do cartão (`CartaoDeIndicador` neutro): o valor já em texto, o estado e a linha de baixo. */
export interface IndicadorDaFrequencia {
  rotulo: string;
  valor: string;
  estado: 'valor' | 'zero' | 'indisponivel';
  detalhe: string | null;
  /** Só no indisponível: por que não há número. */
  motivo?: string;
}

export interface ResumoDaFrequencia {
  /** "Pasta <título> (dd/mm a dd/mm)", na pílula do cartão; sem pasta vigente, "Nenhuma pasta vigente.", abaixo dos indicadores. */
  pasta: string;
  comPasta: boolean;
  indicadores: IndicadorDaFrequencia[];
}

const contagem = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/**
 * Cartão "Frequência e mobilidade" da ficha: "Treinos esta semana" e "Mobilidade esta semana", com "Semana passada: N"
 * embaixo. Com o previsto da pasta vigente, "1 de 4 treinos" (o plural segue o previsto). `mobilidade`: `'oculta'` sem
 * a permissão (ou com a busca dela em erro, que a tela mostra à parte), `null` sem plano de mobilidade publicado na pasta
 * ("—" com o motivo). Sem pasta vigente não há mobilidade a contar: só o indicador dos treinos, e a nota diz isso uma vez.
 */
export function resumoDaFrequencia(
  f: Pick<Frequencia, 'semana' | 'semanaPassada' | 'pasta'>, vigente: { titulo: string } | null,
  mobilidade: { naSemana: number; semanaPassada: number } | null | 'oculta', previstos: number | null,
): ResumoDaFrequencia {
  const p = f.pasta;
  const pasta = !vigente ? 'Nenhuma pasta vigente.'
    : p ? `Pasta ${p.titulo} (${dataCurta(p.de)} a ${dataCurta(p.ate)}${p.limitada ? ', últimos 12 meses' : ''})`
      : `Pasta ${vigente.titulo}`;
  const comPrevisto = vigente && previstos ? previstos : null;
  const indicadores: IndicadorDaFrequencia[] = [{
    rotulo: 'Treinos esta semana',
    valor: comPrevisto ? `${f.semana} de ${contagem(comPrevisto, 'treino', 'treinos')}` : contagem(f.semana, 'treino', 'treinos'),
    estado: f.semana === 0 ? 'zero' : 'valor',
    detalhe: `Semana passada: ${f.semanaPassada}`,
  }];
  if (vigente && mobilidade !== 'oculta') {
    indicadores.push(mobilidade === null
      ? { rotulo: 'Mobilidade esta semana', valor: '—', estado: 'indisponivel', detalhe: null, motivo: 'A pasta vigente não tem mobilidade publicada.' }
      : {
        rotulo: 'Mobilidade esta semana', valor: contagem(mobilidade.naSemana, 'dia', 'dias'),
        estado: mobilidade.naSemana === 0 ? 'zero' : 'valor', detalhe: `Semana passada: ${mobilidade.semanaPassada}`,
      });
  }
  return { pasta, comPasta: !!vigente, indicadores };
}
