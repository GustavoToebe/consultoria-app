/** Contratos da avaliação física (`AvaliacaoFisicaDtos` na API). Medidas em cm; nulo = não medido, nunca zero. */

export type CampoDaMedida =
  | 'bracoDireito'
  | 'bracoEsquerdo'
  | 'peitoral'
  | 'cintura'
  | 'abdomen'
  | 'quadril'
  | 'coxaDireita'
  | 'coxaEsquerda'
  | 'panturrilhaDireita'
  | 'panturrilhaEsquerda';

export type MedidasCorporais = Record<CampoDaMedida, number | null>;

export interface AvaliacaoFisica {
  id: string;
  data: string;
  medidas: MedidasCorporais;
  observacao: string | null;
  /** Peso do registro de peso da mesma data; nulo = sem peso nesse dia (o peso não é guardado na avaliação). */
  pesoKg: number | null;
  versao: number;
  criadoEm: string;
  alteradoEm: string;
}

/** Corpo do POST e do PUT; `versao` só no PUT (lock otimista). */
export interface DadosAvaliacaoFisica {
  data: string | null;
  medidas: MedidasCorporais;
  observacao: string | null;
  versao?: number;
}
