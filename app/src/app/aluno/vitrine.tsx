import { Redirect, useFocusEffect } from 'expo-router';
import { Store, WifiOff } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { CartaoDoItem } from '../../aluno/vitrine/CartaoDoItem';
import { useVitrineDoAluno } from '../../aluno/vitrine/useVitrineDoAluno';
import { agruparPorCategoria } from '../../dominio/vitrineCategorias';
import { espaco } from '../../tema/tokens';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro, Vazio } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/**
 * Vitrine do aluno: os itens ativos que a consultoria mostra, na ordem dela, separados por categoria (subtítulo por grupo,
 * "Sem categoria" por último; sem nenhuma categoria, a lista de sempre, sem subtítulos). Chave desligada = a tela não existe.
 */
export default function VitrineDoAluno() {
  const { dados, erro, carregando, recarregar, vitrineHabilitada, online } = useVitrineDoAluno();
  useFocusEffect(useCallback(() => { recarregar(); }, [recarregar]));
  if (!vitrineHabilitada) return <Redirect href="/aluno" />;
  return (
    <Tela largura={1120}>
      <Cabecalho titulo="Vitrine" subtitulo="Produtos e serviços da sua consultoria." voltar="/aluno" />
      {!online ? <Vazio Icone={WifiOff} titulo="Sem conexão" texto="A vitrine precisa de internet. Conecte-se e volte aqui." /> : null}
      {online && erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {online && !dados && carregando ? <Esqueleto texto="Carregando a vitrine" /> : null}
      {online && dados && dados.length === 0 ? <Vazio Icone={Store} titulo="Nada na vitrine agora" texto="Quando sua consultoria colocar um produto ou serviço, ele aparece aqui." /> : null}
      {online && dados && dados.length > 0 ? (
        <View style={estilos.grupos}>
          {agruparPorCategoria(dados, (i) => i.categoria).map((g) => (
            <View key={g.chave ?? 'sem-categoria'} style={estilos.lista}>
              {g.titulo ? <Texto variante="subtitulo" nivel={2}>{g.titulo}</Texto> : null}
              <View style={estilos.lista} accessibilityRole="list" aria-label={g.titulo ?? undefined}>
                {g.itens.map((item) => <CartaoDoItem key={item.id} item={item} nivel={g.titulo ? 3 : 2} />)}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  // Entre categorias o dobro do espaço entre cartões.
  grupos: { gap: espaco(3) },
  lista: { gap: espaco(1.5) },
});
