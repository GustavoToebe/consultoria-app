import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDoItemDoAluno } from '../../api/rotas';
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { colunasDaVitrineDoInicio } from '../../dominio/arranjoDoInicio';
import { plataformaDoApp } from '../../dominio/financeiro';
import { comoMostrarItem, itensDoCartaoDoInicio } from '../../dominio/vitrine';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Grade } from '../../ui/Grade';
import { Texto } from '../../ui/Texto';
import { PrecoDoItem } from '../vitrine/CartaoDoItem';
import { MiniaturaDoItem } from '../vitrine/MiniaturaDoItem';

/**
 * A "Vitrine" do Início na web larga (`docs/planos/aluno-web-layout.md` seção 1), última linha, na largura toda: os mesmos
 * itens, textos e destino do `CartaoVitrineDoInicio` do celular, mas num `Cartao` com título como "Sua semana" e o "Ver tudo"
 * no cabeçalho do cartão (antes boiava fora dele), e os itens em grade de produtos (`colunasDaVitrineDoInicio`). Sem item, some.
 */
export function CartaoVitrineLarga({ itens: dados }: { itens: ItemDaVitrineDoAluno[] | undefined }) {
  if (!dados?.length) return null;
  const plataforma = plataformaDoApp(Platform.OS);
  const itens = itensDoCartaoDoInicio(dados);
  return (
    <Cartao titulo="Vitrine" acoes={<Botao rotulo="Ver tudo" rotuloAcessivel="Ver tudo da vitrine" tipo="fantasma" aoTocar={() => router.push('/aluno/vitrine')} />}>
      <View accessibilityRole="list">
        <Grade gap={espaco(1.5)} colunas={(largura) => colunasDaVitrineDoInicio(largura, itens.length, espaco(1.5))}>
          {itens.map((item) => (
            <View key={item.id} style={estilos.item} role="listitem" testID={`inicio-vitrine-${item.id}`}>
              <MiniaturaDoItem item={item} carregar={baixarFotoDoItemDoAluno} tamanho={56} />
              <View style={estilos.textos}>
                <Texto variante="subtitulo" numberOfLines={2}>{item.nome}</Texto>
                {comoMostrarItem(item.tipo, plataforma).preco ? <PrecoDoItem item={item} /> : item.descricao ? <Texto variante="suave" numberOfLines={2}>{item.descricao}</Texto> : null}
              </View>
            </View>
          ))}
        </Grade>
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.25) },
});
