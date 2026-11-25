import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useTema } from '../tema/TemaProvider';
import { RAIO } from '../tema/tokens';
import { useEmPrevia } from '../ui/emPrevia';
import { aoPressionarMarcar } from '../ui/marcar';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';
import { vibrar } from '../ui/vibrar';
import { coresDoMarcarSerie, type EstadoDoMarcar } from './coresDoMarcarSerie';

export type { EstadoDoMarcar };

/**
 * O ✓ da linha da série, 52 × 52. Desmarcar nunca trava; marcar só com kg e reps (`dominio/marcarSerie.checkHabilitado`).
 * Vibra ao marcar (forte na última série do exercício), nunca ao desmarcar; sem movimento com "Reduzir movimento"; na
 * prévia do treinador fica desabilitado e não faz nada (`useEmPrevia`). Nome: "Marcar série N como feita".
 */
export function MarcarSerie({ estado, numero, ultimaDoExercicio, motivo, aoTocar, rotulo }: {
  estado: EstadoDoMarcar;
  numero: number;
  ultimaDoExercicio?: boolean;
  /** Por que está desabilitado ("Digite as repetições"): vai no nome acessível; o texto visível é de quem usa. */
  motivo?: string | null;
  aoTocar: () => void;
  /** Nome próprio (cardio: "Marcar cardio da série 2 como feito"). */
  rotulo?: string;
}) {
  const { cores } = useTema();
  const emPrevia = useEmPrevia();
  const reduzido = useMovimentoReduzido();
  const escala = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));
  const feita = estado === 'FEITA';
  const desabilitado = emPrevia || estado === 'INCOMPLETA';
  const c = coresDoMarcarSerie(cores, estado);
  const nome = rotulo ?? `Marcar série ${numero} como feita`;
  return (
    <Animated.View style={estilo}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={motivo && !feita ? `${nome}: ${motivo}` : nome}
        aria-checked={feita}
        accessibilityState={{ checked: feita, disabled: desabilitado }}
        disabled={desabilitado}
        onPress={() => {
          if (emPrevia) return;
          aoPressionarMarcar({
            aoTocar,
            animar: () => escala.set(reduzido ? 1 : withSequence(withTiming(0.88, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 260, mass: 1, reduceMotion: ReduceMotion.System }))),
            vibrar: () => { if (!feita) { if (ultimaDoExercicio) vibrar.sucesso(); else vibrar.leve(); } },
          });
        }}
        style={({ pressed }) => [
          estilos.botao,
          { backgroundColor: c.fundo, borderColor: c.borda, borderStyle: c.tracejado ? 'dashed' : 'solid', opacity: pressed && !desabilitado ? 0.85 : 1 },
        ]}>
        <Check size={26} color={c.icone} strokeWidth={3} />
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({ botao: { width: 52, height: 52, borderWidth: 2, borderRadius: RAIO, alignItems: 'center', justifyContent: 'center' } });
