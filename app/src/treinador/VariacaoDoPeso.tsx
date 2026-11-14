import { StyleSheet, View } from 'react-native';

import type { TomDoPeso } from '../dominio/corDaVariacaoDoPeso';
import type { LinhaDoHistorico } from '../dominio/resumoDoPeso';
import type { SetaDoPeso } from '../dominio/variacaoDoPeso';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

export const SETA_DO_PESO: Record<SetaDoPeso, string> = { sobe: '▲', desce: '▼', igual: '' };

/** A cor do tom no tema em uso (a mesma no resumo e no histórico). */
export function useCorDoTom(tom: TomDoPeso): string {
  const { cores } = useTema();
  return tom === 'positivo' ? cores.sucesso : tom === 'problema' ? cores.perigo : cores.texto;
}

/** "Subiu 1,2 kg", "Desceu 0,7 kg", "Sem alteração" (sem o sinal: o verbo diz a direção ao leitor de tela). */
export function direcaoFalada(seta: SetaDoPeso, texto: string): string {
  if (seta === 'igual') return 'Sem alteração';
  return `${seta === 'sobe' ? 'Subiu' : 'Desceu'} ${texto.replace(/^[+−]/, '')}`;
}

/**
 * Variação de um registro de peso no histórico (A11 da reunião de 30/10; peso-visual D6), igual na ficha e no histórico
 * do aluno: seta, número com sinal e, embaixo, "desde 12/10" quando o registro de comparação está na lista. Sem anterior,
 * "Sem registro anterior" em neutro. `direita` alinha as duas linhas pela direita (coluna numérica da tabela larga).
 * A seta diz a direção e o número leva o sinal; a cor vem do `tom` (a meta que o treinador decidiu, `tomDaVariacaoDoPeso`):
 * verde no caminho da meta, vermelho contra, cor do texto sem meta. A cor nunca é a única informação.
 */
export function VariacaoDoPeso({ linha, direita }: { linha: LinhaDoHistorico; direita?: boolean }) {
  const cor = useCorDoTom(linha.tom);
  if (!linha.seta) {
    return <Texto variante="pequeno" style={direita ? estilos.textoDireita : null} accessibilityLabel={linha.texto}>{linha.texto}</Texto>;
  }
  const seta = SETA_DO_PESO[linha.seta];
  return (
    <View style={[estilos.bloco, direita ? estilos.blocoDireita : null]} accessible accessibilityLabel={`${direcaoFalada(linha.seta, linha.texto)} ${linha.desde ?? 'desde o registro anterior'}`}>
      <Texto numerico style={estilos.numero} cor={cor}>{seta ? `${seta} ${linha.texto}` : linha.texto}</Texto>
      {linha.desde ? <Texto numerico variante="pequeno">{linha.desde}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 2 },
  blocoDireita: { alignItems: 'flex-end' },
  textoDireita: { textAlign: 'right' },
  numero: { fontFamily: fontes.negrito },
});
