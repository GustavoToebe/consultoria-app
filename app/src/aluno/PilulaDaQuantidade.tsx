import { StyleSheet, View } from 'react-native';

import { espaco, fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * Etiqueta da quantidade à direita do item na dieta do aluno: o número grande e a unidade (ou o resto do texto) ao lado,
 * borda e texto numa cor só. Os alimentos usam a cor da refeição (categoria, com o fundo dela); a dose da medicação e da
 * suplementação, as cores neutras do cartão. Sem valor, "—". O leitor de tela ouve só `rotuloAcessivel`.
 */
export function PilulaDaQuantidade({ numero, resto, cor, borda = cor, fundo, rotuloAcessivel }: {
  numero: string | null; resto?: string | null; cor: string; borda?: string; fundo?: string; rotuloAcessivel: string;
}) {
  return (
    <View style={[estilos.pilula, { borderColor: borda, backgroundColor: fundo }]} accessible accessibilityLabel={rotuloAcessivel}>
      {numero !== null || !resto ? <Texto numerico cor={cor} style={estilos.numero}>{numero ?? '—'}</Texto> : null}
      {resto ? <Texto numerico cor={cor} style={estilos.resto}>{resto}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.5), borderWidth: 1, borderRadius: 10, paddingVertical: espaco(0.75), paddingHorizontal: espaco(1.5), flexShrink: 0, maxWidth: '50%' },
  numero: { fontFamily: fontes.negrito, fontSize: 18, lineHeight: 22 },
  resto: { fontFamily: fontes.negrito, fontSize: 14, lineHeight: 18, flexShrink: 1 },
});
