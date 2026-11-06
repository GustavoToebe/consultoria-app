import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { NumeroInvertido } from '../../ui/NumeroInvertido';
import { Selo, type TipoSelo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  numero: number;
  titulo: string;
  selo?: { texto: string; tipo: TipoSelo; Icone?: LucideIcon };
  /** Linha de resumo embaixo do título ("3 séries: 3 WS", "540 kcal · 3 itens"). */
  linha: string;
  rotulo: string;
  /** É o que está no inspetor. */
  escolhido: boolean;
  /** Borda vermelha (erro da validação casado com o item). */
  comProblema: boolean;
  aoEscolher: () => void;
}

/**
 * Item da lista (mestre) dos editores em duas colunas (exercício, refeição, seção da mobilidade): número, título, selo,
 * resumo e a seta. O escolhido segue a seleção invertida do app (borda e barra na cor do texto, número invertido, como a
 * aba de série aberta), com `aria-current` e `selected`; a cor da marca ficava igual à do erro em marca vermelha.
 */
export function ItemDaListaDoEditor({ numero, titulo, selo, linha, rotulo, escolhido, comProblema, aoEscolher }: Props) {
  const { cores, bordas } = useTema();
  const borda = escolhido ? cores.texto : comProblema ? cores.perigo : cores.borda;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      aria-current={escolhido ? 'true' : undefined}
      accessibilityLabel={rotulo}
      onPress={aoEscolher}
      style={(s) => [
        estilos.item,
        {
          borderWidth: bordas.bloco,
          borderLeftWidth: BARRA,
          borderColor: borda,
          borderLeftColor: borda,
          backgroundColor: escolhido ? cores.superficie : sobre(s) ? cores.superficie3 : cores.superficie2,
        },
      ]}>
      <NumeroInvertido numero={numero} invertido={escolhido} />
      <View style={estilos.meio}>
        <Texto style={estilos.nome} numberOfLines={2}>{titulo}</Texto>
        {selo ? <View style={estilos.selo}><Selo texto={selo.texto} tipo={selo.tipo} Icone={selo.Icone} /></View> : null}
        <Texto variante="pequeno" numerico numberOfLines={2}>{linha}</Texto>
      </View>
      <ChevronRight size={18} color={escolhido ? cores.texto : cores.textoSuave} strokeWidth={2} />
    </Pressable>
  );
}

/** Barra da esquerda do item, sempre com a mesma largura (só a cor muda): escolher outro item não empurra o texto. */
const BARRA = 4;

const estilos = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.25), minHeight: ALVO_TOQUE, borderRadius: RAIO, paddingVertical: espaco(1), paddingHorizontal: espaco(1.25) },
  meio: { flex: 1, gap: 4 },
  nome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  selo: { flexDirection: 'row' },
});
