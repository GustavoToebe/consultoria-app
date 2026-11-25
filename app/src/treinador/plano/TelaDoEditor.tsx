import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, View, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTema } from '../../tema/TemaProvider';
import { espaco, faixaDeLargura, LARGURA_EDITOR, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL } from '../../tema/tokens';
import { duasColunas, larguraDoEditor } from '../../dominio/colunasDoEditor';
import { larguraMaximaDoConteudo, respiroLateralDaTela } from '../../dominio/larguraDoConteudo';
import { RolagemComTopo } from '../../ui/RolagemComTopo';
import { ProvedorDeColunas, ProvedorDeTresColunas } from './ColunasDoEditor';
import { useFundoDaArea } from '../../ui/fundoDaArea';
import { useFaixaDeLargura } from '../../ui/useFaixaDeLargura';
import { Vidro } from '../../ui/Vidro';

interface Props {
  /** O `Cabecalho` da tela (trilha, título, subtítulo): rola junto com o conteúdo. */
  cabecalho: ReactNode;
  /** A barra de ações do editor (`BarraDoEditor`): fica fixa no topo e nunca some ao rolar. */
  barra: ReactNode;
  children: ReactNode;
  largura?: number;
  /**
   * Botões que ficam presos embaixo (a importação em tela inteira: Voltar e Validar sempre à vista). Na web gruda na base
   * da rolagem (`sticky`); no celular nativo fica fora da rolagem, abaixo do conteúdo.
   */
  rodape?: ReactNode;
  /**
   * Editores com lista + inspetor (treino, dieta, mobilidade): mede a largura da tela e, a partir de `LARGURA_DUAS_COLUNAS` de conteúdo, avisa os filhos
   * (`useDuasColunas`) e alarga o conteúdo para `LARGURA_EDITOR_DUAS_COLUNAS` (todo o espaço útil, até `LARGURA_MAXIMA`). O 1º quadro sai em uma coluna.
   */
  colunas?: boolean;
}

// Atalho consciente: larguras do menu repetidas de `ui/Navegacao` (aberto e trilho; o minimizado não entra); se mudarem lá, só o 1º quadro erra.
const MENU_ABERTO = 240;
const MENU_TRILHO = 88;

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native. */
const GRUDADA = { position: 'sticky', top: 0, zIndex: 10 } as unknown as ViewStyle;
const GRUDADA_EMBAIXO = { position: 'sticky', bottom: 0, zIndex: 10 } as unknown as ViewStyle;

/**
 * Base dos editores (plano do aluno, modelo e questionário; revisão de telas de 19/10): a mesma `Tela`, mas com a barra
 * de ações sempre à vista. Antes Salvar/Validar/Publicar ficavam num cartão no topo e sumiam ao rolar um treino de oito
 * sessões. Na web a barra vem logo depois do cabeçalho e gruda no topo da rolagem (`sticky`); no celular nativo, sem
 * `sticky`, ela fica fora da rolagem, acima do conteúdo.
 */
