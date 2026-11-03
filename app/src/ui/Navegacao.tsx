import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Slot, usePathname, type Href } from 'expo-router';
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { urlDaApi } from '../api/cliente';
import { gruposDoMenu, rotuloCurtoDoMenu, type GrupoDoMenu } from '../dominio/gruposDoMenu';
import { mesmaTela } from '../dominio/mesmaTela';
import type { Marca } from '../api/tipos';
import { useSessao } from '../sessao/SessaoProvider';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { useSaidaGuardada } from './GuardaDeSaida';
import { MarcaTitulo } from './MarcaTitulo';
import { useAlvoDoPasseio } from './Passeio';
import { propsDeLink } from './propsDeLink';
import { sobre } from './sobre';
import { Texto } from './Texto';

export interface ItemMenu {
  /** Pendência (ponto de atenção no ícone). `'inferior'`: só na barra do celular, quando a tela do aviso fica fora dela. */
  ponto?: boolean | 'inferior';
  rotulo: string;
  /** Rótulo da barra inferior e do trilho do tablet, onde cabem cerca de 10 letras por item ("Planos" em vez de "Planejamento"). */
  rotuloCurto?: string;
  /** Grupo do menu lateral (título no PC, fio no trilho); sem grupo, o item fica no topo. A barra do celular ignora. */
  grupo?: GrupoDoMenu;
  href: Href;
  /** Caminho que marca o item como ativo (o item fica ativo também nas subpáginas). */
  caminho: string;
  Icone: LucideIcon;
  /** Só a raiz da área: ativo apenas no caminho exato. */
  exato?: boolean;
  /** Só no menu lateral do PC (a barra do celular tem espaço para poucos itens). */
  soLateral?: boolean;
  /** Só na barra inferior do celular (no PC o item vive em outro lugar, como o Perfil no cartão do usuário). */
  soCelular?: boolean;
  /** Outros caminhos que também deixam o item ativo (telas abertas a partir dele). */
  tambem?: string[];
  /** Como `tambem`, só na barra inferior: telas que no PC têm item próprio no menu lateral. */
  tambemNoCelular?: string[];
}

/**
 * Casca das áreas logadas: menu lateral fixo a partir de 768 px (um trilho com o rótulo curto embaixo de cada ícone até
 * 1024; expandido a partir daí, com "Minimizar" à escolha) e barra inferior no celular. Item ativo preenchido com a cor da marca no menu lateral
 * (texto `sobreMarca`; na barra inferior, `marcaTexto`) e `aria-current="page"`. No trilho, o topo mostra a logo ou a inicial da consultoria;
 * minimizado no PC, cada ícone diz o nome ao passar o mouse ou focar. Itens com `grupo` ganham título no menu aberto e um fio
 * nos trilhos. `topo` é a barra de topo e só aparece com o menu lateral. Com `sempreInferior` (aluno) a barra
 * inferior vale em qualquer largura e, no PC, fica na mesma coluna do conteúdo (`larguraInferior`).
 */
