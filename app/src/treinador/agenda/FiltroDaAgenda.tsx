import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { moverDestaque, posicaoDaLista, VAO_DO_PAINEL } from '../../dominio/escolhaSuspensa';
import { semAcento } from '../../dominio/telas';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../../tema/tokens';
import { Folha } from '../../ui/Folha';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

export interface ItemDoFiltro {
  chave: string;
  rotulo: string;
  marcado: boolean;
}

interface Props {
  rotulo: string;
  /** O que está escolhido, por extenso ("Toda a equipe", "Agendados, Realizados"). */
  valor: string;
  /** Usado no lugar de `valor` quando ele não cabe numa linha ("2 selecionados"). */
  valorCurto?: string;
  itens: readonly ItemDoFiltro[];
  /** Várias marcadas (o menu fica aberto enquanto se marca) ou uma só (escolher fecha). */
  multipla?: boolean;
  /** Linha divisória depois do primeiro item (o "Todos" do Compromissos). */
  separarPrimeiro?: boolean;
  aoEscolher: (chave: string) => void;
}

interface Ancora { x: number; y: number; w: number; h: number }

const LARGURA_MINIMA_DO_MENU = 240;
const ALTURA_MAXIMA_DO_MENU = 360;
const FOLGA = 16;
/** Linhas da folha do celular: 48 px (lista e caixas de seleção, `docs/design-e-front.md` 4.3). */
const ALTURA_DA_LINHA_NA_FOLHA = ALVO_TOQUE + 4;
/** `menuitemradio`/`menuitemcheckbox` não estão no tipo `Role` do React Native; o react-native-web os passa ao DOM. */
const PAPEL_UNICA = 'menuitemradio' as unknown as 'menuitem';
const PAPEL_VARIAS = 'menuitemcheckbox' as unknown as 'menuitem';

/**
 * Filtro da lateral da agenda, no jeito do Google Agenda: um botão de uma linha "Rótulo: valor ⌄" (rótulo em tom secundário,
 * valor em semibold) com a mesma altura, recuo e contorno nos dois filtros. No PC (janela ≥ 768 px) abre um menu colado ao
 * botão, sem escurecer a tela (embaixo, ou em cima se faltar espaço), com o foco no item marcado: setas, Home e End andam, a
 * letra inicial pula para o item, Enter e Espaço escolhem, Esc fecha e o foco volta ao botão. Escolha única fecha ao
 * escolher; a múltipla fica aberta enquanto se marca. No celular a mesma lista abre numa `Folha`, com linhas de 48 px.
 * Peça local porque as compartilhadas (`EscolhaEmFolha`, `SelecaoMultiplaSuspensa`) abrem folha, têm busca ou rótulo em cima.
 */
