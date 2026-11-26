import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { deslocamentoParaVer, type Faixa } from '../dominio/rolagemHorizontal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Esmaecido, LARGURA_ESMAECIDO, useEsmaecimento } from './FaixaDeChips';
import { Texto } from './Texto';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** Diâmetro do círculo da letra. */
const DIAMETRO = 24;

/**
 * Círculo com a letra da opção da refeição ("A", "B"), no editor de dieta e na dieta do aluno (25/11, "as opções ficaram
 * meio sumidas"). Selecionada: preenchido na cor de ação, letra em `sobreAcao` (≥ 4,5:1 sobre `acao` em todas as cores e
 * paletas, `tema/tokens.test.ts`). As outras: contorno `bordaCampo` (3:1) e letra em `texto`. Só desenho: o nome
 * acessível fica com quem o usa ("Opção A, …").
 */
export function MarcadorDeOpcao({ letra, selecionado }: { letra: string; selecionado: boolean }) {
  const { cores } = useTema();
  return (
    <View aria-hidden testID="marcador-de-opcao"
      style={[estilos.circulo, selecionado ? { backgroundColor: cores.acao, borderColor: cores.acao } : { backgroundColor: 'transparent', borderColor: cores.bordaCampo }]}>
      <Texto style={[estilos.letra, { color: selecionado ? cores.sobreAcao : cores.texto }]}>{letra}</Texto>
    </View>
  );
}

export interface AbaDaOpcao {
  valor: string;
  letra: string;
  /** "Opção A": em negrito na aberta. */
  titulo: string;
  /** Nome da aba para o leitor de tela ("Opção A, 98 kcal, conta no total do dia"). */
  rotuloAcessivel: string;
  /** Antes do círculo (o ícone de problema da validação). */
  antes?: ReactNode;
  /** Depois do título, na mesma linha ("98 kcal", "vazia", em texto secundário). */
  detalhe?: ReactNode;
  /** Na linha de baixo (o selo "Conta no total do dia"). */
  abaixo?: ReactNode;
}

interface PropsDasAbas {
  /** Nome da lista de abas para o leitor de tela ("Opções de 12:00 · Almoço"). */
  rotulo: string;
  abas: AbaDaOpcao[];
  aberta: string;
  aoAbrir: (valor: string) => void;
  /**
   * Logo depois da última aba, fora da rolagem e da lista de abas (o "+ Nova opção"): a faixa só ocupa o que as abas pedem,
   * então ele fica colado a elas e, quando não cabem, sempre inteiro à vista na ponta.
   */
  depois?: ReactNode;
  /**
   * O ⋯ da aba aberta (o menu da opção). Fica sobre a ponta direita dela, que ganha o espaço do botão, mas fora da lista
   * de abas e do gatilho: botão dentro de `tab` ou de `tablist` é aninhamento inválido (APG). Na ordem do Tab vem logo
   * depois da aba aberta.
   */
  acaoDaAberta?: ReactNode;
  /** Logo abaixo das abas, antes do painel (a frase de apoio). */
  apoio?: ReactNode;
  /** Guarda a aba de cada opção, para quem precisa pôr o foco nela (depois de criar ou excluir). */
  registrar?: (valor: string, aba: View | null) => void;
  /** A opção aberta (`tabpanel`). Sem ele, só a faixa (o conteúdo vem depois, fora das abas). */
  children?: ReactNode;
  /**
   * Põe algo em volta de cada aba (o editor: a caixa que o arraste mede e, na aberta, a alça, 26/11). A alça fica ao lado
   * do gatilho, nunca dentro dele: o gatilho escolhe a aba no `mousedown`. Com ele, as medidas são as da volta inteira e
   * a aberta cede à alça o recuo da esquerda.
   */
  envolver?: (aba: ReactNode, valor: string, indice: number) => ReactNode;
}

/** Largura do anel de foco (2 px) mais o afastamento (2 px) do `:focus-visible` do `global.css` (o mesmo do `ui/Abas`). */
const FOLGA_DO_ANEL = 4;
/** O gatilho (web) fica 1 px mais alto que a lista; sem este pixel a borda de baixo do anel perde 1 px. */
const PIXEL_DO_GATILHO = 1;
/** Altura do sublinhado da aba aberta. */
const INDICADOR = 2;

