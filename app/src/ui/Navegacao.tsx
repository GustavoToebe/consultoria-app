import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode, RefObject } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { acaoDoAtalho, ehMac, rotuloDoAtalho } from '../dominio/atalhosDoMenu';
import { router, Slot, usePathname, type Href } from 'expo-router';
import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { urlDaApi } from '../api/cliente';
import {
  alternarGrupoRecolhido,
  gruposDoMenu,
  gruposRecolhidos,
  itemAtivo,
  posicaoNoMenu,
  resumoDoGrupoRecolhido,
  rotuloCurtoDoMenu,
  sinaisDoIconeDoGrupo,
  type GrupoDoMenu,
} from '../dominio/gruposDoMenu';
import { mesmaTela } from '../dominio/mesmaTela';
import type { Marca } from '../api/tipos';
import { NOME_DO_PRODUTO } from '../dominio/produto';
import { useSessao } from '../sessao/SessaoProvider';
import { inteiroComMilhar } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE, TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { ProvedorDoFundoDaArea } from './fundoDaArea';
import { useSaidaGuardada } from './GuardaDeSaida';
import { FAMILIAS } from './MarcaTitulo';
import { ROLAGEM_DO_MENU, useAlvoDoPasseio } from './Passeio';
import { propsDeLink } from './propsDeLink';
import { sobre } from './sobre';
import { IconeDoGrupo, SubmenuDoGrupo, useSubmenuDoTrilho } from './SubmenuDoTrilho';
import { Texto } from './Texto';
import { useTeclado } from './usoWeb';
import { Vidro } from './Vidro';

export interface ItemMenu {
  /** Pendência (ponto de atenção no ícone). `'inferior'`: só na barra do celular, quando a tela do aviso fica fora dela. */
  ponto?: boolean | 'inferior';
  /**
   * Número ao lado do rótulo no menu aberto do PC (como na prévia), em texto neutro; `descricao` completa o nome acessível
   * ("Atualizações, 3 para revisar"). Zero não aparece. No trilho, no recolhido e no celular fica só o `ponto`.
   */
  contagem?: { numero: number; descricao: string };
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
  /** Só na barra inferior do celular (no PC o item vive em outro lugar, como o Perfil no menu da conta). */
  soCelular?: boolean;
  /** Outros caminhos que também deixam o item ativo (telas abertas a partir dele). */
  tambem?: string[];
  /** Como `tambem`, só na barra inferior: telas que no PC têm item próprio no menu lateral. */
  tambemNoCelular?: string[];
}

/**
 * Casca das áreas logadas: menu lateral fixo a partir de 768 px (um trilho com o rótulo curto embaixo de cada ícone até
 * 1024; expandido a partir daí, recolhível à escolha) e barra inferior no celular. Sem barra de topo (guia de 11/11, D1): o
 * conteúdo começa no `painel`. No menu lateral, de cima para baixo e nessa ordem de Tab: a identidade com os ícones de
 * recolher e da `busca` à direita (no minimizado, empilhados sob a logo; o trilho não recolhe), a lista que rola e a `conta`
 * num rodapé fixo (busca e conta só existem na web do treinador). Ctrl+B / Cmd+B alterna a barra. Visual de 11/11: o menu fica no `fundo`, sem contorno, e o conteúdo num
 * `painel` destacado (contorno `divisor`, cantos de 12, 8 px de folga). Item ativo com a seleção neutra (`superficie3`,
 * texto principal) e a marca só no pequeno indicador (`marcaPeca`: barra de 3 × 16 à esquerda no menu, 20 × 2 em cima na
 * barra inferior); `aria-current="page"`. Minimizado no PC, cada grupo vira um ícone que abre o submenu flutuante com os
 * itens dele (`ui/SubmenuDoTrilho`, "Menu Button" da APG) e os controles só de ícone dizem o nome ao passar o mouse ou
 * focar (`useDicaNoMenu`). Itens com `grupo` ganham título e um fio vertical à esquerda no menu aberto e um fio entre os
 * grupos no trilho do tablet. Com `sempreInferior` (aluno) a
 * barra inferior vale em qualquer largura e, no PC, fica na mesma coluna do conteúdo (`larguraInferior`).
 */
