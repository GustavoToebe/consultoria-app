import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { UnidadeAlimento } from '../../api/tipos';
import { numeroDaTela, numeroParaTela } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { UNIDADES } from '../biblioteca/AbaAlimentos';

/** O nome de cada unidade no menu (no campo fica só a sigla). */
const NOME_DA_UNIDADE: Record<UnidadeAlimento, string> = { g: 'Gramas (g)', ml: 'Mililitros (ml)', un: 'Unidades (un)' };
const LARGURA_DO_MENU = 200;
/** O papel ARIA do item com ✓ (o tipo `Role` do RN não o lista; o react-native-web o repassa), como no `MenuDaVisao`. */
const ITEM_DE_ESCOLHA = 'menuitemradio' as unknown as 'menuitem';

interface Ancora { x: number; y: number; w: number; h: number }

/**
 * Quantidade e unidade num campo só, para a tabela de alimentos caber em 1280 (19/11): o número digitado e, dentro da
 * caixa à direita, a sigla com ▾ ("50 g ▾"), que abre o menu das unidades colado a ela. Os nomes acessíveis são os de
 * antes, separados: o campo é "Quantidade" e o botão, "Unidade: g. Escolher.". O erro marca a caixa; o texto dele fica com
 * quem usa (linha inteira abaixo do item).
 */
export function CampoDaQuantidade({ quantidade, unidade, erro, aoMudarQuantidade, aoMudarUnidade }: {
  quantidade: number | null; unidade: UnidadeAlimento; erro: string | null;
  aoMudarQuantidade: (q: number | null) => void; aoMudarUnidade: (u: UnidadeAlimento) => void;
}) {
  const { texto, lido, mudar } = useNumeroDigitado(quantidade, aoMudarQuantidade);
  return (
    <Campo numerico rotulo="Quantidade" rotuloOculto valor={texto} aoMudar={mudar} erroSemTexto keyboardType="decimal-pad" inputMode="decimal"
      erro={erro ?? (lido === undefined ? 'Número inválido.' : null)}
      acao={<MenuDaUnidade unidade={unidade} aoMudar={aoMudarUnidade} />} />
  );
}

// shortcut: cópia do `useNumeroDigitado` de `ui/Campos` (o `CampoNumerico` não repassa `acao` ao `Campo`); trocar pelo
// `CampoNumerico` quando ele ganhar `acao` (sugestão para o design system).
function useNumeroDigitado(valor: number | null, aoMudar: (valor: number | null) => void) {
  const [texto, setTexto] = useState(valor === null ? '' : numeroParaTela(valor, 3));
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    if (numeroDaTela(texto) !== valor) setTexto(valor === null ? '' : numeroParaTela(valor, 3));
  }
  const mudar = (digitado: string) => {
    setTexto(digitado);
    const n = numeroDaTela(digitado);
    if (n !== undefined) {
      setAnterior(n);
      aoMudar(n);
    }
  };
  return { texto, lido: numeroDaTela(texto), mudar };
}

/**
 * A sigla da unidade dentro do campo: botão de menu (Menu Button da APG, no molde do `MenuDaVisao`) que abre colado a ele,
 * com a atual marcada (✓, `menuitemradio`). Abre com o foco na atual; setas dão a volta, Home e End vão às pontas, Enter e
 * Espaço escolhem, Esc e o toque fora fecham, e o foco volta ao botão.
 */