/**
 * Abas das opções da refeição (editor de dieta e dieta do aluno), no padrão Tabs da APG pelo mesmo primitivo do `ui/Abas`
 * (`@rn-primitives/tabs`, o Radix na web: setas, Home/End, Tab entra na aba aberta, `aria-selected` e o `tabpanel` ligado
 * à aba). Peça própria porque cada aba começa pelo `MarcadorDeOpcao` e o `ui/Abas` não tem esse encaixe; o resto é o
 * desenho dele: sublinhado de 2 px e título na cor de ação (em negrito) na aberta, as abas rolam na horizontal com a borda
 * esmaecida quando não cabem, o `depois` fica fora da rolagem e a aba aberta (a recém-criada também) vem para a vista.
 * Sempre dentro de um cartão: o esmaecido pinta com a `superficie` (não o fundo da página, que deixava um retângulo
 * mais escuro ao lado da aba no tema escuro).
 */
export function AbasDasOpcoes({ rotulo, abas, aberta, aoAbrir, depois, acaoDaAberta, apoio, registrar, children, envolver }: PropsDasAbas) {
  const { cores } = useTema();
  const fundo = cores.superficie;
  const { direita, esquerda, medidas } = useEsmaecimento();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef<ScrollView>(null);
  // Medidas lidas na rolagem e no layout, sem estado: rolar não redesenha as abas.
  const caixas = useRef<Partial<Record<string, Faixa>>>({});
  const vista = useRef({ x: 0, largura: 0, total: 0 });
  const mostrar = (valor: string, animado: boolean) => {
    const caixa = caixas.current[valor];
    const { x, largura, total } = vista.current;
    if (!caixa || !largura) return;
    const destino = deslocamentoParaVer(caixa, { x, largura }, LARGURA_ESMAECIDO, total);
    if (destino !== null) rolagem.current?.scrollTo({ x: destino, animated: animado && !reduzido });
  };
  const mostrarAtual = useRef(mostrar);
  useEffect(() => { mostrarAtual.current = mostrar; });
  // Trocou a aba (toque, seta, opção criada): a nova vem para a vista. Na montagem as medidas ainda não chegaram.
  useEffect(() => { mostrarAtual.current(aberta, true); }, [aberta]);
  // Onde a aba aberta está (no conteúdo da rolagem), para o ⋯ ficar na ponta dela; até medir, o ⋯ não aparece.
  const [caixaDaAberta, setCaixaDaAberta] = useState<{ valor: string; x: number; y: number; altura: number } | null>(null);
  const comAcao = !!acaoDaAberta;
  // `x` vem da lista das abas, que fica depois da folga do anel no conteúdo da rolagem.
  const medir = (valor: string, sel: boolean) => (e: LayoutChangeEvent) => {
    caixas.current[valor] = { x: e.nativeEvent.layout.x + FOLGA_DO_ANEL, largura: e.nativeEvent.layout.width };
    if (!sel) return;
    mostrar(valor, false);
    const { x, y, width, height } = e.nativeEvent.layout;
    // O ⋯ ocupa os últimos 44 px da aba aberta (o espaço que ela reserva).
    const nova = { valor, x: x + width - ALVO_TOQUE, y, altura: height };
    setCaixaDaAberta((c) => (c && c.valor === nova.valor && c.x === nova.x && c.y === nova.y && c.altura === nova.altura ? c : nova));
  };
  return (
    <Tabs value={aberta} onValueChange={aoAbrir} style={estilos.raiz}>
      <View style={[estilos.faixa, { borderBottomColor: cores.divisor }]}>
        <View testID="faixa-das-abas" style={[estilos.area, depois ? estilos.areaJusta : null]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={rolagem} scrollEventThrottle={medidas.scrollEventThrottle} style={estilos.rolagem} contentContainerStyle={estilos.conteudoRolagem}
            onLayout={(e: LayoutChangeEvent) => { medidas.onLayout(e); vista.current.largura = e.nativeEvent.layout.width; mostrar(aberta, false); }}
            onContentSizeChange={(w: number) => { medidas.onContentSizeChange(w); vista.current.total = w; mostrar(aberta, false); }}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { medidas.onScroll(e); vista.current.x = e.nativeEvent.contentOffset.x; }}>
            <TabsList accessibilityLabel={rotulo} style={estilos.lista}>
              {abas.map((a, i) => {
                const sel = a.valor === aberta;
                const aba = (
                  <TabsTrigger key={a.valor} value={a.valor} ref={registrar ? (no: View | null) => registrar(a.valor, no) : undefined}
                    accessibilityRole="tab" accessibilityLabel={a.rotuloAcessivel} accessibilityState={{ selected: sel }}
                    onLayout={envolver ? undefined : medir(a.valor, sel)}
                    style={[estilos.aba, envolver && sel ? estilos.abaComAlca : null, sel && comAcao ? estilos.abaComAcao : null, { borderColor: sel ? cores.acao : 'transparent' }]}>
                    <View style={estilos.conteudo}>
                      {a.antes}
                      <MarcadorDeOpcao letra={a.letra} selecionado={sel} />
                      <Texto style={[estilos.titulo, { color: sel ? cores.acao : cores.texto, fontFamily: sel ? fontes.negrito : fontes.medio }]}>{a.titulo}</Texto>
                      {a.detalhe}
                    </View>
                    {a.abaixo}
                  </TabsTrigger>
                );
                return envolver ? <View key={a.valor} onLayout={medir(a.valor, sel)}>{envolver(aba, a.valor, i)}</View> : aba;
              })}
            </TabsList>
            {comAcao && caixaDaAberta?.valor === aberta ? (
              <View style={[estilos.acaoDaAberta, { left: FOLGA_DO_ANEL + caixaDaAberta.x, top: FOLGA_DO_ANEL + caixaDaAberta.y, height: caixaDaAberta.altura }]}>
                {acaoDaAberta}
              </View>
            ) : null}
          </ScrollView>
          {direita ? <Esmaecido cor={fundo} lado="direita" /> : null}
          {esquerda ? <Esmaecido cor={fundo} lado="esquerda" /> : null}
        </View>
        {depois ? <View style={estilos.depois}>{depois}</View> : null}
      </View>
      {apoio}
      {children === undefined ? null : <TabsContent value={aberta}>{children}</TabsContent>}
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  circulo: { width: DIAMETRO, height: DIAMETRO, borderRadius: DIAMETRO / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  letra: { fontFamily: fontes.negrito, fontSize: 13, lineHeight: 16 },
  raiz: { gap: espaco(1.5) },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderBottomWidth: 1 },
  // A rolagem corta o que passa da caixa, e o anel de foco passa da aba: a folga do anel fica dentro do conteúdo e a área
  // avança a mesma folga para os lados (à esquerda sai da faixa sem rolar; à direita entra no vão do `depois`). Não
  // estica quando há o `depois` (25/11): o "+ Nova opção" fica logo depois da última aba; sem espaço, a área encolhe e
  // rola. Sem ele (dieta do aluno), a área ocupa a faixa como antes.
  area: { position: 'relative', flex: 1, minWidth: 0, marginHorizontal: -FOLGA_DO_ANEL },
  areaJusta: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' },
  depois: { flexShrink: 0 },
  lista: { flexDirection: 'row' },
  rolagem: { marginTop: -FOLGA_DO_ANEL, marginBottom: -(FOLGA_DO_ANEL + PIXEL_DO_GATILHO) },
  conteudoRolagem: { flexDirection: 'row', paddingHorizontal: FOLGA_DO_ANEL, paddingTop: FOLGA_DO_ANEL, paddingBottom: FOLGA_DO_ANEL + PIXEL_DO_GATILHO },
  aba: {
    minHeight: ALVO_TOQUE + INDICADOR,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    // O gatilho do RNR é `flex-row` pela classe: em coluna, o `abaixo` desce para baixo do título.
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 2,
    // O gatilho do RNR traz borda, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado (como no `ui/Abas`).
    borderWidth: 0,
    borderBottomWidth: INDICADOR,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  // Com a alça ao lado (editor), o recuo de 12 do começo fica com ela.
  abaComAlca: { paddingLeft: espaco(0.25) },
  // A aba aberta com o ⋯ guarda à direita o alvo dele (44); o desenho compacto de 32 fica centrado ali.
  abaComAcao: { paddingRight: ALVO_TOQUE },
  acaoDaAberta: { position: 'absolute', width: ALVO_TOQUE, justifyContent: 'center', alignItems: 'center' },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  titulo: { fontSize: 15 },
});
