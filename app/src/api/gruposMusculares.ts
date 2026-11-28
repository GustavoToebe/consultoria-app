import { requisicao } from './cliente';

/** Biblioteca › Exercícios › Organizar grupos musculares: os nomes exatos em `origem` passam a ser `destino`. */
export interface UniaoDeGrupos { origem: string[]; destino: string }
export interface ResultadoDaUniao { exerciciosAlterados: number }

/** Só leitura: quantos exercícios (ativos e arquivados) a união mudaria agora. */
export const previaDaUniaoDeGrupos = (corpo: UniaoDeGrupos) =>
  requisicao<ResultadoDaUniao>('/exercicios/grupos-musculares/unir/previa', { metodo: 'POST', corpo });

/** Renomeia o grupo dos exercícios da consultoria; os planos já montados guardam a cópia e não mudam. */
export const unirGruposMusculares = (corpo: UniaoDeGrupos) =>
  requisicao<ResultadoDaUniao>('/exercicios/grupos-musculares/unir', { metodo: 'POST', corpo });
