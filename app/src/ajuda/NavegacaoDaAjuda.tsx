import { Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { sobre } from '../ui/sobre';
import { Texto } from '../ui/Texto';

export interface EntradaDoIndice {
  id: string;
  rotulo: string;
  /** Tópicos do artigo; ausente na página inicial. */
  quantos?: number;
}

/** Web: a coluna fica parada enquanto a página rola e rola por dentro quando passa da altura da janela. */
function useFixo(): ViewStyle {
  const { height } = useWindowDimensions();
  return (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), maxHeight: height - espaco(4), overflowY: 'auto' } : {}) as unknown as ViewStyle;
}

/** Linha de navegação: seleção neutra (`superficie3`), texto principal em negrito e o indicador da marca; a cor nunca é o único sinal. */
function Linha({ ativo, rotulo, detalhe, rotuloAcessivel, papel, aoTocar, compacta }: {
  ativo: boolean; rotulo: string; detalhe?: string; rotuloAcessivel?: string; papel: 'button' | 'link'; aoTocar: () => void; compacta?: boolean;
}) {
  const { cores, marcaPeca } = useTema();
  return (
    <Pressable accessibilityRole={papel} aria-label={rotuloAcessivel} aria-current={ativo ? 'location' : undefined} onPress={aoTocar}
      style={(estado) => [estilos.linha, compacta && estilos.linhaCompacta, ativo ? { backgroundColor: cores.superficie3 } : sobre(estado) && { backgroundColor: cores.superficie2 }]}>
      {ativo ? <View aria-hidden style={[estilos.indicador, { backgroundColor: marcaPeca }]} /> : null}
      <Texto variante={compacta ? 'suave' : 'corpo'} style={[estilos.rotulo, { color: ativo ? cores.texto : cores.textoSuave, fontFamily: ativo ? fontes.semi : fontes.medio }]}>{rotulo}</Texto>
      {detalhe ? <Texto variante="pequeno" numerico aria-hidden>{detalhe}</Texto> : null}
    </Pressable>
  );
}

/**
 * Índice da Ajuda (PC): "Começar a usar", os assuntos com a contagem de tópicos e as perguntas frequentes. O assunto
 * aberto tem `aria-current="location"`.
 */
export function IndiceDaAjuda({ entradas, atual, aoEscolher, largura }: {
  entradas: readonly EntradaDoIndice[]; atual: string; aoEscolher: (id: string) => void; largura: number;
}) {
  const fixo = useFixo();
  return (
    <View role="navigation" aria-label="Tópicos da ajuda" style={[estilos.coluna, { width: largura }, fixo]}>
      <Texto variante="secao" style={estilos.titulo}>Assuntos</Texto>
      {entradas.map((e) => (
        <Linha key={e.id} papel="button" ativo={e.id === atual} rotulo={e.rotulo} aoTocar={() => aoEscolher(e.id)}
          detalhe={e.quantos === undefined ? undefined : String(e.quantos)}
          rotuloAcessivel={e.quantos === undefined ? undefined : `${e.rotulo}, ${e.quantos} ${e.quantos === 1 ? 'tópico' : 'tópicos'}`} />
      ))}
    </View>
  );
}

/** "Nesta página" (PC largo): os tópicos do artigo aberto, com o que está à vista destacado ao rolar. */
export function NestaPagina({ topicos, atual, aoEscolher, largura }: {
  topicos: readonly { id: string; titulo: string }[]; atual: number; aoEscolher: (indice: number) => void; largura: number;
}) {
  const fixo = useFixo();
  return (
    <View role="navigation" aria-label="Nesta página" style={[estilos.coluna, { width: largura }, fixo]}>
      <Texto variante="secao" style={estilos.titulo}>Nesta página</Texto>
      {topicos.map((t, i) => (
        <Linha key={t.id} papel="link" compacta ativo={i === atual} rotulo={t.titulo} aoTocar={() => aoEscolher(i)} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  // A folga de 4 px deixa o anel de foco (2 px + 2 px) inteiro: a coluna rola por dentro e cortaria a borda.
  coluna: { alignSelf: 'flex-start', gap: 2, padding: 4 },
  titulo: { paddingHorizontal: espaco(1.5), paddingBottom: espaco(1) },
  linha: { minHeight: ALVO_TOQUE, flexDirection: 'row', alignItems: 'center', gap: espaco(1), paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderRadius: RAIO },
  // Texto menor, alvo de 44 px igual.
  linhaCompacta: { paddingVertical: espaco(0.5) },
  rotulo: { flex: 1, minWidth: 0 },
  indicador: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
