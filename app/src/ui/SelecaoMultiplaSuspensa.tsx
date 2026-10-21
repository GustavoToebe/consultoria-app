import { Check, ChevronDown, Minus } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  alternarVisiveis,
  estadoDosVisiveis,
  filtrarOpcoes,
  marcadosExistentes,
  resumoDosMarcados,
  textoDosMarcados,
  type OpcaoDaSelecao,
} from '../dominio/selecaoMultiplaSuspensa';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import type { Ancora } from './Calendario';
import { Campo } from './Campo';
import { Folha } from './Folha';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props {
  rotulo: string;
  opcoes: readonly OpcaoDaSelecao[];
  /** Valores marcados. Vazio = sem filtro (o campo diz `rotuloDeTodos`). */
  marcados: ReadonlySet<string>;
  aoMudar: (marcados: Set<string>) => void;
  /** Texto do campo quando nada está marcado. */
  rotuloDeTodos?: string;
  /** Estilo do campo fechado (ex.: `alignSelf: 'flex-end'` ao lado de um campo de busca). */
  style?: StyleProp<ViewStyle>;
}

const LARGURA_MINIMA_DA_LISTA = 320;
const ALTURA_MAXIMA_DA_LISTA = 380;
const FOLGA = 16;

/**
 * Filtro de várias opções, "Todos" quando nada está marcado. Fechado é um campo com rótulo e os marcados em chips
 * (dois e "+N"); aberto tem filtro, "Marcar todos" (só os visíveis) e uma caixa por opção. No PC (janela ≥ 768 px)
 * abre colado ao campo, por cima da tela (embaixo, ou em cima se faltar espaço); no celular abre numa `Folha`. Fecha
 * com Esc, tocando fora ou no X da folha; marcar não fecha. Marcados que sumiram das opções não contam.
 */
export function SelecaoMultiplaSuspensa({ rotulo, opcoes, marcados, aoMudar, rotuloDeTodos = 'Todos', style }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const [aberta, setAberta] = useState(false);
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const campo = useRef<View>(null);
  const vigentes = marcadosExistentes(opcoes, marcados);
  const { chips, restantes } = resumoDosMarcados(opcoes, vigentes);
  const emFolha = width < LARGURA_MENU_LATERAL;

  const abrir = () => {
    if (emFolha) return setAberta(true);
    campo.current?.measureInWindow((x, y, w, h) => {
      setAncora({ x, y, w, h });
      setAberta(true);
    });
  };
  const fechar = () => setAberta(false);
  const lista = <ListaDeOpcoes rotulo={rotulo} opcoes={opcoes} marcados={vigentes} aoMudar={aoMudar} comFoco={!emFolha} limiteDeAltura={emFolha ? undefined : ALTURA_MAXIMA_DA_LISTA} />;

  return (
    <>
      <Pressable
        ref={campo}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${textoDosMarcados(opcoes, vigentes, rotuloDeTodos)}. Escolher.`}
        accessibilityState={{ expanded: aberta }}
        onPress={abrir}
        style={(estado) => [estilos.campo, { borderColor: cores.borda, backgroundColor: sobre(estado) ? cores.superficie3 : 'transparent' }, style]}>
        <View style={estilos.textos}>
          <Texto variante="pequeno" numberOfLines={1}>{rotulo}</Texto>
          <View style={estilos.chips}>
            {chips.length === 0 ? <Texto style={estilos.valor} numberOfLines={1}>{rotuloDeTodos}</Texto> : null}
            {chips.map((c) => <Chip key={c} texto={c} />)}
            {restantes > 0 ? <Chip texto={`+${restantes}`} /> : null}
          </View>
        </View>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {aberta && emFolha ? <Folha visivel titulo={rotulo} aoFechar={fechar}>{lista}</Folha> : null}
      {aberta && !emFolha && ancora ? <Suspensa ancora={ancora} rotulo={rotulo} aoFechar={fechar}>{lista}</Suspensa> : null}
    </>
  );
}

function Chip({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.chip, { backgroundColor: cores.superficie3 }]}>
      <Texto variante="pequeno" cor={cores.texto} numberOfLines={1}>{texto}</Texto>
    </View>
  );
}

/** Painel colado ao campo, sem escurecer a tela (mesmo desenho do `Calendario`). */
function Suspensa({ ancora, rotulo, aoFechar, children }: { ancora: Ancora; rotulo: string; aoFechar: () => void; children: ReactNode }) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  const largura = Math.min(Math.max(ancora.w, LARGURA_MINIMA_DA_LISTA), width - 2 * FOLGA);
  const esquerda = Math.max(FOLGA, Math.min(ancora.x, width - largura - FOLGA));
  const embaixo = height - (ancora.y + ancora.h) - FOLGA;
  const emCima = ancora.y - FOLGA;
  const abreEmbaixo = embaixo >= 280 || embaixo >= emCima;
  const posicao = abreEmbaixo ? { top: ancora.y + ancora.h + 4 } : { bottom: height - ancora.y + 4 };
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel={`Fechar ${rotulo}`} />
      <View
        accessibilityViewIsModal
        role="dialog"
        aria-label={rotulo}
        style={[estilos.painel, posicao, { left: esquerda, width: largura, backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        {children}
      </View>
    </Modal>
  );
}

function ListaDeOpcoes({ rotulo, opcoes, marcados, aoMudar, comFoco, limiteDeAltura }: {
  rotulo: string;
  opcoes: readonly OpcaoDaSelecao[];
  marcados: ReadonlySet<string>;
  aoMudar: (marcados: Set<string>) => void;
  comFoco: boolean;
  /** Altura máxima da lista com rolagem própria (suspensa); na folha a rolagem é da folha. */
  limiteDeAltura?: number;
}) {
  const { cores } = useTema();
  const [filtro, setFiltro] = useState('');
  const visiveis = filtrarOpcoes(opcoes, filtro);
  const estado = estadoDosVisiveis(visiveis, marcados);
  const alternar = (valor: string, marcar: boolean) => {
    const novo = new Set(marcados);
    if (marcar) novo.add(valor);
    else novo.delete(valor);
    aoMudar(novo);
  };
  const linhas = (
    <View accessibilityRole="list" accessibilityLabel={rotulo}>
      {visiveis.length === 0 ? <Texto variante="suave" style={estilos.vazio}>Nenhuma opção encontrada.</Texto> : null}
      {visiveis.map((o) => <Linha key={o.valor} rotulo={o.rotulo} estado={marcados.has(o.valor) ? 'todos' : 'nenhum'} aoTocar={() => alternar(o.valor, !marcados.has(o.valor))} />)}
    </View>
  );
  return (
    <View style={estilos.lista}>
      <View style={estilos.filtro}>
        <Campo rotulo="Filtro" valor={filtro} aoMudar={setFiltro} autoCorrect={false} autoFocus={comFoco && Platform.OS === 'web'} />
      </View>
      <View style={[estilos.divisoria, { borderColor: cores.borda }]}>
        <View style={estilos.marcarTodos}>
          <Linha rotulo={filtro.trim() ? 'Marcar todos os visíveis' : 'Marcar todos'} estado={estado} aoTocar={() => aoMudar(alternarVisiveis(visiveis, marcados))} negrito />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Limpar ${rotulo}`}
          disabled={marcados.size === 0}
          onPress={() => aoMudar(new Set())}
          style={(e) => [estilos.limpar, { opacity: marcados.size === 0 ? 0.4 : 1, backgroundColor: sobre(e) && marcados.size > 0 ? cores.superficie3 : 'transparent' }]}>
          <Texto variante="pequeno" cor={cores.texto} style={estilos.rotuloLimpar}>Limpar</Texto>
        </Pressable>
      </View>
      {limiteDeAltura ? <ScrollView style={{ maxHeight: limiteDeAltura }} keyboardShouldPersistTaps="handled">{linhas}</ScrollView> : linhas}
    </View>
  );
}

