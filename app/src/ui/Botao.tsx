import { Button } from '../components/ui/button';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

type Tipo = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'perigoTexto';

interface Props {
  rotulo: string;
  aoTocar: () => void;
  tipo?: Tipo;
  /** Ícone lucide; pintado com a cor do texto do botão. */
  Icone?: LucideIcon;
  desabilitado?: boolean;
  carregando?: boolean;
  /** Ocupa a largura toda (entrar, ação única da tela no celular). Sem isto o botão tem o tamanho do texto. */
  cheio?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ação principal com a cor da marca (no máximo uma por área); secundária com contorno; fantasma só texto, para ação
 * rara ou de baixo risco; `perigoTexto` é o fantasma com texto vermelho (remover, inativar), sempre com confirmação.
 * `perigo` (preenchido) é só para o botão de confirmação do painel.
 */
export function Botao({ rotulo, aoTocar, tipo = 'primario', Icone, desabilitado, carregando, cheio, style }: Props) {
  const { cores, marca, sobreMarca } = useTema();
  const inativo = desabilitado || carregando;
  const semFundo = tipo === 'fantasma' || tipo === 'perigoTexto';
  const fundo = tipo === 'primario' ? marca : tipo === 'perigo' ? cores.perigo : 'transparent';
  const texto = tipo === 'primario' ? sobreMarca : tipo === 'perigo' ? '#FFFFFF' : tipo === 'perigoTexto' ? cores.perigo : cores.texto;
  const borda = tipo === 'secundario' ? cores.borda : fundo;
  return (
    <Button
      variant={tipo === 'primario' ? 'default' : tipo === 'perigo' ? 'destructive' : tipo === 'secundario' ? 'outline' : 'ghost'}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      disabled={inativo}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.botao,
        {
          backgroundColor: semFundo && pressed ? cores.superficie3 : fundo,
          borderColor: semFundo && pressed ? cores.superficie3 : borda,
          opacity: inativo ? 0.5 : pressed && !semFundo ? 0.8 : 1,
        },
        cheio && estilos.cheio,
        style,
      ]}>
      <View style={estilos.linha}>
        {carregando ? <ActivityIndicator size="small" color={texto} /> : Icone ? <Icone size={18} color={texto} strokeWidth={2} /> : null}
        <Texto style={[estilos.rotulo, { color: texto }]}>{rotulo}</Texto>
      </View>
    </Button>
  );
}

const estilos = StyleSheet.create({
  botao: {
    alignSelf: 'flex-start',
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
