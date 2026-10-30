import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeSyntheticEvent, type StyleProp, type TextInput, type TextInputKeyPressEventData, type ViewStyle } from 'react-native';

import { destaqueInicial, filtrarOpcoesSuspensas, moverDestaque, type OpcaoSuspensa } from '../dominio/escolhaSuspensa';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO } from '../tema/tokens';
import type { Ancora } from './Calendario';
import { Campo } from './Campo';
import { Folha } from './Folha';
import { sobre } from './sobre';
import { Texto } from './Texto';

interface Props<T> {
  rotulo: string;
  valor: T;
  opcoes: readonly OpcaoSuspensa<T>[];
  aoMudar: (valor: T) => void;
  /** Nome da lista (diálogo no PC, título da folha no celular); padrão o rótulo. */
  titulo?: string;
  style?: StyleProp<ViewStyle>;
}

const LARGURA_MINIMA = 300;
const ALTURA_DA_LISTA = 320;
const FOLGA = 16;

/**
 * Escolha única com busca (o campo de cada coluna na importação, referência de 30/10). O botão mostra o rótulo em cima
 * e o valor embaixo. No PC (janela ≥ 768 px) a lista abre colada ao botão, por cima da tela (embaixo, ou em cima se
 * faltar espaço), com a busca já focada: setas andam, Enter escolhe, Esc fecha e o foco volta ao botão. No celular a
 * mesma lista abre numa `Folha`. Regras puras em `dominio/escolhaSuspensa`.
 */
