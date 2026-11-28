import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, type Cores } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';
import { ALTURA_DO_CELULAR, LARGURA_DO_CELULAR } from './arranjoDaMarca';

/** Altura do desenho de um celular com a legenda embaixo (para a `Escala`). */
export const ALTURA_DO_CELULAR_COM_LEGENDA = ALTURA_DO_CELULAR + espaco(1) + 20;

/**
 * Um celular da prévia, no tamanho fixo do desenho (380 × 640; quem chama reduz com a `Escala`), com as cores FIXAS da
 * paleta mostrada (não as do tema de quem edita). É desenho, lido como uma imagem só (`role=img` com a legenda).
 */
export function Celular({ legenda, descricao, testID, cores, children }: { legenda: string; descricao: string; testID: string; cores: Cores; children: ReactNode }) {
  const { cores: atuais } = useTema();
  return (
    <View style={estilos.coluna}>
      <View role="img" aria-label={descricao} testID={testID}
        style={[estilos.celular, { backgroundColor: cores.fundo, borderColor: atuais.bordaCampo }]}>
        {children}
      </View>
      <Texto variante="pequeno" aria-hidden style={estilos.legenda}>{legenda}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { width: LARGURA_DO_CELULAR, gap: espaco(1) },
  celular: { width: LARGURA_DO_CELULAR, height: ALTURA_DO_CELULAR, borderWidth: 1, borderRadius: 28, overflow: 'hidden', justifyContent: 'space-between' },
  legenda: { textAlign: 'center', lineHeight: 20 },
});