/** Linha com caixa de marcar; `estado` 'alguns' mostra o traço (só no "Marcar todos"). */
function Linha({ rotulo, estado, aoTocar, negrito }: { rotulo: string; estado: 'nenhum' | 'alguns' | 'todos'; aoTocar: () => void; negrito?: boolean }) {
  const { cores } = useTema();
  const marcada = estado !== 'nenhum';
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: estado === 'alguns' ? 'mixed' : marcada }}
      aria-checked={estado === 'alguns' ? 'mixed' : marcada}
      onPress={aoTocar}
      style={(e) => [estilos.linha, { backgroundColor: sobre(e) ? cores.superficie3 : 'transparent' }]}>
      <View style={[estilos.caixa, { backgroundColor: marcada ? cores.texto : cores.campo, borderColor: marcada ? cores.texto : cores.bordaCampo }]}>
        {estado === 'todos' ? <Check size={16} color={cores.fundo} strokeWidth={3} /> : null}
        {estado === 'alguns' ? <Minus size={16} color={cores.fundo} strokeWidth={3} /> : null}
      </View>
      <Texto style={[estilos.rotuloLinha, negrito && { fontFamily: fontes.semi }]}>{rotulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  campo: {
    alignSelf: 'flex-start',
    minWidth: 200,
    maxWidth: '100%',
    minHeight: ALVO_TOQUE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.75),
    borderWidth: 1,
    borderRadius: RAIO,
  },
  textos: { flexShrink: 1, flexGrow: 1, gap: 2 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  valor: { fontFamily: fontes.semi, fontSize: 15 },
  chip: { paddingHorizontal: espaco(1), paddingVertical: 2, borderRadius: 4, maxWidth: 160 },
  painel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: RAIO,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }, default: { elevation: 8 } }),
  },
  lista: { gap: espaco(0.5) },
  filtro: { padding: espaco(1), paddingBottom: 0 },
  divisoria: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: espaco(0.5) },
  marcarTodos: { flex: 1 },
  limpar: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), borderRadius: RAIO },
  rotuloLimpar: { textDecorationLine: 'underline', fontFamily: fontes.semi },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1.5), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  caixa: { width: 22, height: 22, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  rotuloLinha: { flex: 1 },
  vazio: { padding: espaco(1.5) },
});
