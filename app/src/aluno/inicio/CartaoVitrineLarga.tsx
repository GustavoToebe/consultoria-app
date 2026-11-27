import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { baixarFotoDoItemDoAluno } from '../../api/rotas';
import type { ItemDaVitrineDoAluno } from '../../api/vitrineTipos';
import { fileiraDaVitrine } from '../../dominio/arranjoDoInicioLargo';
import { plataformaDoApp } from '../../dominio/financeiro';
import { comoMostrarItem, itensDoCartaoDoInicio } from '../../dominio/vitrine';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { PrecoDoItem } from '../vitrine/CartaoDoItem';
import { MiniaturaDoItem } from '../vitrine/MiniaturaDoItem';

const VAO = espaco(1.5);

/**
 * A "Vitrine" do Início na web larga (27/11): uma fileira de produtos (foto ao lado do nome e do preço) (quantos cabem com 240 a 320 px cada, os em
 * promoção primeiro, `itensDoCartaoDoInicio`), o "Ver tudo" no cabeçalho do cartão e a sobra no fim da linha (produto não
 * estica). Os mesmos textos e destino do `CartaoVitrineDoInicio` do celular; item digital no celular sem preço (D6). Sem
 * item, some.
 */
export function CartaoVitrineLarga({ itens: dados }: { itens: ItemDaVitrineDoAluno[] | undefined }) {
  const { cores } = useTema();
  const { largura, aoMedir } = useFaixaDeLargura();
  if (!dados?.length) return null;
  const plataforma = plataformaDoApp(Platform.OS);
  const { quantos, celula } = fileiraDaVitrine(largura, dados.length, VAO);
  const itens = itensDoCartaoDoInicio(dados, quantos);
  return (
    <Cartao titulo="Vitrine" acoes={<Botao rotulo="Ver tudo" rotuloAcessivel="Ver tudo da vitrine" tipo="fantasma" aoTocar={() => router.push('/aluno/vitrine')} />}>
      <View onLayout={aoMedir} role="list" style={[estilos.fileira, { opacity: largura > 0 ? 1 : 0 }]}>
        {itens.map((item) => (
          <View key={item.id} role="listitem" testID={`inicio-vitrine-${item.id}`}
            style={[estilos.item, { width: celula, backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
            <MiniaturaDoItem item={item} carregar={baixarFotoDoItemDoAluno} tamanho={88} />
            <View style={estilos.textos}>
              <Texto variante="subtitulo" numberOfLines={2}>{item.nome}</Texto>
              {comoMostrarItem(item.tipo, plataforma).preco ? <PrecoDoItem item={item} /> : item.descricao ? <Texto variante="suave" numberOfLines={2}>{item.descricao}</Texto> : null}
            </View>
          </View>
        ))}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  fileira: { flexDirection: 'row', gap: VAO },
  // Cartão de produto deitado: a foto à esquerda, nome (até 2 linhas) e preço ao lado. Conferido nas capturas de 27/11: em pé,
  // a foto de 96 deixava 2/3 do cartão vazio, e na largura toda o quadro sem foto virava uma caixa enorme com o ícone.
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), padding: espaco(1.5), borderWidth: 1, borderRadius: RAIO },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.25) },
});