export function Navegacao({ itens, sempreInferior, larguraInferior, rodape, conteudo, busca, conta }: {
  itens: ItemMenu[];
  sempreInferior?: boolean;
  /** Largura máxima da barra inferior no PC (a coluna do aluno, 720); sem isto ocupa a janela toda. */
  larguraInferior?: number;
  rodape?: ReactNode;
  conteudo?: ReactNode;
  /** Abre a busca global, logo abaixo da identidade; só no menu lateral. */
  busca?: ReactNode;
  /** A conta de quem está logado, no rodapé fixo do menu lateral (a lista rola sem escondê-la). */
  conta?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const { cores, bordas, stndrd: stndrdTema, preferencias, escolherPreferencia } = useTema();
  const stndrd = stndrdTema ?? TOKENS_STNDRD_ESCURO;
  const { marca } = useSessao();
  const caminho = usePathname();
  const lateral = !sempreInferior && width >= LARGURA_MENU_LATERAL;
  // Entre 768 e 1023 o menu é só um trilho de ícones: não há largura para menu aberto e conteúdo.
  const trilho = width < LARGURA_MENU_EXPANDIDO;
  const [recolhidoPorEscolha, setRecolhido] = useState(false);
  const recolhido = trilho || recolhidoPorEscolha;
  const { trilho: refDoTrilho, atual: dicaAtual, mostrar: mostrarDica, esconder: esconderDica, aoRolar: medirDica } = useDicaDoTrilho();
  const submenu = useSubmenuDoTrilho(refDoTrilho);
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_MENU_RECOLHIDO).then((v) => setRecolhido(v === '1'), () => undefined);
  }, []);
  const alternar = () => {
    submenu.fechar();
    const proximo = !recolhidoPorEscolha;
    setRecolhido(proximo);
    AsyncStorage.setItem(CHAVE_MENU_RECOLHIDO, proximo ? '1' : '0').catch(() => undefined);
  };
  // Ctrl+B / Cmd+B alterna a barra, como o botão, só onde ela recolhe (o trilho do tablet e a barra de baixo não recolhem);
  // um ouvinte só, aqui. Com o foco num campo o atalho fica com ele (negrito); `preventDefault` só quando agiu.
  useTeclado(lateral && !trilho, (tecla) => {
    if (acaoDoAtalho(tecla) !== 'alternar-barra') return undefined;
    esconderDica();
    alternar();
    return true;
  });
  // Esc dispensa a dica sem mover o mouse nem o foco (WCAG 1.4.13); não consome a tecla, que segue para a folha ou o submenu.
  useTeclado(!!dicaAtual, ({ key }) => {
    if (key === 'Escape') esconderDica();
    return undefined;
  });
  const larguraDoMenu = trilho ? LARGURA_TRILHO : recolhido ? LARGURA_RECOLHIDO : LARGURA_ABERTO;
  // No trilho tudo tem o rótulo embaixo: não há dica. Fora dele, o controle só de ícone (lupa, recolher, avatar) a usa.
  const menu = useMemo<MenuLateral>(
    () => ({ recolhido, trilho, mostrarDica: trilho ? undefined : mostrarDica, esconderDica }),
    [recolhido, trilho, mostrarDica, esconderDica],
  );

  // Uma árvore só nas duas formas (menu lateral × barra de baixo): o conteúdo fica no mesmo lugar e só o menu e a barra entram e
  // saem, então cruzar os 768 px não remonta a tela (painel de filtros aberto, rascunho e formulários não se perdem).
  let menuLateral: ReactNode = null;
  if (lateral) {
    // PC minimizado (72 px): o Início fica com a dica e cada grupo é um ícone com submenu (submenu dos grupos, 18/11).
    const comDica = recolhido && !trilho;
    // Grupos (N29): título no menu aberto; no trilho do tablet, um fio. O leitor de tela ouve o nome do grupo nos dois.
    const doMenu = gruposDoMenu(itens.filter((item) => !item.soCelular));
    // Só o menu aberto recolhe grupo (D1) e todo grupo recolhe, o da tela aberta também (D9, 19/11): abrir uma tela não mexe
    // na escolha. Recolhido, o título do grupo da tela leva a barrinha e o `aria-current` do item atual.
    const grupoDaTela = posicaoNoMenu(caminho)?.grupo;
    const fechados = recolhido ? [] : gruposRecolhidos(preferencias.gruposRecolhidos, doMenu.map((b) => b.grupo));
    const blocos = doMenu.map((bloco, i) => {
      const grupo = bloco.grupo;
      const fechado = !!grupo && fechados.includes(grupo);
      if (grupo && comDica) {
        const { atual, ponto, sinais } = sinaisDoIconeDoGrupo(bloco.itens, caminho);
        return (
          <View key={grupo} style={estilos.bloco}>
            {/* Um fio só, entre o Início e os grupos: os ícones dos grupos ficam juntos. */}
            {i > 0 && !doMenu[i - 1].grupo ? <View style={[estilos.fio, { backgroundColor: cores.divisor }]} /> : null}
            <IconeDoGrupo grupo={grupo} atual={atual} ponto={ponto} sinais={sinais} botao={submenu.doBotao(grupo)} />
          </View>
        );
      }
      let titulo: ReactNode = null;
      if (grupo && recolhido) titulo = i > 0 ? <View style={[estilos.fio, { backgroundColor: cores.divisor }]} /> : null;
      else if (grupo) {
        titulo = (
          <TituloDoGrupo grupo={grupo} fechado={fechado} atual={grupo === grupoDaTela} resumo={fechado ? resumoDoGrupoRecolhido(bloco.itens) : undefined}
            aoAlternar={() => escolherPreferencia({ gruposRecolhidos: alternarGrupoRecolhido(preferencias.gruposRecolhidos, grupo) })} />
        );
      }
      return (
        <BlocoDoMenu key={grupo ?? ''} grupo={grupo} fechado={fechado} titulo={titulo} comFio={!!grupo && !recolhido}>
          {/* Recolhido, os itens saem da árvore (não só da vista): o passeio deixa de apontar para eles sozinho. */}
          {fechado ? null : bloco.itens.map((item) => (
            <ItemNavegacao key={item.caminho} item={item} lateral recolhido={recolhido} trilho={trilho}
              aoMostrarDica={comDica ? mostrarDica : undefined} aoEsconderDica={comDica ? esconderDica : undefined} />
          ))}
        </BlocoDoMenu>
      );
    });
    const doSubmenu = comDica ? submenu.doSubmenu : null;
    const itensDoSubmenu = doSubmenu ? doMenu.find((b) => b.grupo === doSubmenu.grupo)?.itens ?? [] : [];
    menuLateral = (
      <ContextoDoMenu.Provider value={menu}>
        <SafeAreaView edges={['top', 'bottom', 'left']}
          ref={refDoTrilho}
          accessibilityRole="menubar"
          style={[estilos.lateral, recolhido && (trilho ? estilos.lateralTrilho : estilos.lateralRecolhido), { backgroundColor: cores.fundo }]}>
          {/* Topo (padrão "ícones ao lado do logo", 24/11): aberto, uma linha com a marca à esquerda e, à direita, o recolher
              e a busca, só ícones; minimizado, a logo e os dois ícones empilhados embaixo. Os filhos desta caixa são os
              mesmos nos dois modos (só o estilo muda): alternar não desmonta os botões e o foco continua neles. O trilho do
              tablet não recolhe: a logo e a busca com o rótulo embaixo, como os itens. */}
          {trilho ? (
            <>
              <MarcaDoTrilho marca={marca} />
              {busca}
            </>
          ) : (
            <View style={recolhido ? estilos.topoRecolhido : estilos.topo}>
              {recolhido ? <MarcaDoTrilho marca={marca} /> : <MarcaDoMenu marca={marca} />}
              <BotaoDoTopo Icone={recolhido ? PanelLeftOpen : PanelLeftClose} rotulo={recolhido ? 'Expandir barra lateral' : 'Recolher barra lateral'}
                atalho={ATALHO_DA_BARRA} expandido={!recolhido} aoTocar={() => { esconderDica(); alternar(); }} />
              {busca}
            </View>
          )}
          {/* A lista rola quando não cabe na altura (D20); a dica é desenhada no menu, fora da rolagem, que a cortaria. A
              barra de rolagem aparece só no menu aberto: nos trilhos ela comeria a largura dos ícones e dos rótulos. */}
          <ScrollView nativeID={ROLAGEM_DO_MENU} style={estilos.rolagem} showsVerticalScrollIndicator={!recolhido}
            onScroll={comDica ? () => { medirDica(); submenu.aoRolar(); } : undefined} scrollEventThrottle={32}
            contentContainerStyle={[estilos.blocos, estilos.folgaDoFoco]}>{blocos}</ScrollView>
          {conta ? <View style={[estilos.rodapeDoMenu, { borderTopColor: cores.divisor }]}>{conta}</View> : null}
          {!trilho && dicaAtual ? (
            <View pointerEvents="none" accessible={false} style={[
              estilos.dica,
              dicaAtual.abaixo ? { right: espaco(1.5) } : { left: larguraDoMenu + 4 },
              { top: dicaAtual.topo, backgroundColor: cores.texto },
            ]}>
              <Texto numberOfLines={1} style={[estilos.textoDica, { color: cores.fundo }]}>{dicaAtual.texto}</Texto>
              {dicaAtual.atalho ? <Texto numberOfLines={1} style={[estilos.atalhoDica, { color: cores.fundo }]}>{dicaAtual.atalho}</Texto> : null}
            </View>
          ) : null}
          {doSubmenu ? (
            <SubmenuDoGrupo submenu={doSubmenu}>
              {itensDoSubmenu.map((item) => <ItemNavegacao key={item.caminho} item={item} lateral noSubmenu aoEscolher={submenu.aoEscolher} />)}
            </SubmenuDoGrupo>
          ) : null}
        </SafeAreaView>
      </ContextoDoMenu.Provider>
    );
  }
  return (
    <View style={[lateral ? estilos.linha : estilos.coluna, { backgroundColor: cores.fundo }]}>
      {menuLateral}
      <View style={lateral ? [estilos.conteudo, estilos.painel, { backgroundColor: cores.painel, borderLeftColor: cores.divisor, borderLeftWidth: bordas.bloco }] : estilos.conteudo}>
        <ProvedorDoFundoDaArea value={lateral ? cores.painel : null}>
          <View style={estilos.conteudo}>
            {conteudo??<Slot />}
          </View>
        </ProvedorDoFundoDaArea>
      </View>
      {lateral ? null : rodape}
      {lateral ? null : (
        // Sem alvo: no Android a barra fica sólida (nada rola por baixo dela; ela vem depois do conteúdo).
        <Vidro estilo={[estilos.inferior, { borderColor: stndrd.glass.border }]}>
          <SafeAreaView edges={['bottom']} style={estilos.areaInferior}>
            <View accessibilityRole="menubar" style={[estilos.itensInferiores, larguraInferior ? { maxWidth: larguraInferior } : null]}>
              {itens.filter((item) => !item.soLateral).map((item) => (
                <ItemNavegacao key={item.caminho} item={item} />
              ))}
            </View>
          </SafeAreaView>
        </Vidro>
      )}
    </View>
  );
}

