import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgTexto } from 'react-native-svg';

import { escalar } from '../dominio/preferencias';
import { descricaoDoGrafico, graficoTemDados, linhasDaTabelaDoGrafico, maiorValorDoGrafico, reaisCompactos, type BarraDoMes } from '../dominio/financeiro';
import { marcasDoEixo } from '../dominio/grafico';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Tabela } from './Tabela';
import { Texto } from './Texto';

const ALTURA_BASE = 240;
const MARGEM_BASE = { topo: 14, base: 24, esq: 70, dir: 12 };
/** Abaixo desta largura as barras ficam apertadas demais para ler: o gráfico vira tabela. */
const LARGURA_MINIMA_DO_GRAFICO = 420;

/**
 * Gráfico de barras mês a mês (SVG): realizado (verde) e previsto (âmbar) lado a lado. As cores têm significado (nunca a
 * marca). Com a preferência "Mostrar gráficos" desligada, ou numa tela estreita, vira tabela com os mesmos valores.
 * O leitor de tela recebe a lista de valores em texto (o SVG é decorativo). Valor ausente fica sem barra e "—" na tabela.
 */
export function GraficoBarras({ barras, rotulo = 'Recebido e previsto por mês' }: { barras: BarraDoMes[]; rotulo?: string }) {
  const { cores, fatorTexto, preferencias } = useTema();
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  const descricao = `${rotulo}. ${descricaoDoGrafico(barras)}`;
  const comTabela = !preferencias.graficos || (largura > 0 && largura < LARGURA_MINIMA_DO_GRAFICO) || !graficoTemDados(barras);

  const fonte = escalar(11, fatorTexto);
  const MARGEM = { ...MARGEM_BASE, base: escalar(MARGEM_BASE.base, fatorTexto), esq: escalar(MARGEM_BASE.esq, fatorTexto) };
  const ALTURA = ALTURA_BASE + (MARGEM.base - MARGEM_BASE.base);

  if (barras.length === 0) return null;

  return (
    <View onLayout={aoMedir} style={{ gap: espaco(1) }}>
      {comTabela ? (
        <Tabela
          rotulo={rotulo}
          linhas={linhasDaTabelaDoGrafico(barras)}
          chave={(l) => l.rotulo}
          colunas={[
            { chave: 'mes', titulo: 'Mês', principal: true, flex: 1.4, render: (l) => <Texto>{l.rotulo}</Texto> },
            { chave: 'realizado', titulo: 'Recebido', alinhar: 'direita', render: (l) => <Texto>{l.realizado}</Texto> },
            { chave: 'previsto', titulo: 'Previsto', alinhar: 'direita', render: (l) => <Texto>{l.previsto}</Texto> },
          ]}
        />
      ) : largura > 0 ? (
        <View accessible accessibilityRole="image" accessibilityLabel={descricao}>
          <Svg width={largura} height={ALTURA} aria-hidden>
            {desenho({ barras, largura, ALTURA, MARGEM, fonte, cores })}
          </Svg>
        </View>
      ) : (
        <View style={{ height: ALTURA }} />
      )}
      {comTabela ? null : (
        <View style={{ flexDirection: 'row', gap: espaco(2), flexWrap: 'wrap' }}>
          <Legenda cor={cores.sucesso} texto="Recebido" />
          <Legenda cor={cores.atencao} texto="Previsto (cobranças já geradas)" />
        </View>
      )}
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: cor }} />
      <Texto variante="pequeno">{texto}</Texto>
    </View>
  );
}

function desenho({ barras, largura, ALTURA, MARGEM, fonte, cores }: {
  barras: BarraDoMes[];
  largura: number;
  ALTURA: number;
  MARGEM: { topo: number; base: number; esq: number; dir: number };
  fonte: number;
  cores: ReturnType<typeof useTema>['cores'];
}) {
  const maxReais = Math.max(maiorValorDoGrafico(barras) / 100, 1);
  const marcas = marcasDoEixo(0, maxReais * 1.08);
  const topo = Math.max(...marcas, maxReais);
  const areaW = largura - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const y = (reais: number) => MARGEM.topo + (1 - reais / topo) * areaH;
  const faixa = areaW / barras.length;
  const larguraBarra = Math.max(Math.min(faixa * 0.36, 28), 3);
  const passoRotulo = Math.max(1, Math.ceil(barras.length / Math.max(Math.floor(areaW / 64), 1)));
  return (
    <>
      {marcas.map((m) => (
        <Line key={m} x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={cores.borda} strokeWidth={1} />
      ))}
      {marcas.map((m) => (
        <SvgTexto key={`t${m}`} x={MARGEM.esq - 6} y={y(m) + 4} fontSize={fonte} fill={cores.textoSuave} textAnchor="end">
          {reaisCompactos(m)}
        </SvgTexto>
      ))}
      {barras.map((b, i) => {
        const centro = MARGEM.esq + faixa * i + faixa / 2;
        return (
          <G key={b.rotulo}>
            {b.realizado !== null && b.realizado > 0 ? (
              <Rect x={centro - larguraBarra - 1} y={y(b.realizado / 100)} width={larguraBarra} height={Math.max(y(0) - y(b.realizado / 100), 1)} fill={cores.sucesso} rx={2} />
            ) : null}
            {b.previsto !== null && b.previsto > 0 ? (
              <Rect x={centro + 1} y={y(b.previsto / 100)} width={larguraBarra} height={Math.max(y(0) - y(b.previsto / 100), 1)} fill={cores.atencao} rx={2} />
            ) : null}
          </G>
        );
      })}
      {barras.map((b, i) =>
        i % passoRotulo === 0 || i === barras.length - 1 ? (
          <SvgTexto key={`r${i}`} x={MARGEM.esq + faixa * i + faixa / 2} y={ALTURA - 6} fontSize={fonte} fill={cores.textoSuave} textAnchor="middle">
            {b.rotulo.replace(' (até hoje)', '')}
          </SvgTexto>
        ) : null,
      )}
    </>
  );
}
