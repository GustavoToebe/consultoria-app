import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Marca } from '../api/tipos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, textoSobre } from '../tema/tokens';
import { MarcaTitulo } from './MarcaTitulo';
import { Tela } from './Tela';
import { Texto } from './Texto';

/** Símbolo do app (o mesmo ícone da loja, 4,5 KB), no topo das telas públicas sem consultoria conhecida. */
const SIMBOLO: number = require('../../assets/images/icon.png');

/** Largura única das telas públicas (antes 440, 480 ou 560 conforme a tela). */
export const LARGURA_PUBLICA = 440;


/**
 * Casca única das telas públicas (Entrar, cadastro, convites, senha, inscrição): coluna de 440 px no meio da tela em
 * janela alta, o topo com o símbolo e o nome do produto (ou a marca da consultoria, quando a tela já a conhece) e o
 * título da tela, que é o h1. Antes cada tela tinha largura e margens próprias e o Entrar não dizia que app era.
 */
export function TelaPublica({ titulo, subtitulo, marca, children }: {
  titulo: string;
  subtitulo?: string;
  /** Marca da consultoria (convite, inscrição); sem ela, o símbolo e o nome do produto. */
  marca?: Marca | null;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const centrado = height >= 700;
  return (
    <Tela largura={LARGURA_PUBLICA} centrado={centrado}>
      <View style={[estilos.topo, !centrado && estilos.topoAlto]}>
        {marca ? <MarcaTitulo marca={marca} tamanho="grande" /> : <TopoDoProduto />}
        <View style={estilos.titulos}>
          <Texto variante="titulo" nivel={1}>{titulo}</Texto>
          {subtitulo ? <Texto variante="suave">{subtitulo}</Texto> : null}
        </View>
      </View>
      {children}
    </Tela>
  );
}

/** Símbolo e nome do produto. A marca de cada consultoria só aparece depois do login. */
function TopoDoProduto() {
  return (
    <View style={estilos.produto} accessibilityRole="image" accessibilityLabel="Treinos">
      <Image source={SIMBOLO} style={estilos.simbolo} contentFit="contain" accessible={false} />
      <Texto style={estilos.nomeDoProduto} accessible={false}>Treinos</Texto>
    </View>
  );
}

/**
 * Ação principal das telas públicas. Sem consultoria conhecida não há cor de marca (o tema usa um cinza neutro, que no
 * escuro parecia botão desabilitado): o botão usa a seleção invertida (fundo na cor do texto, letra na do fundo). Na
 * inscrição, `cor` é a cor da consultoria. O `Botao` comum não recebe cor; quando o tema tiver uma marca neutra de alto
 * contraste, este volta a ser o `Botao` primário.
 */
export function BotaoPublico({ rotulo, aoTocar, carregando, desabilitado, motivo, cor }: {
  rotulo: string;
  aoTocar: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  /** Por que está desabilitado; aparece abaixo do botão e vai para o leitor de tela. */
  motivo?: string;
  cor?: string | null;
}) {
  const { cores } = useTema();
  const fundo = cor ?? cores.texto;
  const letra = cor ? textoSobre(cor) : cores.fundo;
  const inativo = !!desabilitado || !!carregando;
  const explicacao = desabilitado && !carregando && motivo ? motivo : undefined;
  return (
    <View style={estilos.comMotivo}>
      <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityHint={explicacao}
        accessibilityState={{ disabled: inativo, busy: !!carregando }} disabled={inativo} onPress={aoTocar}
        style={({ pressed }) => [estilos.botao, { backgroundColor: fundo, opacity: inativo ? 0.5 : pressed ? 0.85 : 1 }]}>
        {carregando ? <ActivityIndicator size="small" color={letra} /> : null}
        <Texto numberOfLines={2} style={[estilos.rotulo, { color: letra }]}>{rotulo}</Texto>
      </Pressable>
      {explicacao ? <Texto variante="pequeno" style={estilos.motivo}>{explicacao}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { gap: espaco(2) },
  topoAlto: { marginTop: espaco(4) },
  titulos: { gap: espaco(0.5) },
  produto: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  simbolo: { width: 36, height: 36, borderRadius: 8 },
  nomeDoProduto: { fontFamily: fontes.negrito, fontSize: 18 },
  comMotivo: { alignSelf: 'stretch', gap: espaco(0.5) },
  botao: { minHeight: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(2), paddingVertical: espaco(0.75), flexDirection: 'row', gap: espaco(1), alignItems: 'center', justifyContent: 'center' },
  rotulo: { fontFamily: fontes.semi, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  motivo: { textAlign: 'center' },
});