function ItemNavegacao({ item, lateral, recolhido, trilho, noSubmenu, aoEscolher, aoMostrarDica, aoEsconderDica }: {
  item: ItemMenu;
  lateral?: boolean;
  recolhido?: boolean;
  trilho?: boolean;
  /** Dentro do submenu do PC minimizado: `menuitem`, com rótulo e contagem como no menu aberto, fora do passeio. */
  noSubmenu?: boolean;
  aoEscolher?: () => void;
  /** PC minimizado: o nome do item ao passar o mouse ou focar, desenhado pelo trilho (fora da lista que rola). */
  aoMostrarDica?: (texto: string, no: View | null) => void;
  aoEsconderDica?: () => void;
}) {
  const caminho = usePathname();
  const { cores, marcaPeca, fatorTexto } = useTema();
  const { confirmar } = useSaidaGuardada();
  const alvo = useAlvoDoPasseio(`menu:${item.caminho}`);
  const ativo = itemAtivo(item, caminho, !!lateral);
  // Ativo: texto principal sobre a seleção neutra; a marca fica só no indicador (`marcaPeca`, ≥ 3:1 sobre o menu e a seleção).
  const cor = ativo ? cores.texto : cores.textoSuave;
  // Menu aberto do PC: o número no lugar do ponto (prévia); nos outros modos, o ponto de sempre.
  const contagem = lateral && !recolhido && item.contagem && item.contagem.numero > 0 ? item.contagem : null;
  const ponto = !contagem && (item.ponto === true || (item.ponto === 'inferior' && !lateral));
  // Trilho do tablet (768 a 1023): o rótulo curto embaixo do ícone, como na barra inferior; tablet de toque não tem "passar o mouse".
  const rotuloEmbaixo = !!lateral && !!trilho;
  const rotulo = !lateral || rotuloEmbaixo ? rotuloCurtoDoMenu(item) : item.rotulo;
  // WCAG 2.5.3: o nome acessível começa pelo texto visível ("Planos (Planejamento)").
  const nomeAcessivel = rotulo === item.rotulo ? item.rotulo : `${rotulo} (${item.rotulo})`;
  // No PC minimizado (só ícones) o nome aparece ao passar o mouse ou ao focar pelo teclado: ícones parecidos se confundem.
  const comDica = !!lateral && !!recolhido && !trilho;
  const no = useRef<View | null>(null);
  const ref = useCallback((n: View | null) => {
    no.current = n;
    // O submenu abre e fecha com o mouse: registrar os itens dele no passeio mudaria os passos no meio do caminho.
    if (!noSubmenu) alvo(n);
  }, [alvo, noSubmenu]);
  // Web, menu lateral (a lista rola em todos os modos): o item da tela aberta não fica cortado no fim da lista.
  useEffect(() => {
    if (Platform.OS === 'web' && lateral && ativo && !noSubmenu) (no.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [lateral, ativo, noSubmenu]);
  // Texto grande na barra inferior: o rótulo quebra em até duas linhas e o item cresce com a palavra (nada de reticências).
  const textoGrande = fatorTexto > 1;
  const mostrarDica = () => aoMostrarDica?.(item.rotulo, no.current);
  return (
    <Pressable
      ref={ref}
      accessibilityRole={noSubmenu ? 'menuitem' : 'link'}
      accessibilityLabel={contagem ? `${nomeAcessivel}, ${inteiroComMilhar(contagem.numero)} ${contagem.descricao}` : ponto ? `${nomeAcessivel}, pendência` : nomeAcessivel}
      accessibilityState={{ selected: ativo }}
      // O leitor de tela da web não recebe o `selected` de um link: `aria-current` diz qual é a página atual.
      aria-current={ativo ? 'page' : undefined}
      {...propsDeLink(item.href, () => {
        aoEscolher?.();
        if (!mesmaTela(caminho, item.href)) confirmar(() => router.navigate(item.href));
      })}
      onHoverIn={comDica ? mostrarDica : undefined}
      onHoverOut={comDica ? aoEsconderDica : undefined}
      onFocus={comDica ? mostrarDica : undefined}
      onBlur={comDica ? aoEsconderDica : undefined}
      style={(estado) => [
        lateral ? estilos.itemLateral : estilos.itemInferior,
        !lateral && textoGrande && estilos.itemInferiorGrande,
        lateral && recolhido && (rotuloEmbaixo ? estilos.itemTrilho : estilos.itemRecolhido),
        lateral && sobre(estado) && { backgroundColor: cores.superficie2 },
        lateral && ativo && { backgroundColor: cores.superficie2 },
        !lateral && estado.pressed && { opacity: 0.7 },
      ]}>
      {ativo ? <View aria-hidden style={[lateral ? estilos.indicadorLateral : estilos.indicadorInferior, { backgroundColor: marcaPeca }]} /> : null}
      <View style={lateral ? null : [estilos.pilula, ativo && { backgroundColor: cores.superficie3 }]}>
        <item.Icone size={lateral ? 20 : 22} color={cor} strokeWidth={2} />
        {ponto ? <View style={[estilos.ponto, lateral ? null : estilos.pontoNaPilula, { backgroundColor: cores.atencao, borderColor: lateral ? cores.fundo : cores.superficie }]} /> : null}
      </View>
      {recolhido && !rotuloEmbaixo ? null : (
        <Texto numberOfLines={!lateral && textoGrande ? 2 : 1} style={[lateral && !rotuloEmbaixo ? estilos.rotuloLateral : estilos.rotuloInferior, !lateral && textoGrande && estilos.rotuloInferiorGrande, rotuloEmbaixo && estilos.rotuloTrilho, { color: cor, fontFamily: ativo ? fontes.semi : fontes.medio }]}>{rotulo}</Texto>
      )}
      {contagem ? (
        <View aria-hidden style={[estilos.contagem, { borderColor: cores.divisor }]}>
          <Texto numerico style={[estilos.textoContagem, { color: cores.texto }]}>{inteiroComMilhar(contagem.numero)}</Texto>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Um grupo do menu lateral (`role="group"` com o nome do grupo; o Início, sem grupo, fica num bloco sem nome). Com `comFio`
 * (menu aberto), um fio vertical na cor `borda` liga os itens do grupo aberto, no meio da barrinha do item atual, que fica
 * por cima dele; é só desenho (submenu dos grupos, 18/11).
 */
function BlocoDoMenu({ grupo, fechado, titulo, comFio, children }: { grupo?: GrupoDoMenu; fechado: boolean; titulo: ReactNode; comFio: boolean; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View role={grupo ? 'group' : undefined} aria-label={grupo} style={estilos.bloco}>
      {titulo}
      {comFio && !fechado ? (
        <View style={estilos.itensDoGrupo}>
          <View aria-hidden pointerEvents="none" style={[estilos.fioVertical, { backgroundColor: cores.borda }]} />
          {children}
        </View>
      ) : children}
    </View>
  );
}

/**
 * Título do grupo no menu aberto (plano `menu-grupos-recolhiveis`, D6 e D9): sempre o botão que recolhe e abre (seta para cima
 * = aberto, para baixo = recolhido; `aria-expanded`; nome "Recolher X" / "Abrir X"), também no grupo da tela aberta. Recolhido,
 * mostra o que os itens mostrariam: a soma das contagens (zero não aparece) ou o ponto, e o nome acessível diz as contagens.
 * `atual` (o grupo da tela aberta) recolhido leva a barrinha `marcaPeca` à esquerda e `aria-current`, como o item ativo; aberto,
 * o item atual já tem a dele. Abre e fecha sem animação.
 */
function TituloDoGrupo({ grupo, fechado, atual, resumo, aoAlternar }: {
  grupo: GrupoDoMenu;
  fechado: boolean;
  atual: boolean;
  resumo?: ReturnType<typeof resumoDoGrupoRecolhido>;
  aoAlternar: () => void;
}) {
  const { cores, marcaPeca } = useTema();
  const texto = <Texto variante="secao" aria-hidden numberOfLines={2} style={estilos.textoGrupo}>{grupo}</Texto>;
  const marcado = atual && fechado;
  const numero = resumo?.numero ?? 0;
  const ponto = numero <= 0 && !!resumo?.ponto;
  const sinais = numero > 0 ? (resumo?.partes ?? []).map((p) => `${inteiroComMilhar(p.numero)} ${p.descricao}`) : ponto ? ['pendência'] : [];
  const Seta = fechado ? ChevronDown : ChevronUp;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[`${fechado ? 'Abrir' : 'Recolher'} ${grupo}`, ...sinais].join(', ')}
      accessibilityState={{ expanded: !fechado }}
      aria-expanded={!fechado}
      aria-current={marcado ? true : undefined}
      onPress={aoAlternar}
      style={(estado) => [estilos.tituloGrupo, sobre(estado) && { backgroundColor: cores.superficie2 }]}>
      {marcado ? <View aria-hidden style={[estilos.indicadorDoGrupo, { backgroundColor: marcaPeca }]} /> : null}
      {texto}
      <View style={estilos.sinaisDoGrupo}>
        {numero > 0 ? (
          <View aria-hidden style={[estilos.contagem, { borderColor: cores.divisor }]}>
            <Texto numerico style={[estilos.textoContagem, { color: cores.texto }]}>{inteiroComMilhar(numero)}</Texto>
          </View>
        ) : null}
        {ponto ? <View aria-hidden style={[estilos.pontoNoTitulo, { backgroundColor: cores.atencao }]} /> : null}
        <Seta size={16} color={cores.textoSuave} strokeWidth={2} style={estilos.setaGrupo} />
      </View>
    </Pressable>
  );
}

/**
 * Dica do PC minimizado numa camada do próprio trilho (D20): a lista de ícones rola quando a janela é baixa, e a dica, que
 * sai para a direita do trilho, seria cortada se morasse dentro do item. O item avisa ao ganhar o mouse ou o foco; o trilho
 * mede onde ele está (`measureLayout`, já com a rolagem) e desenha a dica ali. Ao rolar, mede de novo. Uma medida que chega
 * depois de o mouse sair (ou de outro item entrar) é descartada.
 */
function useDicaDoTrilho() {
  const trilho = useRef<View | null>(null);
  const alvo = useRef<{ texto: string; no: View; abaixo: boolean; atalho?: string } | null>(null);
  const [atual, setAtual] = useState<{ texto: string; topo: number; abaixo?: boolean; atalho?: string } | null>(null);
  const medir = useCallback(() => {
    const pedido = alvo.current;
    if (!pedido || !trilho.current) return;
    pedido.no.measureLayout(
      trilho.current as never,
      (_x, y, _largura, altura) => {
        if (alvo.current !== pedido) return;
        // Abaixo do controle, terminando no fim da linha dos ícones do topo (a borda direita útil do menu aberto): à direita
        // do menu ela cobriria o título da tela, e alinhada pelo recolher encostaria na borda da janela.
        setAtual(pedido.abaixo
          ? { texto: pedido.texto, atalho: pedido.atalho, topo: y + altura + DICA_ABAIXO_DO_CONTROLE, abaixo: true }
          : { texto: pedido.texto, atalho: pedido.atalho, topo: y + DICA_ABAIXO_DO_TOPO });
      },
      () => undefined,
    );
  }, []);
  const mostrar = useCallback((texto: string, no: View | null, abaixo = false, atalho?: string) => {
    if (!no) return;
    alvo.current = { texto, no, abaixo, atalho };
    medir();
  }, [medir]);
  const esconder = useCallback(() => {
    alvo.current = null;
    setAtual(null);
  }, []);
  return { trilho, atual, mostrar, esconder, aoRolar: medir };
}

/** Estado do menu lateral para o que mora nele (a busca e a conta): o modo e a dica dos controles só de ícone. */
interface MenuLateral {
  /** Minimizado (72) ou trilho (88): só ícones, ou ícone com o rótulo curto embaixo. */
  recolhido: boolean;
  /** Trilho do tablet (768 a 1023 px): rótulo embaixo do ícone, sem dica e sem recolher. */
  trilho: boolean;
  mostrarDica?: (texto: string, no: View | null, abaixo?: boolean, atalho?: string) => void;
  esconderDica?: () => void;
}
const ContextoDoMenu = createContext<MenuLateral>({ recolhido: false, trilho: false });
export const useMenuLateral = () => useContext(ContextoDoMenu);

/**
 * Dica de um controle só de ícone do menu lateral (o nome ao passar o mouse ou focar), desenhada pelo menu. `ativa` falsa
 * ou fora do menu lateral: sem eventos. `noRef` é o `ref` do próprio controle (o menu mede onde ele está). `abaixo`: a dica
 * fica abaixo do controle, terminando no fim da linha do topo (senão, à direita do menu). `atalho` aparece depois do texto, mais suave.
 */
export function useDicaNoMenu(texto: string, ativa: boolean, noRef: RefObject<View | null>, abaixo = false, atalho?: string): {
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
} {
  const { mostrarDica, esconderDica } = useContext(ContextoDoMenu);
  if (!ativa || !mostrarDica) return {};
  const mostrar = () => mostrarDica(texto, noRef.current, abaixo, atalho);
  return { onHoverIn: mostrar, onHoverOut: esconderDica, onFocus: mostrar, onBlur: esconderDica };
}

/** Atalhos da barra (Cmd no Mac). Detectados uma vez no carregamento: a web é SPA (`web.output: single`), sem HTML pré-gerado. */
const MAC = Platform.OS === 'web' && typeof navigator !== 'undefined' && ehMac(navigator.platform);
export const ATALHO_DA_BARRA = rotuloDoAtalho('b', MAC);
export const ATALHO_DA_BUSCA = rotuloDoAtalho('k', MAC);

/**
 * Botão só de ícone do topo do menu lateral (recolher e busca; 24/11): neutro, ícone `textoSuave`, realce `superficie2` com o
 * mouse. Aberto, 32 de largura por 44 de altura, com o desenho de 32 × 32, lado a lado à direita da marca e a dica abaixo;
 * minimizado, a largura do trilho por 44, empilhado sob a logo como os itens, e a dica à direita do menu. `rotulo` é o texto
 * da dica e, sem `nome`, o nome acessível; `atalho` vai na dica. `aoMontar` recebe o nó (o alvo do passeio).
 */
export function BotaoDoTopo({ Icone, rotulo, nome, atalho, expandido, aoTocar, aoMontar }: {
  Icone: LucideIcon;
  rotulo: string;
  nome?: string;
  atalho: string;
  /** Só o recolher: diz ao leitor de tela se a barra está aberta. */
  expandido?: boolean;
  aoTocar: () => void;
  aoMontar?: (no: View | null) => void;
}) {
  const { cores } = useTema();
  const { recolhido } = useContext(ContextoDoMenu);
  const noRef = useRef<View | null>(null);
  const ref = useCallback((no: View | null) => {
    noRef.current = no;
    aoMontar?.(no);
  }, [aoMontar]);
  const dica = useDicaNoMenu(rotulo, true, noRef, !recolhido, atalho);
  // O mouse é acompanhado aqui, não pelo `hovered` do Pressable: alternar tira o botão de baixo do ponteiro sem o navegador
  // avisar a saída, e o `hovered` ficaria preso (o realce ficava no botão com o mouse longe). Tocar zera.
  const [mouse, setMouse] = useState(false);
  return (
    <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={nome ?? rotulo} {...dica}
      {...(expandido === undefined ? null : { accessibilityState: { expanded: expandido }, 'aria-expanded': expandido })}
      onPress={() => { setMouse(false); aoTocar(); }}
      onHoverIn={() => { setMouse(true); dica.onHoverIn?.(); }}
      onHoverOut={() => { setMouse(false); dica.onHoverOut?.(); }}
      style={[estilos.botaoDoTopo, recolhido && estilos.botaoDoTopoRecolhido]}>
      {(estado) => (
        <View style={[estilos.desenhoDoTopo, recolhido && estilos.desenhoDoTopoRecolhido, (mouse || estado.pressed) && { backgroundColor: cores.superficie2 }]}>
          <Icone size={20} color={cores.textoSuave} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Identidade do menu aberto (prévia de 11/11; ícones ao lado, 24/11): a logo (ou a inicial) e o nome, à esquerda dos ícones
 * do topo, 68 px no conjunto. Logo larga (mais de 1,5 vez a altura) já traz o nome e fica sozinha no espaço que sobra, para
 * a marca real continuar inteira. Nome longo fica numa linha e trunca com reticências: os ícones nunca saem do menu. O
 * padrão do `MarcaTitulo` (telas públicas, aluno, Marca) não muda.
 */
function MarcaDoMenu({ marca }: { marca: Marca | null }) {
  const { cores, marca: cor, sobreMarca } = useTema();
  const [larga, setLarga] = useState(false);
  const nome = marca?.nome?.trim() || NOME_DO_PRODUTO;
  const fonte = marca?.fonteTitulo && marca.fonteTitulo !== 'PADRAO' ? FAMILIAS[marca.fonteTitulo] : undefined;
  const metal = marca?.fonteTitulo === 'METAL';
  return (
    <View style={estilos.marca} {...(larga ? { accessibilityRole: 'image' as const, accessibilityLabel: nome } : null)}>
      <View aria-hidden style={larga ? estilos.caixaLogoLarga : null}>
        {marca?.logoUrl ? (
          <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={larga ? estilos.logoLarga : estilos.logoTrilho} contentFit="contain"
            contentPosition="left" onLoad={(e) => setLarga(e.source.width > e.source.height * 1.5)} />
        ) : (
          <View style={[estilos.inicial, estilos.inicialMenu, { backgroundColor: cor, borderColor: cores.borda }]}>
            <Texto style={[estilos.textoInicial, estilos.textoInicialMenu, { color: sobreMarca }]}>{nome.charAt(0).toUpperCase()}</Texto>
          </View>
        )}
      </View>
      {larga ? null : (
        <Texto numberOfLines={1} style={[estilos.nomeMenu, fonte ? { fontFamily: fonte } : null, metal && estilos.nomeMetal]}>{nome}</Texto>
      )}
    </View>
  );
}

/** Topo do trilho e do PC minimizado: a logo da consultoria ou a inicial do nome, para o menu de ícones não ficar sem dono. */
function MarcaDoTrilho({ marca }: { marca: Marca | null }) {
  const { cores, marca: cor, sobreMarca } = useTema();
  const nome = marca?.nome?.trim() || NOME_DO_PRODUTO;
  const figura = marca?.logoUrl ? (
    <Image source={{ uri: urlDaApi(marca.logoUrl) }} style={estilos.logoTrilho} contentFit="contain" />
  ) : (
    <View style={[estilos.inicial, { backgroundColor: cor, borderColor: cores.borda }]}>
      <Texto style={[estilos.textoInicial, { color: sobreMarca }]}>{nome.charAt(0).toUpperCase()}</Texto>
    </View>
  );
  return <View accessibilityRole="image" accessibilityLabel={nome} style={estilos.topoTrilho}>{figura}</View>;
}

const CHAVE_MENU_RECOLHIDO = 'menu-lateral-recolhido';
const LARGURA_ABERTO = 240;
const LARGURA_RECOLHIDO = 72;
// 88 px: 80 de rótulo embaixo do ícone; os maiores, "Atualizações" e "Interessados" (cerca de 75 px em 12 px semi), cabem sem cortar.
const LARGURA_TRILHO = 88;
/** A dica fica 8 px abaixo do topo do item, como quando morava dentro dele. */
const DICA_ABAIXO_DO_TOPO = 8;
/** A dica dos ícones do topo do menu aberto fica 4 px abaixo deles. */
const DICA_ABAIXO_DO_CONTROLE = 4;

const estilos = StyleSheet.create({
  linha: { flex: 1, flexDirection: 'row' },
  coluna: { flex: 1 },
  conteudo: { flex: 1 },
  lateral: { width: LARGURA_ABERTO, paddingHorizontal: espaco(1.5), gap: espaco(0.5), zIndex: 30 },
  // O conteúdo ao lado do menu: 8 px do topo, da direita e de baixo; o lado do menu fica rente (o menu já tem folga).
  // `overflow: hidden` deixa os cantos de 12 limpos sob as faixas fixas das telas.
  // Visual-ponytail (17/11): o conteúdo ocupa a página inteira ao lado do menu, separado só pelo filete (sem a moldura arredondada).
  painel: { overflow: 'hidden' },
  lateralRecolhido: { width: LARGURA_RECOLHIDO, paddingTop: espaco(2) },
  lateralTrilho: { width: LARGURA_TRILHO, paddingTop: espaco(2), paddingHorizontal: espaco(0.5) },
  itemRecolhido: { justifyContent: 'center', paddingHorizontal: 0 },
  itemTrilho: { flexDirection: 'column', justifyContent: 'center', gap: 2, paddingHorizontal: 0, paddingVertical: espaco(0.5) },
  rolagem: { flexGrow: 1, flexShrink: 1, marginHorizontal: -espaco(0.5) },
  // O anel de foco (2 px + 2 px de folga) fica por fora do item: sem esta folga a rolagem o cortaria nas bordas.
  folgaDoFoco: { padding: espaco(0.5) },
  blocos: { gap: espaco(0.5) },
  bloco: { gap: espaco(0.5) },
  // Título do grupo no menu aberto: alvo de 44 com o texto embaixo, perto dos itens dele; o espaço de cima separa os grupos
  // (cerca de 28 px do item anterior ao texto, 8 do texto ao primeiro item). Sem folga extra entre os blocos.
  tituloGrupo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    // O nome nunca quebra no meio da palavra: se nome, contagem e seta não cabem (texto Extra com número grande), a
    // contagem e a seta descem para a linha de baixo, à direita. Folgas curtas para isso quase nunca acontecer.
    flexWrap: 'wrap',
    alignContent: 'flex-end',
    columnGap: espaco(0.5),
    rowGap: 2,
    minHeight: ALVO_TOQUE,
    paddingLeft: espaco(1.5),
    paddingRight: espaco(1),
    paddingBottom: espaco(0.5),
    borderRadius: RAIO_CONTROLE,
  },
  // 14 semibold (o item é 15 médio): o título lê como cabeçalho do grupo pelo peso e pelo espaço de cima, sem caixa alta.
  textoGrupo: { flexGrow: 1, flexShrink: 0, textTransform: 'none', letterSpacing: 0, fontSize: 14, lineHeight: 20 },
  sinaisDoGrupo: { flexDirection: 'row', alignItems: 'flex-end', gap: espaco(0.5), marginLeft: 'auto' },
  // O ponto do grupo recolhido fica na linha do título (o do item mora no canto do ícone).
  pontoNoTitulo: { width: 9, height: 9, borderRadius: 5, marginBottom: 4 },
  setaGrupo: { marginBottom: 1 },
  // Barrinha do item atual (3 × 16, à esquerda), na linha do texto do título: o texto fica embaixo da caixa de 44.
  indicadorDoGrupo: { position: 'absolute', left: 0, bottom: 6, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  fio: { height: 1, marginVertical: espaco(0.5), marginHorizontal: espaco(1) },
  // Fio vertical do grupo aberto: 1 px no meio da barrinha de 3 px do item atual (left 0), do primeiro ao último item.
  itensDoGrupo: { gap: espaco(0.5) },
  fioVertical: { position: 'absolute', left: 1, top: espaco(1), bottom: espaco(1), width: 1 },
  // Topo do menu aberto: uma linha, a marca ocupa o que sobra e os ícones (32 cada) ficam colados à direita, sem encolher.
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: espaco(0.5) },
  // Topo do minimizado: a logo e, embaixo, os ícones empilhados na largura do trilho, como os itens.
  topoRecolhido: { gap: espaco(0.5), marginBottom: espaco(1) },
  // 32 de largura (cabem dois ao lado do nome sem alargar o menu) por 44 de altura; o desenho de 32 × 32 recebe o realce.
  // shortcut: largura abaixo do ALVO_TOQUE de 44 (passa os 24 da WCAG 2.5.8), só no menu aberto do PC, que é de mouse; trocar se o menu aberto chegar ao toque.
  botaoDoTopo: { flexShrink: 0, width: 32, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  botaoDoTopoRecolhido: { width: 'auto', alignSelf: 'stretch' },
  desenhoDoTopo: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenhoDoTopoRecolhido: { alignSelf: 'stretch', width: 'auto', height: ALVO_TOQUE },
  // Rodapé fixo com a conta: um fio `divisor` em cima; a lista rola acima dele sem escondê-lo.
  rodapeDoMenu: { borderTopWidth: 1, paddingTop: espaco(1), paddingBottom: espaco(1) },
  // Linha de 44 + 12 em cima e embaixo = 68 px; a logo começa na mesma coluna dos ícones do menu.
  marca: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE + espaco(3), paddingVertical: espaco(1.5), paddingLeft: espaco(1.5), paddingRight: espaco(0.5) },
  // A logo larga ocupa o que sobra ao lado dos ícones do topo.
  caixaLogoLarga: { flex: 1, minWidth: 0 },
  logoLarga: { width: '100%', maxWidth: 200, height: 44 },
  nomeMenu: { flexShrink: 1, fontFamily: fontes.semi, fontSize: 15, lineHeight: 20 },
  nomeMetal: { fontSize: 18, lineHeight: 22, letterSpacing: 1 },
  itemLateral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.5),
    minHeight: ALVO_TOQUE,
    paddingHorizontal: espaco(1.5),
    borderRadius: RAIO_CONTROLE,
  },
  rotuloLateral: { flexShrink: 1, fontSize: 15 },
  // Contagem do menu aberto: pílula neutra à direita, texto principal, contorno `divisor` (a prévia).
  contagem: { marginLeft: 'auto', minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoContagem: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
  indicadorLateral: { position: 'absolute', left: 0, top: '50%', marginTop: -8, width: 3, height: 16, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  indicadorInferior: { position: 'absolute', top: 0, alignSelf: 'center', width: 20, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  // Pílula atrás do ícone na barra inferior: `superficie3` no item ativo.
  pilula: { width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pontoNaPilula: { right: 10, top: 2 },
  inferior: { borderTopWidth: 1 },
  areaInferior: { alignItems: 'center' },
  itensInferiores: { flexDirection: 'row', width: '100%' },
  itemInferior: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 3, paddingVertical: espaco(0.5), paddingHorizontal: 2 },
  rotuloInferior: { fontSize: 12, lineHeight: 16 },
  // Texto grande: largura pelo conteúdo (a palavra inteira cabe) e o que sobra da barra se reparte; a altura cresce com as linhas.
  // Em janela estreita (< 360 px) o item encolhe em vez de sair da tela (shortcut: a palavra mais longa pode cortar ali; trocar se houver telefone assim).
  itemInferiorGrande: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  rotuloInferiorGrande: { textAlign: 'center' },
  // Esticado na largura do item: com `numberOfLines`, nome que não coube vira reticências em vez de vazar do trilho.
  rotuloTrilho: { alignSelf: 'stretch', textAlign: 'center' },
  ponto: { position: 'absolute', right: -5, top: -3, width: 9, height: 9, borderRadius: 5, borderWidth: 1 },
  // À direita do menu, 4 px depois da borda dele (o `left` vem da largura do menu agora).
  dica: { position: 'absolute', flexDirection: 'row', alignItems: 'baseline', gap: espaco(1), paddingHorizontal: espaco(1), paddingVertical: 4, borderRadius: 6, zIndex: 50 },
  textoDica: { fontFamily: fontes.semi, fontSize: 13 },
  // O atalho, depois do nome, mais leve (o mesmo texto da dica a 70%: continua acima de 4,5:1 sobre o fundo dela).
  atalhoDica: { fontFamily: fontes.medio, fontSize: 12, opacity: 0.7 },
  topoTrilho: { alignItems: 'center', marginBottom: espaco(1) },
  logoTrilho: { width: 44, height: 44 },
  inicial: { width: 40, height: 40, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoInicial: { fontFamily: fontes.negrito, fontSize: 18 },
  inicialMenu: { width: 32, height: 32, borderRadius: RAIO_CONTROLE },
  textoInicialMenu: { fontSize: 14 },
});
