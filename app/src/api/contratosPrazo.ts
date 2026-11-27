import { requisicao } from './cliente';

/**
 * Prazo para assinar da consultoria (S6, `docs/planos/contrato-digital.md`): `GET`/`PUT /consultoria/contratos`, com
 * `CONTRATO_LER`/`CONTRATO_ALTERAR`. `prazoDias` de 1 a 60; nulo = não trava (só pendência). Vale para os contratos gerados
 * depois; os já gerados não mudam. Erros: 503 `CONTRATOS_INDISPONIVEL` (chave desligada) e 422 `CONTRATO_PRAZO_INVALIDO` no campo `prazoDias`.
 */
export interface PrazoDosContratos {
  prazoDias: number | null;
}

export const obterPrazoDosContratos = () => requisicao<PrazoDosContratos>('/consultoria/contratos');

export const atualizarPrazoDosContratos = (prazoDias: number | null) =>
  requisicao<PrazoDosContratos>('/consultoria/contratos', { metodo: 'PUT', corpo: { prazoDias } });
