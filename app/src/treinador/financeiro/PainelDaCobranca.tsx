import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { IconeBotao } from '../../ui/IconeBotao';
import { RodapeDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { DetalheDaCobranca, type CascaDoDetalhe, type PropsDaCasca, type PropsDoDetalhe } from './DetalheDaCobranca';

/** Largura do detalhe fixo ao lado da tabela (financeiro em tela larga, 23/11): a do pedido, ~480 px, a da confirmação (P1). */
export const LARGURA_DO_PAINEL_DA_COBRANCA = 480;

/**
 * `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `comunidade.tsx`). O
 * painel acompanha a rolagem da página: a linha 50 da tabela abre o detalhe à vista.
 */
const grudado = (alturaDaJanela: number) =>
  (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), maxHeight: alturaDaJanela - espaco(4) } : {}) as unknown as ViewStyle;

/**
 * Casca do painel fixo: região com o título como nome (não é diálogo: a tabela continua usável ao lado), faixa do título
 * com o X, corpo que rola sozinho e rodapé de ações sempre à vista. Ao abrir (ou trocar de cobrança, que remonta a casca)
 * o foco vai ao título; "Fechar" e o Esc devolvem o foco à linha que abriu.
 */
function CascaDePainel({ titulo, aoFechar, rodape, children }: PropsDaCasca) {
  const { cores, bordas } = useTema();
  const { height } = useWindowDimensions();
  const tituloRef = useRef<View>(null);
  // Quem tinha o foco ao abrir (a linha da tabela), lido no primeiro render, antes de o foco vir para cá.
  const [quemAbriu] = useState(() => (Platform.OS === 'web' ? (document.activeElement as HTMLElement | null) : null));
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (tituloRef.current as unknown as HTMLElement | null)?.focus?.();
  }, []);
  const fechar = () => {
    aoFechar();
    if (quemAbriu?.isConnected) requestAnimationFrame(() => quemAbriu.focus());
  };
  // Esc dentro do painel fecha. O evento do React sobe pela árvore de componentes: o Esc da confirmação, do calendário ou da
  // folha de renegociar (abertas por portal a partir daqui) também chegaria; só fecha o que nasceu dentro do painel no DOM.
  const teclado = Platform.OS === 'web' ? {
    onKeyDown: (e: { key: string; target: unknown; currentTarget: unknown }) => {
      if (e.key === 'Escape' && (e.currentTarget as HTMLElement).contains(e.target as Node)) fechar();
    },
  } : {};
  return (
    <View role="region" aria-label={titulo} {...teclado}
      style={[estilos.painel, grudado(height), { backgroundColor: cores.superficie, borderColor: cores.divisor, borderWidth: bordas.bloco }]}>
      <View style={[estilos.topo, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo }]}>
        <View ref={tituloRef} style={estilos.titulo} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}>
          <Texto variante="bloco" nivel={2}>{titulo}</Texto>
        </View>
        <IconeBotao Icone={X} rotulo="Fechar" aoTocar={fechar} moldura />
      </View>
      <ScrollView style={estilos.corpo} contentContainerStyle={estilos.conteudo}>{children}</ScrollView>
      {rodape ? (
        <View style={[estilos.rodape, { borderColor: cores.divisor }]}>
          <RodapeDeAcoes empilhar={false}>{rodape}</RodapeDeAcoes>
        </View>
      ) : null}
    </View>
  );
}

/**
 * No painel, "Renegociar" abre o passo a passo por cima e o painel fica ao lado da tabela; em 480 px o rodapé vai em duas
 * linhas (a principal em cima, cheia; as outras embaixo, lado a lado) para nenhuma ação quebrar sozinha numa linha.
 */
const CASCA_DE_PAINEL: CascaDoDetalhe = { Componente: CascaDePainel, renegociarPorCima: true, rodapeEmDuasLinhas: true };

/**
 * A cobrança aberta num painel fixo à direita da tabela, só na faixa `ultralarga` (Cobranças, financeiro em tela larga,
 * 23/11): o mesmo `DetalheDaCobranca` da `FolhaDaCobranca`, sem modal. Abrir outra cobrança troca o conteúdo.
 */
export function PainelDaCobranca(props: PropsDoDetalhe) {
  return <DetalheDaCobranca {...props} casca={CASCA_DE_PAINEL} />;
}

const estilos = StyleSheet.create({
  painel: { width: LARGURA_DO_PAINEL_DA_COBRANCA, flexShrink: 0, alignSelf: 'flex-start', borderRadius: RAIO, overflow: 'hidden' },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1),
    paddingLeft: espaco(2), paddingRight: espaco(1.5), paddingVertical: espaco(1), borderBottomWidth: LINHA_DA_FAIXA,
  },
  titulo: { flex: 1 },
  corpo: { flexShrink: 1 },
  conteudo: { padding: espaco(2), gap: espaco(1.5) },
  rodape: { padding: espaco(2), borderTopWidth: 1 },
});
