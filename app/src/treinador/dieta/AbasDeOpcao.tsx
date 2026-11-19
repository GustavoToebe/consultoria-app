import { CircleAlert } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { OpcaoRefeicao } from '../../api/tipos';
import { CONTA_NO_TOTAL, kcalDaAba, nomeDaAba, tituloDaOpcao } from '../../dominio/opcoesDaRefeicao';
import { deslocamentoParaVer, type Faixa } from '../../dominio/rolagemHorizontal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { Esmaecido, LARGURA_ESMAECIDO, useEsmaecimento } from '../../ui/FaixaDeChips';
import { useFundoDaArea } from '../../ui/fundoDaArea';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useMovimentoReduzido } from '../../ui/useMovimentoReduzido';

interface Props {
  /** Nome da lista de abas para o leitor de tela ("Opções de 12:00 · Almoço"). */
  rotulo: string;
  opcoes: OpcaoRefeicao[];
  aberta: string;
  comProblema: ReadonlySet<string>;
  aoAbrir: (uid: string) => void;
  /** No fim da faixa, fora da rolagem e da lista de abas (o "+ Opção"): sempre inteiro à vista. */
  depois: ReactNode;
  /** Logo abaixo das abas, antes da opção aberta (a frase de apoio). */
  apoio?: ReactNode;
  /** Guarda a aba de cada opção, para quem precisa pôr o foco nela (depois de criar ou excluir). */
  registrar: (uid: string, aba: View | null) => void;
  /** A opção aberta (`tabpanel`). */
  children: ReactNode;
}

/** Largura do anel de foco (2 px) mais o afastamento (2 px) do `:focus-visible` do `global.css` (o mesmo do `ui/Abas`). */
const FOLGA_DO_ANEL = 4;
/** O gatilho (web) fica 1 px mais alto que a lista; sem este pixel a borda de baixo do anel perde 1 px. */
const PIXEL_DO_GATILHO = 1;
/** Altura do sublinhado da aba aberta. */
const INDICADOR = 2;

/**
 * Opções da refeição em abas (19/11), no padrão Tabs da APG pelo mesmo primitivo do `ui/Abas` (`@rn-primitives/tabs`, o
 * Radix na web: setas, Home/End, Tab entra na aba aberta, `aria-selected` e o `tabpanel` ligado à aba). Peça própria porque
 * a aba tem a kcal em fonte numérica e o selo da primeira opção, e o `ui/Abas` não tem o painel; o resto é o desenho e o
 * comportamento dele: sublinhado de 2 px e título na cor de ação na aberta, as abas rolam na horizontal com a borda
 * esmaecida quando não cabem, o "+ Opção" fica fora da rolagem, e a aba aberta (a recém-criada também) vem para a vista.
 */
