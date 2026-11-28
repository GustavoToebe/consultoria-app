import { StyleSheet, View } from 'react-native';

import { CartaoFotos } from '../../fotos/CartaoFotos';
import { colunasDoHistorico } from '../../dominio/colunasDoHistorico';
import { espaco } from '../../tema/tokens';
import { CartaoAvaliacaoFisica } from '../../treinador/CartaoAvaliacaoFisica';
import { CartaoPeso } from '../../treinador/CartaoPeso';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { useFaixaDaTela } from '../../ui/Tela';

const VAO = espaco(3);

/**
 * Aba Corpo do Histórico na web (28/11, pedido do Gustavo): na primeira linha Peso e Fotos lado a lado, com a mesma altura
 * (a linha estica os dois cartões; a grade das fotos usa a largura do cartão), e na segunda a Avaliação física na largura
 * toda (gráfico e tabela lado a lado por dentro). Sem vazio embaixo de nenhuma coluna. Onde não cabem duas colunas
 * (`dominio/colunasDoHistorico`, mínimo de 440 cada), um embaixo do outro: Peso, Avaliação, Fotos.
 */
export function CorpoDoHistorico({ online }: { online: boolean }) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const faixa = useFaixaDaTela();
  const duas = colunasDoHistorico(largura, faixa, { pecas: 2, vao: VAO }) >= 2;
  const avaliacao = <CartaoAvaliacaoFisica online={online} />;
  return (
    // Nada antes de medir: montar numa coluna e remontar em duas buscaria os dados duas vezes.
    <View onLayout={aoMedir} style={estilos.pilha}>
      {largura === 0 ? null : duas ? (
        <>
          <View style={estilos.linha}>
            <View testID="corpo-do-historico-peso" style={estilos.celula}><CartaoPeso style={estilos.cheio} /></View>
            <View testID="corpo-do-historico-fotos" style={estilos.celula}><CartaoFotos style={estilos.cheio} /></View>
          </View>
          {avaliacao}
        </>
      ) : (
        <>
          <CartaoPeso />
          {avaliacao}
          <CartaoFotos />
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pilha: { gap: VAO },
  linha: { flexDirection: 'row', alignItems: 'stretch', gap: VAO },
  celula: { flex: 1, minWidth: 0 },
  cheio: { flexGrow: 1 },
});
