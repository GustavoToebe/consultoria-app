import { View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { fundoDoVidro, TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { useReduzirTransparencia } from './useReduzirTransparencia';
import type { PropsDoVidro } from './Vidro';

/**
 * Vidro na web: `backdrop-filter` com a `cor` do vidro na `opacidade` do token (sem expo-blur). Com "reduzir
 * transparência" ou contraste alto, fundo sólido. Navegador sem `backdrop-filter` mostra só o translúcido, que já passa
 * de 4,5:1 sem blur. O `alvo` só existe no Android e aqui é ignorado.
 */
export function Vidro({ estilo, children, intensidade = 50, alvo: _alvo, ref, ...resto }: PropsDoVidro) {
  const { stndrd, preferencias } = useTema();
  const vidro = (stndrd ?? TOKENS_STNDRD_ESCURO).glass;
  const solido = useReduzirTransparencia() || preferencias?.contraste === 'ALTO';
  // `backdropFilter` existe no react-native-web (CSS), mas não no tipo do React Native.
  const fundo = solido
    ? { backgroundColor: vidro.cor }
    : ({ backgroundColor: fundoDoVidro(vidro), backdropFilter: `blur(${(vidro.blur * intensidade) / 50}px)` } as object);
  return <View ref={ref} {...resto} style={[estilo, fundo]}>{children}</View>;
}

export const AlvoDoVidro = View;
