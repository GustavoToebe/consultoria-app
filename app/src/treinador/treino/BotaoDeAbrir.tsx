import { ChevronDown, ChevronUp, Info, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Botão de texto que abre e fecha um trecho logo abaixo dele ("O que é?", "Digitar como 4+2"): seta que acompanha o
 * estado, `aria-expanded` (na web só ele chega ao HTML; o `accessibilityState` fica para o nativo) e alvo de 44 px. O
 * rótulo acessível diz do quê, para não repetir entre trechos.
 */
export function BotaoDeAbrir({ texto, rotuloAcessivel, aberto, aoAlternar, pequeno = false }: {
  texto: string; rotuloAcessivel?: string; aberto: boolean; aoAlternar: () => void;
  /** Link pequeno de opção avançada ("Digitar como texto"): 13 px, em texto secundário. */
  pequeno?: boolean;
}) {
  const { cores } = useTema();
  const Seta = aberto ? ChevronUp : ChevronDown;
  return <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel ?? texto} accessibilityState={{ expanded: aberto }} aria-expanded={aberto} onPress={aoAlternar}
    style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
    <Texto style={[estilos.texto, pequeno ? estilos.textoPequeno : null, { color: pequeno ? cores.textoSuave : cores.texto }]}>{texto}</Texto>
    <Seta size={pequeno ? 14 : 16} color={cores.texto} strokeWidth={2} />
  </Pressable>;
}

/**
 * A mesma forma, para uma ação de texto que acrescenta algo ao trecho ("Informar também em respirações"): o ícone vem
 * antes do texto e não há estado de aberto. Mais estreito que o `Botao` fantasma, cabe numa linha em 390 px.
 */
export function BotaoDeTexto({ texto, rotuloAcessivel, Icone, aoTocar }: { texto: string; rotuloAcessivel?: string; Icone: LucideIcon; aoTocar: () => void }) {
  const { cores } = useTema();
  return <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel ?? texto} onPress={aoTocar}
    style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
    <Icone size={16} color={cores.texto} strokeWidth={2} />
    <Texto style={[estilos.texto, { color: cores.texto }]}>{texto}</Texto>
  </Pressable>;
}

/**
 * O ⓘ de um campo ou de um título (27/11): só o ícone, alvo de 44 px, abre e fecha a explicação logo abaixo (a
 * `Explicacao` de quem usa). É um disclosure (APG), não um balão: o texto fica na página, lido na ordem, e o nome
 * acessível diz do quê ("O que é o tipo FS?").
 */
export function BotaoDeInfo({ rotulo, aberto, aoAlternar }: { rotulo: string; aberto: boolean; aoAlternar: () => void }) {
  const { cores } = useTema();
  return <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ expanded: aberto }} aria-expanded={aberto} onPress={aoAlternar}
    style={(estado) => [estilos.info, { backgroundColor: aberto || sobre(estado) ? cores.sobre : 'transparent' }]}>
    <Info size={18} color={aberto ? cores.texto : cores.textoSuave} strokeWidth={2} />
  </Pressable>;
}

/** A explicação que o ⓘ abre: texto secundário com a régua à esquerda. */
export function Explicacao({ texto }: { texto: string }) {
  const { cores } = useTema();
  return <View style={[estilos.explicacao, { borderLeftColor: cores.borda }]}>
    <Texto variante="suave">{texto}</Texto>
  </View>;
}

const estilos = StyleSheet.create({
  info: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  // O recuo à esquerda é negativo para o texto alinhar com os rótulos dos campos; o fundo do hover ainda tem folga.
  botao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: espaco(1), marginLeft: -espaco(1), borderRadius: RAIO },
  textoPequeno: { fontFamily: fontes.normal, fontSize: 13 },
  texto: { fontFamily: fontes.semi, fontSize: 14, textDecorationLine: 'underline', flexShrink: 1 },
});
