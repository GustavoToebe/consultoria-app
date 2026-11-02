import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ATALHOS_DAS_VISOES, ROTULOS_DAS_VISOES, VISOES_DO_CALENDARIO, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  visao: VisaoDoCalendario;
  aoMudar: (v: VisaoDoCalendario) => void;
  /** Avisa a tela que o menu está aberto (os atalhos D/W/M/Y esperam ele fechar). */
  aoMudarAberto?: (aberto: boolean) => void;
}

interface Ancora { x: number; y: number; w: number; h: number }

const LARGURA_DO_MENU = 200;
/**
 * O papel ARIA do item com ✓ (escolha única dentro do menu). O tipo `Role` do React Native não o lista, mas o
 * react-native-web passa o `role` direto ao DOM; no celular vale o `accessibilityState.checked`.
 */
const ITEM_DE_ESCOLHA = 'menuitemradio' as unknown as 'menuitem';

/** A letra do atalho de cada visão ("D", "W", "M", "Y"), invertendo `ATALHOS_DAS_VISOES`. */
const LETRA_DA_VISAO = Object.fromEntries(
  Object.entries(ATALHOS_DAS_VISOES).map(([letra, v]) => [v, letra.toUpperCase()]),
) as Partial<Record<VisaoDoCalendario, string>>;

/**
 * Seletor da visão do calendário no jeito do Google Agenda: um botão "Mês ▾" que abre um menu colado a ele (embaixo,
 * alinhado à direita, sem sair da janela) com Dia, Semana, Mês e Ano e a letra do atalho à direita; a visão atual tem o ✓
 * (`menuitemradio` com `aria-checked`). Abre com o foco na visão atual; na web as setas andam entre os itens (dando a volta),
 * Home e End vão às pontas e Enter ou Espaço escolhem. Fecha com Esc, tocando fora ou escolhendo, e o foco volta ao botão.
 * Mesmo molde do `MenuCriar`.
 */
export function MenuDaVisao({ visao, aoMudar, aoMudarAberto }: Props) {
  const { cores, bordas } = useTema();
  const { width } = useWindowDimensions();
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<View>(null);
  const itens = useRef<(View | null)[]>([]);

  const abrir = () => botao.current?.measureInWindow((x, y, w, h) => { setAncora({ x, y, w, h }); aoMudarAberto?.(true); });
  const fechar = (depois?: () => void) => {
    setAncora(null);
    aoMudarAberto?.(false);
    // Na web o foco volta ao botão (o Modal some do DOM e o foco cairia no corpo da página).
    if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
    depois?.();
  };
  const escolher = (v: VisaoDoCalendario) => fechar(() => { if (v !== visao) aoMudar(v); });

  const aberto = ancora !== null;
  // Ao abrir, o foco vai para a visão atual (como num menu de opções do sistema).
  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const indice = Math.max(0, VISOES_DO_CALENDARIO.indexOf(visao));
    const relogio = setTimeout(() => (itens.current[indice] as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(relogio);
  }, [aberto, visao]);

  // Teclado dentro do menu (web). Escuta na captura do documento: o `Pressable` do react-native-web para a propagação do
  // teclado, então um `onKeyDown` no menu não veria as setas. Enter e Espaço escolhem aqui mesmo, sem depender de como o
  // react-native-web trata o `menuitemradio`.
  const escolherRef = useRef(escolher);
  useEffect(() => { escolherRef.current = escolher; });
  useEffect(() => {
    if (!aberto || Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => {
      const elementos = itens.current.map((r) => r as unknown as HTMLElement | null);
      const atual = elementos.indexOf(document.activeElement as HTMLElement);
      if ((e.key === 'Enter' || e.key === ' ') && atual >= 0) {
        e.preventDefault();
        e.stopPropagation();
        escolherRef.current(VISOES_DO_CALENDARIO[atual]);
        return;
      }
      const destino = proximoItem(e.key, atual, elementos.length);
      if (destino === null) return;
      e.preventDefault();
      elementos[destino]?.focus();
    };
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, [aberto]);

  const esquerda = ancora ? Math.max(espaco(1), Math.min(ancora.x + ancora.w - LARGURA_DO_MENU, width - LARGURA_DO_MENU - espaco(1))) : 0;
  const rotulo = ROTULOS_DAS_VISOES[visao];
  return (
    <>
      <Pressable ref={botao} collapsable={false} onPress={abrir}
        accessibilityRole="button" accessibilityLabel={`Visão do calendário: ${rotulo}`}
        accessibilityState={{ expanded: aberto }} aria-expanded={aberto}
        style={(e) => [estilos.botao, { borderColor: cores.borda, backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
        <Texto style={estilos.rotuloDoBotao}>{rotulo}</Texto>
        <ChevronDown size={18} color={cores.texto} strokeWidth={2} />
      </Pressable>
      {ancora ? (
        <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => fechar()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => fechar()} accessibilityLabel="Fechar o menu da visão" />
          <View role="menu" aria-label="Visão do calendário" accessibilityViewIsModal
            style={[estilos.menu, {
              top: ancora.y + ancora.h + espaco(0.5), left: esquerda, backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: bordas.bloco,
            }]}>
            {VISOES_DO_CALENDARIO.map((v, i) => {
              const atual = v === visao;
              const letra = LETRA_DA_VISAO[v];
              return (
                <Pressable key={v} ref={(no) => { itens.current[i] = no; }} role={ITEM_DE_ESCOLHA} aria-checked={atual}
                  accessibilityState={{ checked: atual }} accessibilityLabel={ROTULOS_DAS_VISOES[v]}
                  onPress={() => escolher(v)}
                  style={(e) => [estilos.item, sobre(e) && { backgroundColor: cores.superficie3 }]}>
                  <View style={estilos.marca}>
                    {atual ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}
                  </View>
                  <Texto style={[estilos.nome, atual && { fontFamily: fontes.semi }]}>{ROTULOS_DAS_VISOES[v]}</Texto>
                  {letra ? <Texto variante="suave" aria-hidden style={estilos.letra}>{letra}</Texto> : null}
                </Pressable>
              );
            })}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

/** Para onde o foco vai com a tecla (-1 = nenhum item com o foco): setas dão a volta, Home e End vão às pontas. */
function proximoItem(tecla: string, atual: number, total: number): number | null {
  if (total === 0) return null;
  if (tecla === 'ArrowDown') return atual < 0 ? 0 : (atual + 1) % total;
  if (tecla === 'ArrowUp') return atual < 0 ? total - 1 : (atual - 1 + total) % total;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  return null;
}

const estilos = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingLeft: espaco(2), paddingRight: espaco(1.5),
    borderWidth: 1, borderRadius: RAIO,
  },
  rotuloDoBotao: { fontFamily: fontes.semi, fontSize: 15 },
  menu: { position: 'absolute', width: LARGURA_DO_MENU, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5) },
  marca: { width: 20, alignItems: 'center' },
  nome: { flex: 1 },
  letra: { fontVariant: ['tabular-nums'] },
});
