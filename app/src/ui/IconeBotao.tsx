import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

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
  /** Ícone menor (16 px, desenho de 32 px) em linhas apertadas; o alvo continua com 44 px. */
  compacto?: boolean;
  /**
   * Com moldura (borda fina e fundo da superfície), como os botões da faixa do exercício e da série no editor de
   * treino (protótipo de 30/10): mostra que é botão mesmo sobre a faixa cinza. Desenho de 40 px dentro do alvo de 44.
   */
  moldura?: boolean;
}

/**
 * Ícone linear (lucide, 20 px) com alvo de toque de 44 px. O alvo é a caixa de fora, sempre 44×44 (C2 da auditoria de
 * 03/11: o `hitSlop` não vale no react-native-web); o desenho (moldura de 40 ou compacto de 32) fica centrado dentro dela.
 */
export function IconeBotao({ Icone, rotulo, aoTocar, cor, desabilitado, compacto, moldura }: Props) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      style={[estilos.alvo, { opacity: desabilitado ? 0.4 : 1 }]}>
      {(estado) => (
        <View
          style={[estilos.desenho, compacto && estilos.compacto, moldura && [estilos.moldura, { borderColor: cores.bordaCampo }],
            { backgroundColor: sobre(estado) && !desabilitado ? cores.superficie3 : moldura ? cores.superficie : 'transparent' }]}>
          <Icone size={compacto ? 16 : 20} color={cor ?? cores.texto} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  desenho: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  compacto: { width: 32, height: 32 },
  moldura: { width: 40, height: 40, borderWidth: 1 },
});