export function FiltroDaAgenda({ rotulo, valor, valorCurto, itens, multipla, separarPrimeiro, aoEscolher }: Props) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  const [aberto, setAberto] = useState<Ancora | 'folha' | null>(null);
  const botao = useRef<View>(null);
  const linhas = useRef<(View | null)[]>([]);
  // O valor por extenso só fica se couber: mede o texto sem limite (fantasma) e o espaço do valor no botão.
  const [larguraDoValor, setLarguraDoValor] = useState(0);
  const [espacoDoValor, setEspacoDoValor] = useState(0);
  const cabe = !valorCurto || espacoDoValor === 0 || larguraDoValor <= espacoDoValor;
  const texto = cabe ? valor : valorCurto;

  const abrir = () => {
    if (width < LARGURA_MENU_LATERAL) setAberto('folha');
    else botao.current?.measureInWindow((x, y, w, h) => setAberto({ x, y, w, h }));
  };
  const fechar = () => {
    setAberto(null);
    // O Modal some do DOM e o foco cairia no corpo da página: volta ao botão que abriu.
    if (Platform.OS === 'web') setTimeout(() => (botao.current as unknown as HTMLElement | null)?.focus?.(), 0);
  };
  const escolher = (chave: string) => {
    aoEscolher(chave);
    if (!multipla) fechar();
  };

  const noMenu = aberto !== null && aberto !== 'folha';
  // Ao abrir no PC, o foco vai ao item marcado (ou ao primeiro).
  useEffect(() => {
    if (!noMenu || Platform.OS !== 'web') return undefined;
    const i = Math.max(0, itens.findIndex((x) => x.marcado));
    const relogio = setTimeout(() => (linhas.current[i] as unknown as HTMLElement | null)?.focus?.(), 0);
    return () => clearTimeout(relogio);
    // Só ao abrir: marcar outro item na múltipla não tira o foco de onde está.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noMenu]);

  // Teclado do menu (web), na captura do documento como no `MenuDaVisao`: o `Pressable` do react-native-web para a
  // propagação. O Esc fica com o `Modal` (fecha só o menu, também quando ele abre por cima da folha "Agendas e filtros").
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    teclaRef.current = (e: KeyboardEvent) => {
      const elementos = linhas.current.slice(0, itens.length).map((r) => r as unknown as HTMLElement | null);
      const atual = elementos.indexOf(document.activeElement as HTMLElement);
      if ((e.key === 'Enter' || e.key === ' ') && atual >= 0) {
        e.preventDefault();
        e.stopPropagation();
        escolher(itens[atual].chave);
        return;
      }
      let destino = ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) ? moverDestaque(atual, elementos.length, e.key) : -1;
      if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Letra inicial: o próximo item que começa com ela, dando a volta (equipe grande sem campo de busca).
        const letra = semAcento(e.key);
        const ordem = itens.map((_, k) => (atual + 1 + k) % itens.length);
        destino = ordem.find((k) => semAcento(itens[k].rotulo).startsWith(letra)) ?? -1;
      }
      if (destino < 0) return;
      e.preventDefault();
      elementos[destino]?.focus();
    };
  });
  useEffect(() => {
    if (!noMenu || Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => teclaRef.current(e);
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, [noMenu]);

  const lista = (emFolha: boolean) => (
    <View role={emFolha ? (multipla ? 'group' : 'radiogroup') : 'menu'} aria-label={rotulo}>
      {itens.map((item, i) => (
        <View key={item.chave} style={separarPrimeiro && i === 0 ? [estilos.separado, { borderBottomColor: cores.divisor }] : null}>
          <Pressable
            ref={(no) => { linhas.current[i] = no; }}
            role={emFolha ? (multipla ? 'checkbox' : 'radio') : multipla ? PAPEL_VARIAS : PAPEL_UNICA}
            aria-checked={item.marcado}
            accessibilityState={{ checked: item.marcado }}
            accessibilityLabel={item.rotulo}
            onPress={() => escolher(item.chave)}
            style={(e) => [estilos.item, emFolha && { minHeight: ALTURA_DA_LINHA_NA_FOLHA }, { backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
            {multipla ? (
              <View style={[estilos.caixa, { backgroundColor: item.marcado ? cores.texto : cores.campo, borderColor: item.marcado ? cores.texto : cores.bordaCampo }]}>
                {item.marcado ? <Check size={16} color={cores.fundo} strokeWidth={3} /> : null}
              </View>
            ) : (
              <View style={estilos.marca}>{item.marcado ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}</View>
            )}
            <Texto style={[estilos.nome, item.marcado && { fontFamily: fontes.semi }]}>{item.rotulo}</Texto>
          </Pressable>
        </View>
      ))}
    </View>
  );

  const menu = () => {
    if (!noMenu) return null;
    const a = aberto;
    const largura = Math.min(Math.max(a.w, LARGURA_MINIMA_DO_MENU), width - 2 * FOLGA);
    const esquerda = Math.max(FOLGA, Math.min(a.x, width - largura - FOLGA));
    const lugar = posicaoDaLista(height - (a.y + a.h) - FOLGA, a.y - FOLGA, 0, ALTURA_MAXIMA_DO_MENU, 2 * ALVO_TOQUE);
    const posicao = lugar.abreEmbaixo ? { top: a.y + a.h + VAO_DO_PAINEL } : { bottom: height - a.y + VAO_DO_PAINEL };
    return (
      <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={fechar}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fechar} accessibilityLabel={`Fechar ${rotulo}`} />
        <View style={[estilos.menu, posicao, { left: esquerda, width: largura, backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
          <ScrollView style={{ maxHeight: lugar.alturaMaxima }}>{lista(false)}</ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Pressable
        ref={botao}
        collapsable={false}
        accessibilityRole="button"
        // O nome começa pelo que está à vista ("2 selecionados"), para o comando de voz achar o botão (WCAG 2.5.3).
        accessibilityLabel={`${rotulo}: ${texto}${texto !== valor ? ` (${valor})` : ''}. Escolher.`}
        accessibilityState={{ expanded: aberto !== null }}
        aria-expanded={aberto !== null}
        aria-haspopup={width < LARGURA_MENU_LATERAL ? 'dialog' : 'menu'}
        onPress={abrir}
        style={(e) => [estilos.botao, { borderColor: cores.bordaCampo, backgroundColor: sobre(e) ? cores.superficie3 : cores.campo }]}>
        <Texto variante="suave" style={estilos.texto}>{rotulo}:</Texto>
        <View style={estilos.espacoDoValor} onLayout={(e) => setEspacoDoValor(e.nativeEvent.layout.width)}>
          <Texto numberOfLines={1} style={[estilos.texto, estilos.valor, { color: cores.texto }]}>{texto}</Texto>
        </View>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
        {valorCurto ? (
          // Fantasma do valor inteiro, sem limite de largura, só para medir (invisível e fora da leitura de tela).
          <View style={estilos.fantasma} pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants">
            <Texto style={[estilos.texto, estilos.valor]} onLayout={(e) => setLarguraDoValor(e.nativeEvent.layout.width)}>{valor}</Texto>
          </View>
        ) : null}
      </Pressable>
      {aberto === 'folha' ? <Folha visivel titulo={rotulo} aoFechar={fechar}>{lista(true)}</Folha> : null}
      {menu()}
    </>
  );
}

const estilos = StyleSheet.create({
  // Mesmo molde do botão da `EscolhaEmFolha` (campo, `bordaCampo`, `RAIO_CONTROLE`), esticado na largura da lateral.
  botao: {
    alignSelf: 'stretch',
    minHeight: ALVO_TOQUE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(0.75),
    paddingHorizontal: espaco(1.5),
    borderWidth: 1,
    borderRadius: RAIO_CONTROLE,
    overflow: 'hidden',
  },
  texto: { fontSize: 15 },
  valor: { fontFamily: fontes.semi },
  espacoDoValor: { flex: 1, minWidth: 0 },
  fantasma: { position: 'absolute', left: 0, top: 0, width: 1000, opacity: 0, alignItems: 'flex-start' },
  menu: { position: 'absolute', borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(0.5), overflow: 'hidden' },
  separado: { borderBottomWidth: 1, marginBottom: espaco(0.5), paddingBottom: espaco(0.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5) },
  marca: { width: 22, alignItems: 'center' },
  caixa: { width: 22, height: 22, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  nome: { flex: 1 },
});
