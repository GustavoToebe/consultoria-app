import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { larguraMaximaDoConteudo, respiroLateralDaTela } from '../dominio/larguraDoConteudo';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MAXIMA } from '../tema/tokens';
import { useFundoDaArea } from './fundoDaArea';
import { RolagemComTopo } from './RolagemComTopo';
import { useFaixaDeLargura } from './useFaixaDeLargura';

interface Props {
  children: ReactNode;
  /** Rolagem própria (padrão). Telas com lista virtualizada passam `false`. */
  rolar?: boolean;
  /** Largura máxima do conteúdo (`LARGURA_EDITOR`, `LARGURA_LISTA`, 720 no aluno); sem teto de 1800 px quando `larguraConteudo` for Automática. */
  largura?: number;
  bordas?: Edge[];
  /** Conteúdo curto no meio da tela (Entrar em janela alta). */
  centrado?: boolean;
  /** Folga das laterais e do topo; padrão `espaco(2)` (16). Só as telas que pedem respiro maior no PC passam outro valor. */
  folga?: number;
}

/**
 * Base de toda tela: SafeAreaView do react-native-safe-area-context (o do react-native está obsoleto e quebrou o
 * topo no protótipo), fundo da área (`painel` ao lado do menu no PC, `fundo` no resto) e conteúdo centralizado até a
 * largura configurada (sem teto em Automática, 1800 px em Limitada). Com rolagem própria, mostra o botão
 * "voltar ao início da página" (`RolagemComTopo`).
 */
export function Tela({ children, rolar = true, largura = LARGURA_MAXIMA, bordas = ['top', 'bottom'], centrado, folga }: Props) {
  const fundo = useFundoDaArea();
  const { preferencias } = useTema();
  const { faixa, aoMedir } = useFaixaDeLargura();
  const larguraUtil = larguraMaximaDoConteudo(largura, preferencias.larguraConteudo);
  const lateral = respiroLateralDaTela(faixa, folga);
  const preenchimento =
    folga === undefined && lateral === undefined
      ? undefined
      : { ...(folga !== undefined ? { padding: folga } : null), ...(lateral !== undefined ? { paddingHorizontal: lateral } : null) };
  const conteudo = (
    <View style={[estilos.conteudo, larguraUtil === undefined ? null : { maxWidth: larguraUtil }, !rolar && { flex: 1, minHeight: 0 }]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={bordas} onLayout={aoMedir} style={[estilos.raiz, { backgroundColor: fundo }]}>
      <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {rolar ? (
          <RolagemComTopo preencher contentContainerStyle={[estilos.rolagem, preenchimento, centrado && estilos.centrado]}>{conteudo}</RolagemComTopo>
        ) : (
          <View style={[estilos.raiz, estilos.rolagem, preenchimento]}>{conteudo}</View>
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