export function AbasDeOpcao({ rotulo, opcoes, aberta, comProblema, aoAbrir, depois, apoio, registrar, children }: Props) {
  const { cores } = useTema();
  // O esmaecido das bordas pinta com o fundo de quem contém as abas (a superfície do cartão).
  const fundo = useFundoDaArea();
  const { direita, esquerda, medidas } = useEsmaecimento();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef<ScrollView>(null);
  // Medidas lidas na rolagem e no layout, sem estado: rolar não redesenha as abas.
  const caixas = useRef<Partial<Record<string, Faixa>>>({});
  const vista = useRef({ x: 0, largura: 0, total: 0 });
  const mostrar = (uid: string, animado: boolean) => {
    const caixa = caixas.current[uid];
    const { x, largura, total } = vista.current;
    if (!caixa || !largura) return;
    const destino = deslocamentoParaVer(caixa, { x, largura }, LARGURA_ESMAECIDO, total);
    if (destino !== null) rolagem.current?.scrollTo({ x: destino, animated: animado && !reduzido });
  };
  const mostrarAtual = useRef(mostrar);
  useEffect(() => { mostrarAtual.current = mostrar; });
  // Trocou a aba (toque, seta, opção criada): a nova vem para a vista. Na montagem as medidas ainda não chegaram.
  useEffect(() => { mostrarAtual.current(aberta, true); }, [aberta]);
  return (
    <Tabs value={aberta} onValueChange={aoAbrir} style={estilos.raiz}>
      <View style={[estilos.faixa, { borderBottomColor: cores.divisor }]}>
        <View testID="faixa-das-abas" style={estilos.area}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={rolagem} scrollEventThrottle={medidas.scrollEventThrottle} style={estilos.rolagem} contentContainerStyle={estilos.conteudoRolagem}
            onLayout={(e: LayoutChangeEvent) => { medidas.onLayout(e); vista.current.largura = e.nativeEvent.layout.width; mostrar(aberta, false); }}
            onContentSizeChange={(w: number) => { medidas.onContentSizeChange(w); vista.current.total = w; mostrar(aberta, false); }}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => { medidas.onScroll(e); vista.current.x = e.nativeEvent.contentOffset.x; }}>
            <TabsList accessibilityLabel={rotulo} style={estilos.lista}>
              {opcoes.map((o, i) => {
                const sel = o.uid === aberta;
                const problema = comProblema.has(o.uid);
                return (
                  <TabsTrigger key={o.uid} value={o.uid} ref={(aba: View | null) => registrar(o.uid, aba)}
                    accessibilityRole="tab" accessibilityLabel={nomeDaAba(o, i === 0, problema)} accessibilityState={{ selected: sel }}
                    onLayout={(e: LayoutChangeEvent) => {
                      // `x` vem da lista das abas, que fica depois da folga do anel no conteúdo da rolagem.
                      caixas.current[o.uid] = { x: e.nativeEvent.layout.x + FOLGA_DO_ANEL, largura: e.nativeEvent.layout.width };
                      if (sel) mostrar(o.uid, false);
                    }}
                    style={[estilos.aba, { borderColor: sel ? cores.acao : 'transparent' }]}>
                    {/* O selo da primeira vai na linha de baixo: na mesma linha, a aba aberta passava da faixa em 390 e
                        empurrava a terceira para fora em 1280. */}
                    <View style={estilos.conteudo}>
                      {problema ? <CircleAlert size={16} color={cores.perigo} strokeWidth={2.5} /> : null}
                      <Texto style={[estilos.titulo, { color: sel ? cores.acao : cores.texto, fontFamily: sel ? fontes.semi : fontes.medio }]}>{tituloDaOpcao(o)}</Texto>
                      <Texto variante="suave" aria-hidden>·</Texto>
                      <Texto variante="suave" numerico={o.itens.length > 0}>{kcalDaAba(o)}</Texto>
                    </View>
                    {i === 0 ? <Selo texto={CONTA_NO_TOTAL} /> : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollView>
          {direita ? <Esmaecido cor={fundo} lado="direita" /> : null}
          {esquerda ? <Esmaecido cor={fundo} lado="esquerda" /> : null}
        </View>
        <View style={estilos.depois}>{depois}</View>
      </View>
      {apoio}
      <TabsContent value={aberta}>{children}</TabsContent>
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espaco(1.5) },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), borderBottomWidth: 1 },
  // A rolagem corta o que passa da caixa, e o anel de foco passa da aba: a folga do anel fica dentro do conteúdo e a área
  // avança a mesma folga para os lados (à esquerda sai da faixa sem rolar; à direita entra no vão do "+ Opção").
  area: { position: 'relative', flex: 1, minWidth: 0, marginHorizontal: -FOLGA_DO_ANEL },
  depois: { flexShrink: 0 },
  lista: { flexDirection: 'row' },
  rolagem: { marginTop: -FOLGA_DO_ANEL, marginBottom: -(FOLGA_DO_ANEL + PIXEL_DO_GATILHO) },
  conteudoRolagem: { flexDirection: 'row', paddingHorizontal: FOLGA_DO_ANEL, paddingTop: FOLGA_DO_ANEL, paddingBottom: FOLGA_DO_ANEL + PIXEL_DO_GATILHO },
  aba: {
    minHeight: ALVO_TOQUE + INDICADOR,
    paddingHorizontal: espaco(1.5),
    paddingVertical: espaco(0.5),
    // O gatilho do RNR é `flex-row` pela classe: em coluna, o selo da primeira desce para baixo do título.
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
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  titulo: { fontSize: 15 },
});
