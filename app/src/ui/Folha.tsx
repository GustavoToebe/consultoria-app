import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { IconeBotao } from './IconeBotao';
import { Texto } from './Texto';

interface Props {
  visivel: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  /** Botões fixos no rodapé (fora da rolagem). */
  rodape?: ReactNode;
}

/**
 * Painel por cima da tela: lateral à direita no PC, folha que sobe de baixo no celular. Usado para escolher da
 * biblioteca, aplicar receita e formulários curtos. Fecha no X, tocando fora ou no voltar do Android.
 */
export function Folha({ visivel, titulo, aoFechar, children, rodape }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const margem = useSafeAreaInsets();
  const lateral = width >= LARGURA_MENU_LATERAL;
  return (
    <Modal transparent visible={visivel} animationType={lateral ? 'fade' : 'slide'} onRequestClose={aoFechar}>
      <View style={[estilos.fundo, lateral ? estilos.fundoLateral : estilos.fundoInferior]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar painel" />
        <View
          accessibilityViewIsModal
          style={[
            estilos.painel,
            lateral
              ? [estilos.painelLateral, { paddingTop: margem.top + espaco(1) }]
              : [estilos.painelInferior, { paddingBottom: margem.bottom }],
            { backgroundColor: cores.superficie, borderColor: cores.borda },
          ]}>
          <View style={estilos.topo}>
            <Texto variante="subtitulo" style={estilos.titulo}>{titulo}</Texto>
            <IconeBotao Icone={X} rotulo="Fechar" aoTocar={aoFechar} />
          </View>
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {rodape ? <View style={[estilos.rodape, { borderColor: cores.borda }]}>{rodape}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  fundoLateral: { alignItems: 'flex-end' },
  fundoInferior: { justifyContent: 'flex-end' },
  painel: { borderWidth: 1 },
  painelLateral: { width: 460, maxWidth: '100%', height: '100%' },
  painelInferior: { maxHeight: '88%', borderTopLeftRadius: RAIO * 2, borderTopRightRadius: RAIO * 2 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: espaco(2),
    paddingRight: espaco(1),
    paddingVertical: espaco(1),
  },
  titulo: { flex: 1 },
  conteudo: { padding: espaco(2), paddingTop: 0, gap: espaco(1.5) },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: espaco(1),
    padding: espaco(2),
    borderTopWidth: 1,
  },
});
