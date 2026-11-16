import { Image } from 'expo-image';
import { ExternalLink, Package } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { urlDaApi } from '../../api/cliente';
import { caminhoDaFotoDaLoja } from '../../api/rotas';
import { PrecoFormatado } from '../../aluno/vitrine/CartaoDoItem';
import { ROTULO_DO_BOTAO, type ItemDaLojaParaMostrar } from '../../dominio/loja';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE, textoSobre } from '../../tema/tokens';
import { CupomDoProduto } from '../../ui/AcoesDoProduto';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/** `hrefAttrs` é do react-native-web (vira `target`/`rel` do `<a>`); o tipo do React Native não o conhece. */
type PropsDeAncora = PressableProps & { href: string; hrefAttrs: { target: string; rel: string } };

/**
 * Um item da página pública: foto (quando há), nome, descrição, preço, cupom e "Comprar". O que aparece já vem decidido
 * por `itemDaLojaParaMostrar` (no celular, só foto, nome e descrição). A foto é pública e sem token (`urlDaApi`), nunca
 * pelo cliente da API.
 */
export function CartaoDaLoja({ codigo, item, cor }: { codigo: string; item: ItemDaLojaParaMostrar; cor: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.divisor }]} role="listitem" testID={`item-da-loja-${item.id}`}>
      {item.foto ? <FotoDoItem codigo={codigo} item={item} /> : null}
      <View style={estilos.textos}>
        <Texto variante="subtitulo" nivel={2}>{item.nome}</Texto>
        {item.descricao ? <Texto variante="suave">{item.descricao}</Texto> : null}
        {item.preco ? <PrecoFormatado preco={item.preco} /> : null}
      </View>
      {item.cupom ? <CupomDoProduto uid={item.id} nome={item.nome} cupom={item.cupom} /> : null}
      {item.linkUrl ? <Comprar href={item.linkUrl} nome={item.nome} cor={cor} /> : null}
    </View>
  );
}

/** Foto 4:3 inteira (sem cortar o produto) sobre a superfície elevada; se não carregar, o quadro neutro com o ícone. */
function FotoDoItem({ codigo, item }: { codigo: string; item: ItemDaLojaParaMostrar }) {
  const { cores } = useTema();
  const [falhou, setFalhou] = useState(false);
  return (
    <View style={[estilos.foto, { backgroundColor: cores.superficie2 }]}>
      {falhou ? (
        <Package size={32} color={cores.textoSuave} aria-hidden />
      ) : (
        <Image source={{ uri: urlDaApi(caminhoDaFotoDaLoja(codigo, item.id, item.fotoAtualizadaEm)) }} style={estilos.imagem}
          contentFit="contain" accessibilityLabel={`Foto de ${item.nome}`} onError={() => setFalhou(true)} />
      )}
    </View>
  );
}

/**
 * "Comprar": `<a href>` de verdade, em outra aba e com `rel="noopener noreferrer"` (a página de venda é do treinador, fora
 * do app). Na cor da consultoria: é a ação de cada cartão, como o envio da inscrição.
 */
function Comprar({ href, nome, cor }: { href: string; nome: string; cor: string }) {
  const letra = textoSobre(cor);
  const props: PropsDeAncora = {
    href,
    hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' },
    accessibilityRole: 'link',
    accessibilityLabel: `${ROTULO_DO_BOTAO} ${nome}, abre em outra aba`,
    style: (estado) => [estilos.comprar, { backgroundColor: cor, borderColor: cor, opacity: sobre(estado) ? 0.88 : 1 }],
  };
  return (
    <Pressable {...props}>
      <View style={estilos.conteudoDoComprar}>
        <Texto style={[estilos.rotulo, { color: letra }]}>{ROTULO_DO_BOTAO}</Texto>
        <ExternalLink size={18} color={letra} strokeWidth={2} aria-hidden />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1.25) },
  foto: { aspectRatio: 4 / 3, borderRadius: RAIO_CONTROLE, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  imagem: { width: '100%', height: '100%' },
  textos: { gap: espaco(0.5) },
  comprar: {
    minHeight: ALVO_TOQUE,
    borderRadius: RAIO,
    borderWidth: 1,
    paddingHorizontal: espaco(2),
    paddingVertical: espaco(0.75),
    justifyContent: 'center',
  },
  conteudoDoComprar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espaco(1) },
  rotulo: { fontFamily: fontes.semi, fontSize: 15 },
});
