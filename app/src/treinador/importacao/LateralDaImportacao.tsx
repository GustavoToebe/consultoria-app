import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Cartao } from '../../ui/Cartao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

/** ~360 px ao lado do conteúdo, com o vão de 32 (o mesmo da lateral da Equipe e do Mural). */
const LARGURA_DA_LATERAL = 360;
export const VAO_DA_LATERAL = 32;

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo da `LateralDosMembros`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), overflowY: 'auto' } : {}) as unknown as ViewStyle;

/**
 * Coluna da importação na faixa larga em diante (25/11): o resumo da sessão e, embaixo, a próxima etapa (o botão, o
 * erro e o resultado dela vêm de quem chama, e só aparecem aqui nessa faixa). Grudada ao rolar na web.
 */
export function LateralDaImportacao({ resumo, children }: {
  /** Sem sessão aberta, nulo: a coluna já fica no lugar e diz o que vai aparecer nela (a página não pula ao enviar). */
  resumo: { linhas: readonly { rotulo: string; valor: string }[]; termosPendentes: number | null } | null;
  children?: ReactNode;
}) {
  const janela = useWindowDimensions();
  const { cores } = useTema();
  return (
    <View role="complementary" aria-label="Resumo da importação"
      style={[estilos.lateral, GRUDADA, Platform.OS === 'web' && { maxHeight: janela.height - espaco(4) }]}>
      <Cartao titulo="Resumo da importação">
        {resumo ? <View style={estilos.linhas}>
          {resumo.linhas.map((l) => (
            <View key={l.rotulo} style={[estilos.linha, estilos.fio, { borderBottomColor: cores.divisor }]}>
              <Texto variante="suave" style={estilos.rotulo}>{l.rotulo}</Texto>
              <Texto numerico style={estilos.valor}>{l.valor}</Texto>
            </View>
          ))}
          <View style={estilos.linha}>
            <Texto variante="suave" style={estilos.rotulo}>Termos pendentes</Texto>
            {/* Âmbar só quando há o que conferir; o número vai junto (o sinal nunca é só a cor). */}
            {/* O `Selo` se alinha ao topo (`alignSelf`); a caixa o centra na linha, como os números. */}
            {resumo.termosPendentes ? <View style={estilos.centro}><Selo texto={String(resumo.termosPendentes)} tipo="atencao" /></View>
              : <Texto numerico style={estilos.valor}>{resumo.termosPendentes === null ? '—' : 'Nenhum'}</Texto>}
          </View>
        </View> : <Texto variante="suave">Envie os arquivos ou cole um texto. O que for lido aparece aqui, com a próxima etapa.</Texto>}
        {children ? <View style={estilos.proxima}>{children}</View> : null}
      </Cartao>
    </View>
  );
}

const estilos = StyleSheet.create({
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
  linhas: { gap: 0 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: 40 },
  fio: { borderBottomWidth: 1 },
  rotulo: { flex: 1, minWidth: 0 },
  valor: { fontFamily: fontes.semi },
  proxima: { gap: espaco(2) },
  centro: { justifyContent: 'center' },
});
