import type { Painel } from '../../api/financeiroTipos';
import { avisoDoHistoricoParcial } from '../../dominio/financeiro';
import { Incompleto } from '../../ui/Estados';

/** Ressalva informativa e neutra (ícone de informação, sem cor de alerta): uma vez por tela, quando a API marca o histórico como parcial. */
export function AvisoDoHistoricoParcial({ painel }: { painel: Pick<Painel, 'historicoFinanceiroParcial'> | null | undefined }) {
  const texto = avisoDoHistoricoParcial(painel);
  return texto ? <Incompleto texto={texto} /> : null;
}
