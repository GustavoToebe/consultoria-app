import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MolduraDoPerfil } from '../dominio/perfilDaComunidade';

const LINHA = 2;
const GROSSA = 5;
const FOLGA = 3;

/**
 * Moldura da foto do perfil na Comunidade, na cor de destaque do aluno. Cada moldura tem uma FORMA própria (linha fina, duas
 * linhas, traços, linha larga), para nunca depender só da cor; o nome dela vem sempre escrito ao lado. A dupla são dois anéis
 * porque o `borderStyle` do React Native não tem "double". `tamanho` é o do conteúdo (a foto); a moldura cresce por fora.
 */
export function MolduraDaFoto({ moldura, cor, tamanho, children }: { moldura: MolduraDoPerfil; cor: string; tamanho: number; children: ReactNode }) {
  const anel = (dentro: number, largura: number, conteudo: ReactNode, tracejada = false) => {
    const lado = dentro + 2 * (largura + FOLGA);
    return (
      <View style={[estilos.anel, { width: lado, height: lado, borderRadius: lado / 2, borderWidth: largura, borderColor: cor, borderStyle: tracejada ? 'dashed' : 'solid' }]}>
        {conteudo}
      </View>
    );
  };
  if (moldura === 'DUPLA') return anel(tamanho + 2 * (LINHA + FOLGA), LINHA, anel(tamanho, LINHA, children));
  if (moldura === 'GROSSA') return anel(tamanho, GROSSA, children);
  return anel(tamanho, LINHA, children, moldura === 'TRACEJADA');
}

const estilos = StyleSheet.create({
  anel: { alignItems: 'center', justifyContent: 'center' },
});
