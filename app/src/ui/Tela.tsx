import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MAXIMA } from '../tema/tokens';
import { RolagemComTopo } from './RolagemComTopo';

interface Props {
  children: ReactNode;
  /** Rolagem própria (padrão). Telas com lista virtualizada passam `false`. */
  rolar?: boolean;
  /** Largura máxima do conteúdo (`LARGURA_EDITOR`, `LARGURA_LISTA`, 720 no aluno); nunca passa de `LARGURA_MAXIMA`. */
  largura?: number;
  bordas?: Edge[];
  /** Conteúdo curto no meio da tela (Entrar em janela alta). */
  centrado?: boolean;
}

/**
 * Base de toda tela: SafeAreaView do react-native-safe-area-context (o do react-native está obsoleto e quebrou o
 * topo no protótipo), fundo do tema e conteúdo centralizado até LARGURA_MAXIMA. Com rolagem própria, mostra o botão
 * "voltar ao início da página" (`RolagemComTopo`).
 */
export function Tela({ children, rolar = true, largura = LARGURA_MAXIMA, bordas = ['top', 'bottom'], centrado }: Props) {
  const { cores } = useTema();
  const larguraUtil = Math.min(largura, LARGURA_MAXIMA);
  const conteudo = <View style={[estilos.conteudo, { maxWidth: larguraUtil }, !rolar && { flex: 1, minHeight: 0 }]}>{children}</View>;
  return (
    <SafeAreaView edges={bordas} style={[estilos.raiz, { backgroundColor: cores.fundo }]}>
      <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {rolar ? (
          <RolagemComTopo preencher contentContainerStyle={[estilos.rolagem, centrado && estilos.centrado]}>{conteudo}</RolagemComTopo>
        ) : (
          <View style={[estilos.raiz, estilos.rolagem]}>{conteudo}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  rolagem: { flexGrow: 1, padding: espaco(2) },
  centrado: { justifyContent: 'center' },
  conteudo: { width: '100%', alignSelf: 'center', gap: espaco(3) },
});
