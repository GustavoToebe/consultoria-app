import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

export interface ProximoPassoDaTela {
  texto: string;
  /** Botão (o único primário do Início); `null` quando está tudo em dia. */
  acao: { rotulo: string; aoTocar: () => void } | null;
  /** A pendência é um atraso: a borda acende em `perigo`, o mesmo do indicador "Atrasadas" (guia de 11/11, pág. 16). */
  atraso?: boolean;
  /** Linha pequena sob o texto ("Não foi possível conferir tudo."): a verificação foi parcial (D9). */
  aviso?: string | null;
}

/**
 * A primeira coisa do painel, quando os Primeiros passos não ocupam o lugar: a pendência mais importante e um botão.
 * A borda à esquerda acende em âmbar com pendência (em `perigo` se for atraso); sem nada, fica neutra e sem botão.
 */
export function ProximoPasso({ passo }: { passo: ProximoPassoDaTela }) {
  const { cores, bordas } = useTema();
  // Situação (D9, 17/11): a cor fica na barra, no tingido e no rótulo "Próximo passo"; o texto da pendência segue em `texto`.
  const tom = !passo.acao ? null : passo.atraso ? { cor: cores.perigo, fundo: cores.perigoSuave } : { cor: cores.atencao, fundo: cores.atencaoSuave };
  return (
    <View accessibilityRole="summary"
      style={[estilos.passo, {
        borderWidth: bordas.bloco,
        borderColor: cores.divisor,
        borderLeftColor: tom ? tom.cor : cores.divisor,
        backgroundColor: tom ? tom.fundo : cores.superficie,
      }]}>
      <View style={estilos.texto}>
        <Texto variante="secao" cor={tom ? tom.cor : cores.textoSuave}>Próximo passo</Texto>
        <Texto variante="bloco">{passo.texto}</Texto>
        {passo.aviso ? <Texto variante="pequeno">{passo.aviso}</Texto> : null}
      </View>
      {passo.acao ? <Botao tipo="primario" rotulo={passo.acao.rotulo} aoTocar={passo.acao.aoTocar} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  passo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), borderLeftWidth: 5, borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2) },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 2 },
});
