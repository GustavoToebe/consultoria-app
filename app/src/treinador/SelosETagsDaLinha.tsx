import { X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { TagDeAluno } from '../api/tipos';
import {
  alvoDoMaisTags, dicaDoMaisTags, lugarDaListaDeTags, rotuloDoMaisTags, tagsEscondidasDaLinha, type Retangulo, type SeloDeExcecao,
} from '../dominio/selosDaLinhaDeAluno';
import { resumoDasTagsNaLinha } from '../dominio/tagsDeAluno';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../tema/tokens';
import { IconeBotao } from '../ui/IconeBotao';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';
import { ChipDeTag } from './tags/ChipDeTag';

/**
 * O desenho do "+N" que vira botão: quando medir, se está aceso (mouse em cima, apertado ou a lista aberta) e se leva o
 * anel do foco do teclado (o anel fica no desenho, não no alvo de 44 px, que cortaria o selo e o nome em cima).
 */
export interface DesenhoDoMaisTags { aoMedir: () => void; aceso: boolean; anel: boolean }

/**
 * Embaixo do nome do aluno: o selo de situação e as tags na MESMA linha, lado a lado (o selo primeiro); se não couberem,
 * quebram para a linha seguinte, nunca um por linha. No máximo duas tags e "+N" (`resumoDasTagsNaLinha`). Os chips são
 * decorativos (o link da linha já os nomeia). Com `mais` (linha-link), o "+N" é o desenho de um botão que fica por cima
 * dele, fora do link (`useMaisTagsDaLinha`); sem `mais` (Selecionar), é só texto com o tooltip e o nome acessível.
 */
export function SelosETagsDaLinha({ selos, tags, mais, prenderMais }: {
  selos: readonly SeloDeExcecao[]; tags: readonly TagDeAluno[]; mais?: DesenhoDoMaisTags; prenderMais?: (el: View | null) => void;
}) {
  const { cores } = useTema();
  if (!selos.length && !tags.length) return null;
  const { visiveis, texto } = resumoDasTagsNaLinha(tags);
  return (
    <View style={estilos.linha}>
      {selos.map((s) => <Selo key={s.texto} texto={s.texto} tipo={s.tipo} />)}
      {visiveis.map((t) => <View key={t.id} aria-hidden><ChipDeTag tag={t} larguraMaxima={140} /></View>)}
      {texto && mais ? (
        // Só o desenho: o botão por cima tem o nome, o foco e o toque.
        <View ref={prenderMais} collapsable={false} aria-hidden importantForAccessibility="no-hide-descendants" onLayout={mais.aoMedir}
          style={[estilos.desenho, {
            borderColor: cores.bordaCampo, backgroundColor: mais.aceso ? cores.sobre : 'transparent',
            outlineColor: cores.anelFoco, outlineStyle: 'solid', outlineWidth: mais.anel ? 2 : 0, outlineOffset: 2,
          }]}>
          <Texto style={estilos.textoDoDesenho}>{texto}</Texto>
        </View>
      ) : texto ? (
        <View ref={comTitulo(dicaDoMaisTags(tags))} accessible accessibilityRole="text" accessibilityLabel={rotuloDoMaisTags(tags) ?? texto}>
          <Selo texto={texto} />
        </View>
      ) : null}
    </View>
  );
}

/** O react-native-web não repassa `title`: vai direto no elemento (só na web; reforço do mouse, nunca o único caminho). */
function comTitulo(dica: string | null) {
  return (el: View | null) => {
    if (dica && Platform.OS === 'web' && el && 'setAttribute' in el && typeof el.setAttribute === 'function') el.setAttribute('title', dica);
  };
}

/**
 * O "+N" acionável da linha-link da lista de alunos. O link da linha é um `<a>` e não pode ter botão dentro, então o
 * desenho fica no link (`desenho`, para `SelosETagsDaLinha mais`) e o botão vai no `children` da `LinhaDaLista`, irmão do
 * link, por cima do desenho: a `capa` cobre a linha inteira, e a posição do desenho medida em relação a ela não muda com a
 * rolagem nem com a entrada em cascata. Mede de novo quando o desenho ou a linha mudam de tamanho; antes da primeira
 * medida o botão não existe (senão ficaria no canto, por cima das iniciais). Tab, Enter, Espaço, clique e toque abrem a
 * lista das outras tags (`ListaDeTagsAncorada`); Esc, tocar fora ou tocar de novo fecham, e o foco volta ao "+N".
 */
export function useMaisTagsDaLinha(tags: readonly TagDeAluno[], nomeDoAluno: string): {
  desenho?: DesenhoDoMaisTags; prender: (el: View | null) => void; sobreposicao: ReactNode;
} {
  const desenho = useRef<View>(null);
  const capa = useRef<View>(null);
  const gatilho = useRef<View>(null);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [sobre, setSobre] = useState(false);
  const [anel, setAnel] = useState(false);
  const [aberta, setAberta] = useState<Retangulo | null>(null);
  const rotulo = rotuloDoMaisTags(tags);
  const prender = (el: View | null) => { desenho.current = el; };
  if (!rotulo) return { prender, sobreposicao: null };

  const medir = () => {
    const d = desenho.current;
    const c = capa.current;
    if (!d || !c) return;
    d.measureInWindow((dx, dy, dw, dh) => c.measureInWindow((cx, cy) => {
      const novo = alvoDoMaisTags({ x: dx - cx, y: dy - cy, w: dw, h: dh }, ALVO_TOQUE);
      setAlvo((antes) => (antes && novo && antes.x === novo.x && antes.y === novo.y && antes.w === novo.w && antes.h === novo.h ? antes : novo));
    }));
  };
  const abrir = () => desenho.current?.measureInWindow((x, y, w, h) => setAberta({ x, y, w, h }));
  const fechar = () => {
    setAberta(null);
    // O Modal sai do DOM e o foco cairia no corpo da página: volta ao "+N".
    if (Platform.OS === 'web') setTimeout(() => (gatilho.current as unknown as HTMLElement | null)?.focus?.(), 0);
  };
  const dica = dicaDoMaisTags(tags);

  const sobreposicao = (
    <View ref={capa} collapsable={false} onLayout={medir} style={estilos.capa}>
      {alvo ? (
        <Pressable
          ref={(el) => { gatilho.current = el; comTitulo(dica)(el); }}
          accessibilityRole="button"
          accessibilityLabel={rotulo}
          aria-haspopup="dialog"
          aria-expanded={!!aberta}
          accessibilityState={{ expanded: !!aberta }}
          onPress={abrir}
          onHoverIn={() => setSobre(true)}
          onHoverOut={() => setSobre(false)}
          onPressIn={() => setSobre(true)}
          onPressOut={() => setSobre(false)}
          // Só o foco do teclado (`:focus-visible`) acende o anel; o do clique, não.
          onFocus={() => setAnel(Platform.OS === 'web' && !!(gatilho.current as unknown as HTMLElement | null)?.matches?.(':focus-visible'))}
          onBlur={() => setAnel(false)}
          style={[estilos.alvo, SEM_ANEL_NA_WEB, { left: alvo.x, top: alvo.y, width: alvo.w, height: alvo.h }]} />
      ) : null}
      {aberta ? <ListaDeTagsAncorada ancora={aberta} tags={tagsEscondidasDaLinha(tags)} nomeDoAluno={nomeDoAluno} aoFechar={fechar} /> : null}
    </View>
  );
  return { desenho: { aoMedir: medir, aceso: sobre || !!aberta, anel }, prender, sobreposicao };
}

/** Estilo em linha (vale por cima do `:focus-visible` do `global.css`): o anel do "+N" é desenhado no desenho. */
const SEM_ANEL_NA_WEB = Platform.OS === 'web' ? { outlineWidth: 0 } : null;
const LARGURA_DA_LISTA = 240;
const FOLGA = 16;

/**
 * As outras tags, um chip por linha (as mesmas cores), numa caixa pequena colada ao "+N", sem escurecer a tela: o padrão
 * do resumo da Agenda (`CartaoAncorado`). `Modal` transparente (a trava de foco e o Esc são dele), o fundo inteiro fecha
 * no toque (também em cima do "+N": tocar de novo fecha) e o X fecha para quem usa leitor de tela no celular.
 */
function ListaDeTagsAncorada({ ancora, tags, nomeDoAluno, aoFechar }: { ancora: Retangulo; tags: readonly TagDeAluno[]; nomeDoAluno: string; aoFechar: () => void }) {
  const { cores, bordas } = useTema();
  const { width, height } = useWindowDimensions();
  const [altura, setAltura] = useState(0);
  const caixa = useRef<View>(null);
  const largura = Math.min(LARGURA_DA_LISTA, width - 2 * FOLGA);
  const lugar = lugarDaListaDeTags(ancora, { largura, altura }, { largura: width, altura: height }, FOLGA);
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    // O foco entra no X (o único controle): o anel fica nele, e não em volta da caixa inteira.
    const relogio = setTimeout(() => {
      const el = caixa.current as unknown as HTMLElement | null;
      (el?.querySelector?.<HTMLElement>('[role="button"], button') ?? el)?.focus?.();
    }, 0);
    return () => clearTimeout(relogio);
  }, []);
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessible={false} focusable={false} tabIndex={-1} />
      <View ref={caixa} role="dialog" aria-modal aria-label={`Outras tags de ${nomeDoAluno}`} tabIndex={-1} accessibilityViewIsModal
        onLayout={(e) => setAltura(Math.round(e.nativeEvent.layout.height))}
        style={[estilos.lista, {
          left: lugar.esquerda, top: lugar.topo, width: largura, maxHeight: height - 2 * FOLGA,
          backgroundColor: cores.superficie2, borderColor: cores.divisor, borderWidth: bordas.bloco,
        }]}>
        <View style={estilos.topoDaLista}>
          <Texto variante="rotulo">Outras tags</Texto>
          <IconeBotao Icone={X} compacto rotulo="Fechar a lista de tags" aoTocar={aoFechar} />
        </View>
        {/* Muitas tags: só a lista rola (a caixa nunca passa da janela). */}
        <ScrollView style={estilos.rolagem}>
          <View role="list" style={estilos.chips}>
            {tags.map((t) => <View key={t.id} role="listitem"><ChipDeTag tag={t} larguraMaxima={largura - 2 * espaco(1.5)} /></View>)}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  // A pílula dos chips (22 px) com contorno neutro: parece tocável, sem cor de situação nem de marca.
  desenho: { minHeight: 22, borderWidth: 1, borderRadius: 999, paddingHorizontal: espaco(1), justifyContent: 'center' },
  textoDoDesenho: { fontFamily: fontes.medio, fontSize: 12, lineHeight: 16 },
  capa: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'box-none' },
  alvo: { position: 'absolute', borderRadius: RAIO_CONTROLE },
  // Sem `overflow: hidden`: cortaria o anel de foco do X.
  lista: { position: 'absolute', borderRadius: RAIO, paddingLeft: espaco(1.5), paddingTop: espaco(0.5), paddingBottom: espaco(1.5) },
  // O X fica 8 px para dentro da borda: o anel dele (2 px + 2 de folga) cabe na caixa.
  topoDaLista: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: espaco(1) },
  rolagem: { flexShrink: 1 },
  chips: { gap: espaco(1), alignItems: 'flex-start', paddingRight: espaco(1.5) },
});
