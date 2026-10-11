import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { sobre } from './sobre';

interface Props {
  Icone: LucideIcon;
  /** Obrigatório: o leitor de tela lê este texto. */
  rotulo: string;
  aoTocar: () => void;
  cor?: string;
  desabilitado?: boolean;
  /** Ícone menor (16 px) em linhas apertadas; o alvo continua com 44 px (o `hitSlop` completa o que falta). */
  compacto?: boolean;
}

/** Ícone linear (lucide, 20 px) com alvo de toque de 44 px. */
export function IconeBotao({ Icone, rotulo, aoTocar, cor, desabilitado, compacto }: Props) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      hitSlop={compacto ? 6 : 0}
      style={(estado) => [estilos.botao, compacto && estilos.compacto, { opacity: desabilitado ? 0.4 : 1, backgroundColor: sobre(estado) && !desabilitado ? cores.superficie3 : 'transparent' }]}>
      <Icone size={compacto ? 16 : 20} color={cor ?? cores.texto} strokeWidth={2} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  compacto: { width: 32, height: 32 },
});