export function TelaDoEditor({ cabecalho, barra, children, largura = LARGURA_EDITOR, rodape, colunas }: Props) {
  const { cores, preferencias } = useTema();
  // Medida na raiz, que acompanha a janela: o `View` do conteúdo tem `maxWidth` e mediria a si mesmo (a tela oscilaria).
  const { largura: larguraMedida, faixa, aoMedir } = useFaixaDeLargura();
  // Até a medida chegar, a janela menos o menu lateral: sem isto o 1º quadro saía em uma coluna e piscava (~90 ms) em 1280 e 1440.
  const janela = useWindowDimensions().width;
  const estimada = janela - (janela >= LARGURA_MENU_EXPANDIDO ? MENU_ABERTO : janela >= LARGURA_MENU_LATERAL ? MENU_TRILHO : 0);
  const duas = !!colunas && duasColunas((larguraMedida > 0 ? larguraMedida : estimada) - 2 * espaco(2));
  const faixaEfetiva = larguraMedida > 0 ? faixa : faixaDeLargura(estimada);
  const tres = duas && faixaEfetiva === 'ultralarga' && preferencias.larguraConteudo === 'AUTOMATICA';
  const larguraUtil = larguraMaximaDoConteudo(duas ? larguraDoEditor(true) : largura, preferencias.larguraConteudo);
  const estiloLargura = larguraUtil === undefined ? undefined : { maxWidth: larguraUtil };
  // A mesma faixa do `tres` (estimada até a medida chegar): só com a medida, a ultralarga abria com 16 px de recuo e não 48.
  const recuoLateral = respiroLateralDaTela(faixaEfetiva) ?? espaco(2);
  const web = Platform.OS === 'web';
  const barraGrudada = useRef<View>(null);
  useEffect(() => (web ? semFocoDebaixoDaBarra(barraGrudada.current as unknown as HTMLElement | null) : undefined), [web]);
  const fundo = useFundoDaArea();
  // A altura da barra grudada (web): ela quebra em duas linhas em 1280 (Validar, Salvar, Publicar), e o inspetor grudado
  // embaixo dela (`useFixoAbaixoDaBarra`) precisa da medida, não de um topo fixo.
  const [alturaDaBarra, setAlturaDaBarra] = useState<number | null>(null);
  const bordaDaBarra = { borderColor: cores.borda };
  const fundoDaBarra = { backgroundColor: fundo, ...bordaDaBarra };
  return (
    <ContextoDaBarra.Provider value={alturaDaBarra}>
    <ProvedorDeColunas value={duas}>
    <ProvedorDeTresColunas value={tres}>
    <SafeAreaView edges={['top']} style={[estilos.raiz, { backgroundColor: fundo }]} onLayout={aoMedir}>
      <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!web ? <View style={[estilos.barraFora, fundoDaBarra, { paddingHorizontal: recuoLateral }]}><View style={[estilos.largura, estiloLargura]}>{barra}</View></View> : null}
        <RolagemComTopo preencher contentContainerStyle={[estilos.rolagem, { paddingHorizontal: recuoLateral }]}>
          <View style={[estilos.conteudo, estiloLargura]}>
            {cabecalho}
            {/* Na web o conteúdo passa por baixo das barras grudadas: vidro (D11). No nativo elas ficam fora da rolagem, sólidas. */}
            {web ? <Vidro ref={barraGrudada} nativeID={ID_DA_BARRA} onLayout={(e) => setAlturaDaBarra(e.nativeEvent.layout.height)} estilo={[GRUDADA, estilos.barraGrudada, bordaDaBarra, { marginHorizontal: -recuoLateral, paddingHorizontal: recuoLateral }]}>{barra}</Vidro> : null}
            {children}
            {web && rodape ? <Vidro estilo={[GRUDADA_EMBAIXO, estilos.rodapeGrudado, bordaDaBarra, { marginHorizontal: -recuoLateral, paddingHorizontal: recuoLateral }]}>{rodape}</Vidro> : null}
          </View>
        </RolagemComTopo>
        {!web && rodape ? <View style={[estilos.rodapeFora, fundoDaBarra, { paddingHorizontal: recuoLateral }]}><View style={[estilos.largura, estilos.linhaDoRodape, estiloLargura]}>{rodape}</View></View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ProvedorDeTresColunas>
    </ProvedorDeColunas>
    </ContextoDaBarra.Provider>
  );
}

const ContextoDaBarra = createContext<number | null>(null);

/**
 * Web: o estilo da coluna que gruda logo abaixo da barra do editor (o inspetor do treino e da dieta, o índice do
 * questionário): topo = altura medida da barra + 16 px, e altura máxima até o fim da janela. Antes o topo era fixo em 80 px,
 * a altura da barra em uma linha; em 1280 ela quebra em duas (~122 px) e cobria o cabeçalho do exercício ("Trocar
 * exercício" cortado). Até a medida chegar vale o topo antigo. No nativo não há barra grudada: `undefined`.
 */
export function useFixoAbaixoDaBarra(): ViewStyle | undefined {
  const altura = useContext(ContextoDaBarra);
  const { height } = useWindowDimensions();
  if (Platform.OS !== 'web') return undefined;
  const topo = altura === null ? espaco(10) : altura + espaco(2);
  return { position: 'sticky', top: topo, maxHeight: height - topo - espaco(2) } as unknown as ViewStyle;
}

/**
 * A coluna grudada abaixo da barra, para quem monta a `TelaDoEditor` (o hook só lê a medida dentro dela). `rola`: rola por
 * dentro quando passa da janela (o resumo do treino e o total do dia da dieta, por cima do conteúdo que passa embaixo).
 */
export function FixoAbaixoDaBarra({ style, rola = false, ...resto }: ViewProps & { rola?: boolean }) {
  const fixo = useFixoAbaixoDaBarra();
  const rolagem = fixo && rola ? ({ zIndex: 1, overflowY: 'auto' } as unknown as ViewStyle) : null;
  return <View {...resto} style={[style, fixo, rolagem]} />;
}

/** Id no DOM (web) da barra grudada: `mostrarAbaixoDaBarra` e o índice do questionário medem a altura dela. */
export const ID_DA_BARRA = 'barra-do-editor';

