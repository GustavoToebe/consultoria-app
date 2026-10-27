import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Botão de texto que abre e fecha um trecho logo abaixo dele ("O que é?", "Digitar como 4+2"): seta que acompanha o
 * estado, `aria-expanded` (na web só ele chega ao HTML; o `accessibilityState` fica para o nativo) e alvo de 44 px. O
 * rótulo acessível diz do quê, para não repetir entre trechos.
 */
export function BotaoDeAbrir({ texto, rotuloAcessivel, aberto, aoAlternar }: {
  texto: string; rotuloAcessivel?: string; aberto: boolean; aoAlternar: () => void;
}) {
  const { cores } = useTema();
  const Seta = aberto ? ChevronUp : ChevronDown;
  return <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel ?? texto} accessibilityState={{ expanded: aberto }} aria-expanded={aberto} onPress={aoAlternar}
    style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
    <Texto style={[estilos.texto, { color: cores.texto }]}>{texto}</Texto>
    <Seta size={16} color={cores.texto} strokeWidth={2} />
  </Pressable>;
}

/**
 * A mesma forma, para uma ação de texto que acrescenta algo ao trecho ("Informar também em respirações"): o ícone vem
 * antes do texto e não há estado de aberto. Mais estreito que o `Botao` fantasma, cabe numa linha em 390 px.
 */
export function BotaoDeTexto({ texto, rotuloAcessivel, Icone, aoTocar }: { texto: string; rotuloAcessivel?: string; Icone: LucideIcon; aoTocar: () => void }) {
  const { cores } = useTema();
  return <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel ?? texto} onPress={aoTocar}
    style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }]}>
    <Icone size={16} color={cores.texto} strokeWidth={2} />
    <Texto style={[estilos.texto, { color: cores.texto }]}>{texto}</Texto>
  </Pressable>;
}

const estilos = StyleSheet.create({
  // O recuo à esquerda é negativo para o texto alinhar com os rótulos dos campos; o fundo do hover ainda tem folga.
  botao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: espaco(1), marginLeft: -espaco(1), borderRadius: RAIO },
  texto: { fontFamily: fontes.semi, fontSize: 14, textDecorationLine: 'underline', flexShrink: 1 },
});
