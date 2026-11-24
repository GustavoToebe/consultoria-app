import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { fundoPintado, superficiePintada } from '../../ui/superficiePintada';
import { Texto } from '../../ui/Texto';

export interface ProximoPassoDaTela {
  texto: string;
  /** Botão (o único primário do Início); `null` quando está tudo em dia. */
  acao: { rotulo: string; aoTocar: () => void } | null;
  /** A pendência é um atraso: a pintura acende em `perigo`, o mesmo do indicador "Atrasadas" (guia de 11/11, pág. 16). */
  atraso?: boolean;
  /** Linha pequena sob o texto ("Não foi possível conferir tudo."): a verificação foi parcial (D9). */
  aviso?: string | null;
}

/**
 * A primeira coisa do painel, quando os Primeiros passos não ocupam o lugar: a pendência mais importante e um botão.
 * Pintado como os cartões do Início (24/11, `ui/superficiePintada`): com pendência, degradê e borda inteira em âmbar
 * (`perigo` se for atraso) e a bolinha antes do rótulo; sem nada, neutro e sem botão. Raio e recuo dos blocos de baixo
 * (`BlocoDoPainel`, 16 e o recuo do `Cartao`), para o texto alinhar com o conteúdo deles.
 */
export function ProximoPasso({ passo }: { passo: ProximoPassoDaTela }) {
  const { cores, bordas, variante } = useTema();
  const { width } = useWindowDimensions();
  // Situação (D9, 17/11): a cor fica na pintura, na bolinha e no rótulo "Próximo passo"; o texto da pendência segue em `texto`.
  const cor = !passo.acao ? null : passo.atraso ? cores.perigo : cores.atencao;
  const p = cor ? superficiePintada(cor, cores.superficie, variante, cores) : null;
  return (
    <View accessibilityRole="summary" testID="proximo-passo"
      style={[estilos.passo, {
        borderWidth: bordas.bloco,
        borderColor: p?.borda ?? cores.divisor,
        paddingHorizontal: espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2),
      }, p ? fundoPintado(p) : { backgroundColor: cores.superficie }]}>
      <View style={estilos.texto}>
        <View style={estilos.rotulo}>
          {cor ? <View aria-hidden testID="proximo-passo-ponto" style={[estilos.ponto, { backgroundColor: cor, boxShadow: `0px 0px 10px ${cor}` }]} /> : null}
          <Texto variante="secao" cor={p?.texto ?? cores.textoSuave}>Próximo passo</Texto>
        </View>
        <Texto variante="bloco">{passo.texto}</Texto>
        {passo.aviso ? <Texto variante="pequeno">{passo.aviso}</Texto> : null}
      </View>
      {passo.acao ? <Botao tipo="primario" rotulo={passo.acao.rotulo} aoTocar={passo.acao.aoTocar} style={estilos.botao} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Com texto ampliado ou largura curta o botão desce para a linha de baixo, sempre à direita (`marginLeft: 'auto'`);
  // `alignSelf: 'center'` desfaz o `flex-start` do `Botao` para ele ficar no meio da altura do texto.
  passo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5), borderRadius: 16, paddingVertical: espaco(1.5) },
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 140, gap: 2 },
  rotulo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 7, height: 7, borderRadius: 4 },
  botao: { marginLeft: 'auto', alignSelf: 'center' },
});