/**
 * Web: se o topo do elemento `id` está fora da tela ou escondido sob a barra grudada, rola até ele ficar logo abaixo
 * da barra; se já está à vista, não mexe. Serve ao inspetor das duas colunas (escolher um item no fim de uma lista longa
 * deixava o detalhe começando fora da tela) e ao "Exercício aberto" do celular (o `rolarAte` da rolagem não conhece a
 * barra e deixava o nome do exercício embaixo dela). Sem animação (nada a reduzir para o movimento reduzido).
 * `forcar`: rola mesmo com o topo à vista, para o item recém-criado (refeição nova) não ficar com o campo cortado na borda de baixo.
 * shortcut: no celular nativo não faz nada (lá não há duas colunas com barra grudada); trocar por `rolarAte` se houver.
 */
export function mostrarAbaixoDaBarra(id: string, forcar = false): void {
  if (Platform.OS !== 'web') return;
  requestAnimationFrame(() => {
    const alvo = document.getElementById(id);
    const barra = document.getElementById(ID_DA_BARRA);
    if (!alvo || !barra) return;
    const topo = alvo.getBoundingClientRect().top;
    if (!forcar && topo >= barra.getBoundingClientRect().bottom && topo < window.innerHeight) return;
    // A conta na mão, na rolagem da barra: `scrollIntoView` com `scroll-margin-top` deixava o alvo no topo, sob a barra,
    // quando um ancestral tem `overflow: hidden` (o cartão da sessão no celular).
    let rolagem = barra.parentElement;
    while (rolagem && !/(auto|scroll)/.test(getComputedStyle(rolagem).overflowY)) rolagem = rolagem.parentElement;
    if (!rolagem) return;
    // A base da barra depois de rolar: grudada (`top: 0`) no topo da rolagem. Com a página no início a barra ainda está
    // abaixo do cabeçalho, e medir a posição de agora deixava o alvo ~96 px abaixo dela.
    const baseGrudada = rolagem.getBoundingClientRect().top + barra.offsetHeight;
    rolagem.scrollTop += topo - baseGrudada - espaco(1);
  });
}

/**
 * Web: o campo que ganha foco (Tab, Shift+Tab, foco por script) por baixo da barra grudada vem para o meio da tela
 * (WCAG 2.4.11, foco não encoberto). O navegador só rola o necessário para a borda, e a borda de cima fica sob a barra.
 * shortcut: o certo seria `scroll-padding-top` na rolagem de `ui/RolagemComTopo`, peça compartilhada fora deste escopo.
 */
function semFocoDebaixoDaBarra(barra: HTMLElement | null): (() => void) | undefined {
  if (!barra) return undefined;
  // Foco vindo do ponteiro (clique num controle meio coberto pela barra) não rola: rolar entre o apertar e o soltar tirava o
  // controle de baixo do ponteiro e o clique se perdia (a lista da "Técnica da série" não abria).
  let apertando = false;
  const aoApertar = () => { apertando = true; };
  const aoSoltar = () => { apertando = false; };
  const aoFocar = (e: FocusEvent) => {
    if (apertando) return;
    const alvo = e.target as HTMLElement | null;
    // Só o conteúdo do editor (irmão da barra); folha e painel em portal ficam de fora.
    if (!alvo || barra.contains(alvo) || !barra.parentElement?.contains(alvo)) return;
    if (alvo.getBoundingClientRect().top < barra.getBoundingClientRect().bottom) alvo.scrollIntoView({ block: 'center' });
  };
  document.addEventListener('pointerdown', aoApertar, true);
  document.addEventListener('pointerup', aoSoltar, true);
  document.addEventListener('pointercancel', aoSoltar, true);
  document.addEventListener('focusin', aoFocar);
  return () => {
    document.removeEventListener('pointerdown', aoApertar, true);
    document.removeEventListener('pointerup', aoSoltar, true);
    document.removeEventListener('pointercancel', aoSoltar, true);
    document.removeEventListener('focusin', aoFocar);
  };
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  rolagem: { flexGrow: 1, padding: espaco(2) },
  conteudo: { width: '100%', alignSelf: 'center', gap: espaco(3) },
  largura: { width: '100%', alignSelf: 'center' },
  // A barra cobre também o recuo lateral da rolagem: o conteúdo que passa por baixo não aparece nas beiradas.
  barraGrudada: { marginHorizontal: -espaco(2), paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderBottomWidth: 1, marginTop: -espaco(1.5) },
  barraFora: { paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderBottomWidth: 1 },
  rodapeGrudado: {
    marginHorizontal: -espaco(2), paddingHorizontal: espaco(2), paddingVertical: espaco(1.5), borderTopWidth: 1, marginBottom: -espaco(2),
    flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: espaco(1),
  },
  rodapeFora: { paddingHorizontal: espaco(2), paddingVertical: espaco(1), borderTopWidth: 1 },
  linhaDoRodape: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: espaco(1) },
});
