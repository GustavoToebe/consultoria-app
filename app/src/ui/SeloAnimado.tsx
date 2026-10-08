import { Check, Circle } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, FadeIn, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { fontes, RAIO } from '../tema/tokens';
import type { TipoSelo } from './Selo';
import { useMovimentoReduzido } from './useMovimentoReduzido';

const TIPOS: TipoSelo[] = ['neutro', 'atencao', 'perigo', 'sucesso'];
export function SeloAnimado({ texto, tipo, pulsar }: { texto: string; tipo: TipoSelo; pulsar: boolean }) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const cor = useSharedValue(TIPOS.indexOf(tipo));
  const opacidade = useSharedValue(1);
  const escala = useSharedValue(1);
  const anterior = useRef(tipo);
  const paleta = TIPOS.map((t) => cores[t]);
  useEffect(() => {
    cor.value = reduzido ? TIPOS.indexOf(tipo) : withTiming(TIPOS.indexOf(tipo), { duration: 200 });
    cancelAnimation(opacidade);
    opacidade.value = pulsar && !reduzido ? withRepeat(withTiming(0.4, { duration: 700 }), -1, true) : 1;
    if (tipo === 'sucesso' && anterior.current !== tipo) escala.value = reduzido ? 1 : withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 260, mass: 1 }));
    anterior.current = tipo;
    return () => { cancelAnimation(opacidade); cancelAnimation(escala); };
  }, [tipo, pulsar, reduzido, cor, opacidade, escala]);
  const fundo = useAnimatedStyle(() => ({ borderColor: interpolateColor(cor.value, [0, 1, 2, 3], paleta), backgroundColor: interpolateColor(cor.value, [0, 1, 2, 3], paleta.map((c) => `${c}22`)) }));
  const letras = useAnimatedStyle(() => ({ color: interpolateColor(cor.value, [0, 1, 2, 3], paleta) }));
  const icone = useAnimatedStyle(() => ({ opacity: opacidade.value, transform: [{ scale: escala.value }] }));
  const Icone = tipo === 'sucesso' ? Check : Circle;
  return (
    <Animated.View style={[estilos.selo, fundo]} accessibilityLiveRegion="polite">
      <Animated.View style={icone}><Icone size={14} color={cores[tipo]} accessible={false} /></Animated.View>
      <Animated.Text key={texto} entering={reduzido ? undefined : FadeIn.duration(200).reduceMotion(ReduceMotion.System)} style={[estilos.texto, letras]}>{texto}</Animated.Text>
    </Animated.View>
  );
}
const estilos = StyleSheet.create({
  selo: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RAIO, paddingHorizontal: 6, paddingVertical: 4 },
  texto: { flexShrink: 1, fontFamily: fontes.semi, fontSize: 12, lineHeight: 16, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
});
