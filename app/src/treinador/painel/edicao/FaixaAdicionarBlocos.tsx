import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../../tema/TemaProvider';
import { espaco, RAIO } from '../../../tema/tokens';
import { Botao } from '../../../ui/Botao';
import { Texto } from '../../../ui/Texto';
import { idDaEdicao, type BlocoDoPainelId, type ItemDaEdicao } from './tipos';

/**
 * "Adicionar blocos", no fim da grade em edição: um cartão pequeno por bloco oculto (nome, a frase curta do que ele mostra
 * e "Adicionar"). Quem adiciona é o pai (`aoAdicionar`): o bloco volta no fim da grade, já visível. Sem ocultos, a faixa
 * some.
 */
export function FaixaAdicionarBlocos({ ocultos, aoAdicionar }: {
  ocultos: readonly Pick<ItemDaEdicao, 'id' | 'titulo' | 'descricao'>[];
  aoAdicionar: (id: BlocoDoPainelId) => void;
}) {
  const { cores, bordas } = useTema();
  if (ocultos.length === 0) return null;
  return (
    <View style={estilos.faixa}>
      <Texto variante="bloco" nivel={2}>Adicionar blocos</Texto>
      <View role="list" style={estilos.cartoes}>
        {ocultos.map((b) => (
          <View key={b.id} role="listitem" nativeID={idDaEdicao(b.id, 'adicionar')}
            style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
            <View style={estilos.textos}>
              <Texto variante="rotulo" cor={cores.texto}>{b.titulo}</Texto>
              <Texto variante="pequeno">{b.descricao}</Texto>
            </View>
            <Botao rotulo="Adicionar" rotuloAcessivel={`Adicionar ${b.titulo} ao Início`} tipo="secundario" Icone={Plus} aoTocar={() => aoAdicionar(b.id)} />
          </View>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { gap: espaco(1.5) },
  cartoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2) },
  // Cartões de pelo menos 240 px que dividem a linha; o botão fica embaixo do texto, à esquerda.
  cartao: { flexGrow: 1, flexShrink: 1, flexBasis: 240, maxWidth: 420, gap: espaco(1.5), padding: espaco(2), borderRadius: RAIO, alignItems: 'flex-start' },
  textos: { gap: 2, alignSelf: 'stretch' },
});
