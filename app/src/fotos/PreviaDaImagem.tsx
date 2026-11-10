import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FotoDaLinha } from '../api/tipos';
import { LARGURA_IMAGEM, layoutDaImagem, type FormatoDaImagem, type RetanguloDaImagem } from '../dominio/comparacaoDeFotos';
import { dataParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { enderecoDaImagem } from '../ui/ImagemProtegida';
import { Texto } from '../ui/Texto';
import { useCarregar } from '../ui/useCarregar';

/**
 * Prévia de uma imagem da comparação na escala da tela, com a mesma geometria do arquivo gerado
 * (`layoutDaImagem`, espelho do `LayoutDaComparacao` do servidor): quadros sem borda nem canto, espaço de 8 px
 * escalado, foto cobrindo o quadro e a logo a 30% da largura, com a proporção dela, a 24 px do pé.
 */
export function PreviaDaImagem({ chave, rotulo, fotos, formato, largura, altura, logoUrl, baixar }: {
  chave: string;
  rotulo: string;
  fotos: FotoDaLinha[];
  formato: FormatoDaImagem;
  largura: number;
  altura: number;
  /** Endereço da logo já resolvido, ou `null` sem logo. */
  logoUrl: string | null;
  baixar: (foto: FotoDaLinha) => Promise<Blob>;
}) {
  const { cores } = useTema();
  const [logo, setLogo] = useState<{ largura: number; altura: number } | null>(null);
  const escala = largura / LARGURA_IMAGEM;
  // Até a logo carregar, a conta usa um quadrado; o `onLoad` corrige para a proporção real.
  const layout = layoutDaImagem(formato, fotos.length, !!logoUrl, logo?.largura ?? 1, logo?.altura ?? 1);
  const naTela = (r: RetanguloDaImagem) => ({
    left: Math.round(r.x * escala), top: Math.round(r.y * escala),
    width: Math.round(r.largura * escala), height: Math.round(r.altura * escala),
  });
  return (
    // Fundo `#000` literal: é a cor do fundo da imagem gerada no servidor (não é cor de tela, por isso não é token).
    // A borda de 1 px fica por fora: a área da imagem mede exatamente `largura` × `altura`.
    <View style={[estilos.quadro, { width: largura + 2, height: altura + 2, backgroundColor: '#000', borderColor: cores.borda }]}>
      <View role="group" accessibilityLabel="Prévia da imagem" style={StyleSheet.absoluteFill}>
        {fotos.map((foto, i) => (
          <Quadro key={foto.fotoId} chave={`gerar:${chave}:${foto.fotoId}`} descricao={`${rotulo}, ${dataParaTela(foto.data)}`} carregar={() => baixar(foto)} estilo={naTela(layout.fotos[i])} />
        ))}
      </View>
      {logoUrl && layout.logo ? (
        <Image
          source={{ uri: logoUrl }}
          contentFit="contain"
          accessibilityLabel="Logo da consultoria"
          pointerEvents="none"
          onLoad={(e) => { const { width, height } = e.source; if (width > 0 && height > 0) setLogo({ largura: width, altura: height }); }}
          style={[estilos.absoluto, naTela(layout.logo)]}
        />
      ) : null}
    </View>
  );
}

/** Um quadro da imagem: baixa a foto com o token, como a `ImagemProtegida`, mas sem a moldura dela (o arquivo não tem). */
function Quadro({ chave, descricao, carregar, estilo }: {
  chave: string;
  descricao: string;
  carregar: () => Promise<Blob>;
  estilo: { left: number; top: number; width: number; height: number };
}) {
  const { cores } = useTema();
  const { dados: endereco, erro, recarregar } = useCarregar(chave, async () => enderecoDaImagem(await carregar()));
  useEffect(() => () => {
    if (endereco?.startsWith('blob:')) URL.revokeObjectURL(endereco);
  }, [endereco]);
  if (erro) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${descricao}: não foi possível carregar. Tocar para tentar de novo`}
        onPress={recarregar} style={[estilos.absoluto, estilos.centro, estilo, { backgroundColor: cores.superficie2 }]}>
        <Texto variante="pequeno" style={estilos.textoCentro}>Tentar de novo</Texto>
      </Pressable>
    );
  }
  if (!endereco) return <View accessibilityRole="progressbar" accessibilityLabel={`Carregando: ${descricao}`} style={[estilos.absoluto, estilo, { backgroundColor: cores.superficie2 }]} />;
  return <Image source={{ uri: endereco }} cachePolicy="none" contentFit="cover" accessibilityLabel={descricao} style={[estilos.absoluto, estilo]} />;
}

const estilos = StyleSheet.create({
  quadro: { position: 'relative', overflow: 'hidden', borderWidth: 1 },
  absoluto: { position: 'absolute' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  textoCentro: { textAlign: 'center' },
});
