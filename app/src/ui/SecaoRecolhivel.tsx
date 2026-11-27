import { ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { type ReactNode, useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  titulo: string;
  /** Fechada, ao lado do título em texto secundário (desce para baixo dele sem espaço). Texto = uma linha com reticências. */
  resumo?: ReactNode;
  /** Sem `aberta`, a seção guarda o próprio estado e começa assim (padrão: fechada). */
  abertaInicial?: boolean;
  /** Controlada: quem usa guarda o estado (para abrir sozinha num erro, por exemplo) e recebe o pedido em `aoMudar`. */
  aberta?: boolean;
  aoMudar?: (aberta: boolean) => void;
  /** Explicação da seção: vira o ⓘ ao lado do título, que abre e fecha o texto logo abaixo dele. */
  ajuda?: string;
  /** Nível do título (h3 por padrão; dentro de um item que já é h3, 4). */
  nivel?: number;
  children: ReactNode;
}

/**
 * Seção que abre e fecha pelo título (27/11; "Observação e modo de preparo" da refeição, e o mesmo desenho das seções do
 * exercício no treino): título em semi-negrito com a seta, botão dentro do título (acordeão da WAI-ARIA APG, com
 * `aria-expanded` e `aria-controls`; Enter e Espaço pelo `Pressable`), alvo de 44 px e o foco visível do app. Fechada, o
 * `resumo` fica ao lado; aberta, o conteúdo é uma região nomeada pelo título. O ⓘ (`ajuda`) é um disclosure, não um balão:
 * o texto fica na página, lido na ordem. Sem animação (abre e fecha no lugar), então o "Reduzir movimento" já vale.
 */
export function SecaoRecolhivel({ titulo, resumo, abertaInicial = false, aberta: controlada, aoMudar, ajuda, nivel = 3, children }: Props) {
  const { cores } = useTema();
  const [propria, setPropria] = useState(abertaInicial);
  const [explicando, setExplicando] = useState(false);
  const aberta = controlada ?? propria;
  const id = useId();
  const idDoTitulo = `${id}-titulo`;
  const idDoConteudo = `${id}-conteudo`;
  const web = Platform.OS === 'web';
  const alternar = () => {
    if (controlada === undefined) setPropria(!aberta);
    aoMudar?.(!aberta);
  };
  const Seta = aberta ? ChevronUp : ChevronDown;
  return (
    <View style={estilos.secao}>
      <View style={estilos.linha}>
        <View role="heading" aria-level={nivel} style={estilos.encolhe}>
          <Pressable nativeID={idDoTitulo} accessibilityRole="button" accessibilityLabel={titulo} accessibilityState={{ expanded: aberta }} aria-expanded={aberta}
            // O RN não tipa `aria-controls`; o react-native-web o leva ao HTML. Só aberta: fechada, o conteúdo não existe.
            {...(web && aberta ? ({ 'aria-controls': idDoConteudo } as object) : null)}
            onPress={alternar} style={(estado) => [estilos.botao, { backgroundColor: sobre(estado) ? cores.sobre : 'transparent' }]}>
            <Texto style={[estilos.titulo, { color: cores.texto }]}>{titulo}</Texto>
            <Seta size={18} color={cores.texto} strokeWidth={2} />
          </Pressable>
        </View>
        {ajuda ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Sobre: ${titulo}`} accessibilityState={{ expanded: explicando }} aria-expanded={explicando}
            onPress={() => setExplicando(!explicando)}
            style={(estado) => [estilos.info, { backgroundColor: explicando || sobre(estado) ? cores.sobre : 'transparent' }]}>
            <Info size={18} color={explicando ? cores.texto : cores.textoSuave} strokeWidth={2} />
          </Pressable>
        ) : null}
        {!aberta && resumo ? (
          <View style={estilos.resumo}>
            {typeof resumo === 'string' ? <Texto variante="suave" numberOfLines={1}>{resumo}</Texto> : resumo}
          </View>
        ) : null}
      </View>
      {ajuda && explicando ? (
        <View style={[estilos.explicacao, { borderLeftColor: cores.borda }]}><Texto variante="suave">{ajuda}</Texto></View>
      ) : null}
      {aberta ? (
        <View role="region" aria-labelledby={idDoTitulo} accessibilityLabel={web ? undefined : titulo} nativeID={idDoConteudo} style={estilos.conteudo}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(0.5) },
  encolhe: { flexShrink: 1 },
  // O recuo à esquerda é negativo para o texto alinhar com os rótulos dos campos; o fundo do hover ainda tem folga. Sem
  // `maxWidth: '100%'`: ele mede pelo título sem o recuo e cortava 8 px, e o título quebrava em duas linhas com espaço sobrando.
  botao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1), marginLeft: -espaco(1), borderRadius: RAIO },
  titulo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  info: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  // Ao lado do título enquanto couber pelo menos ~160 px; abaixo disso desce inteiro para a linha de baixo.
  resumo: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  explicacao: { borderLeftWidth: 2, paddingLeft: espaco(1.5), paddingVertical: espaco(0.5) },
  conteudo: { paddingTop: espaco(0.5) },
});
