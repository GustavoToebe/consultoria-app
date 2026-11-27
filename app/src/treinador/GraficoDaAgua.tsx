import { Check } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import type { BarraDaAgua, GraficoDaAgua as Grafico } from '../dominio/graficoDaAgua';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, misturar, textoSobre } from '../tema/tokens';
import { Texto } from '../ui/Texto';
import { useFaixaDeLargura } from '../ui/useFaixaDeLargura';

/** Altura útil das barras (a do maior entre a meta e o maior registro). */
const ALTURA = 140;
/** Folga acima da barra mais alta para o valor e o ✓ não serem cortados. */
const TOPO = 44;
/** Registro de 0 L: um traço que se vê, para não parecer dia sem registro. */
const ALTURA_MINIMA = 3;
/** Topo do degradê: a cor a 70% sobre o cartão (≥ 3:1, `tokens.test.ts`). */
const TOPO_DO_DEGRADE = 0.7;
/** Abaixo disto (largura do gráfico, ~celular) o rótulo da meta desce para a legenda e o vão encolhe: a calha à direita
 * tiraria das colunas o espaço do valor e da data, que quebrariam. */
const LARGURA_ESTREITA = 420;
/** Tracejado do dia sem registro, bem apagado: decorativo, o nome da coluna e a falta do valor dizem "sem registro". */
const TRACEJADO_APAGADO = 0.5;

/**
 * Gráfico da Água na ficha (27/11): sete colunas na largura toda do cartão, do mais antigo a "Hoje" (em negrito). Barra em
 * azul-água (`identificacao.AGUA`) com degradê vertical sutil, mais forte embaixo, na altura proporcional à meta; o dia que
 * chegou à meta leva a barra cheia (sem degradê) e o ✓ em cima. Valor em cima de cada barra com registro, em texto neutro
 * (a cor nunca é o único sinal). Dia sem registro é coluna tracejada apagada, sem valor. A linha tracejada da meta corre a
 * largura toda e termina no rótulo "Meta 5,0 L". Cada coluna tem o texto do dia como nome acessível e, na web, como dica.
 * Com "Mostrar gráficos" desligado, os mesmos textos numa lista.
 */
export function GraficoDaAgua({ grafico }: { grafico: Grafico }) {
  const { cores, preferencias, identificacao } = useTema();
  const { barras, metaFracao, rotuloDaMeta } = grafico;
  const { largura, aoMedir } = useFaixaDeLargura();
  if (!preferencias.graficos) {
    return <View style={estilos.lista}>{barras.map((b) => <Texto key={b.data} numerico>{b.texto}</Texto>)}</View>;
  }
  const agua = identificacao.AGUA.cor;
  const apagado = misturar(cores.superficie, agua, TRACEJADO_APAGADO);
  const altura = (b: BarraDaAgua) => Math.max((b.fracao ?? 0) * ALTURA, ALTURA_MINIMA);
  // Antes da primeira medida (0), o desenho largo: o PC não pisca; no celular troca no primeiro quadro.
  const estreito = largura > 0 && largura < LARGURA_ESTREITA;
  const comMeta = metaFracao !== null && rotuloDaMeta !== null;
  const vao = { gap: estreito ? espaco(0.5) : espaco(1) };
  return (
    <View style={estilos.grafico} onLayout={aoMedir}>
      <View style={estilos.colunaDoGrafico}>
        <View role="list" aria-label="Água por dia nos últimos 7 dias" style={[estilos.area, vao]}>
          {metaFracao !== null ? (
            <View aria-hidden pointerEvents="none" style={[estilos.meta, { bottom: metaFracao * ALTURA, borderColor: cores.textoSuave }]} />
          ) : null}
          {barras.map((b) => (
            <Coluna key={b.data} texto={b.texto}>
              {b.fracao === null ? (
                <View style={[estilos.barra, estilos.semRegistro, { height: (metaFracao ?? 1) * ALTURA, borderColor: apagado }]} />
              ) : (
                <>
                  <Texto variante="pequeno" numerico numberOfLines={1} cor={cores.texto} style={estilos.valor}>{b.valor}</Texto>
                  {b.bateuMeta ? (
                    <View style={[estilos.check, { backgroundColor: agua }]}>
                      <Check size={12} strokeWidth={3} color={textoSobre(agua)} />
                    </View>
                  ) : null}
                  <View testID="barra-da-agua" style={[estilos.barra, { height: altura(b) }, b.bateuMeta ? { backgroundColor: agua } : degrade(agua, misturar(cores.superficie, agua, TOPO_DO_DEGRADE))]} />
                </>
              )}
            </Coluna>
          ))}
        </View>
        {/* Os rótulos já estão no nome de cada coluna: aqui são só para ver. */}
        <View aria-hidden style={[estilos.rotulos, vao]}>
          {barras.map((b) => (
            <Texto key={b.data} variante="pequeno" numerico numberOfLines={1} style={[estilos.rotulo, b.hoje ? estilos.hoje : null]}
              cor={b.hoje ? cores.texto : cores.textoSuave}>{b.rotulo}</Texto>
          ))}
        </View>
        {comMeta && estreito ? (
          // No estreito, a legenda da linha embaixo, à direita: tracejado curto + "Meta 5,0 L".
          <View aria-hidden style={estilos.legenda}>
            <View style={[estilos.amostraDaMeta, { borderColor: cores.textoSuave }]} />
            <Texto variante="pequeno" numerico>{rotuloDaMeta}</Texto>
          </View>
        ) : null}
      </View>
      {comMeta && !estreito ? (
        // O rótulo fica centrado na altura da linha, fora das colunas, para não cobrir o valor de "Hoje".
        <View aria-hidden style={[estilos.calha, { paddingBottom: Math.max((metaFracao ?? 0) * ALTURA - 9, 0) }]}>
          <Texto variante="pequeno" numerico>{rotuloDaMeta}</Texto>
        </View>
      ) : null}
    </View>
  );
}

