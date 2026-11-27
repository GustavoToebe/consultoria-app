import { useWindowDimensions } from 'react-native';

import { InterruptorDeLembretesDeCompromisso } from '../../../aluno/compromissos/InterruptorDeLembretesDeCompromisso';
import { useSessao } from '../../../sessao/SessaoProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../../tema/tokens';
import { Cabecalho } from '../../../ui/Cabecalho';
import { PreferenciasDoApp, RestaurarPreferencias } from '../../../ui/PreferenciasDoApp';
import { Tela } from '../../../ui/Tela';
import { InterruptorDoPushDeAtencao } from '../../regras/InterruptorDoPushDeAtencao';

/**
 * Ajustes: preferências pessoais de tema, contraste, tamanho do texto, animações e vibração. No PC usa a largura útil
 * (como Números) e as preferências vão em duas colunas quando o contêiner cabe. Quem vê a agenda ganha o interruptor dos
 * lembretes de compromisso (o mesmo do aluno; na web ele não aparece, porque não há notificação). Quem recebe o aviso das
 * regras de atenção (com a chave ligada) ganha "Avisos no celular", também na web: a preferência é da conta (C7).
 * Tela larga (26/11): sem teto próprio, como as outras telas de Configurações: em Automática as colunas da
 * `PreferenciasDoApp` (até 3 na ultralarga) preenchem a área ao lado do menu; em Limitada o bloco para em 1800, centrado.
 */
export function TelaAjustes() {
  const { width } = useWindowDimensions();
  const { pode } = useSessao();
  return (
    <Tela bordas={['top']} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <Cabecalho titulo="Aparência e preferências" descricao="Valem só neste aparelho e para a sua conta." acoes={<RestaurarPreferencias />} />
      <PreferenciasDoApp comTitulo={false} duasColunas extras={(
        <>
          {pode('AGENDA_LER') ? <InterruptorDeLembretesDeCompromisso /> : null}
          <InterruptorDoPushDeAtencao />
        </>
      )} />
    </Tela>
  );
}
