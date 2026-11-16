import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDoItemDoAluno } from '../../api/rotas';
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { plataformaDoApp } from '../../dominio/financeiro';
import { linkParaAbrir } from '../../dominio/links';
import { comoMostrarItem, textoDoPreco, type TextoDoPreco } from '../../dominio/vitrine';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { CupomDoProduto, VerProduto } from '../../ui/AcoesDoProduto';
import { Texto } from '../../ui/Texto';
import { MiniaturaDoItem } from './MiniaturaDoItem';

/**
 * Preço do item como o servidor decidiu (`precoVigenteCentavos`, D4): o app só formata. Com o especial valendo, o
 * normal vem riscado ao lado e a validade embaixo. O leitor de tela ouve "antes" no lugar do risco.
 */
export function PrecoDoItem({ item }: { item: ItemDaVitrineDoAluno }) {
  return <PrecoFormatado preco={textoDoPreco(item)} />;
}

/** O desenho do preço já formatado pelo domínio (também na página pública da loja). */
export function PrecoFormatado({ preco }: { preco: TextoDoPreco }) {
  const rotulo = `Preço: ${preco.atual === '—' ? 'não informado' : preco.atual}${preco.antes ? `, antes ${preco.antes}` : ''}${preco.validade ? `. ${preco.validade}` : ''}`;
  return (
    <View style={estilos.preco} accessible accessibilityLabel={rotulo}>
      <View style={estilos.linhaDoPreco}>
        <Texto variante="subtitulo" numerico>{preco.atual}</Texto>
        {preco.antes ? <Texto variante="suave" numerico style={estilos.riscado}>{preco.antes}</Texto> : null}
      </View>
      {preco.validade ? <Texto variante="pequeno">{preco.validade}</Texto> : null}
    </View>
  );
}

/**
 * Um item da vitrine para o aluno. No celular, item DIGITAL mostra só foto, nome e descrição (D6, regra das lojas):
 * sem preço, cupom, link nem frase de "compre pelo site". O link abre fora do app, sem token.
 */
export function CartaoDoItem({ item }: { item: ItemDaVitrineDoAluno }) {
  const { cores } = useTema();
  const mostrar = comoMostrarItem(item.tipo, plataformaDoApp(Platform.OS));
  const link = mostrar.link ? linkParaAbrir(item.linkUrl) : null;
  const cupom = mostrar.cupom ? item.cupom?.trim() : null;
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.divisor }]} role="listitem" testID={`item-da-vitrine-${item.id}`}>
      <View style={estilos.topo}>
        <MiniaturaDoItem item={item} carregar={baixarFotoDoItemDoAluno} tamanho={88} />
        <View style={estilos.textos}>
          <Texto variante="subtitulo" nivel={2}>{item.nome}</Texto>
          {item.descricao ? <Texto variante="suave">{item.descricao}</Texto> : null}
          {mostrar.preco ? <PrecoDoItem item={item} /> : null}
        </View>
      </View>
      {cupom || link ? (
        <View style={estilos.acoes}>
          {cupom ? <CupomDoProduto uid={item.id} nome={item.nome} cupom={cupom} /> : null}
          {link ? <VerProduto link={link} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1.5) },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  preco: { gap: espaco(0.25), paddingTop: espaco(0.25) },
  linhaDoPreco: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: espaco(1) },
  riscado: { textDecorationLine: 'line-through' },
  acoes: { gap: espaco(0.5) },
});
