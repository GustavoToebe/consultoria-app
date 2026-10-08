import { useEffect } from 'react';
import Animated, { cancelAnimation, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { Selo, type TipoSelo } from './Selo';
import { useMovimentoReduzido } from './useMovimentoReduzido';

export function SeloAnimado({ texto, tipo, pulsar }: { texto: string; tipo: TipoSelo; pulsar: boolean }) {
  const reduzido = useMovimentoReduzido();
  return <EstadoDoSelo key={`${tipo}:${texto}`} texto={texto} tipo={tipo} pulsar={pulsar} reduzido={reduzido} />;
}

function EstadoDoSelo({ texto, tipo, pulsar, reduzido }: { texto: string; tipo: TipoSelo; pulsar: boolean; reduzido: boolean }) {
  const opacidade = useSharedValue(1);
  const escala = useSharedValue(tipo === 'sucesso' && !reduzido ? 0.94 : 1);
  useEffect(() => {
    cancelAnimation(opacidade);
    opacidade.set(pulsar && !reduzido ? withRepeat(withTiming(0.55, { duration: 700 }), -1, true) : 1);
    escala.set(reduzido ? 1 : withSpring(1, { damping: 18, stiffness: 260, mass: 1 }));
    return () => { cancelAnimation(opacidade); cancelAnimation(escala); };
  }, [pulsar, reduzido, opacidade, escala]);
  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.get(), transform: [{ scale: escala.get() }] }));
  return (
    <Animated.View accessibilityLiveRegion="polite" style={estilo}
      entering={reduzido ? undefined : FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      exiting={reduzido ? undefined : FadeOut.duration(120).reduceMotion(ReduceMotion.System)}>
      <Selo texto={texto} tipo={tipo} />
    </Animated.View>
  );
}
