import type { MelhoresDoExercicio } from '../api/tipos';
import { SEM_DADO } from './formatos';
import { textoDaCarga, type UnidadeDeCarga } from './unidadeDeCarga';

/**
 * Folha "Histórico" do exercício do aluno (plano `docs/planos/treino-do-aluno-lacunas-cbum.md`, D2): os melhores que o
 * pacote traz, só reorganizados. Nada é calculado além do que o pacote já tem; sem dado, "—".
 */

export interface LinhaDoRecorde {
  rotulo: string;
  valor: string;
}

/**
 * Três linhas, sempre na mesma ordem: maior carga, mais repetições (a maior contagem entre as cargas; empate, a carga
 * maior) e maior volume (carga × repetições de uma série), com os mesmos nomes do aviso de recorde (`textoDoRecorde`). `null` (exercício sem registro antes do corte) deixa as três em "—".
 */
export function linhasDosRecordes(m: MelhoresDoExercicio | null | undefined, unidade: UnidadeDeCarga = 'kg'): LinhaDoRecorde[] {
  const mais = (m?.repeticoesPorCarga ?? []).reduce<{ carga: number; repeticoes: number } | null>(
    (melhor, r) => (!melhor || r.repeticoes > melhor.repeticoes || (r.repeticoes === melhor.repeticoes && r.carga > melhor.carga) ? r : melhor),
    null,
  );
  return [
    { rotulo: 'Maior carga', valor: m ? textoDaCarga(m.maiorCarga, unidade) : SEM_DADO },
    { rotulo: 'Mais repetições', valor: mais ? `${mais.repeticoes} com ${textoDaCarga(mais.carga, unidade)}` : SEM_DADO },
    { rotulo: 'Maior volume', valor: m ? textoDaCarga(m.maiorVolume, unidade) : SEM_DADO },
  ];
}
