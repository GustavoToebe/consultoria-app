import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';

/**
 * Pares "rótulo / valor" (`CampoLeitura`) lado a lado, quebrando linha quando não cabem: quatro numa linha no PC, dois
 * no celular. Para resumos curtos (valor, periodicidade, vencimento) que, um embaixo do outro, viravam uma coluna alta e
 * vazia. Cada item tem a mesma largura mínima, então as colunas se alinham entre linhas.
 */
export function CamposEmLinha({ children, minimo = 150 }: { children: ReactNode; minimo?: number }) {
  const itens = Children.toArray(children);
  return (
    <View style={estilos.linha}>
      {itens.map((item, i) => <View key={i} style={[estilos.item, { flexBasis: minimo }]}>{item}</View>)}
    </View>
  );
}

/** Largura mínima de cada data, por variante do par ("31/12/2026" e o ícone do calendário cabem nas duas). */
const MINIMO_DA_DATA = { formulario: 190, filtro: 150 } as const;

/**
 * Intervalo de datas (P2 de `docs/design-e-front.md` 4.6): os dois `CampoData` (início e fim) numa `CamposEmLinha`, com
 * a mesma largura e o mesmo topo; o erro de um fica embaixo dele e não desalinha o outro. `formulario` (padrão): lado a
 * lado na folha do PC e empilhados no celular (duas de 190 px não cabem em 390). `filtro` (painel de filtros): lado a lado
 * sempre que cabem duas de 150 px, também no celular. Empilham só quando a largura não dá (texto grande, cartão estreito).
 */
export function ParDeDatas({ children, variante = 'formulario' }: { children: ReactNode; variante?: keyof typeof MINIMO_DA_DATA }) {
  return <CamposEmLinha minimo={MINIMO_DA_DATA[variante]}>{children}</CamposEmLinha>;
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  item: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
});
