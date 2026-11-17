import { BlurTargetView, BlurView } from 'expo-blur';
import type { ReactNode, Ref, RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { fundoDoVidro, TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { useReduzirTransparencia } from './useReduzirTransparencia';

export type PropsDoVidro = Omit<ViewProps, 'style' | 'children'> & {
  /** Contorno, raio, espaçamento e posição da peça; o fundo é do vidro. */
  estilo?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Força do blur, de 1 a 100 (padrão 50). */
  intensidade?: number;
  /** Android: o `AlvoDoVidro` com o conteúdo que passa por baixo (irmão do vidro, nunca ancestral). Sem ele, fundo sólido. */
  alvo?: RefObject<View | null>;
  ref?: Ref<View>;
};

/** Android 12 (API 31): abaixo disso o `dimezisBlurViewSdk31Plus` não borra e o vidro vira sólido. */
const ANDROID_COM_BLUR = 31;

/**
 * Se o vidro borra o que está atrás ou vira fundo sólido (`cor` do vidro a 100%). Sólido com "reduzir transparência" ou
 * contraste alto; no Android, também sem alvo ou antes do 12. Nunca texto sem fundo: o translúcido já passa de 4,5:1 sem blur.
 */
export function vidroComBlur({ os, versao, temAlvo, reduzir }: {
  os: string;
  versao: number | string;
  temAlvo: boolean;
  reduzir: boolean;
}): boolean {
  if (reduzir) return false;
  if (os === 'android') return temAlvo && Number(versao) >= ANDROID_COM_BLUR;
  return os === 'ios';
}

/**
 * Vidro (D11): superfície fixa por cima do conteúdo que rola (barra inferior, descanso, aviso de recorde). Por cima do blur
 * vai a `cor` do vidro na `opacidade` do token, então o contraste nunca depende do que está atrás. Cartões e telas de
 * leitura não usam vidro.
 */
export function Vidro({ estilo, children, intensidade = 50, alvo, ref, ...resto }: PropsDoVidro) {
  const { stndrd, modo, preferencias } = useTema();
  const vidro = (stndrd ?? TOKENS_STNDRD_ESCURO).glass;
  const reduzir = useReduzirTransparencia() || preferencias?.contraste === 'ALTO';
  if (!vidroComBlur({ os: Platform.OS, versao: Platform.Version, temAlvo: !!alvo, reduzir })) {
    return <View ref={ref} {...resto} style={[estilo, { backgroundColor: vidro.cor }]}>{children}</View>;
  }
  return (
    <View ref={ref} {...resto} style={[estilo, estilos.recorte]}>
      <BlurView intensity={intensidade} tint={modo === 'CLARO' ? 'light' : 'dark'} blurTarget={alvo}
        blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fundoDoVidro(vidro) }]} />
      {children}
    </View>
  );
}

/** O conteúdo que passa por baixo de um vidro no Android (ref para o `alvo`); nas outras plataformas é um `View`. */
export const AlvoDoVidro = BlurTargetView;

const estilos = StyleSheet.create({
  // As camadas do blur seguem o raio da peça.
  recorte: { overflow: 'hidden' },
});
