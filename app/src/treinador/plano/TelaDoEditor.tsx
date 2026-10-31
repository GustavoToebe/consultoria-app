import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_EDITOR, LARGURA_MAXIMA } from '../../tema/tokens';
import { RolagemComTopo } from '../../ui/RolagemComTopo';

interface Props {
  /** O `Cabecalho` da tela (trilha, título, subtítulo): rola junto com o conteúdo. */
  cabecalho: ReactNode;
  /** A barra de ações do editor (`BarraDoEditor`): fica fixa no topo e nunca some ao rolar. */
  barra: ReactNode;
  children: ReactNode;
  largura?: number;
  /**
   * Botões que ficam presos embaixo (a importação em tela inteira: Voltar e Validar sempre à vista). Na web gruda na base
   * da rolagem (`sticky`); no celular nativo fica fora da rolagem, abaixo do conteúdo.
   */
  rodape?: ReactNode;
}

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native. */
const GRUDADA = { position: 'sticky', top: 0, zIndex: 10 } as unknown as ViewStyle;
const GRUDADA_EMBAIXO = { position: 'sticky', bottom: 0, zIndex: 10 } as unknown as ViewStyle;

/**
 * Base dos editores (plano do aluno, modelo e questionário; revisão de telas de 19/10): a mesma `Tela`, mas com a barra
 * de ações sempre à vista. Antes Salvar/Validar/Publicar ficavam num cartão no topo e sumiam ao rolar um treino de oito
 * sessões. Na web a barra vem logo depois do cabeçalho e gruda no topo da rolagem (`sticky`); no celular nativo, sem
 * `sticky`, ela fica fora da rolagem, acima do conteúdo.
 */
export function TelaDoEditor({ cabecalho, barra, children, largura = LARGURA_EDITOR, rodape }: Props) {
  const { cores } = useTema();
  const larguraUtil = Math.min(largura, LARGURA_MAXIMA);
  const web = Platform.OS === 'web';
  const fundoDaBarra = { backgroundColor: cores.fundo, borderColor: cores.borda };
  return (
    <SafeAreaView edges={['top']} style={[estilos.raiz, { backgroundColor: cores.fundo }]}>
      <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!web ? <View style={[estilos.barraFora, fundoDaBarra]}><View style={[estilos.largura, { maxWidth: larguraUtil }]}>{barra}</View></View> : null}
        <RolagemComTopo preencher contentContainerStyle={estilos.rolagem}>
          <View style={[estilos.conteudo, { maxWidth: larguraUtil }]}>
            {cabecalho}
            {web ? <View style={[GRUDADA, estilos.barraGrudada, fundoDaBarra]}>{barra}</View> : null}
            {children}
            {web && rodape ? <View style={[GRUDADA_EMBAIXO, estilos.rodapeGrudado, fundoDaBarra]}>{rodape}</View> : null}
          </View>
        </RolagemComTopo>
        {!web && rodape ? <View style={[estilos.rodapeFora, fundoDaBarra]}><View style={[estilos.largura, estilos.linhaDoRodape, { maxWidth: larguraUtil }]}>{rodape}</View></View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  rolagem: { flexGrow: 1, padding: espaco(2) },
  conteudo: { width: '100%', alignSelf: 'center', gap: espaco(3) },
  largura: { width: '100%', alignSelf: 'center' },
  // A barra cobre também o recuo lateral da rolagem: o conteúdo que passa por baixo não aparece nas beiradas.
  barraGrudada: { marginHorizontal: -espaco(2), paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderBottomWidth: 1, marginTop: -espaco(1.5) },
  barraFora: { paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderBottomWidth: 1 },
  rodapeGrudado: {
    marginHorizontal: -espaco(2), paddingHorizontal: espaco(2), paddingVertical: espaco(1.5), borderTopWidth: 1, marginBottom: -espaco(2),
    flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: espaco(1),
  },
  rodapeFora: { paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderTopWidth: 1 },
  linhaDoRodape: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: espaco(1) },
});
