import { StyleSheet, View } from 'react-native';

import { destinosPermitidos, type DestinoDaImportacao } from '../../dominio/mapeamentoDaImportacao';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { LinkTexto } from '../../ui/LinkTexto';

/**
 * Link secundário do estado vazio da Biblioteca ("Importar de planilha"): leva à Importação, a mesma tela do menu lateral.
 * Só aparece a quem pode importar para aquele destino (a regra do menu, `destinosPermitidos`); o resto não vê um caminho
 * que não funciona. Vai embaixo da ação principal do estado vazio, nunca no lugar dela.
 */
export function ImportarDePlanilha({ destino }: { destino: DestinoDaImportacao }) {
  const { pode } = useSessao();
  if (!destinosPermitidos(pode).some((d) => d.id === destino)) return null;
  return (
    <View style={estilos.centro}>
      <LinkTexto href="/treinador/importacao" texto="Importar de planilha" />
    </View>
  );
}

const estilos = StyleSheet.create({
  // O estado vazio já tem 32 px de respiro embaixo: o link chega mais perto da ação principal.
  centro: { alignItems: 'center', marginTop: -espaco(2) },
});
