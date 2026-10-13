import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useMovimentoReduzido } from './useMovimentoReduzido';
import { X } from 'lucide-react-native';
import { PortalHost } from '@rn-primitives/portal';
import { createContext, useContext, useEffect, useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { IconeBotao } from './IconeBotao';
import { RolagemComTopo } from './RolagemComTopo';
import { Texto } from './Texto';

/** Larguras das folhas no PC: formulário curto e escolha (600) ou conteúdo grande (`LARGURA_EDITOR`). */
export const LARGURA_FOLHA = 600;

/**
 * Destino do diálogo aberto de dentro da folha. O `Modal` fica por cima do `PortalHost` da raiz, então a confirmação
 * precisa ir para dentro do próprio Modal: no nativo pelo `nome` do portal, na web pelo `elemento` (o `hostName` do
 * primitivo é ignorado na web, e sem container o diálogo iria para o fim do body, atrás do Modal). Fora de folha é `undefined`.
 */
export interface PortalDaFolhaValor { nome: string; elemento: HTMLElement | null }
const PortalDaFolha = createContext<PortalDaFolhaValor | undefined>(undefined);
export const usePortalDaFolha = () => useContext(PortalDaFolha);

interface Props {
  visivel: boolean;
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  /** Botões fixos no rodapé (fora da rolagem). */
  rodape?: ReactNode;
  /** Ação do cabeçalho, ao lado do X (ex.: menu ⋯); fica fixa enquanto o conteúdo rola. */
  acaoNoTopo?: ReactNode;
  /** Largura no PC (centralizada); padrão `LARGURA_FOLHA` (600). Conteúdo grande (pasta com planos e registros) usa `LARGURA_EDITOR`. */
  largura?: number;
}

/**
 * Painel por cima da tela: centralizado no PC, folha que sobe de baixo no celular. Usado para escolher da
 * biblioteca, aplicar receita e formulários curtos. Fecha no X, tocando fora ou no voltar do Android. Para o leitor
 * de tela é um diálogo modal com o nome do título; na web o foco entra no primeiro controle do conteúdo.
 */
export function Folha({ visivel, titulo, aoFechar, children, rodape, largura, acaoNoTopo }: Props) {
  return <Modal transparent visible={visivel} animationType="none" onRequestClose={aoFechar}>
    {visivel ? <Painel titulo={titulo} aoFechar={aoFechar} rodape={rodape} largura={largura} acaoNoTopo={acaoNoTopo}>{children}</Painel> : null}
  </Modal>;
}

/** Arraste no cabeçalho para preservar a rolagem e os campos dentro do conteúdo. */
function Painel({titulo,aoFechar,children,rodape,largura,acaoNoTopo}:Omit<Props,'visivel'>) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  // No Android o `Modal` já fica acima da barra do sistema; somar a margem de baixo do provider (que está fora dele)
  // deixava um vão sob o rodapé.
  const margem = useSafeAreaInsets();
  const centralizado = width >= LARGURA_MENU_LATERAL;
  const reduzido = useMovimentoReduzido();
  const portal = useId();
  const [elementoPortal, setElementoPortal] = useState<HTMLElement | null>(null);
  const guardarElementoPortal = useCallback((no: View | null) => setElementoPortal(Platform.OS === 'web' ? (no as unknown as HTMLElement | null) : null), []);
  const valorPortal = useMemo(() => ({ nome: portal, elemento: elementoPortal }), [portal, elementoPortal]);
  const conteudo = useRef<View>(null);
  const fechar = useRef<View>(null);
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
  // Decidido ao abrir: girar a tela depois não move o foco de novo.
  const [focarConteudo] = useState(centralizado);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // O foco entra no primeiro controle do conteúdo (campo ou botão); sem nenhum, no X de fechar. Nunca no fundo.
    // Na folha de baixo (celular) o foco vai ao X: focar um campo abriria o teclado por cima da lista.
    const raiz = focarConteudo ? (conteudo.current as unknown as HTMLElement | null) : null;
    const primeiro = raiz?.querySelector?.<HTMLElement>('input, textarea, select, button, a[href], [tabindex="0"]');
    const alvo = primeiro ?? (fechar.current as unknown as HTMLElement | null)?.querySelector?.<HTMLElement>('button, [tabindex="0"]');
    alvo?.focus?.();
  }, [focarConteudo]);
  return (
    <PortalDaFolha.Provider value={valorPortal}>
    <GestureHandlerRootView style={{flex:1}}>
      <KeyboardAvoidingView style={estilos.fundoArea} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <View style={[estilos.fundo, centralizado ? estilos.fundoCentral : estilos.fundoInferior]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar painel" importantForAccessibility="no-hide-descendants" />
        <Animated.View
          onLayout={evento => altura.set(evento.nativeEvent.layout.height)}
          accessibilityViewIsModal
          role="dialog"
          aria-modal
          aria-label={titulo}
          style={[
            estilos.painel, movimento,
            centralizado
              ? [estilos.painelCentral, largura ? { width: largura, height: '90%' as const } : null]
              : [estilos.painelInferior, { paddingBottom: Platform.OS === 'android' ? 0 : margem.bottom }],
            { backgroundColor: cores.superficie, borderColor: cores.borda },
          ]}>
          <GestureDetector gesture={gesto}><View style={estilos.topo}>
            <Texto variante="bloco" nivel={2} style={estilos.titulo}>{titulo}</Texto>
            <View style={estilos.acoesTopo}>
              {acaoNoTopo}
              <View ref={fechar} collapsable={false}><IconeBotao Icone={X} rotulo="Fechar" aoTocar={aoFechar} /></View>
            </View>
          </View></GestureDetector>
          <View ref={conteudo} collapsable={false} style={estilos.area}>
            <RolagemComTopo contentContainerStyle={estilos.conteudo}>{children}</RolagemComTopo>
          </View>
          {rodape ? <View style={[estilos.rodape, { borderColor: cores.borda }]}>{rodape}</View> : null}
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
      <View ref={guardarElementoPortal} style={StyleSheet.absoluteFill} pointerEvents="box-none"><PortalHost name={portal} /></View>
    </GestureHandlerRootView>
    </PortalDaFolha.Provider>
  );
}

const estilos = StyleSheet.create({
  fundoArea: { flex: 1 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  fundoCentral: { alignItems: 'center', justifyContent: 'center', padding: espaco(2) },
  fundoInferior: { justifyContent: 'flex-end' },
  painel: { borderWidth: 1, overflow: 'hidden' },
  painelCentral: { width: LARGURA_FOLHA, maxWidth: '100%', maxHeight: '90%', borderRadius: RAIO },
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
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  // O botão "voltar ao início" do `RolagemComTopo` é absoluto dentro desta área, logo nunca sai do painel.
  area: { flexShrink: 1, minHeight: 0 },
  // Folga de 6 px no topo: o anel de foco (2 px + recuo de 2 px) do primeiro controle não é cortado pela rolagem.
  conteudo: { padding: espaco(2), paddingTop: espaco(0.75), gap: espaco(1.5) },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: espaco(1),
    padding: espaco(2),
    borderTopWidth: 1,
  },
});
