import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';

/**
 * Barra fina de progresso ("3 de 18 séries"). O texto ao lado é de quem usa; a barra é só apoio visual. `rotulo` e
 * `valorEmTexto` dão nome e valor falado ao leitor de tela (`aria-valuetext`), quando o número cru não diz nada sozinho.
 */
export function BarraProgresso({ feitas, total, cor, trilho, rotulo, valorEmTexto }: {
  feitas: number; total: number; cor?: string; trilho?: string; rotulo?: string; valorEmTexto?: string;
}) {
  const { cores } = useTema();
  const fracao = total > 0 ? Math.min(feitas / total, 1) : 0;
  return (
    <View
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={feitas}
      aria-valuetext={valorEmTexto}
      style={[estilos.trilho, { backgroundColor: trilho ?? cores.superficie2 }]}>
      <View style={[estilos.cheio, { width: `${fracao * 100}%`, backgroundColor: cor ?? cores.sucesso }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 6, borderRadius: 3, overflow: 'hidden' },
  cheio: { height: '100%', borderRadius: 3 },
});
