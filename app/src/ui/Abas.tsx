import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { deslocamentoParaVer, type Faixa } from '../dominio/rolagemHorizontal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../tema/tokens';
import { Esmaecido, LARGURA_ESMAECIDO, useEsmaecimento } from './FaixaDeChips';
import { useFundoDaArea } from './fundoDaArea';
import { Selo } from './Selo';
import { Texto } from './Texto';
import { useMovimentoReduzido } from './useMovimentoReduzido';

interface Props<T extends string> {
  /** `contagem` aparece num círculo ao lado do rótulo ("Para revisar 3"). */
  abas: {
    valor: T; rotulo: string; contagem?: number;
    /** Código curto num selo neutro ao lado do rótulo ("3× WS"). */
    detalhe?: string;
    /** Aba com erro ou aviso da validação: ícone na cor, e o nome acessível diz qual. */
    problema?: 'perigo' | 'atencao';
    corIndicador?: string;
  }[];
  ativa: T;
  aoMudar: (valor: T) => void;
  /** Cor atrás das abas (fundo da tela ou superfície do cartão), para o esmaecido das bordas casar. */
  fundo?: string;
  /**
   * `automatica` (padrão): focar uma aba a seleciona (seta do teclado). `manual`: a seta só move o foco e Enter ou Espaço
   * seleciona; use quando trocar de aba tem consequência (pergunta "Sair sem salvar?", que devolve o foco à aba clicada
   * e, no modo automático, pediria a troca de novo).
   */
  ativacao?: 'automatica' | 'manual';
  /**
   * À direita da faixa, fora da rolagem e da lista de abas (o "+ Nova série"): sempre inteiro à vista, por mais abas que
   * haja; só as abas rolam.
   */
  depois?: ReactNode;
}

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/**
 * Abas de texto: a ativa em texto principal com o pequeno indicador da marca embaixo (`marcaPeca`, 2 px, ≥ 3:1); as
 * outras em texto secundário. Rolam na horizontal se não couberem no celular, com a borda esmaecida
 * do lado em que há mais abas (sem isso "Atua…" parecia cortado). A aba ativa é rolada para a vista, inteira e fora do
 * esmaecido (C5): ao abrir por link uma aba do fim (`?aba=`), ao voltar, ou ao tocar numa aba meio escondida. Alvo de 44 px.
 */