export function EscolhaSuspensa<T extends string | number | null>({ rotulo, valor, opcoes, aoMudar, titulo, style }: Props<T>) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  /** Aberta: colada ao botão (PC) ou numa folha (celular). */
  const [aberta, setAberta] = useState<Ancora | 'folha' | null>(null);
  const botao = useRef<View>(null);
  const escolhida = opcoes.find((o) => o.valor === valor);
  const texto = escolhida?.rotulo ?? '—';
  const abrir = () => {
    if (width < LARGURA_MENU_LATERAL) setAberta('folha');
    else botao.current?.measureInWindow((x, y, w, h) => setAberta({ x, y, w, h }));
  };
  const fechar = () => {
    setAberta(null);
    // O foco volta ao botão que abriu a lista (teclado e leitor de tela continuam de onde estavam).
    if (Platform.OS === 'web') requestAnimationFrame(() => (botao.current as unknown as { focus?: () => void } | null)?.focus?.());
  };
  return (
    <>
      <Pressable
        ref={botao}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${texto}. Escolher.`}
        accessibilityState={{ expanded: !!aberta }}
        aria-haspopup="listbox"
        onPress={abrir}
        style={(estado) => [estilos.botao, { borderColor: cores.bordaCampo, backgroundColor: sobre(estado) ? cores.superficie3 : cores.campo }, style]}>
        <View style={estilos.textos}>
          <Texto variante="pequeno" numberOfLines={1}>{rotulo}</Texto>
          <Texto style={estilos.valor} numberOfLines={1}>{texto}</Texto>
        </View>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {aberta ? (
        <Lista ancora={aberta === 'folha' ? null : aberta} rotulo={titulo ?? rotulo} valor={valor} opcoes={opcoes} aoFechar={fechar}
          aoEscolher={(v) => { aoMudar(v); fechar(); }} />
      ) : null}
    </>
  );
}

function Lista<T extends string | number | null>({ ancora, rotulo, valor, opcoes, aoEscolher, aoFechar }: {
  ancora: Ancora | null; rotulo: string; valor: T; opcoes: readonly OpcaoSuspensa<T>[]; aoEscolher: (valor: T) => void; aoFechar: () => void;
}) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  const [filtro, setFiltro] = useState('');
  const visiveis = filtrarOpcoesSuspensas(opcoes, filtro);
  const [destaque, setDestaque] = useState(() => destaqueInicial(visiveis, valor));
  const atual = Math.min(destaque, visiveis.length - 1);
  const prefixo = `opcao-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const busca = useRef<TextInput>(null);
  // A busca já abre focada; o `autoFocus` sozinho perde para o foco que o `Modal` põe no painel ao abrir.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const t = setTimeout(() => busca.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const mostrar = (i: number) => {
    setDestaque(i);
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: { getElementById: (id: string) => { scrollIntoView?: (o: object) => void } | null } }).document;
    doc?.getElementById(`${prefixo}-${i}`)?.scrollIntoView?.({ block: 'nearest' });
  };
  const escolherDestacada = () => {
    const o = visiveis[atual];
    if (o) aoEscolher(o.valor);
  };
  const tecla = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const k = e.nativeEvent.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      mostrar(moverDestaque(atual, visiveis.length, k));
    }
  };

  const campoDeBusca = (
    <View style={estilos.busca}>
      <Campo ref={busca} rotulo="Buscar campo" valor={filtro} autoCorrect={false} onKeyPress={tecla} onSubmitEditing={escolherDestacada} submitBehavior="submit"
        aoMudar={(t) => { setFiltro(t); setDestaque(destaqueInicial(filtrarOpcoesSuspensas(opcoes, t), valor)); }} />
    </View>
  );
  const lista = (
    // `listbox` não está no tipo `Role` do RN, mas o react-native-web o repassa.
    <View {...({ role: 'listbox' } as object)} aria-label={rotulo}>
      {visiveis.length === 0 ? <Texto variante="suave" style={estilos.vazio}>Nenhum campo encontrado.</Texto> : null}
      {visiveis.map((o, i) => {
        const escolhida = o.valor === valor;
        return (
          <Pressable key={String(o.valor)} nativeID={`${prefixo}-${i}`} role="option" aria-selected={escolhida}
            accessibilityLabel={o.detalhe ? `${o.rotulo}, ${o.detalhe}` : o.rotulo}
            onHoverIn={() => setDestaque(i)} onPress={() => aoEscolher(o.valor)}
            style={[estilos.opcao, { backgroundColor: escolhida ? cores.texto : i === atual ? cores.superficie3 : 'transparent' }]}>
            <View style={estilos.textos}>
              <Texto style={[estilos.rotuloOpcao, { color: escolhida ? cores.fundo : cores.texto }]}>{o.rotulo}</Texto>
              {o.detalhe ? <Texto variante="pequeno" cor={escolhida ? cores.fundo : undefined}>{o.detalhe}</Texto> : null}
            </View>
            {escolhida ? <Check size={18} color={cores.fundo} strokeWidth={2.5} /> : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (!ancora) return <Folha visivel titulo={rotulo} aoFechar={aoFechar}>{campoDeBusca}{lista}</Folha>;

  const largura = Math.min(Math.max(ancora.w, LARGURA_MINIMA), width - 2 * FOLGA);
  const esquerda = Math.max(FOLGA, Math.min(ancora.x, width - largura - FOLGA));
  const embaixo = height - (ancora.y + ancora.h) - FOLGA;
  const emCima = ancora.y - FOLGA;
  const abreEmbaixo = embaixo >= 260 || embaixo >= emCima;
  const posicao = abreEmbaixo ? { top: ancora.y + ancora.h + 4 } : { bottom: height - ancora.y + 4 };
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel={`Fechar ${rotulo}`} />
      <View accessibilityViewIsModal role="dialog" aria-label={rotulo}
        style={[estilos.painel, posicao, { left: esquerda, width: largura, backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        {campoDeBusca}
        <ScrollView style={{ maxHeight: ALTURA_DA_LISTA }} keyboardShouldPersistTaps="handled">{lista}</ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  botao: {
    alignSelf: 'stretch',
    minHeight: ALVO_TOQUE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1),
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    borderWidth: 1,
    borderRadius: RAIO,
  },
  textos: { flex: 1, gap: 1 },
  valor: { fontFamily: fontes.semi, fontSize: 15 },
  painel: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: RAIO,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }, default: { elevation: 8 } }),
  },
  busca: { padding: espaco(1) },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5) },
  rotuloOpcao: { fontFamily: fontes.semi },
  vazio: { padding: espaco(1.5) },
});
