import { ArrowUp } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** Quem está dentro de uma rolagem registra pontos (`AlvoDeRolagem`) e pede para rolar até eles. */
export interface Rolagem {
  registrar: (chave: string, vista: View | null) => void;
  /** Rola até o primeiro da lista que estiver na tela (depois de um instante, para a tela redesenhar antes). */
  rolarAte: (chaves: readonly string[]) => void;
}

const RolagemContexto = createContext<Rolagem | null>(null);

/** Sem rolagem por perto (teste, tela sem `Tela`), `rolarAte` não faz nada. */
export function useRolagem(): Rolagem {
  return useContext(RolagemContexto) ?? SEM_ROLAGEM;
}
const SEM_ROLAGEM: Rolagem = { registrar: () => undefined, rolarAte: () => undefined };

/** Rolagem (px) a partir da qual aparece o botão de voltar ao início. */
const LIMITE_TOPO = 400;
/** Movimento mínimo (px) para contar como rolar para cima ou para baixo (ignora o tremor do dedo). */
const DIFERENCA_MINIMA = 4;
/** Espaço no fim da rolagem para o botão flutuante não cobrir o último item. */
const FOLGA_DO_BOTAO = espaco(2) + ALVO_TOQUE + espaco(1);

/**
 * Web: reserva a faixa da barra de rolagem mesmo quando ela não aparece (`scrollbar-gutter: stable`). Sem isto, perto do limite de
 * altura a barra surge e tira ~15 px de largura; o que tem altura proporcional à largura (a capa 16:9 do vídeo, medida por `onLayout`
 * na `Grade`) fica mais baixo, o conteúdo passa a caber, a barra some, a largura volta e o ciclo recomeça: a tela piscava. Com a faixa
 * fixa a largura útil não depende de a barra existir. Barra overlay (celular, macOS) não ocupa espaço e não muda nada.
 * Só nas telas (`preencher`; numa folha a faixa vazia deixaria 32 px à direita contra 16 à esquerda do conteúdo) e a partir de
 * `LARGURA_MENU_LATERAL`: abaixo disso o aparelho é de toque (barra sobreposta) e 15 px a menos quebrariam as barras de 390 px.
 * shortcut: folha com altura que depende da largura e perto da altura máxima ainda pode piscar; nenhuma conhecida, trocar quando aparecer.
 */
const FAIXA_DA_BARRA: StyleProp<ViewStyle> = Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as ViewStyle) : undefined;

/**
 * Para onde rolar (px) a fim de o campo focado ficar inteiro na janela, com `folga` de ar; `null` se já está visível. Campo mais
 * alto que a janela fica com o topo à mostra. Existe porque, com o teclado aberto, a janela da rolagem encolhe depois de o
 * foco já ter entrado e nada rola o campo de volta para cima do teclado.
 */
export function deslocamentoParaMostrar(campo: { topo: number; altura: number }, deslocamento: number, janela: number, folga: number): number | null {
  if (janela <= 0) return null;
  const fim = campo.topo + campo.altura + folga;
  if (fim > deslocamento + janela) return Math.max(0, Math.min(fim - janela, campo.topo - folga));
  if (campo.topo - folga < deslocamento) return Math.max(0, campo.topo - folga);
  return null;
}

interface Props {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Ocupa a altura toda do pai (telas); sem isto encolhe junto com o conteúdo (folhas com altura máxima). */
  preencher?: boolean;
}

/**
 * ScrollView com o botão flutuante "Voltar ao início da página", usado nas telas e nas folhas. O botão só aparece
 * depois de 400 px e enquanto a pessoa rola para cima (quem rola para baixo está lendo ou marcando séries, e o botão
 * parado no canto cobria o ✓ da série e a seta do último item).
 */
