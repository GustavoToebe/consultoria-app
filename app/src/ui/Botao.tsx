import { Button } from '../components/ui/button';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

type Tipo = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'perigoTexto';

interface Props {
  rotulo: string;
  /** Texto lido pelo leitor de tela quando o rótulo na tela é mais curto que a ação ("Editar" → "Editar treino do aluno"). */
  rotuloAcessivel?: string;
  aoTocar: () => void;
  tipo?: Tipo;
  /** Ícone lucide; pintado com a cor do texto do botão. */
  Icone?: LucideIcon;
  desabilitado?: boolean;
  /**
   * Por que o botão está desabilitado ("Preencha o nome", "Escolha um aluno"). Aparece como linha pequena abaixo do
   * botão e vai no `accessibilityHint`; sem isto o botão apagado não explica nada. Só aparece com `desabilitado`.
   */
  motivo?: string;
  carregando?: boolean;
  /** Ocupa a largura toda (entrar, ação única da tela no celular). Sem isto o botão tem o tamanho do texto. */
  cheio?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ação principal com a cor da marca (no máximo uma por área); secundária com contorno; fantasma só texto, para ação
 * rara ou de baixo risco; `perigoTexto` é o fantasma com texto vermelho (remover, inativar), sempre com confirmação.
 * `perigo` (preenchido, `perigoFundo`) é só para o botão de confirmação do painel. O rótulo quebra em até duas
 * linhas e nunca estoura o cartão; vários botões lado a lado vão numa `LinhaDeAcoes`.
 */
export function Botao({ rotulo, rotuloAcessivel, aoTocar, tipo = 'primario', Icone, desabilitado, motivo, carregando, cheio, style }: Props) {
  const { cores, marca, sobreMarca } = useTema();
  const inativo = desabilitado || carregando;
  const semFundo = tipo === 'fantasma' || tipo === 'perigoTexto';
  const fundo = tipo === 'primario' ? marca : tipo === 'perigo' ? cores.perigoFundo : 'transparent';
  const texto = tipo === 'primario' ? sobreMarca : tipo === 'perigo' ? '#FFFFFF' : tipo === 'perigoTexto' ? cores.perigo : cores.texto;
  const borda = tipo === 'secundario' ? cores.borda : fundo;
  const explicacao = desabilitado && !carregando && motivo ? motivo : undefined;
  const botao = (
    <Button
      variant={tipo === 'primario' ? 'default' : tipo === 'perigo' ? 'destructive' : tipo === 'secundario' ? 'outline' : 'ghost'}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityHint={explicacao}
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
        explicacao ? null : style,
      ]}>
      <View style={estilos.linha}>
        {carregando ? <ActivityIndicator size="small" color={texto} /> : Icone ? <Icone size={18} color={texto} strokeWidth={2} /> : null}
        <Texto numberOfLines={2} style={[estilos.rotulo, { color: texto }]}>{rotulo}</Texto>
      </View>
    </Button>
  );
  if (!explicacao) return botao;
  return (
    <View style={[estilos.comMotivo, cheio && estilos.cheio, style]}>
      {botao}
      <Texto variante="pequeno" style={cheio ? estilos.motivoCentro : null}>{explicacao}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(0.75),
    borderRadius: RAIO,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cheio: { alignSelf: 'stretch' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  rotulo: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1, textAlign: 'center' },
  comMotivo: { alignSelf: 'flex-start', maxWidth: '100%', gap: espaco(0.5) },
  motivoCentro: { textAlign: 'center' },
});
