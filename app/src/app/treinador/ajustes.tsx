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
/**
 * Tela larga (revisão de 24/11): as duas colunas da `PreferenciasDoApp` param em 720 px cada; o teto da tela é o das duas
 * mais o vão, para o bloco ficar centrado como as outras telas de configuração em vez de deixar metade da tela vazia à
 * direita em 2560 e 3440.
 */
const LARGURA_DOS_AJUSTES = 2 * 720 + espaco(3);

export default function Ajustes() {
  const { width } = useWindowDimensions();
  const { pode } = useSessao();
  return (
    <Tela bordas={['top']} largura={LARGURA_DOS_AJUSTES} folga={width >= LARGURA_MENU_LATERAL ? espaco(3.5) : undefined}>
      <Cabecalho titulo="Ajustes" subtitulo="Valem só neste aparelho e para a sua conta." />
      <PreferenciasDoApp comTitulo={false} duasColunas extras={pode('AGENDA_LER') ? <InterruptorDeLembretesDeCompromisso /> : undefined} />
    </Tela>
  );
}
