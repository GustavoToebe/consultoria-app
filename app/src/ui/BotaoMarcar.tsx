import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Keyframe, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { RAIO } from '../tema/tokens';
import { useMovimentoReduzido } from './useMovimentoReduzido';
import { useEmPrevia } from './emPrevia';
import { aoPressionarMarcar, coresDoMarcar } from './marcar';
import { vibrar } from './vibrar';

/**
 * O ✓ de "série feita": caixa de 56 × 52 com borda `bordaCampo` quando vazia (a borda de cartão quase sumia no fundo
 * escuro); feita = ✓ neutro na faixa `superficie3`; verde só com `agora` (acabou de marcar, `aluno/useMarcadoAgora`);
 * desabilitada (prévia) fica na faixa `superficie3`, sem a cara de campo. Cores em `coresDoMarcar`.
 */
export function BotaoMarcar({ feito, agora = false, aoTocar, ultimaDoExercicio, rotulo, desabilitado: desabilitadoPorFora, semVibrar }: {
  feito: boolean; aoTocar: () => void; ultimaDoExercicio?: boolean; rotulo: string; desabilitado?: boolean;
  /** Feito com a tela aberta: o único ✓ verde. */
  agora?: boolean;
  /** O toque não marca ainda (abre o painel "Fez com 60 kg?"): sem a vibração de série feita. */
  semVibrar?: boolean;
}) {
  const { cores } = useTema();
  // Na prévia do treinador o ✓ fica desabilitado e não faz nada.
  const emPrevia = useEmPrevia();
  const desabilitado = desabilitadoPorFora || emPrevia;
  const reduzido = useMovimentoReduzido();
  const escala = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  const { icone } = coresDoMarcar(cores, { feito, agora, desabilitado, pressionado: false });
  return (
    <Animated.View style={estilo}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={rotulo}
        aria-checked={feito}
        accessibilityState={{ checked: feito, disabled: desabilitado }} disabled={desabilitado}
        onPress={() => { if (!emPrevia) aoPressionarMarcar({ aoTocar,
          animar: () => escala.set(reduzido ? 1 : withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 260, mass: 1, reduceMotion: ReduceMotion.System }))),
          vibrar: () => { if (!feito && !semVibrar) { if (ultimaDoExercicio) vibrar.sucesso(); else vibrar.leve(); } },
        }); }}
        style={({ pressed }) => { const c = coresDoMarcar(cores, { feito, agora, desabilitado, pressionado: pressed }); return [estilos.botao, { borderColor: c.borda, backgroundColor: c.fundo }]; }}>
        <Animated.View key={String(feito)} entering={reduzido ? undefined : new Keyframe({ 0: { opacity: 0, transform: [{ scale: 0.6 }] }, 100: { opacity: 1, transform: [{ scale: 1 }] } }).duration(150).reduceMotion(ReduceMotion.System)}>
          {icone ? <Check size={26} color={icone} strokeWidth={3} /> : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
const estilos = StyleSheet.create({ botao: { width: 56, height: 52, borderWidth: 2, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' } });
