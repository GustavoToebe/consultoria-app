import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../../tema/tokens';
import { IconeBotao } from '../../ui/IconeBotao';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';

interface Props {
  titulo: string;
  /** Linha de resumo do item fechado ("2×10 · com vídeo"). */
  resumo?: string;
  selo?: { texto: string; tipo: TipoSelo };
  aberto: boolean;
  aoAlternar: () => void;
  /** Com `aoMover`, as setas ↑↓ (desabilitadas na ponta da lista). */
  posicao?: number;
  total?: number;
  aoMover?: (delta: -1 | 1) => void;
  /** Nome do item no leitor de tela das setas ("pergunta", "refeição"). */
  nomeDoItem: string;
  /** Depois do chevron: ⋯ ou lixeira. */
  remover?: ReactNode;
  /** Faixa de grupo (`superficie3`, rente às bordas do cartão) em vez de linha simples. */
  faixa?: boolean;
}

/**
 * Cabeçalho de item editável em lista (refeição, item de mobilidade, pergunta, seção, plano do pacote), com a mesma
 * gramática em todos os editores (padrão das telas de 19/10): título e resumo (tocar abre/fecha) · setas ↑↓ = mover ·
 * chevron = abrir/fechar · remover. O chevron nunca move e a seta nunca abre.
 */
export function CabecalhoDoItem({ titulo, resumo, selo, aberto, aoAlternar, posicao = 0, total = 1, aoMover, nomeDoItem, remover, faixa }: Props) {
  const { cores } = useTema();
  const Seta = aberto ? ChevronUp : ChevronDown;
  return (
    <View style={[estilos.linha, faixa && [estilos.faixa, { backgroundColor: cores.superficie3, borderColor: cores.borda }]]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo}, ${aberto ? 'aberto' : 'fechado'}`}
        accessibilityState={{ expanded: aberto }}
        onPress={aoAlternar}
        style={({ pressed }) => [estilos.textos, { opacity: pressed ? 0.7 : 1 }]}>
        <Texto variante="bloco" style={estilos.titulo}>{titulo}</Texto>
        {resumo ? <Texto variante="suave" numerico>{resumo}</Texto> : null}
        {selo ? <View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} /></View> : null}
      </Pressable>
      <View style={estilos.acoes}>
        {aoMover && total > 1 ? (
          <>
            <IconeBotao Icone={ArrowUp} rotulo={`Subir ${nomeDoItem}`} desabilitado={posicao === 0} aoTocar={() => aoMover(-1)} />
            <IconeBotao Icone={ArrowDown} rotulo={`Descer ${nomeDoItem}`} desabilitado={posicao === total - 1} aoTocar={() => aoMover(1)} />
          </>
        ) : null}
        <IconeBotao Icone={Seta} rotulo={`${aberto ? 'Fechar' : 'Abrir'} ${nomeDoItem}`} aoTocar={aoAlternar} />
        {remover}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  faixa: { borderBottomWidth: 1, borderTopLeftRadius: RAIO, borderTopRightRadius: RAIO, paddingLeft: espaco(2), paddingRight: espaco(1), paddingVertical: espaco(0.5) },
  textos: { flex: 1, minHeight: ALVO_TOQUE, justifyContent: 'center', gap: 1 },
  titulo: { fontSize: 16, lineHeight: 22 },
  selo: { flexDirection: 'row', marginTop: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center' },
});
