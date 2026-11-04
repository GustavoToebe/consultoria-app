import { StyleSheet, View } from 'react-native';

import type { MetaDoPeso } from '../api/tipos';
import type { TomDoPeso } from '../dominio/corDaVariacaoDoPeso';
import { linhaDaMeta } from '../dominio/metaDoPesoNaFicha';
import type { VariacaoDoPeso as Variacao } from '../dominio/variacaoDoPeso';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * A seta diz a direção e o número leva o sinal; a cor vem do `tom` (a meta que o treinador decidiu, `tomDaVariacaoDoPeso`):
 * verde no caminho da meta, vermelho contra, cor do texto sem meta. A cor nunca é a única informação.
 */
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
export function VariacaoDoPeso({ variacao, tom = 'neutro' }: { variacao: Variacao | null; tom?: TomDoPeso }) {
  const { cores } = useTema();
  const cor = tom === 'positivo' ? cores.sucesso : tom === 'problema' ? cores.perigo : cores.texto;
  if (!variacao) {
    return <Texto numerico style={estilos.numero} cor={cores.textoSuave} accessibilityLabel="Sem registro anterior">—</Texto>;
  }
  const seta = SETA[variacao.seta];
  return (
    <View style={estilos.bloco} accessible accessibilityLabel={textoAcessivel(variacao)}>
      <Texto numerico style={estilos.numero} cor={cor}>{seta ? `${seta} ${variacao.texto}` : variacao.texto}</Texto>
      {variacao.desde ? <Texto numerico variante="pequeno">desde {variacao.desde}</Texto> : null}
    </View>
  );
}

/** A legenda das setas, uma vez por lista, e, com meta, a linha que explica as cores (D4). */
export function LegendaDaVariacao({ meta, quem = 'equipe' }: { meta?: MetaDoPeso | null; quem?: 'equipe' | 'aluno' }) {
  const linha = linhaDaMeta(meta, quem);
  return (
    <View style={estilos.bloco}>
      <Texto variante="pequeno">▲ subiu · ▼ desceu desde o registro anterior</Texto>
      {linha ? <Texto variante="pequeno">{linha}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: 2 },
  numero: { fontFamily: fontes.negrito },
});
