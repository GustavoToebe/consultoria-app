import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { deslocamentoParaVer, type Faixa } from '../dominio/rolagemHorizontal';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_ITEM, espaco, fontes, LINHA_DA_FAIXA, RAIO } from '../tema/tokens';
import { Esmaecido, LARGURA_ESMAECIDO, useEsmaecimento } from './FaixaDeChips';
import { Selo } from './Selo';
import { Texto } from './Texto';
import { useMovimentoReduzido } from './useMovimentoReduzido';

interface Props<T extends string> {
  /** `contagem` aparece num círculo ao lado do rótulo ("Para revisar 3"). */
  abas: {
    valor: T; rotulo: string; contagem?: number;
    /** Código curto num selo neutro ao lado do rótulo ("3× WS"). */
    detalhe?: string;
    /** Aba com erro ou aviso da validação: ícone e borda na cor, e o nome acessível diz qual. */
    problema?: 'perigo' | 'atencao';
    corIndicador?: string;
  }[];
  ativa: T;
  aoMudar: (valor: T) => void;
  /** Cor atrás das abas (fundo da tela ou superfície do cartão), para o esmaecido das bordas casar. */
  fundo?: string;
  /**
   * `sublinhado` (padrão): texto com o sublinhado na cor da marca. `invertida`: cada aba é uma caixa e a selecionada fica
   * invertida (fundo `texto`, texto `fundo`), como a opção ativa da `Escolha`; é a das séries do exercício.
   */
  variante?: 'sublinhado' | 'invertida';
  /**
   * À direita da faixa, fora da rolagem e da lista de abas (o "+ Nova série"): sempre inteiro à vista, por mais abas que
   * haja; só as abas rolam.
   */
  depois?: ReactNode;
}

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/**
 * Abas de texto com sublinhado de 3 px na cor da marca (a mesma espessura da linha da faixa, `LINHA_DA_FAIXA`); rolam na horizontal se não couberem no celular, com a borda esmaecida
 * do lado em que há mais abas (sem isso "Atua…" parecia cortado). A aba ativa é rolada para a vista, inteira e fora do
 * esmaecido (C5): ao abrir por link uma aba do fim (`?aba=`), ao voltar, ou ao tocar numa aba meio escondida. Alvo de 44 px.
 */
export function Abas<T extends string>({ abas, ativa, aoMudar, fundo, variante = 'sublinhado', depois }: Props<T>) {
  const invertida = variante === 'invertida';
  const { cores, marca } = useTema();
  const { direita, esquerda, medidas } = useEsmaecimento();
  const cor = fundo ?? cores.fundo;
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
    <Tabs value={ativa} onValueChange={(v) => aoMudar(v as T)} style={invertida ? null : [estilos.borda, { borderColor: cores.borda }]}>
      <View style={depois ? estilos.comDepois : null}>
      <View style={[estilos.area, depois ? estilos.areaQueCede : null]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.rolagem} contentContainerStyle={estilos.conteudoRolagem} {...medidasDaRolagem}>
        <TabsList style={[estilos.linha, invertida ? estilos.linhaInvertida : null]}>
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
                style={invertida
                  ? [estilos.caixa, sel ? { backgroundColor: cores.texto, borderColor: cores.texto } : { backgroundColor: cores.superficie2, borderColor: corDoProblema ?? cores.bordaCampo }]
                  : [estilos.aba, { borderColor: sel ? marca : 'transparent' }]}>
                <View style={estilos.conteudo}>
                  {/* Na selecionada o ícone fica na cor do texto invertido: vermelho ou âmbar sobre o fundo escuro não passa 3:1 em todo tema. */}
                  {invertida && corDoProblema ? <IconeDoProblema size={16} color={sel ? cores.fundo : corDoProblema} strokeWidth={2.5} /> : null}
                  {/* Na selecionada a cor do tipo (livre, do treinador) não passa 3:1 sobre o fundo invertido: o anel em `fundo` separa o ponto. */}
                  {a.corIndicador ? <View style={[estilos.ponto, { backgroundColor: a.corIndicador, borderColor: invertida && sel ? cores.fundo : 'transparent' }]} /> : null}
                  <Texto style={[estilos.texto, { color: invertida ? (sel ? cores.fundo : cores.texto) : sel ? cores.texto : cores.textoSuave }]}>{a.rotulo}</Texto>
                  {a.detalhe ? <Selo texto={a.detalhe} tipo="neutro" /> : null}
                  {a.contagem === undefined ? null : (
                    <View style={[estilos.contagem, { backgroundColor: sel ? cores.texto : cores.superficie2, borderColor: sel ? cores.texto : cores.borda }]}>
                      <Texto numerico style={[estilos.textoContagem, { color: sel ? cores.fundo : cores.textoSuave }]}>{a.contagem}</Texto>
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
const ANEL_DO_PONTO = 1;

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
    minHeight: ALVO_TOQUE + LINHA_DA_FAIXA,
    paddingHorizontal: espaco(1.5),
    justifyContent: 'center',
    // O gatilho do RNR traz borda nos quatro lados, cantos e fundo na aba ativa; aqui a aba ativa é só o sublinhado.
    borderWidth: 0,
    borderBottomWidth: LINHA_DA_FAIXA,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -1,
  },
  linhaInvertida: { gap: espaco(1) },
  // Caixa de 44 px com borda de item; a selecionada é invertida (a cor vem do tema).
  caixa: { minHeight: ALVO_TOQUE, paddingHorizontal: espaco(1.5), justifyContent: 'center', borderWidth: BORDA_ITEM, borderRadius: RAIO },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  texto: { fontFamily: fontes.semi, fontSize: 15 },
  // Anel de 1 px sempre presente (transparente na aba não selecionada), para a aba não mudar de tamanho ao selecionar.
  ponto: { width: espaco(1) + 2 * ANEL_DO_PONTO, height: espaco(1) + 2 * ANEL_DO_PONTO, borderRadius: espaco(0.5) + ANEL_DO_PONTO, borderWidth: ANEL_DO_PONTO, marginRight: espaco(0.25) },
  contagem: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textoContagem: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 16 },
});
