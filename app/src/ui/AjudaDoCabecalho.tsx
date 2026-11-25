import { Link, router, usePathname, type Href } from 'expo-router';
import { Info } from 'lucide-react-native';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type PointerEvent, type ViewStyle } from 'react-native';

import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';
import { mesmaTela } from '../dominio/mesmaTela';
import { escalar } from '../dominio/preferencias';
import { lugarDaListaDeTags, type Retangulo } from '../dominio/selosDaLinhaDeAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { useSaidaGuardada } from './GuardaDeSaida';
import { sobre } from './sobre';
import { Texto } from './Texto';
import { useCliqueFora, useTeclado } from './usoWeb';

/** O nome do botão e do balão. */
const ROTULO = 'Sobre esta tela';
const LARGURA_DO_BALAO = 320;
const FOLGA = 16;
/** Mouse: um instante antes de abrir (passar por cima a caminho de outro lugar não pisca o balão) e antes de fechar (o vão até o balão). */
const ABRIR_APOS = 250;
const FECHAR_APOS = 200;
/** Altura de linha do título do cabeçalho (`tipografia.titulo`): o alvo de 44 px se centra nela, sem crescer a linha. */
const LINHA_DO_TITULO = 32;

/** Quem abriu: o mouse fecha ao sair, o teclado ao perder o foco; o toque (e o clique) só fecha com outro toque, fora ou Esc. */
type Origem = 'mouse' | 'teclado' | 'toque';

/** Na web o `ref` de uma `View` é o elemento do DOM; aqui sem conversão às cegas. */
function elementoDaWeb(no: unknown): HTMLElement | null {
  return typeof HTMLElement !== 'undefined' && no instanceof HTMLElement ? no : null;
}

/**
 * O ⓘ "Sobre esta tela" logo depois do título do cabeçalho: guarda a descrição da tela, que sai da tela (pedido de 25/11).
 * Abre com o mouse em cima (com um instante de espera), no foco do teclado (`:focus-visible`; o foco do clique não) e no
 * toque ou clique (alterna). Esc, tocar fora, o mouse sair (só o que o mouse abriu) e o foco sair (o que o teclado ou o
 * toque abriu) fecham; o Esc devolve o foco ao ⓘ. O mouse pode entrar no balão (WCAG 1.4.13) e o Tab passa do ⓘ ao
 * "Saiba mais", que vem logo depois no DOM. Sem animação (as caixas ancoradas do app abrem sem ela), então o "Reduzir
 * movimento" já vale. A descrição é a descrição acessível do ⓘ (`aria-describedby` na web, `accessibilityHint` no
 * celular); o texto do balão fica fora da leitura para não ser lido duas vezes.
 * Web: o balão mora ao lado do ⓘ (`position: absolute`), sempre no DOM e oculto quando fechado, para a descrição valer.
 * Celular: um `Modal` transparente ancorado (o padrão das tags da linha, `ListaDeTagsAncorada`); tocar fora fecha.
 */
