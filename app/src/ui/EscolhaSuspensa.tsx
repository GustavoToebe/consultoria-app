import { Check, ChevronDown } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeSyntheticEvent, type StyleProp, type TextInput, type TextInputKeyPressEventData, type ViewStyle } from 'react-native';

import { comDigitado, destaqueInicial, filtrarOpcoesSuspensas, moverDestaque, posicaoDaLista, VAO_DO_PAINEL, type OpcaoSuspensa } from '../dominio/escolhaSuspensa';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LARGURA_MENU_LATERAL, RAIO, RAIO_CONTROLE } from '../tema/tokens';
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
  /** Lista curta, sem busca: o foco vai à opção escolhida e as setas, Home, End, Enter e Espaço andam e escolhem. */
  semBusca?: boolean;
  /** Rótulo do campo de busca; padrão "Buscar campo" (a importação). */
  rotuloDaBusca?: string;
  /** Texto da busca sem resultado; padrão "Nenhum campo encontrado.". */
  textoVazio?: string;
  /**
   * Texto livre: a opção do que foi digitado na busca (ex.: "Usar “Lanches”"), ou nula. Se o valor dela já é uma das
   * opções, vale a de lá, no topo; senão vai no fim (`comDigitado`). A regra do texto é de quem chama (`dominio/`).
   */
  digitado?: { opcao: (texto: string) => OpcaoSuspensa<T> | null; maxLength?: number };
  /** Linhas do valor no botão fechado; padrão 1. Mais quando o fim do valor (um fator, por exemplo) não pode sumir. */
  linhasDoValor?: number;
  style?: StyleProp<ViewStyle>;
}

const LARGURA_MINIMA = 300;
const ALTURA_DA_LISTA = 320;
const FOLGA = 16;
/** Altura da busca antes da primeira medida (rótulo + campo + respiro). */
const ALTURA_DA_BUSCA = 92;

/**
 * Escolha única com busca (o campo de cada coluna na importação, referência de 30/10). O botão mostra o rótulo em cima
 * e o valor embaixo. No PC (janela ≥ 768 px) a lista abre colada ao botão, por cima da tela (embaixo, ou em cima se
 * faltar espaço; a lista encolhe para nunca sair da janela), com a busca já focada: setas andam, Enter escolhe, Esc fecha e o foco volta ao botão. No celular a
 * mesma lista abre numa `Folha`. Regras puras em `dominio/escolhaSuspensa`.
 */
export function EscolhaSuspensa<T extends string | number | null>({
  rotulo, valor, opcoes, aoMudar, titulo, semBusca, rotuloDaBusca, textoVazio, digitado, linhasDoValor = 1, style,
}: Props<T>) {
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
          <Texto style={estilos.valor} numberOfLines={linhasDoValor}>{texto}</Texto>
        </View>
        <ChevronDown size={18} color={cores.textoSuave} strokeWidth={2} />
      </Pressable>
      {aberta ? (
        <Lista ancora={aberta === 'folha' ? null : aberta} rotulo={titulo ?? rotulo} valor={valor} opcoes={opcoes} aoFechar={fechar}
          semBusca={!!semBusca} rotuloDaBusca={rotuloDaBusca ?? 'Buscar campo'} textoVazio={textoVazio ?? 'Nenhum campo encontrado.'} digitado={digitado}
          aoEscolher={(v) => { aoMudar(v); fechar(); }} />
      ) : null}
    </>
  );
}