function MenuDaUnidade({ unidade, aoMudar }: { unidade: UnidadeAlimento; aoMudar: (u: UnidadeAlimento) => void }) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<View>(null);
  const itens = useRef<(View | null)[]>([]);
  const aberto = ancora !== null;
  const atual = Math.max(0, UNIDADES.findIndex((u) => u.valor === unidade));

  const abrir = () => botao.current?.measureInWindow((x, y, w, h) => setAncora({ x, y, w, h }));
  const fechar = (depois?: () => void) => {
    setAncora(null);
    if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
    depois?.();
  };
  const escolher = (u: UnidadeAlimento) => fechar(() => { if (u !== unidade) aoMudar(u); });
  const escolherRef = useRef(escolher);
  useEffect(() => { escolherRef.current = escolher; });

  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const relogio = setTimeout(() => (itens.current[atual] as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(relogio);
  }, [aberto, atual]);
  // Teclado (web), na captura do documento: o `Pressable` do react-native-web para a propagação das teclas.
  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => {
      const elementos = itens.current.map((r) => r as unknown as HTMLElement | null);
      const i = elementos.indexOf(document.activeElement as HTMLElement);
      if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
        e.preventDefault();
        e.stopPropagation();
        escolherRef.current(UNIDADES[i].valor);
        return;
      }
      const n = elementos.length;
      const destino = e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowUp' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
      if (destino === null) return;
      e.preventDefault();
      elementos[destino]?.focus();
    };
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, [aberto]);

  const esquerda = ancora ? Math.max(espaco(1), Math.min(ancora.x + ancora.w - LARGURA_DO_MENU, width - LARGURA_DO_MENU - espaco(1))) : 0;
  return (
    <>
      <Pressable ref={botao} collapsable={false} onPress={abrir} accessibilityRole="button" accessibilityLabel={`Unidade: ${unidade}. Escolher.`}
        accessibilityState={{ expanded: aberto }} aria-expanded={aberto} aria-haspopup="menu"
        testID="segmento-da-unidade" style={estilos.botao}>
        {(e) => (
          <>
            {/* O realce fica dentro do contorno do campo (2 px: a borda do foco e do erro), nunca por cima dele (25/11). */}
            <View pointerEvents="none" testID="realce-da-unidade" style={[estilos.realce, { backgroundColor: sobre(e) ? cores.sobre : 'transparent' }]} />
            <View pointerEvents="none" style={[estilos.divisor, { backgroundColor: cores.bordaCampo }]} />
            {/* Numa `View` (posicionada na web): o SVG solto ficava por baixo do realce absoluto. */}
            <View style={estilos.conteudo}>
              <Texto style={[estilos.sigla, { color: cores.texto }]}>{unidade}</Texto>
              <ChevronDown size={14} color={cores.textoSuave} strokeWidth={2.5} />
            </View>
          </>
        )}
      </Pressable>
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu da unidade" />
          <View role="menu" aria-label="Unidade" accessibilityViewIsModal
            style={[estilos.menu, { top: ancora.y + ancora.h + espaco(0.5), left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: bordas.bloco }]}>
            {UNIDADES.map((u, i) => {
              const marcada = u.valor === unidade;
              return (
                <Pressable key={u.valor} ref={(no) => { itens.current[i] = no; }} role={ITEM_DE_ESCOLHA} aria-checked={marcada}
                  accessibilityState={{ checked: marcada }} accessibilityLabel={NOME_DA_UNIDADE[u.valor]} onPress={() => escolher(u.valor)}
                  style={(e) => [estilos.item, sobre(e) && { backgroundColor: cores.sobre }]}>
                  <View style={estilos.marca}>{marcada ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}</View>
                  <Texto style={marcada ? { fontFamily: fontes.semi } : null}>{NOME_DA_UNIDADE[u.valor]}</Texto>
                </Pressable>
              );
            })}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  // O alvo tem 44 de largura (o recuo que o `Campo` reserva para a `acao`) e a altura do campo inteira; o desenho é um
  // segmento do mesmo contorno: divisor fino à esquerda e o realce recuado da borda, com os cantos de dentro.
  botao: { width: ALVO_TOQUE, minHeight: ALVO_TOQUE, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO_CONTROLE },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  realce: { position: 'absolute', top: 2, bottom: 2, right: 2, left: 1, borderTopRightRadius: RAIO_CONTROLE - 2, borderBottomRightRadius: RAIO_CONTROLE - 2 },
  divisor: { position: 'absolute', left: 0, top: espaco(1), bottom: espaco(1), width: 1 },
  sigla: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 20 },
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5) },
  marca: { width: 20, alignItems: 'center' },
});
