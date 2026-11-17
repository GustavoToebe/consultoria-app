import { useWindowDimensions } from 'react-native';

import { InterruptorDeLembretesDeCompromisso } from '../../aluno/compromissos/InterruptorDeLembretesDeCompromisso';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { PreferenciasDoApp } from '../../ui/PreferenciasDoApp';
import { Tela } from '../../ui/Tela';

/**
 * Ajustes: preferências pessoais de tema, contraste, tamanho do texto, animações e vibração. No PC usa a largura útil
 * (como Números) e as preferências vão em duas colunas quando o contêiner cabe. Quem vê a agenda ganha o interruptor dos
 * lembretes de compromisso (o mesmo do aluno; na web ele não aparece, porque não há notificação).
 */
export default function Ajustes() {
  const { width } = useWindowDimensions();
  const { pode } = useSessao();
  return (
    <Tela bordas={['top']} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <Cabecalho titulo="Ajustes" subtitulo="Valem só neste aparelho e para a sua conta." />
      <PreferenciasDoApp comTitulo={false} duasColunas extras={pode('AGENDA_LER') ? <InterruptorDeLembretesDeCompromisso /> : undefined} />
    </Tela>
  );
}
