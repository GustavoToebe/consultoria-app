import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colunasPorLargura } from '../dominio/grade';
import { espaco } from '../tema/tokens';
import { useFaixaDeLargura } from './useFaixaDeLargura';

/**
 * Itens de uma lista em colunas, pela largura da própria grade (medida com onLayout, como o cartão do Progresso):
 * 1 coluna abaixo de 760 px, 2 a partir de 760 e 3 a partir de 1240. Cada filho ocupa uma célula de largura igual;
 * `gap` é o espaço entre itens (o mesmo da lista que a grade substitui). Sem medida ainda, 1 coluna. `colunas` troca a
 * regra (os indicadores de Interessados: 4, 2 ou 1); sem ela, a de sempre. `alinhar` `inicio`: cada item com a própria
 * altura (cartões de conteúdos diferentes lado a lado), em vez de esticar até o vizinho. `ultimaLinha` `esticar`: a última
 * linha incompleta (5 em 3 + 2) divide a largura toda entre os seus, sem buraco à direita (`GradeDeIndicadores`); o
 * padrão `igual` deixa cada célula com a largura das outras.
 */
export function Grade({ children, gap = espaco(1), colunas: regra = colunasPorLargura, alinhar = 'esticar', ultimaLinha = 'igual' }: {
  children: ReactNode;
  gap?: number;
  colunas?: (largura: number) => number;
  alinhar?: 'esticar' | 'inicio';
  ultimaLinha?: 'igual' | 'esticar';
}) {
  const { largura, aoMedir } = useFaixaDeLargura();
  const colunas = largura > 0 ? regra(largura) : 1;
  const itens = Children.toArray(children);
  // Largura exata da célula: o espaço total entre colunas sai da largura medida. A mesma árvore em 1 e em várias colunas
  // (cada item numa célula com a mesma chave): passar de 1 para 2 colunas depois da medida não remonta os campos, que
  // perderiam o foco e o que estava sendo digitado. O `- 1`: na web o onLayout arredonda a largura (3045,5 vira 3046) e as
  // células passariam da linha por meio pixel, jogando a última para baixo (o 3 + 1 do ultrawide com zoom, 24/11).
  const largo = (n: number) => (largura - 1 - gap * (n - 1)) / n;
  const celula = colunas === 1 ? undefined : largo(colunas);
  const resto = colunas > 1 && ultimaLinha === 'esticar' ? itens.length % colunas : 0;
  const celulaDaUltima = resto ? largo(resto) : undefined;
  return (
    <View onLayout={aoMedir} style={[colunas === 1 ? null : estilos.linha, colunas > 1 && alinhar === 'inicio' ? estilos.inicio : null, { gap }]}>
      {itens.map((item, i) => {
        const width = celulaDaUltima !== undefined && i >= itens.length - resto ? celulaDaUltima : celula;
        return <View key={i} style={width === undefined ? undefined : { width }}>{item}</View>;
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  inicio: { alignItems: 'flex-start' },
});