export function RolagemComTopo({ children, contentContainerStyle, preencher }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef<ScrollView>(null);
  const [longe, setLonge] = useState(false);
  const area = useRef<View>(null);
  const deslocamento = useRef(0);
  const alvos = useRef(new Map<string, View>());
  // A folga só existe quando o botão pode aparecer (dá para rolar mais de `LIMITE_TOPO`). Antes valia sempre: numa folha
  // ou tela curta sobravam 68 px vazios embaixo do último item, acima do rodapé (evidência 05 do guia de 10/11).
  // `conteudo` é a altura sem a folga, para a decisão não oscilar ao pôr ou tirar a folga.
  const medidas = useRef({ conteudo: 0, janela: 0, folga: false });
  const [folga, setFolga] = useState(false);
  const conferirFolga = useCallback(() => {
    const m = medidas.current;
    const precisa = m.conteudo - m.janela > LIMITE_TOPO;
    if (precisa === m.folga) return;
    m.folga = precisa;
    setFolga(precisa);
  }, []);
  const registrar = useCallback((chave: string, vista: View | null) => {
    if (vista) alvos.current.set(chave, vista);
    else alvos.current.delete(chave);
  }, []);
  const rolarAte = useCallback((chaves: readonly string[]) => {
    setTimeout(() => {
      const alvo = chaves.map((c) => alvos.current.get(c)).find((v) => v !== undefined);
      alvo?.measureInWindow((_x, y) => area.current?.measureInWindow((_sx, sy) => {
        rolagem.current?.scrollTo({ y: Math.max(0, deslocamento.current + y - sy - espaco(2)), animated: !reduzido });
      }));
    }, 80);
  }, [reduzido]);
  const contexto = useMemo(() => ({ registrar, rolarAte }), [registrar, rolarAte]);
  // Com o teclado aberto a janela encolhe (KeyboardAvoidingView da `Tela` e da `Folha`): traz o campo focado de volta à vista.
  // Fora desta rolagem (campo de uma folha por cima da tela) o `measureLayout` falha e nada acontece.
  const mostrarCampoFocado = useCallback(() => {
    const campo = TextInput.State.currentlyFocusedInput();
    const interior = rolagem.current?.getInnerViewNode?.();
    if (!campo || interior == null) return;
    campo.measureLayout(interior, (_x, topo, _largura, altura) => {
      const destino = deslocamentoParaMostrar({ topo, altura }, deslocamento.current, medidas.current.janela, espaco(2));
      if (destino !== null) rolagem.current?.scrollTo({ y: destino, animated: !reduzido });
    }, () => undefined);
  }, [reduzido]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    // Se a janela não encolher (ou encolher antes do evento), o `onLayout` não basta: confere de novo depois do ajuste.
    const inscricao = Keyboard.addListener('keyboardDidShow', () => {
      clearTimeout(espera);
      espera = setTimeout(mostrarCampoFocado, 120);
    });
    return () => { clearTimeout(espera); inscricao.remove(); };
  }, [mostrarCampoFocado]);
  return (
    <RolagemContexto.Provider value={contexto}>
    <View ref={area} style={[estilos.area, preencher && estilos.preencher]}>
      <ScrollView
        ref={rolagem}
        style={preencher && width >= LARGURA_MENU_LATERAL ? FAIXA_DA_BARRA : undefined}
        contentContainerStyle={[contentContainerStyle, folga && estilos.fim]}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => {
          medidas.current.janela = e.nativeEvent.layout.height;
          conferirFolga();
          if (Platform.OS !== 'web' && Keyboard.isVisible()) mostrarCampoFocado();
        }}
        onContentSizeChange={(_largura, altura) => {
          medidas.current.conteudo = altura - (medidas.current.folga ? FOLGA_DO_BOTAO : 0);
          conferirFolga();
        }}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const anterior = deslocamento.current;
          deslocamento.current = y;
          if (y <= LIMITE_TOPO) setLonge(false);
          else if (y < anterior - DIFERENCA_MINIMA) setLonge(true);
          else if (y > anterior + DIFERENCA_MINIMA) setLonge(false);
        }}>
        {children}
      </ScrollView>
      {longe ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início da página"
          onPress={() => rolagem.current?.scrollTo({ y: 0, animated: !reduzido })}
          style={({ pressed }) => [estilos.botao, { backgroundColor: cores.superficie, borderColor: cores.bordaCampo, opacity: pressed ? 0.7 : 1 }]}>
          <ArrowUp size={20} color={cores.texto} />
        </Pressable>
      ) : null}
    </View>
    </RolagemContexto.Provider>
  );
}

const estilos = StyleSheet.create({
  area: { flexShrink: 1, minHeight: 0 },
  preencher: { flex: 1 },
  // Espaço no fim da rolagem: o botão flutuante nunca cobre o último botão ou item da tela.
  fim: { paddingBottom: FOLGA_DO_BOTAO },
  botao: { position: 'absolute', right: espaco(2), bottom: espaco(2), width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
