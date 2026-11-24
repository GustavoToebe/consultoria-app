import { Folha } from '../../ui/Folha';
import { DetalheDaCobranca, type CascaDoDetalhe, type PropsDaCasca, type PropsDoDetalhe } from './DetalheDaCobranca';

function CascaDeFolha({ titulo, aoFechar, rodape, children }: PropsDaCasca) {
  return <Folha visivel titulo={titulo} aoFechar={aoFechar} rodape={rodape}>{children}</Folha>;
}

/** A cobrança numa `Folha` por cima da tela; "Renegociar" troca o conteúdo da folha (sem folha sobre folha). */
const CASCA_DE_FOLHA: CascaDoDetalhe = { Componente: CascaDeFolha, renegociarPorCima: false, rodapeEmDuasLinhas: false };

/**
 * Uma cobrança numa `Folha` (o conteúdo é o `DetalheDaCobranca`, o mesmo do painel fixo das Cobranças na tela ultralarga).
 * Nula = fechada.
 */
export function FolhaDaCobranca(props: PropsDoDetalhe) {
  return <DetalheDaCobranca {...props} casca={CASCA_DE_FOLHA} />;
}
