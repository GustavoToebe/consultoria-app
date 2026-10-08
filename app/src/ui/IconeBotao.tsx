import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';

interface Props {
  Icone: LucideIcon;
  /** Obrigatório: o leitor de tela lê este texto. */
  rotulo: string;
  aoTocar: () => void;
  cor?: string;
  desabilitado?: boolean;
}

/** Ícone linear (lucide, 20 px) com alvo de toque de 44 px. */
export function IconeBotao({ Icone, rotulo, aoTocar, cor, desabilitado }: Props) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={desabilitado}
      onPress={aoTocar}
      style={({ pressed }) => [estilos.botao, { opacity: desabilitado ? 0.4 : pressed ? 0.6 : 1 }]}>
      <Icone size={20} color={cor ?? cores.texto} strokeWidth={2} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
