import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { Campo } from './Campo';

type Props = Omit<ComponentProps<typeof Campo>, 'secureTextEntry' | 'acao' | 'numerico' | 'linhas'>;

/**
 * Campo de senha com o olho para mostrar ou ocultar o que foi digitado. Nasce oculto; o estado é só desta tela e não
 * é guardado. Alvo de 44 px e rótulo para leitor de tela que diz o que o toque vai fazer.
 */
export function CampoSenha(props: Props) {
  const { cores } = useTema();
  const [visivel, setVisivel] = useState(false);
  const Icone = visivel ? EyeOff : Eye;
  return (
    <Campo
      {...props}
      secureTextEntry={!visivel}
      autoCapitalize="none"
      autoCorrect={false}
      acao={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          onPress={() => setVisivel((v) => !v)}
          style={estilos.olho}>
          <Icone size={20} color={cores.textoSuave} strokeWidth={2} />
        </Pressable>
      }
    />
  );
}

const estilos = StyleSheet.create({
  olho: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
});
