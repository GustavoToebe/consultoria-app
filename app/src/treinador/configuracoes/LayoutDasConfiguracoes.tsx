import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useFundoDaArea } from '../../ui/fundoDaArea';
import { ColunaDasConfiguracoes } from './ColunaDasConfiguracoes';
import { useDuasColunas } from './comum';

/**
 * Layout de `/treinador/configuracoes/*`. A partir de 1024 px de janela, duas colunas: a lista fixa à esquerda (300 px) e o
 * item à direita, com a largura e a rolagem da `Tela` dele. Abaixo disso, só a rota (a lista ou, no item, a ida à rota inteira).
 */
export function LayoutDasConfiguracoes() {
  const fundo = useFundoDaArea();
  const duas = useDuasColunas();
  // O `Slot` fica sempre no mesmo lugar da árvore: trocá-lo de pai (ao cruzar 1024 px, ou na primeira medida da janela)
  // remonta o navegador da rota, que perde o item e reescreve o endereço como `/configuracoes?item=...`.
  return (
    <View style={[estilos.linha, { backgroundColor: fundo }]}>
      {duas ? <ColunaDasConfiguracoes /> : null}
      <View style={estilos.item}><Slot /></View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flex: 1, flexDirection: 'row', minHeight: 0 },
  item: { flex: 1, minWidth: 0 },
});