function Lista<T extends string | number | null>({ ancora, rotulo, valor, opcoes, aoEscolher, aoFechar, semBusca, rotuloDaBusca, textoVazio, digitado }: {
  ancora: Ancora | null; rotulo: string; valor: T; opcoes: readonly OpcaoSuspensa<T>[]; aoEscolher: (valor: T) => void; aoFechar: () => void;
  semBusca: boolean; rotuloDaBusca: string; textoVazio: string; digitado?: Props<T>['digitado'];
}) {
  const { cores } = useTema();
  const { width, height } = useWindowDimensions();
  const [filtro, setFiltro] = useState('');
  const [alturaMedida, setAlturaDaBusca] = useState(ALTURA_DA_BUSCA);
  const alturaDaBusca = semBusca ? 0 : alturaMedida;
  const visiveisDoFiltro = (t: string) => comDigitado(filtrarOpcoesSuspensas(opcoes, t), opcoes, digitado ? digitado.opcao(t) : null);
  const visiveis = visiveisDoFiltro(filtro);
  const [destaque, setDestaque] = useState(() => destaqueInicial(visiveis, valor));
  const atual = Math.min(destaque, visiveis.length - 1);
  const prefixo = `opcao-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const busca = useRef<TextInput>(null);
  const itens = useRef<(View | null)[]>([]);
  // A busca (ou, sem busca, a opção escolhida) já abre focada; o `autoFocus` sozinho perde para o foco que o `Modal`
  // põe no painel ao abrir.
  const [primeiroFoco] = useState(() => Math.max(destaqueInicial(visiveis, valor), 0));
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const t = setTimeout(() => (semBusca ? (itens.current[primeiroFoco] as unknown as HTMLElement | null)?.focus?.() : busca.current?.focus()), 30);
    return () => clearTimeout(t);
  }, [semBusca, primeiroFoco]);

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
  // Sem busca, o teclado anda pelas opções (web). Escuta na captura do documento, como o `MenuDaVisao`: o `Pressable`
  // do react-native-web para a propagação do teclado. O Esc continua com o `Modal`/`Folha` de cima (fecha só a lista).
  const teclaRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    teclaRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // Só numa opção (a focada): o Enter no "Fechar" da folha continua fechando.
        const o = visiveis[itens.current.indexOf(e.target as unknown as View)];
        if (!o) return;
        e.preventDefault();
        e.stopPropagation();
        aoEscolher(o.valor);
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const i = moverDestaque(atual, visiveis.length, e.key);
      setDestaque(i);
      (itens.current[i] as unknown as HTMLElement | null)?.focus?.();
    };
  });
  useEffect(() => {
    if (!semBusca || Platform.OS !== 'web') return undefined;
    const ouvir = (e: KeyboardEvent) => teclaRef.current(e);
    document.addEventListener('keydown', ouvir, true);
    return () => document.removeEventListener('keydown', ouvir, true);
  }, [semBusca]);

  const campoDeBusca = semBusca ? null : (
    <View style={estilos.busca} onLayout={(e) => setAlturaDaBusca(e.nativeEvent.layout.height)}>
      <Campo ref={busca} rotulo={rotuloDaBusca} valor={filtro} autoCorrect={false} onKeyPress={tecla} onSubmitEditing={escolherDestacada} submitBehavior="submit"
        maxLength={digitado?.maxLength} aoMudar={(t) => { setFiltro(t); setDestaque(destaqueInicial(visiveisDoFiltro(t), valor)); }} />
    </View>
  );
  const lista = (
    // `listbox` não está no tipo `Role` do RN, mas o react-native-web o repassa.
    <View {...({ role: 'listbox' } as object)} aria-label={rotulo}>
      {visiveis.length === 0 ? <Texto variante="suave" style={estilos.vazio} accessibilityLiveRegion="polite">{textoVazio}</Texto> : null}
      {visiveis.map((o, i) => {
        const escolhida = o.valor === valor;
        return (
          <Pressable key={String(o.valor)} ref={(no) => { itens.current[i] = no; }} nativeID={`${prefixo}-${i}`} role="option" aria-selected={escolhida}
            accessibilityLabel={o.detalhe ? `${o.rotulo}, ${o.detalhe}` : o.rotulo}
            onHoverIn={() => setDestaque(i)} onFocus={() => setDestaque(i)} onPress={() => aoEscolher(o.valor)}
            style={[estilos.opcao, { backgroundColor: escolhida ? cores.superficie3 : i === atual ? cores.superficie3 : 'transparent', borderColor: escolhida ? cores.bordaCampo : 'transparent' }]}>
            <View style={estilos.textos}>
              <Texto style={[estilos.rotuloOpcao, { color: cores.texto }]}>{o.rotulo}</Texto>
              {o.detalhe ? <Texto variante="pequeno">{o.detalhe}</Texto> : null}
            </View>
            {escolhida ? <Check size={18} color={cores.texto} strokeWidth={2.5} /> : null}
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
  const { abreEmbaixo, alturaMaxima } = posicaoDaLista(embaixo, emCima, alturaDaBusca, ALTURA_DA_LISTA, 2 * ALVO_TOQUE);
  const posicao = abreEmbaixo ? { top: ancora.y + ancora.h + VAO_DO_PAINEL } : { bottom: height - ancora.y + VAO_DO_PAINEL };
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel={`Fechar ${rotulo}`} />
      <View accessibilityViewIsModal role="dialog" aria-label={rotulo}
        style={[estilos.painel, posicao, { left: esquerda, width: largura, backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
        {campoDeBusca}
        <ScrollView style={{ maxHeight: alturaMaxima }} keyboardShouldPersistTaps="handled">{lista}</ScrollView>
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
    borderRadius: RAIO_CONTROLE,
  },
  textos: { flex: 1, gap: 1 },
  valor: { fontFamily: fontes.semi, fontSize: 15 },
  painel: {
    position: 'absolute',
    zIndex: 9999,
    borderWidth: 1,
    borderRadius: RAIO,
    overflow: 'hidden',
  },
  busca: { padding: espaco(1) },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.5), borderWidth: 1 },
  rotuloOpcao: { fontFamily: fontes.semi },
  vazio: { padding: espaco(1.5) },
});