export function Navegacao({ itens, sempreInferior, larguraInferior, rodape, conteudo, topo }: {
  itens: ItemMenu[];
  sempreInferior?: boolean;
  /** Largura máxima da barra inferior no PC (a coluna do aluno, 720); sem isto ocupa a janela toda. */
  larguraInferior?: number;
  rodape?: ReactNode;
  conteudo?: ReactNode;
  topo?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const { cores } = useTema();
  const { marca } = useSessao();
  const lateral = !sempreInferior && width >= LARGURA_MENU_LATERAL;
  // Entre 768 e 1023 o menu é só um trilho de ícones: não há largura para menu aberto e conteúdo.
  const trilho = width < LARGURA_MENU_EXPANDIDO;
  const [recolhidoPorEscolha, setRecolhido] = useState(false);
  const recolhido = trilho || recolhidoPorEscolha;
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_MENU_RECOLHIDO).then((v) => setRecolhido(v === '1'), () => undefined);
  }, []);
  const alternar = () => {
    const proximo = !recolhidoPorEscolha;
    setRecolhido(proximo);
    AsyncStorage.setItem(CHAVE_MENU_RECOLHIDO, proximo ? '1' : '0').catch(() => undefined);
  };

  if (lateral) {
    // Grupos (N29): título no menu aberto; no trilho, um fio. O leitor de tela ouve o nome do grupo nos dois.
    const blocos = gruposDoMenu(itens.filter((item) => !item.soCelular)).map((bloco, i) => (
      <View key={bloco.grupo ?? ''} role={bloco.grupo ? 'group' : undefined} aria-label={bloco.grupo} style={estilos.bloco}>
        {!bloco.grupo ? null : recolhido ? (
          i > 0 ? <View style={[estilos.fio, { backgroundColor: cores.divisor }]} /> : null
        ) : (
          <Texto variante="secao" aria-hidden numberOfLines={2} style={estilos.tituloGrupo}>{bloco.grupo}</Texto>
        )}
        {bloco.itens.map((item) => (
          <ItemNavegacao key={item.caminho} item={item} lateral recolhido={recolhido} trilho={trilho} />
        ))}
      </View>
    ));
    return (
      <View style={[estilos.linha, { backgroundColor: cores.fundo }]}>
        <SafeAreaView edges={['top', 'bottom', 'left']}
          accessibilityRole="menubar"
          style={[estilos.lateral, recolhido && (trilho ? estilos.lateralTrilho : estilos.lateralRecolhido), { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          {recolhido ? <MarcaDoTrilho marca={marca} /> : (
            <View style={estilos.marca}>
              <MarcaTitulo marca={marca} />
            </View>
          )}
          {/* A lista rola quando não cabe na altura. No PC minimizado não: a dica sai para fora do trilho e a rolagem a cortaria.
              A barra de rolagem aparece só no menu aberto: no trilho ela comeria a largura dos rótulos (o item cortado embaixo já avisa). */}
          {recolhido && !trilho ? <View style={estilos.blocos}>{blocos}</View> : (
            <ScrollView style={estilos.rolagem} showsVerticalScrollIndicator={!trilho} contentContainerStyle={[estilos.blocos, estilos.folgaDoFoco]}>{blocos}</ScrollView>
          )}
          {trilho ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={recolhido ? 'Expandir menu' : 'Minimizar menu'}
              onPress={alternar}
              style={(estado) => [estilos.itemLateral, estilos.alternar, recolhido && estilos.itemRecolhido, sobre(estado) && { backgroundColor: cores.superficie3 }]}>
              {recolhido ? <PanelLeftOpen size={20} color={cores.textoSuave} strokeWidth={2} /> : <PanelLeftClose size={20} color={cores.textoSuave} strokeWidth={2} />}
              {recolhido ? null : <Texto style={[estilos.rotuloLateral, { color: cores.textoSuave }]}>Minimizar</Texto>}
            </Pressable>
          )}
        </SafeAreaView>
        <View style={estilos.conteudo}>
          {topo}
          <View style={estilos.conteudo}>
            {conteudo??<Slot />}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[estilos.coluna, { backgroundColor: cores.fundo }]}>
      <View style={estilos.conteudo}>
        {conteudo??<Slot />}
      </View>
      {rodape}
      <SafeAreaView edges={['bottom']}
        style={[estilos.inferior, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View accessibilityRole="menubar" style={[estilos.itensInferiores, larguraInferior ? { maxWidth: larguraInferior } : null]}>
          {itens.filter((item) => !item.soLateral).map((item) => (
            <ItemNavegacao key={item.caminho} item={item} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ItemNavegacao({ item, lateral, recolhido, trilho }: { item: ItemMenu; lateral?: boolean; recolhido?: boolean; trilho?: boolean }) {
  const caminho = usePathname();
  const { cores, marcaTexto, marca, sobreMarca } = useTema();
  const { confirmar } = useSaidaGuardada();
  const alvo = useAlvoDoPasseio(`menu:${item.caminho}`);
  const [dica, setDica] = useState(false);
  const casa = (base: string) => caminho === base || caminho.startsWith(`${base}/`);
  const ativo = (item.exato ? caminho === item.caminho : casa(item.caminho)) || !!item.tambem?.some(casa)
    || (!lateral && !!item.tambemNoCelular?.some(casa));
  // Menu lateral: o item ativo é preenchido com a cor da marca (protótipo de 30/10); na barra inferior, só o ícone e o texto.
  const preenchido = !!lateral && ativo;
  const cor = preenchido ? sobreMarca : ativo ? marcaTexto : cores.textoSuave;
  const ponto = item.ponto === true || (item.ponto === 'inferior' && !lateral);
  // Trilho do tablet (768 a 1023): o rótulo curto embaixo do ícone, como na barra inferior; tablet de toque não tem "passar o mouse".
  const rotuloEmbaixo = !!lateral && !!trilho;
  const rotulo = !lateral || rotuloEmbaixo ? rotuloCurtoDoMenu(item) : item.rotulo;
  // No PC minimizado (só ícones) o nome aparece ao passar o mouse ou ao focar pelo teclado: ícones parecidos se confundem.
  const comDica = !!lateral && !!recolhido && !trilho;
  const no = useRef<View | null>(null);
  const ref = useCallback((n: View | null) => {
    no.current = n;
    alvo(n);
  }, [alvo]);
  // Web, menu lateral que rola (não o PC minimizado): o item da tela aberta não fica cortado no fim da lista.
  useEffect(() => {
    if (Platform.OS === 'web' && lateral && ativo && !comDica) (no.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [lateral, ativo, comDica]);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="link"
      accessibilityLabel={ponto ? `${item.rotulo}, pendência` : item.rotulo}
      accessibilityState={{ selected: ativo }}
      // O leitor de tela da web não recebe o `selected` de um link: `aria-current` diz qual é a página atual.
      aria-current={ativo ? 'page' : undefined}
      {...propsDeLink(item.href, () => { if (!mesmaTela(caminho, item.href)) confirmar(() => router.navigate(item.href)); })}
      onHoverIn={comDica ? () => setDica(true) : undefined}
      onHoverOut={comDica ? () => setDica(false) : undefined}
      onFocus={comDica ? () => setDica(true) : undefined}
      onBlur={comDica ? () => setDica(false) : undefined}
      style={(estado) => [
        lateral ? estilos.itemLateral : estilos.itemInferior,
        lateral && recolhido && (rotuloEmbaixo ? estilos.itemTrilho : estilos.itemRecolhido),
        lateral && sobre(estado) && { backgroundColor: cores.superficie3 },
        preenchido && { backgroundColor: marca },
        !lateral && estado.pressed && { opacity: 0.7 },
      ]}>
      <View>
        <item.Icone size={lateral ? 20 : 22} color={cor} strokeWidth={2} />
        {ponto ? <View style={[estilos.ponto, { backgroundColor: cores.atencao, borderColor: cores.superficie }]} /> : null}
      </View>
      {recolhido && !rotuloEmbaixo ? null : (
        <Texto numberOfLines={1} style={[lateral && !rotuloEmbaixo ? estilos.rotuloLateral : estilos.rotuloInferior, rotuloEmbaixo && estilos.rotuloTrilho, { color: cor }]}>{rotulo}</Texto>
      )}
      {comDica && dica ? (
        <View pointerEvents="none" accessible={false} style={[estilos.dica, { backgroundColor: cores.texto }]}>
          <Texto numberOfLines={1} style={[estilos.textoDica, { color: cores.fundo }]}>{item.rotulo}</Texto>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Topo do trilho: a logo da consultoria ou a inicial do nome, para o menu de ícones não ficar sem dono. */
function MarcaDoTrilho({ marca }: { marca: Marca | null }) {
  const { cores, marca: cor, sobreMarca } = useTema();
  const nome = marca?.nome?.trim() || 'Treinos';
  if (marca?.logoUrl) {
    return (
      <View accessibilityRole="image" accessibilityLabel={nome} style={estilos.topoTrilho}>
        <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={estilos.logoTrilho} contentFit="contain" />
      </View>
    );
  }
  return (
    <View accessibilityRole="image" accessibilityLabel={nome} style={estilos.topoTrilho}>
      <View style={[estilos.inicial, { backgroundColor: cor, borderColor: cores.borda }]}>
        <Texto style={[estilos.textoInicial, { color: sobreMarca }]}>{nome.charAt(0).toUpperCase()}</Texto>
      </View>
    </View>
  );
}

const CHAVE_MENU_RECOLHIDO = 'menu-lateral-recolhido';

const estilos = StyleSheet.create({
  linha: { flex: 1, flexDirection: 'row' },
  coluna: { flex: 1 },
  conteudo: { flex: 1 },
  lateral: { width: 240, borderRightWidth: 1, paddingHorizontal: espaco(1.5), gap: espaco(0.5), zIndex: 30 },
  lateralRecolhido: { width: 72, paddingTop: espaco(2) },
  // 88 px: 80 de rótulo embaixo do ícone; os maiores, "Atualizações" e "Interessados" (75 px em Inter 600 de 12 px), cabem sem cortar.
  lateralTrilho: { width: 88, paddingTop: espaco(2), paddingHorizontal: espaco(0.5) },
  itemRecolhido: { justifyContent: 'center', paddingHorizontal: 0 },
  itemTrilho: { flexDirection: 'column', justifyContent: 'center', gap: 2, paddingHorizontal: 0, paddingVertical: espaco(0.5) },
  rolagem: { flexGrow: 1, flexShrink: 1, marginHorizontal: -espaco(0.5) },
  // O anel de foco (2 px + 2 px de folga) fica por fora do item: sem esta folga a rolagem o cortaria nas bordas.
  folgaDoFoco: { padding: espaco(0.5) },
  blocos: { gap: espaco(0.5) },
  bloco: { gap: espaco(0.5) },
  tituloGrupo: { paddingHorizontal: espaco(1.5), paddingTop: espaco(1.5), paddingBottom: espaco(0.5) },
  fio: { height: 1, marginVertical: espaco(0.5), marginHorizontal: espaco(1) },
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
  inferior: { borderTopWidth: 1, alignItems: 'center' },
  itensInferiores: { flexDirection: 'row', width: '100%' },
  itemInferior: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 3, paddingVertical: espaco(0.5), paddingHorizontal: 2 },
  rotuloInferior: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
  // Esticado na largura do item: com `numberOfLines`, nome que não coube vira reticências em vez de vazar do trilho.
  rotuloTrilho: { alignSelf: 'stretch', textAlign: 'center' },
  ponto: { position: 'absolute', right: -5, top: -3, width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
  dica: { position: 'absolute', left: 64, top: 8, paddingHorizontal: espaco(1), paddingVertical: 4, borderRadius: 6, zIndex: 50 },
  textoDica: { fontFamily: fontes.semi, fontSize: 13 },
  topoTrilho: { alignItems: 'center', marginBottom: espaco(1) },
  logoTrilho: { width: 44, height: 44 },
  inicial: { width: 40, height: 40, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoInicial: { fontFamily: fontes.negrito, fontSize: 18 },
});
