import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

type Tipo = 'primario' | 'secundario' | 'perigo' | 'fantasma';

interface Props {
  rotulo: string;
  aoTocar: () => void;
  tipo?: Tipo;
  /** Ícone lucide; pintado com a cor do texto do botão. */
  Icone?: LucideIcon;
  desabilitado?: boolean;
  carregando?: boolean;
  /** Ocupa a largura toda (formulários no celular). */
  cheio?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Ação principal com a cor da marca; secundária com borda; perigo em vermelho (status, nunca a marca). */
export function Botao({ rotulo, aoTocar, tipo = 'primario', Icone, desabilitado, carregando, cheio, style }: Props) {
  const { cores, marca, sobreMarca } = useTema();
  const inativo = desabilitado || carregando;
  const fundo = tipo === 'primario' ? marca : tipo === 'perigo' ? cores.perigo : 'transparent';
  const texto = tipo === 'primario' ? sobreMarca : tipo === 'perigo' ? '#FFFFFF' : cores.texto;
  const borda = tipo === 'secundario' ? cores.borda : fundo;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, borderColor: borda, opacity: inativo ? 0.5 : pressed ? 0.8 : 1 },
        cheio && estilos.cheio,
        style,
      ]}>
      <View style={estilos.linha}>
        {carregando ? <ActivityIndicator size="small" color={texto} /> : Icone ? <Icone size={18} color={texto} strokeWidth={2} /> : null}
        <Texto style={[estilos.rotulo, { color: texto }]}>{rotulo}</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2),
    borderRadius: RAIO,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cheio: { alignSelf: 'stretch' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  rotulo: { fontFamily: fontes.semi, fontSize: 15 },
});
