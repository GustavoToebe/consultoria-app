import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, RAIO } from '../tema/tokens';
import { Campo } from './Campo';

type Props = Omit<ComponentProps<typeof Campo>, 'secureTextEntry' | 'acao' | 'numerico' | 'linhas'>;

/** `aria-pressed` chega ao `<button>` pelo react-native-web, mas não está nos tipos do React Native. */
const pressionado = (valor: boolean) => ({ 'aria-pressed': valor }) as object;

/**
 * Campo de senha com o olho para mostrar ou ocultar o que foi digitado. Nasce oculto; o estado é só desta tela e não
 * é guardado. Alvo de 44 px. Botão de alternar (WAI-ARIA APG): nome fixo "Mostrar senha" e o estado em `aria-pressed`
 * (no celular, `checked`); nome que muda junto com o estado seria lido como "Ocultar senha, pressionado".
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
          accessibilityLabel="Mostrar senha"
          {...(Platform.OS === 'web' ? pressionado(visivel) : { accessibilityState: { checked: visivel } })}
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
