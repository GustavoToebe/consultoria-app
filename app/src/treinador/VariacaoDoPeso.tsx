import { StyleSheet, View } from 'react-native';

import type { VariacaoDoPeso as Variacao } from '../dominio/variacaoDoPeso';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/** A seta só diz a direção; ela e o número ficam na cor do texto (o sistema não julga se subir é bom ou ruim). */
const SETA = { sobe: '▲', desce: '▼', igual: '' } as const;

/** Frase para o leitor de tela: "Subiu 1,2 kg desde 12/10", "Desceu 0,7 kg desde o registro anterior", "Igual ao registro anterior". */
function textoAcessivel(v: Variacao): string {
  if (v.seta === 'igual') return `Igual ao registro ${v.desde ? `de ${v.desde}` : 'anterior'}`;
  const numero = v.texto.replace(/^[+−]/, '');
  return `${v.seta === 'sobe' ? 'Subiu' : 'Desceu'} ${numero} ${v.desde ? `desde ${v.desde}` : 'desde o registro anterior'}`;
}

/**
 * Variação de um registro de peso (A11 da reunião de 30/10), igual na ficha e no histórico do aluno: seta, número com
 * sinal e, embaixo, "desde 12/10" quando o registro de comparação está na lista. Sem anterior, "—".
 */
export function VariacaoDoPeso({ variacao }: { variacao: Variacao | null }) {
  const { cores } = useTema();
  if (!variacao) {
    return <Texto numerico style={estilos.numero} cor={cores.textoSuave} accessibilityLabel="Sem registro anterior">—</Texto>;
  }
  const seta = SETA[variacao.seta];
  return (
    <View style={estilos.bloco} accessible accessibilityLabel={textoAcessivel(variacao)}>
      <Texto numerico style={estilos.numero} cor={cores.texto}>{seta ? `${seta} ${variacao.texto}` : variacao.texto}</Texto>
      {variacao.desde ? <Texto numerico variante="pequeno">desde {variacao.desde}</Texto> : null}
    </View>
  );
}

/** A legenda das setas, uma vez por lista. */
export function LegendaDaVariacao() {
  return <Texto variante="pequeno">▲ subiu · ▼ desceu desde o registro anterior</Texto>;
}

const estilos = StyleSheet.create({
  bloco: { gap: 2 },
  numero: { fontFamily: fontes.negrito },
});
