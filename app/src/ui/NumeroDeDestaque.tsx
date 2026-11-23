import { useMemo } from 'react';

import { MOTIVO_SEM_DADOS, type EnfaseDoNumero } from '../dominio/destaque';
import { useTema } from '../tema/TemaProvider';
import { coresDeDestaque } from '../tema/tokens';
import { aparenciaDoNumero, type AparenciaDoNumero } from './destaqueDoNumero';
import { Texto } from './Texto';

/**
 * Cores de destaque no tema em uso (gráficos, valores de lançamento, recordes). A peça `NumeroDeDestaque` saiu no cartão
 * pintado (23/11): todo número de indicador é o `ui/CartaoDeIndicador`; aqui ficam os ganchos e o motivo do "—".
 */
export function useDestaques() {
  const { cores, variante } = useTema();
  return useMemo(() => coresDeDestaque(cores, variante), [cores, variante]);
}

/** A aparência no tema em uso (o valor da linha dos Lançamentos). */
export function useAparenciaDoNumero(enfase: EnfaseDoNumero): AparenciaDoNumero {
  const { cores } = useTema();
  return aparenciaDoNumero(enfase, cores, useDestaques());
}

/**
 * Motivo escrito sob o "—" do número indisponível (D14): o zero é só "0"; o indisponível é "—" mais esta linha, em fonte
 * normal, menor que o número e em `textoSuave` (4,5:1 sobre `superficie` e `superficie2`, `tema/tokens.test.ts`).
 */
export function MotivoDoIndisponivel({ texto = MOTIVO_SEM_DADOS }: { texto?: string }) {
  const { cores } = useTema();
  return <Texto variante="pequeno" cor={cores.textoSuave}>{texto}</Texto>;
}
