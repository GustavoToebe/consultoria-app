import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';

/** Barra fina de progresso ("3 de 18 séries"). O texto ao lado é de quem usa; a barra é só apoio visual. */
export function BarraProgresso({ feitas, total, cor, trilho }: { feitas: number; total: number; cor?: string; trilho?: string }) {
  const { cores } = useTema();
  const fracao = total > 0 ? Math.min(feitas / total, 1) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: feitas }}
      style={[estilos.trilho, { backgroundColor: trilho ?? cores.superficie2 }]}>
      <View style={[estilos.cheio, { width: `${fracao * 100}%`, backgroundColor: cor ?? cores.sucesso }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  cheio: { height: '100%', borderRadius: 3 },
});
