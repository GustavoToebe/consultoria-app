import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { router, Slot, usePathname, type Href } from 'expo-router';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { MarcaTitulo } from './MarcaTitulo';
import { Texto } from './Texto';

export interface ItemMenu {
  ponto?: boolean;
  rotulo: string;
  href: Href;
  /** Caminho que marca o item como ativo (o item fica ativo também nas subpáginas). */
  caminho: string;
  Icone: LucideIcon;
  /** Só a raiz da área: ativo apenas no caminho exato. */
  exato?: boolean;
  /** Só no menu lateral do PC (a barra do celular tem espaço para poucos itens). */
  soLateral?: boolean;
}

/**
 * Casca das áreas logadas: menu lateral fixo no PC (largura ≥ 900) e barra inferior no celular. Item ativo com a
 * cor da marca (o único uso de cor de marca na navegação).
 */
export function Navegacao({ itens, sempreInferior, rodape }: { itens: ItemMenu[]; sempreInferior?: boolean; rodape?: ReactNode }) {
  const { width } = useWindowDimensions();
  const { cores } = useTema();
  const { marca } = useSessao();
  const lateral = !sempreInferior && width >= LARGURA_MENU_LATERAL;
  const [recolhido, setRecolhido] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_MENU_RECOLHIDO).then((v) => setRecolhido(v === '1'), () => undefined);
  }, []);
  const alternar = () => {
    const proximo = !recolhido;
    setRecolhido(proximo);
    AsyncStorage.setItem(CHAVE_MENU_RECOLHIDO, proximo ? '1' : '0').catch(() => undefined);
  };

  if (lateral) {
    return (
      <View style={[estilos.linha, { backgroundColor: cores.fundo }]}>
        <SafeAreaView edges={['top', 'bottom', 'left']}
          style={[estilos.lateral, recolhido && estilos.lateralRecolhido, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          {recolhido ? null : (
            <View style={estilos.marca}>
              <MarcaTitulo marca={marca} />
            </View>
          )}
          {itens.map((item) => (
            <ItemNavegacao key={item.caminho} item={item} lateral recolhido={recolhido} />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recolhido ? 'Expandir menu' : 'Minimizar menu'}
            onPress={alternar}
            style={({ pressed }) => [estilos.itemLateral, estilos.alternar, recolhido && estilos.itemRecolhido, { opacity: pressed ? 0.7 : 1 }]}>
            {recolhido ? <PanelLeftOpen size={20} color={cores.textoSuave} strokeWidth={2} /> : <PanelLeftClose size={20} color={cores.textoSuave} strokeWidth={2} />}
            {recolhido ? null : <Texto style={[estilos.rotuloLateral, { color: cores.textoSuave }]}>Minimizar</Texto>}
          </Pressable>
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
      {rodape}
      <SafeAreaView edges={['bottom']}
        style={[estilos.inferior, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        {itens.filter((item) => !item.soLateral).map((item) => (
          <ItemNavegacao key={item.caminho} item={item} />
        ))}
      </SafeAreaView>
    </View>
  );
}

function ItemNavegacao({ item, lateral, recolhido }: { item: ItemMenu; lateral?: boolean; recolhido?: boolean }) {
  const caminho = usePathname();
  const { cores, marca } = useTema();
  const ativo = item.exato ? caminho === item.caminho : caminho === item.caminho || caminho.startsWith(`${item.caminho}/`);
  const cor = ativo ? marca : cores.textoSuave;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.ponto ? `${item.rotulo}, atualização pendente` : item.rotulo}
      accessibilityState={{ selected: ativo }}
      onPress={() => router.navigate(item.href)}
      style={({ pressed }) => [
        lateral ? estilos.itemLateral : estilos.itemInferior,
        lateral && recolhido && estilos.itemRecolhido,
        lateral && ativo && { backgroundColor: cores.superficie2 },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View>
        <item.Icone size={20} color={cor} strokeWidth={2} />
        {item.ponto ? <View style={{position:'absolute',right:-5,top:-3,width:8,height:8,borderRadius:4,backgroundColor:cores.atencao}} /> : null}
      </View>
      {recolhido ? null : <Texto style={[lateral ? estilos.rotuloLateral : estilos.rotuloInferior, { color: cor }]}>{item.rotulo}</Texto>}
    </Pressable>
  );
}

const CHAVE_MENU_RECOLHIDO = 'menu-lateral-recolhido';

const estilos = StyleSheet.create({
  linha: { flex: 1, flexDirection: 'row' },
  coluna: { flex: 1 },
  conteudo: { flex: 1 },
  lateral: { width: 240, borderRightWidth: 1, paddingHorizontal: espaco(1.5), gap: espaco(0.5) },
  lateralRecolhido: { width: 72, paddingTop: espaco(2) },
  itemRecolhido: { justifyContent: 'center', paddingHorizontal: 0 },
  alternar: { marginTop: 'auto', marginBottom: espaco(1) },
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
