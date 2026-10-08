import { router, Slot, usePathname, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { MarcaTitulo } from './MarcaTitulo';
import { Texto } from './Texto';

export interface ItemMenu {
  rotulo: string;
  href: Href;
  /** Caminho que marca o item como ativo (o item fica ativo também nas subpáginas). */
  caminho: string;
  Icone: LucideIcon;
  /** Só a raiz da área: ativo apenas no caminho exato. */
  exato?: boolean;
}

/**
 * Casca das áreas logadas: menu lateral fixo no PC (largura ≥ 900) e barra inferior no celular. Item ativo com a
 * cor da marca (o único uso de cor de marca na navegação).
 */
export function Navegacao({ itens, sempreInferior }: { itens: ItemMenu[]; sempreInferior?: boolean }) {
  const { width } = useWindowDimensions();
  const { cores } = useTema();
  const { marca } = useSessao();
  const lateral = !sempreInferior && width >= LARGURA_MENU_LATERAL;

  if (lateral) {
    return (
      <View style={[estilos.linha, { backgroundColor: cores.fundo }]}>
        <SafeAreaView edges={['top', 'bottom', 'left']}
          style={[estilos.lateral, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <View style={estilos.marca}>
            <MarcaTitulo marca={marca} />
          </View>
          {itens.map((item) => (
            <ItemNavegacao key={item.caminho} item={item} lateral />
          ))}
        </SafeAreaView>
        <View style={estilos.conteudo}>
          <Slot />
        </View>
      </View>
    );
  }
  return (
    <View style={[estilos.coluna, { backgroundColor: cores.fundo }]}>
      <View style={estilos.conteudo}>
        <Slot />
      </View>
      <SafeAreaView edges={['bottom']}
        style={[estilos.inferior, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        {itens.map((item) => (
          <ItemNavegacao key={item.caminho} item={item} />
        ))}
      </SafeAreaView>
    </View>
  );
}

function ItemNavegacao({ item, lateral }: { item: ItemMenu; lateral?: boolean }) {
  const caminho = usePathname();
  const { cores, marca } = useTema();
  const ativo = item.exato ? caminho === item.caminho : caminho === item.caminho || caminho.startsWith(`${item.caminho}/`);
  const cor = ativo ? marca : cores.textoSuave;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.rotulo}
      accessibilityState={{ selected: ativo }}
      onPress={() => router.navigate(item.href)}
      style={({ pressed }) => [
        lateral ? estilos.itemLateral : estilos.itemInferior,
        lateral && ativo && { backgroundColor: cores.superficie2 },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <item.Icone size={20} color={cor} strokeWidth={2} />
      <Texto style={[lateral ? estilos.rotuloLateral : estilos.rotuloInferior, { color: cor }]}>{item.rotulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { flex: 1, flexDirection: 'row' },
  coluna: { flex: 1 },
  conteudo: { flex: 1 },
  lateral: { width: 240, borderRightWidth: 1, paddingHorizontal: espaco(1.5), gap: espaco(0.5) },
  marca: { paddingVertical: espaco(2), paddingHorizontal: espaco(1) },
  itemLateral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO,
  },
  rotuloLateral: { fontFamily: fontes.semi, fontSize: 15 },
  inferior: { flexDirection: 'row', borderTopWidth: 1 },
  itemInferior: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 2, paddingVertical: espaco(0.5) },
  rotuloInferior: { fontFamily: fontes.semi, fontSize: 11 },
});