export function Abas<T extends string>({ abas, ativa, aoMudar, fundo, depois, ativacao = 'automatica' }: Props<T>) {
  const { cores, marcaPeca } = useTema();
  const { direita, esquerda, medidas } = useEsmaecimento();
  const daArea = useFundoDaArea();
  const cor = fundo ?? daArea;
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
  // Trocou a aba (toque, voltar do navegador, link): a nova vem para a vista. Na montagem as medidas ainda não chegaram.
  useEffect(() => { mostrarAtual.current(ativa, true); }, [ativa]);
  const medidasDaRolagem = {
    ...medidas,
    ref: rolagem,
    onLayout: (e: LayoutChangeEvent) => {
      medidas.onLayout(e);
      vista.current.largura = e.nativeEvent.layout.width;
      mostrar(ativa, false);
    },
    onContentSizeChange: (w: number) => {
      medidas.onContentSizeChange(w);
      vista.current.total = w;
      // Os rótulos medem depois da rolagem: sem isto, a aba ativa no fim da faixa não entra na vista na abertura.
      mostrar(ativa, false);
    },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      medidas.onScroll(e);
      vista.current.x = e.nativeEvent.contentOffset.x;
    },
  };
  return (
    <Tabs value={ativa} onValueChange={(v) => aoMudar(v as T)} activationMode={ativacao === 'manual' ? 'manual' : 'automatic'} style={[estilos.borda, { borderColor: cores.divisor }]}>
      <View style={depois ? estilos.comDepois : null}>
      <View style={[estilos.area, depois ? estilos.areaQueCede : null]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.rolagem} contentContainerStyle={estilos.conteudoRolagem} {...medidasDaRolagem}>
        <TabsList style={estilos.linha}>
          {abas.map((a) => {
            const sel = a.valor === ativa;
            const rotulo = [a.contagem === undefined ? a.rotulo : `${a.rotulo} (${a.contagem})`, a.detalhe, a.problema ? TEXTO_DO_PROBLEMA[a.problema] : null].filter(Boolean).join(', ');
            const corDoProblema = a.problema ? cores[a.problema] : null;
            const IconeDoProblema = a.problema === 'perigo' ? CircleAlert : TriangleAlert;
            return (
              <TabsTrigger value={a.valor}
                key={a.valor}
                accessibilityRole="tab"
                accessibilityLabel={rotulo}
                accessibilityState={{ selected: sel }}
                onLayout={(e: LayoutChangeEvent) => {
                  // `x` vem da lista das abas, que fica depois da folga do anel no conteúdo da rolagem.
                  caixas.current[a.valor] = { x: e.nativeEvent.layout.x + FOLGA_DO_ANEL, largura: e.nativeEvent.layout.width };
                  if (sel) mostrar(a.valor, false);
                }}
                style={[estilos.aba, { borderColor: sel ? marcaPeca : 'transparent' }]}>
                <View style={estilos.conteudo}>
                  {corDoProblema ? <IconeDoProblema size={16} color={corDoProblema} strokeWidth={2.5} /> : null}
                  {a.corIndicador ? <View style={[estilos.ponto, { backgroundColor: a.corIndicador }]} /> : null}
                  <Texto style={[estilos.texto, { color: sel ? cores.texto : cores.textoSuave, fontFamily: sel ? fontes.semi : fontes.medio }]}>{a.rotulo}</Texto>
                  {a.detalhe ? <Selo texto={a.detalhe} tipo="neutro" /> : null}
                  {a.contagem === undefined ? null : (
                    <View style={[estilos.contagem, { backgroundColor: cores.superficie3 }]}>
                      <Texto numerico style={[estilos.textoContagem, { color: cores.texto }]}>{a.contagem}</Texto>
                    </View>
                  )}
                </View>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </ScrollView>
      {direita ? <Esmaecido cor={cor} lado="direita" /> : null}
      {esquerda ? <Esmaecido cor={cor} lado="esquerda" /> : null}
      </View>
      {depois ? <View style={estilos.depois}>{depois}</View> : null}
      </View>
    </Tabs>
  );
}

/** Largura do anel (2 px) mais o afastamento (2 px) do `:focus-visible` do `global.css`. */
const FOLGA_DO_ANEL = 4;
/** O gatilho (web) fica 1 px mais alto que a lista (`h-[calc(100%-1px)]` contra o `minHeight` da aba): sem este pixel a borda de baixo do anel perde 1 px. */
const PIXEL_DO_GATILHO = 1;
/** Altura do indicador da aba ativa (o sublinhado na `marcaPeca`). */
const INDICADOR = 2;

const estilos = StyleSheet.create({
  borda: { borderBottomWidth: 1 },
  area: { position: 'relative' },
  comDepois: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  areaQueCede: { flex: 1, minWidth: 0 },
  depois: { flexShrink: 0 },
  linha: { flexDirection: 'row' },
  // A rolagem corta tudo que passa da sua caixa, e o anel de foco (2 px + 2 px de folga, global.css) passa da aba:
  // a folga dentro do conteúdo é devolvida com margem negativa, então o layout não muda.
  rolagem: { marginHorizontal: -FOLGA_DO_ANEL, marginTop: -FOLGA_DO_ANEL, marginBottom: -(FOLGA_DO_ANEL + PIXEL_DO_GATILHO) },
  conteudoRolagem: { flexDirection: 'row', paddingHorizontal: FOLGA_DO_ANEL, paddingTop: FOLGA_DO_ANEL, paddingBottom: FOLGA_DO_ANEL + PIXEL_DO_GATILHO },
  aba: {
    // 44 px de alvo mais o sublinhado, que entra na própria altura.
    minHeight: ALVO_TOQUE + INDICADOR,
    paddingHorizontal: espaco(1.5),
    justifyContent: 'center',
    // O gatilho do RNR traz borda nos quatro lados, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado.
    borderWidth: 0,
    borderBottomWidth: INDICADOR,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  texto: { fontSize: 15 },
  ponto: { width: espaco(1), height: espaco(1), borderRadius: espaco(0.5), marginRight: espaco(0.25) },
  contagem: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  textoContagem: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
});
