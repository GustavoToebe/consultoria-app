import { Pencil } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Selo "Editando" do item em edição (visual-ponytail, 17/11): pílula cheia na cor de ação, texto `sobreAcao` (≥ 4,5:1).
 * Acompanha o fundo `acaoSuave` e o contorno `acao` de `coresDaEdicao`; nunca aparece sozinho.
 */
export function SeloEditando({ rotulo = 'Editando' }: { rotulo?: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.selo, { backgroundColor: cores.acao }]} accessibilityLabel={rotulo}>
      <Pencil size={11} color={cores.sobreAcao} strokeWidth={2.4} />
      <Texto style={[estilos.texto, { color: cores.sobreAcao }]}>{rotulo}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: espaco(1), paddingVertical: 2 },
  texto: { fontFamily: fontes.semi, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
});
