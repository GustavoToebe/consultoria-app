import { StyleSheet, View } from 'react-native';

import { filtrosDoMural, type FiltroDoMural } from '../dominio/comunidade';
import { espaco } from '../tema/tokens';
import { Campo } from '../ui/Campo';
import { Escolha } from '../ui/Escolha';
import { FaixaDeChips } from '../ui/FaixaDeChips';

/**
 * Busca de uma linha e os chips do tipo (seleção neutra; no celular a faixa rola de lado). "Denunciados" só para quem
 * modera. A tela atrasa a busca (`useAtrasado`) antes de pedir à API.
 */
export function BarraDoMural({ filtro, aoFiltrar, busca, aoBuscar, comDenunciados }: {
  filtro: FiltroDoMural;
  aoFiltrar: (f: FiltroDoMural) => void;
  busca: string;
  aoBuscar: (b: string) => void;
  comDenunciados: boolean;
}) {
  return (
    <View style={estilos.barra}>
      <Campo rotulo="Buscar na comunidade" valor={busca} aoMudar={aoBuscar} placeholder="Palavra da publicação" autoCorrect={false}
        inputMode="search" />
      <FaixaDeChips quebrar accessibilityLabel="Tipo de publicação">
        <Escolha descricao="Tipo de publicação" chips valor={filtro} aoMudar={aoFiltrar} opcoes={filtrosDoMural(comDenunciados)} />
      </FaixaDeChips>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { gap: espaco(1.5) },
});
