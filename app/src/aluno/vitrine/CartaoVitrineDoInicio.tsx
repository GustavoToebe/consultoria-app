import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDoItemDoAluno } from '../../api/rotas';
import { plataformaDoApp } from '../../dominio/financeiro';
import { comoMostrarItem, itensDoCartaoDoInicio } from '../../dominio/vitrine';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { SecaoDoInicio } from '../SecaoDoInicio';
import { MiniaturaDoItem } from './MiniaturaDoItem';
import { PrecoDoItem } from './CartaoDoItem';
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';

/**
 * "Vitrine" no início do aluno: até dois itens (o de preço especial valendo primeiro) e "Ver tudo". Sem item, sem
 * internet, com erro ou com a chave desligada, o bloco some (como "Seus compromissos"). Os itens vêm do Início
 * (`useVitrineDoAluno`), que também precisa saber se o bloco aparece para montar as colunas da tela larga.
 */
export function CartaoVitrineDoInicio({ itens: dados }: { itens: ItemDaVitrineDoAluno[] | undefined }) {
  if (!dados?.length) return null;
  const plataforma = plataformaDoApp(Platform.OS);
  return (
    <SecaoDoInicio titulo="Vitrine" direita={<Botao rotulo="Ver tudo" rotuloAcessivel="Ver tudo da vitrine" tipo="fantasma" aoTocar={() => router.push('/aluno/vitrine')} />}>
      <Cartao>
        <View style={estilos.lista} accessibilityRole="list">
          {itensDoCartaoDoInicio(dados).map((item) => (
            <View key={item.id} style={estilos.item} role="listitem" testID={`inicio-vitrine-${item.id}`}>
              <MiniaturaDoItem item={item} carregar={baixarFotoDoItemDoAluno} tamanho={56} />
              <View style={estilos.textos}>
                <Texto variante="subtitulo" numberOfLines={2}>{item.nome}</Texto>
                {comoMostrarItem(item.tipo, plataforma).preco ? <PrecoDoItem item={item} /> : item.descricao ? <Texto variante="suave" numberOfLines={2}>{item.descricao}</Texto> : null}
              </View>
            </View>
          ))}
        </View>
      </Cartao>
    </SecaoDoInicio>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5) },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.25) },
});
