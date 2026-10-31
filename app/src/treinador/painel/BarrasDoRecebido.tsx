import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgTexto } from 'react-native-svg';

import { reaisCompactos } from '../../dominio/financeiro';
import { marcasDoEixo } from '../../dominio/grafico';
import type { BarrasDoPainel, MesDasBarras } from '../../dominio/painelDoInicio';
import { escalar } from '../../dominio/preferencias';
import { useTema } from '../../tema/TemaProvider';
import { espaco, fontes } from '../../tema/tokens';
import { Tabela } from '../../ui/Tabela';
import { Texto } from '../../ui/Texto';

const ALTURA = 220;
const MARGEM = { topo: 12, base: 26, esq: 64, dir: 8 };
/** Abaixo disto o rótulo do mês encurta ("out/26"). */
const LARGURA_CURTA = 480;

/** "out/2026" vira "out/26" quando a largura aperta. */
const rotuloCurto = (m: MesDasBarras) => m.rotulo.replace(/\/(\d{2})(\d{2})$/, '/$2');

/**
 * Barras do recebido (bruto, na cor do texto) e dos lançamentos (cinza) dos últimos 6 meses, em SVG sem biblioteca. As
 * cores são de dado, nunca da marca. O leitor de tela recebe a descrição com todos os valores (o desenho é uma imagem
 * só); com "Mostrar gráficos" desligado ou sem nenhum valor vira a tabela com os mesmos números. Mês sem dado: "—", sem
 * barra; o mês em andamento vem em negrito, com "*".
 */
export function BarrasDoRecebido({ barras }: { barras: BarrasDoPainel }) {
  const { cores, fatorTexto } = useTema();
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const comTabela = !barras.desenhar || barras.semDados;
  const corDe = (cor: 'texto' | 'neutro') => (cor === 'texto' ? cores.texto : cores.neutro);

  return (
    <View style={estilos.area}>
      {comTabela ? (
        <Tabela
          rotulo={barras.titulo}
          linhas={barras.meses}
          chave={(m) => m.mes}
          larguraMinima={360}
          colunas={[
            { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.2, render: (m) => <Texto style={m.parcial ? estilos.parcial : null}>{m.rotulo}{m.parcial ? '*' : ''}</Texto> },
            { chave: 'recebido', titulo: barras.series[0].rotulo, alinhar: 'direita', render: (m) => <Texto numerico>{m.recebidoTexto}</Texto> },
            { chave: 'lancamentos', titulo: barras.series[1].rotulo, alinhar: 'direita', render: (m) => <Texto numerico>{m.lancamentosTexto}</Texto> },
          ]}
        />
      ) : (
        <>
          <View style={estilos.legenda} aria-hidden importantForAccessibility="no-hide-descendants">
            {barras.series.map((s) => (
              <View key={s.chave} style={estilos.itemDaLegenda}>
                <View style={[estilos.quadrado, { backgroundColor: corDe(s.cor) }]} />
                <Texto variante="pequeno" cor={cores.texto}>{s.rotulo}</Texto>
              </View>
            ))}
          </View>
          <View onLayout={aoMedir} accessible accessibilityRole="image" accessibilityLabel={barras.descricao}>
            {largura > 0 ? (
              <Svg width={largura} height={ALTURA} aria-hidden>
                <Desenho barras={barras} largura={largura} fonte={escalar(12, fatorTexto)} cores={cores} />
              </Svg>
            ) : <View style={{ height: ALTURA }} />}
          </View>
        </>
      )}
      {barras.notas.map((n) => <Texto key={n} variante="pequeno">{n}</Texto>)}
    </View>
  );
}

function Desenho({ barras, largura, fonte, cores }: {
  barras: BarrasDoPainel; largura: number; fonte: number; cores: ReturnType<typeof useTema>['cores'];
}) {
  const maxReais = Math.max(barras.maximo / 100, 1);
  const marcas = marcasDoEixo(0, maxReais * 1.08);
  const topo = Math.max(...marcas, maxReais);
  const areaW = largura - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const y = (reais: number) => MARGEM.topo + (1 - reais / topo) * areaH;
  const n = Math.max(barras.meses.length, 1);
  const faixa = areaW / n;
  const larguraBarra = Math.max(Math.min(faixa * 0.3, 28), 4);
  const curto = largura < LARGURA_CURTA;
  const corDe = (cor: 'texto' | 'neutro') => (cor === 'texto' ? cores.texto : cores.neutro);
  const [recebido, lancamentos] = barras.series;

  const barra = (valor: number | null, x: number, cor: string, chave: string) => {
    if (valor === null) {
      return <SvgTexto key={chave} x={x + larguraBarra / 2} y={y(0) - 4} fontSize={fonte} fill={cores.textoSuave} textAnchor="middle">—</SvgTexto>;
    }
    if (valor <= 0) return null;
    return <Rect key={chave} x={x} y={y(valor / 100)} width={larguraBarra} height={Math.max(y(0) - y(valor / 100), 1)} fill={cor} rx={2} />;
  };

  return (
    <>
      {marcas.map((m) => (
        <Line key={m} x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={cores.divisor} strokeWidth={1} />
      ))}
      <Line x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(0)} y2={y(0)} stroke={cores.bordaCampo} strokeWidth={1} />
      {marcas.map((m) => (
        <SvgTexto key={`t${m}`} x={MARGEM.esq - 6} y={y(m) + 4} fontSize={fonte} fill={cores.textoSuave} textAnchor="end">
          {reaisCompactos(m)}
        </SvgTexto>
      ))}
      {barras.meses.map((m, i) => {
        const centro = MARGEM.esq + faixa * i + faixa / 2;
        return (
          <G key={m.mes}>
            {barra(m.recebido, centro - larguraBarra - 1, corDe(recebido.cor), 'r')}
            {barra(m.lancamentos, centro + 1, corDe(lancamentos.cor), 'l')}
            <SvgTexto x={centro} y={ALTURA - 8} fontSize={fonte} fill={m.parcial ? cores.texto : cores.textoSuave} fontWeight={m.parcial ? 'bold' : 'normal'} textAnchor="middle">
              {`${curto ? rotuloCurto(m) : m.rotulo}${m.parcial ? '*' : ''}`}
            </SvgTexto>
          </G>
        );
      })}
    </>
  );
}

const estilos = StyleSheet.create({
  area: { gap: espaco(1) },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(2), justifyContent: 'center' },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  quadrado: { width: 12, height: 12, borderRadius: 3 },
  parcial: { fontFamily: fontes.negrito },
});
