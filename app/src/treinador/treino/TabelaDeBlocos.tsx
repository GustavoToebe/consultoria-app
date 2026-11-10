import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { textoAcessivelDoBloco, textoDaVariacao, type ResumoDoBloco } from '../../dominio/editorDeTreino';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, BORDA_ITEM, espaco, fontes, RAIO } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

export interface LinhaDoBloco {
  /** uid da 1ª série do bloco (o mesmo valor da antiga aba). */
  valor: string;
  /** "Série 2 · WS": começo do nome acessível e da coluna Bloco. */
  rotulo: string;
  resumo: ResumoDoBloco;
  problema?: 'perigo' | 'atencao';
  corIndicador?: string;
}

const TEXTO_DO_PROBLEMA = { perigo: 'com problema a corrigir', atencao: 'com aviso' } as const;

/** Abaixo desta largura da própria tabela as quatro colunas viram uma linha de bloco empilhada (390 e o inspetor estreito). */
const LARGURA_DAS_COLUNAS = 540;

/**
 * Tabela dos blocos do exercício (10/11): Bloco, Quantidade, Repetições e Descanso, uma linha por bloco de `agrupar`, com o
 * que varia entre as séries do bloco embaixo do nome. É uma lista de abas **vertical** com ativação manual (APG Tabs):
 * setas movem o foco, Enter ou Espaço escolhem; o foco é o anel do `:focus-visible`, a escolhida fica invertida e o erro
 * é borda e ícone na cor, três sinais que não se confundem. O editor do bloco escolhido fica embaixo (`EditorSeries`).
 */
export function TabelaDeBlocos({ linhas, ativa, aoMudar, depois }: {
  linhas: LinhaDoBloco[];
  ativa: string;
  aoMudar: (valor: string) => void;
  /** "+ Nova série", logo abaixo da última linha. */
  depois?: ReactNode;
}) {
  const { cores } = useTema();
  const [largura, setLargura] = useState<number | null>(null);
  // O primitivo na web descarta `style` em função: o hover vem do mouse sobre a linha.
  const [sobre, setSobre] = useState<string | null>(null);
  const colunas = largura === null || largura >= LARGURA_DAS_COLUNAS;
  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  return (
    <View style={estilos.tabela} onLayout={medir}>
      {colunas ? (
        // Cabeçalho só visual: cada linha já diz os quatro valores no nome acessível.
        <View style={[estilos.linha, estilos.cabecalho]} aria-hidden importantForAccessibility="no-hide-descendants">
          <Texto variante="rotulo" style={estilos.bloco}>Bloco</Texto>
          <Texto variante="rotulo" style={estilos.quantidade}>Quantidade</Texto>
          <Texto variante="rotulo" style={estilos.repeticoes}>Repetições</Texto>
          <Texto variante="rotulo" style={estilos.descanso}>Descanso</Texto>
        </View>
      ) : null}
      <Tabs value={ativa} onValueChange={aoMudar} orientation="vertical" activationMode="manual">
        <TabsList aria-label="Blocos do exercício" style={estilos.lista}>
          {linhas.map((l) => {
            const sel = l.valor === ativa;
            const corDoProblema = l.problema ? cores[l.problema] : null;
            const Icone = l.problema === 'perigo' ? CircleAlert : TriangleAlert;
            const forte = sel ? cores.fundo : cores.texto;
            const suave = sel ? cores.fundo : cores.textoSuave;
            const variacao = textoDaVariacao(l.resumo.variacao);
            const rotulo = [textoAcessivelDoBloco(l.rotulo, l.resumo), l.problema ? TEXTO_DO_PROBLEMA[l.problema] : null].filter(Boolean).join(', ');
            const nome = (
              <View style={estilos.nome}>
                <View style={estilos.titulo}>
                  {/* Na escolhida o ícone e o anel do ponto ficam na cor do texto invertido (contraste em todo tema). */}
                  {corDoProblema ? <Icone size={16} color={sel ? cores.fundo : corDoProblema} strokeWidth={2.5} /> : null}
                  {l.corIndicador ? <View style={[estilos.ponto, { backgroundColor: l.corIndicador, borderColor: sel ? cores.fundo : 'transparent' }]} /> : null}
                  <Texto style={[estilos.forte, { color: forte }]}>{l.rotulo}</Texto>
                </View>
                {l.resumo.nome ? <Texto variante="pequeno" cor={suave}>{l.resumo.nome}</Texto> : null}
                {variacao ? <Texto variante="pequeno" cor={suave}>{variacao}</Texto> : null}
              </View>
            );
            const series = `${l.resumo.quantidade} ${l.resumo.quantidade === 1 ? 'série' : 'séries'}`;
            return (
              <TabsTrigger key={l.valor} value={l.valor} accessibilityRole="tab" accessibilityLabel={rotulo} accessibilityState={{ selected: sel }}
                {...(Platform.OS === 'web' ? ({ onMouseEnter: () => setSobre(l.valor), onMouseLeave: () => setSobre(null) } as object) : {})}
                style={[estilos.caixa, sel ? { backgroundColor: cores.texto, borderColor: cores.texto } : { backgroundColor: sobre === l.valor ? cores.superficie3 : cores.superficie2, borderColor: corDoProblema ?? cores.bordaCampo }]}>
                {colunas ? (
                  <View style={estilos.linha}>
                    <View style={estilos.bloco}>{nome}</View>
                    <Texto numerico style={[estilos.quantidade, { color: forte }]}>{series}</Texto>
                    <Texto numerico style={[estilos.repeticoes, { color: forte }]}>{l.resumo.repeticoes}</Texto>
                    <Texto numerico style={[estilos.descanso, { color: forte }]}>{l.resumo.descanso}</Texto>
                  </View>
                ) : (
                  <View style={estilos.empilhado}>
                    {nome}
                    <Texto variante="pequeno" numerico cor={forte}>{`${series} · ${l.resumo.repeticoes} · descanso ${l.resumo.descanso}`}</Texto>
                  </View>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {depois ? <View style={estilos.depois}>{depois}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tabela: { gap: espaco(0.5) },
  // A lista e o gatilho do `components/ui/tabs` nascem em linha, `w-fit` e centrados: aqui são coluna e linha cheia.
  lista: { flexDirection: 'column', width: '100%', gap: espaco(0.5) },
  caixa: {
    width: '100%', height: 'auto', minHeight: ALVO_TOQUE, justifyContent: 'flex-start', alignItems: 'stretch',
    paddingHorizontal: espaco(1.5), paddingVertical: espaco(0.75), borderWidth: BORDA_ITEM, borderRadius: RAIO,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), width: '100%' },
  // Mesmo recuo da linha (padding mais a borda), para as colunas do cabeçalho caírem sobre os valores.
  cabecalho: { paddingHorizontal: espaco(1.5) + BORDA_ITEM },
  bloco: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  quantidade: { width: 88, flexShrink: 0 },
  repeticoes: { width: 120, flexShrink: 0 },
  descanso: { width: 148, flexShrink: 0 },
  nome: { gap: espaco(0.25), minWidth: 0 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), flexWrap: 'wrap' },
  forte: { fontFamily: fontes.semi, fontSize: 15, flexShrink: 1 },
  empilhado: { gap: espaco(0.5), width: '100%' },
  ponto: { width: espaco(1) + 2, height: espaco(1) + 2, borderRadius: espaco(0.5) + 1, borderWidth: 1 },
  depois: { alignItems: 'flex-start', paddingTop: espaco(0.5) },
});
