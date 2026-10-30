import { Card } from '../components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { BORDA_BLOCO, espaco, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

interface Props {
  children: ReactNode;
  titulo?: string;
  /** Uma linha `suave` abaixo do título, no lugar de texto solto de explicação. */
  descricao?: string;
  /** Faixa de grupo (`CabecalhoDeGrupo`) rente às bordas, no lugar do título: o conteúdo ganha o padding só embaixo. */
  cabecalho?: ReactNode;
  /** Botões do cartão, à direita do título. */
  acoes?: ReactNode;
  /** Botões fixos na base do cartão: numa grade, ficam alinhados entre cartões de alturas diferentes. */
  rodape?: ReactNode;
  /** O título vira botão que recolhe e expande o conteúdo (as `acoes` ficam sempre visíveis). */
  recolhivel?: boolean;
  /** Só vale com `recolhivel`: começa fechado. */
  recolhido?: boolean;
  /** Nível do título para o leitor de tela; padrão h2 (o h1 é o `Cabecalho` da tela). */
  nivel?: 2 | 3;
  /**
   * Título e ações numa faixa (`superficie3`, linha embaixo) rente às bordas: marca onde a seção começa (reunião de
   * 29/10, "tudo parece uma coisa só, sem início e fim"). Ligada em todo cartão com título; `faixa={false}` só onde a
   * faixa atrapalha (cartão de destaque com cor própria, por exemplo).
   */
  faixa?: boolean;
  /** Antes do título, na mesma linha: a bolinha na cor do estado nos grupos da lista de alunos. Decorativo: o título diz o estado. */
  marcador?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Cartão flat: superfície, borda de 2 px, cantos de 12 px, sem sombra; a faixa do título tem linha de 3 px embaixo. Separa seções, dias, exercícios. */
export function Cartao({ children, cabecalho, titulo, descricao, acoes, rodape, recolhivel, recolhido = false, nivel = 2, faixa = true, marcador, style }: Props) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const [fechado, setFechado] = useState(recolhivel ? recolhido : false);
  const Seta = fechado ? ChevronDown : ChevronUp;
  const recuo = espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2);
  const comFaixa = faixa && !cabecalho && !!(titulo || acoes);
  const rente = !!cabecalho || comFaixa;
  return (
    <Card style={[estilos.cartao, { borderWidth: bordas.bloco, backgroundColor: cores.superficie, borderColor: cores.borda, padding: rente ? 0 : recuo }, rente ? estilos.comCabecalho : null, style]}>
      {cabecalho ?? null}
      {titulo || acoes ? (
        <View style={[estilos.topo, comFaixa ? [estilos.faixa, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo, paddingHorizontal: recuo }, fechado ? estilos.faixaFechada : null] : null]}>
          <View style={estilos.tituloEDescricao}>
            {titulo && recolhivel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${titulo}, ${fechado ? 'recolhido' : 'expandido'}`}
                accessibilityState={{ expanded: !fechado }}
                onPress={() => setFechado((v) => !v)}
                style={({ pressed }) => [estilos.tituloBotao, { opacity: pressed ? 0.7 : 1 }]}>
                {marcador ?? null}
                <Texto variante="bloco" nivel={nivel} style={estilos.titulo}>{titulo}</Texto>
                <Seta size={18} color={cores.textoSuave} />
              </Pressable>
            ) : titulo && marcador ? (
              <View style={estilos.comMarcador}>{marcador}<Texto variante="bloco" nivel={nivel} style={estilos.titulo}>{titulo}</Texto></View>
            ) : titulo ? <Texto variante="bloco" nivel={nivel} style={estilos.titulo}>{titulo}</Texto> : null}
            {descricao && !fechado ? <Texto variante="suave">{descricao}</Texto> : null}
          </View>
          {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
        </View>
      ) : null}
      {fechado || (rente && Children.toArray(children).length === 0) ? null : rente ? <View style={[estilos.corpo, { padding: recuo }]}>{children}</View> : children}
      {rodape && !fechado ? <View style={[estilos.rodape, rente ? { paddingHorizontal: recuo, paddingBottom: recuo } : null]}>{rodape}</View> : null}
    </Card>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: BORDA_BLOCO, borderRadius: RAIO, gap: espaco(2) },
  comCabecalho: { overflow: 'hidden', gap: 0 },
  corpo: { gap: espaco(2) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), flexWrap: 'wrap' },
  tituloEDescricao: { flexShrink: 1, flexGrow: 1, flexBasis: 200, gap: 2 },
  titulo: { flexShrink: 1 },
  comMarcador: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  faixa: { paddingVertical: espaco(1.5), borderBottomWidth: LINHA_DA_FAIXA },
  faixaFechada: { borderBottomWidth: 0 },
  tituloBotao: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexShrink: 1, minHeight: 44 },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap', maxWidth: '100%' },
  // `marginTop: 'auto'` empurra o rodapé para a base quando o cartão é esticado pela grade.
  rodape: { marginTop: 'auto' },
});