/** Degradê vertical, mais forte embaixo: CSS na web, `experimental_backgroundImage` no nativo (o molde de `fundoPintado`). */
function degrade(forte: string, fraco: string): ViewStyle {
  const imagem = `linear-gradient(to top, ${forte} 0%, ${fraco} 100%)`;
  // A chave do web não existe no `ViewStyle` do React Native: o mesmo molde do `position: 'sticky'` das telas.
  return Platform.OS === 'web'
    ? ({ backgroundColor: forte, backgroundImage: imagem } as unknown as ViewStyle)
    : { backgroundColor: forte, experimental_backgroundImage: imagem };
}

/** A coluna de um dia: item da lista com `role=img` e o texto do dia; na web, também o `title` (o react-native-web não o repassa: vai pelo nó). */
function Coluna({ texto, children }: { texto: string; children: ReactNode }) {
  const no = useRef<View>(null);
  useEffect(() => {
    const el: unknown = no.current;
    if (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) el.title = texto;
  }, [texto]);
  return (
    <View role="listitem" style={estilos.coluna}>
      <View ref={no} role="img" aria-label={texto} style={estilos.alvo}>{children}</View>
    </View>
  );
}

// Colunas e rótulos na mesma grade (mesmo `flex` e o mesmo vão), para cada rótulo ficar sob a sua barra.
const estilos = StyleSheet.create({
  grafico: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(1) },
  colunaDoGrafico: { flex: 1, minWidth: 0, gap: espaco(0.75) },
  lista: { gap: espaco(0.5) },
  area: { height: ALTURA + TOPO, flexDirection: 'row' },
  coluna: { flex: 1, minWidth: 0 },
  alvo: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: espaco(0.5) },
  rotulos: { flexDirection: 'row' },
  rotulo: { flex: 1, minWidth: 0, textAlign: 'center' },
  hoje: { fontFamily: fontes.negrito },
  valor: { textAlign: 'center' },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  barra: { width: '88%', maxWidth: 56, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  semRegistro: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 6 },
  meta: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  calha: { height: ALTURA + TOPO, justifyContent: 'flex-end' },
  legenda: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espaco(0.75) },
  amostraDaMeta: { width: 20, height: 0, borderTopWidth: 1, borderStyle: 'dashed' },
});
