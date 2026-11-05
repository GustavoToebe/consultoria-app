import type { Configuracao, Serie } from '../api/tipos';
import { papelDe } from './metodologia';
import { textoDoPasso, type UnidadeDeCarga } from './unidadeDeCarga';

const modo = (s: Serie) => s.carga?.modo ?? 'NENHUMA';

/**
 * Aviso ao registrar as repetições (D11 e N16). Na série de trabalho (`CARGA_TRABALHO`, papel `TRABALHO`), bater ou
 * passar o topo da meta avisa que o próximo treino sugere subir 1 passo do arredondamento. Nas outras séries de trabalho
 * e de pós-trabalho, passar de `repsMax` continua "Passou de N repetições, o máximo da meta.". Sem aviso em AMRAP,
 * cardio, técnica, aquecimento, preparação e tipo que a metodologia não conhece. Regra pura; funciona sem internet.
 */
export function avisoDeRepeticoes(
  serie: Serie,
  repeticoes: number | null,
  metodologia: Configuracao | null | undefined,
  arredondamentoKg = 0.5,
  unidade: UnidadeDeCarga = 'kg',
): string | null {
  if (repeticoes === null || serie.amrap || serie.cardio || serie.tecnica) return null;
  const papel = papelDe(metodologia, serie.tipo);
  const metaTopo = serie.repsMax ?? serie.repsMin;
  if (modo(serie) === 'CARGA_TRABALHO' && papel === 'TRABALHO' && metaTopo != null && repeticoes >= metaTopo) {
    const passo = textoDoPasso(arredondamentoKg, unidade);
    const palavra = metaTopo === 1 ? 'repetição' : 'repetições';
    if (repeticoes === metaTopo) return `Meta de ${metaTopo} ${palavra} atingida! No próximo treino a sugestão sobe +${passo}.`;
    return `Passou de ${metaTopo} ${palavra} (meta atingida)! No próximo treino a sugestão sobe +${passo}.`;
  }
  if (serie.repsMax == null || (papel !== 'TRABALHO' && papel !== 'POS_TRABALHO') || repeticoes <= serie.repsMax) return null;
  return `Passou de ${serie.repsMax} ${serie.repsMax === 1 ? 'repetição' : 'repetições'}, o máximo da meta.`;
}
