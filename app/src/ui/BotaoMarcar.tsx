import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Keyframe, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { RAIO } from '../tema/tokens';
import { useMovimentoReduzido } from './useMovimentoReduzido';
import { aoPressionarMarcar } from './marcar';
import { vibrar } from './vibrar';

/**
 * O ✓ de "série feita": caixa de 56 × 52 com borda `bordaCampo` quando vazia (a borda de cartão quase sumia no fundo
 * escuro) e preenchida de verde quando feita.
 */
export function BotaoMarcar({ feito, aoTocar, ultimaDoExercicio, rotulo, desabilitado }: {
  feito: boolean; aoTocar: () => void; ultimaDoExercicio?: boolean; rotulo: string; desabilitado?: boolean;
}) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const escala = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  return (
    <Animated.View style={estilo}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={rotulo}
        aria-checked={feito}
        accessibilityState={{ checked: feito, disabled: desabilitado }} disabled={desabilitado}
        onPress={() => aoPressionarMarcar({ aoTocar,
          animar: () => escala.set(reduzido ? 1 : withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 260, mass: 1, reduceMotion: ReduceMotion.System }))),
          vibrar: () => { if (!feito) { if (ultimaDoExercicio) vibrar.sucesso(); else vibrar.leve(); } },
        })}
        style={({ pressed }) => [estilos.botao, { borderColor: feito ? cores.sucesso : cores.bordaCampo, backgroundColor: feito ? cores.sucesso : pressed ? cores.superficie3 : cores.campo }]}>
        <Animated.View key={String(feito)} entering={reduzido ? undefined : new Keyframe({ 0: { opacity: 0, transform: [{ scale: 0.6 }] }, 100: { opacity: 1, transform: [{ scale: 1 }] } }).duration(150).reduceMotion(ReduceMotion.System)}>
          <Check size={26} color={feito ? '#FFFFFF' : cores.textoSuave} strokeWidth={3} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
const estilos = StyleSheet.create({ botao: { width: 56, height: 52, borderWidth: 2, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' } });
