import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { toQR } from 'toqr';

import { caminhoDoQr } from '../dominio/mfa';

/**
 * QR code desenhado em SVG (sem imagem, sem serviço externo: o segredo nunca sai do aparelho). O fundo é sempre branco
 * e o desenho preto, em qualquer tema, porque o leitor precisa do contraste e da margem clara em volta.
 */
export function CodigoQr({ conteudo, tamanho = 200, descricao }: { conteudo: string; tamanho?: number; descricao: string }) {
  const { caminho, lado } = useMemo(() => caminhoDoQr(toQR(conteudo)), [conteudo]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={descricao} style={[estilos.quadro, { width: tamanho, height: tamanho }]}>
      <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} aria-hidden>
        <Path d={caminho} fill="#000000" />
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  quadro: { backgroundColor: '#FFFFFF' },
});