export function AjudaDoCabecalho({ texto, artigo, aoMudar }: {
  texto: string;
  artigo: Href | null;
  /** Avisa quem desenha o cabeçalho que o balão abriu ou fechou (ele sobe por cima da barra grudada dos editores). */
  aoMudar?: (aberto: boolean) => void;
}) {
  const { cores, bordas, fatorTexto } = useTema();
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const idDoBalao = useId();
  const idDoTexto = useId();
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [ancora, setAncora] = useState<Retangulo | null>(null);
  const envolve = useRef<View>(null);
  const botao = useRef<View>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O Esc devolve o foco ao ⓘ: esse foco (visível, depois de uma tecla) não pode reabrir o balão.
  const devolvendo = useRef(false);
  const aberto = origem !== null && ancora !== null;

  const limparRelogio = () => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
  };
  useEffect(() => limparRelogio, []);

  const abrir = (quem: Origem) => {
    limparRelogio();
    botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }));
    setOrigem(quem);
    aoMudar?.(true);
  };
  const fechar = (devolverFoco = false) => {
    limparRelogio();
    setOrigem(null);
    aoMudar?.(false);
    if (!devolverFoco) return;
    devolvendo.current = true;
    botao.current?.focus();
    devolvendo.current = false;
  };

  useTeclado(web && aberto, ({ key }) => {
    if (key !== 'Escape') return undefined;
    fechar(origem !== 'mouse');
    return true;
  });
  useCliqueFora(envolve, web && aberto, () => fechar());

  // shortcut: a posição é medida ao abrir; mudar o tamanho da janela com o balão aberto não a refaz, trocar se incomodar.
  const largura = Math.min(LARGURA_DO_BALAO, width - 2 * FOLGA);
  const conteudo = (
    <>
      <View id={web ? idDoTexto : undefined} aria-hidden={web} importantForAccessibility={web ? 'no-hide-descendants' : 'auto'}>
        <Texto>{texto}</Texto>
      </View>
      {artigo ? <SaibaMais href={artigo} aoTocar={() => fechar()} /> : null}
    </>
  );
  const caixa = { width: largura, backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco };

  // O alvo de 44 px centrado na primeira linha do título, com margens negativas: o cabeçalho não fica mais alto.
  const meio = (escalar(LINHA_DO_TITULO, fatorTexto) - ALVO_TOQUE) / 2;
  const doMouse = web ? {
    onPointerEnter: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'mouse') return;
      limparRelogio();
      if (!origem) relogio.current = setTimeout(() => abrir('mouse'), ABRIR_APOS);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.nativeEvent.pointerType !== 'mouse') return;
      limparRelogio();
      if (!origem) return;
      if (origem === 'mouse') relogio.current = setTimeout(() => fechar(), FECHAR_APOS);
    },
    // O foco que sai do ⓘ para o "Saiba mais" fica dentro: só fecha quando vai para fora do envoltório.
    onBlur: () => setTimeout(() => {
      const el = elementoDaWeb(envolve.current);
      if (el && !el.contains(document.activeElement) && (origem === 'teclado' || origem === 'toque')) fechar();
    }, 0),
  } : {};

  return (
    <View ref={envolve} collapsable={false} style={[estilos.envolve, { marginVertical: meio }, aberto && estilos.porCima]} {...doMouse}>
      <Pressable
        ref={botao}
        accessibilityRole="button"
        accessibilityLabel={ROTULO}
        accessibilityHint={web ? undefined : texto}
        aria-describedby={web ? idDoTexto : undefined}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={web ? idDoBalao : undefined}
        accessibilityState={{ expanded: aberto }}
        onPress={() => (aberto ? fechar() : abrir('toque'))}
        onFocus={() => {
          if (devolvendo.current || !elementoDaWeb(botao.current)?.matches(':focus-visible')) return;
          if (aberto) setOrigem('teclado');
          else abrir('teclado');
        }}
        style={estilos.alvo}>
        {(estado) => (
          <View style={[estilos.desenho, { backgroundColor: sobre(estado) || aberto ? cores.sobreNaFaixa : 'transparent' }]}>
            <Info size={18} color={aberto ? cores.texto : cores.textoSuave} strokeWidth={2} />
          </View>
        )}
      </Pressable>
      {web ? (
        <View id={idDoBalao} role="dialog" aria-label={ROTULO}
          style={aberto && ancora
            ? [estilos.balao, caixa, { left: lugarDaListaDeTags(ancora, { largura, altura: 0 }, { largura: width, altura: height }, FOLGA).esquerda - ancora.x }]
            : estilos.oculto}>
          {conteudo}
        </View>
      ) : aberto && ancora ? (
        <BalaoNoCelular ancora={ancora} largura={largura} estilo={caixa} aoFechar={() => fechar()}>{conteudo}</BalaoNoCelular>
      ) : null}
    </View>
  );
}

/** Celular: `Modal` transparente, fundo que fecha no toque (também em cima do ⓘ) e o balão abaixo dele, dentro da janela. */
function BalaoNoCelular({ ancora, largura, estilo, aoFechar, children }: {
  ancora: Retangulo; largura: number; estilo: ViewStyle; aoFechar: () => void; children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const [altura, setAltura] = useState(0);
  const lugar = lugarDaListaDeTags(ancora, { largura, altura }, { largura: width, altura: height }, FOLGA, 0);
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar" />
      <View role="dialog" aria-label={ROTULO} accessibilityViewIsModal onLayout={(e) => setAltura(Math.round(e.nativeEvent.layout.height))}
        style={[estilos.balao, estilo, { left: lugar.esquerda, top: lugar.topo, maxHeight: height - 2 * FOLGA }]}>
        {children}
      </View>
    </Modal>
  );
}

/**
 * "Saiba mais": o link de texto do app (`LinkTexto`), com o fechar do balão antes de sair. A mesma guarda de saída:
 * com alteração pendente pergunta antes; Ctrl+clique abre outra guia e o balão fecha do mesmo jeito.
 */
function SaibaMais({ href, aoTocar }: { href: Href; aoTocar: () => void }) {
  const { cores } = useTema();
  const caminho = usePathname();
  const { confirmar, pendente } = useSaidaGuardada();
  return (
    <Link href={href} accessibilityRole="link" style={estilos.alvoDoLink}
      onPress={(clique: CliqueDoNavegador & { preventDefault?: () => void }) => {
        aoTocar();
        if (mesmaTela(caminho, href)) {
          clique.preventDefault?.();
          return;
        }
        if (!pendente() || deixarParaONavegador(clique)) return;
        clique.preventDefault?.();
        confirmar(() => router.navigate(href));
      }}>
      <Texto style={[estilos.link, { color: cores.texto }]}>Saiba mais</Texto>
    </Link>
  );
}

const estilos = StyleSheet.create({
  envolve: { position: 'relative', flexShrink: 0 },
  porCima: { zIndex: 10 },
  alvo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  desenho: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  // Logo abaixo do alvo, sem vão: o mouse passa do ⓘ ao balão sem sair do envoltório.
  balao: { position: 'absolute', top: ALVO_TOQUE, borderRadius: RAIO, paddingHorizontal: espaco(2), paddingTop: espaco(1.5), paddingBottom: espaco(1.5), gap: espaco(0.5) },
  oculto: { display: 'none' },
  alvoDoLink: { minHeight: ALVO_TOQUE, paddingVertical: 11, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: -espaco(1) },
  link: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
});
