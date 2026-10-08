import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useMovimentoReduzido } from './useMovimentoReduzido';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  return <Modal transparent visible={visivel} animationType="none" onRequestClose={aoFechar}>
    {visivel ? <Painel titulo={titulo} aoFechar={aoFechar} rodape={rodape}>{children}</Painel> : null}
  </Modal>;
}

/** Arraste no cabeçalho para preservar a rolagem e os campos dentro do conteúdo. */
function Painel({titulo,aoFechar,children,rodape}:Omit<Props,'visivel'>) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  const margem = useSafeAreaInsets();
  const centralizado = width >= LARGURA_MENU_LATERAL;
  const reduzido = useMovimentoReduzido();
  // Sem animação de entrada: o painel aparece pronto. O deslocamento só existe para o arrastar-para-fechar no celular.
  const deslocamento = useSharedValue(0);
  const altura = useSharedValue(height * 0.88);
  const movimento=useAnimatedStyle(()=>({transform:[{translateY:deslocamento.get()}]}));
  const gesto=Gesture.Pan().enabled(Platform.OS !== 'web' && !centralizado)
    .activeOffsetY(10)
    .onUpdate(evento=>{deslocamento.set(Math.max(0,evento.translationY));})
    .onEnd(evento=>{
      if (evento.translationY > altura.get()*0.3 || evento.velocityY > 1000) {
        scheduleOnRN(aoFechar);
      } else deslocamento.set(reduzido ? 0 : withSpring(0,{damping:18,stiffness:260}));
    });
  return (
    <GestureHandlerRootView style={{flex:1}}>
      <View style={[estilos.fundo, centralizado ? estilos.fundoCentral : estilos.fundoInferior]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar painel" />
        <Animated.View
          onLayout={evento => altura.set(evento.nativeEvent.layout.height)}
          accessibilityViewIsModal
          style={[
            estilos.painel, movimento,
            centralizado
              ? estilos.painelCentral
              : [estilos.painelInferior, { paddingBottom: margem.bottom }],
            { backgroundColor: cores.superficie, borderColor: cores.borda },
          ]}>
          <GestureDetector gesture={gesto}><View style={estilos.topo}>
            <Texto variante="bloco" style={estilos.titulo}>{titulo}</Texto>
            <IconeBotao Icone={X} rotulo="Fechar" aoTocar={aoFechar} />
          </View></GestureDetector>
          <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {rodape ? <View style={[estilos.rodape, { borderColor: cores.borda }]}>{rodape}</View> : null}
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  fundoCentral: { alignItems: 'center', justifyContent: 'center', padding: espaco(2) },
  fundoInferior: { justifyContent: 'flex-end' },
  painel: { borderWidth: 1 },
  painelCentral: { width: 600, maxWidth: '100%', maxHeight: '90%', borderRadius: RAIO, overflow: 'hidden' },
  painelInferior: { maxHeight: '88%', borderTopLeftRadius: RAIO, borderTopRightRadius: RAIO },
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
