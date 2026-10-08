import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgTexto } from 'react-native-svg';

import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { marcasDoEixo } from '../dominio/grafico';
import { Texto } from './Texto';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

const ALTURA = 180;
const MARGEM = { topo: 14, base: 24, esq: 40, dir: 14 };

/** Gráfico de linha simples (SVG). Pontos já na ordem do eixo horizontal; só desenha o que foi registrado. */
export function GraficoLinha({ pontos, unidade, descricao }: { pontos: PontoGrafico[]; unidade: string; descricao: string }) {
  const { cores, marca } = useTema();
  const [largura, setLargura] = useState(0);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  if (pontos.length === 0) return null;

  const valores = pontos.map((p) => p.valor);
  const folga = Math.max((Math.max(...valores) - Math.min(...valores)) * 0.15, 0.5);
  const min = Math.min(...valores) - folga;
  const max = Math.max(...valores) + folga;
  const w = Math.max(largura, 1);
  const areaW = w - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (i: number) => MARGEM.esq + (pontos.length === 1 ? areaW / 2 : (i / (pontos.length - 1)) * areaW);
  const y = (v: number) => MARGEM.topo + (1 - (v - min) / (max - min)) * areaH;
  const marcas = marcasDoEixo(min, max);
  const passoRotulo = Math.max(1, Math.ceil(pontos.length / Math.max(Math.floor(areaW / 64), 1)));
  const formato = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

  return (
    <View onLayout={aoMedir} accessible accessibilityRole="image" accessibilityLabel={descricao} style={{ gap: espaco(0.5) }}>
      {largura > 0 ? (
        <Svg width={w} height={ALTURA} aria-hidden>
          {marcas.map((m) => (
            <Line key={m} x1={MARGEM.esq} x2={w - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={cores.borda} strokeWidth={1} />
          ))}
          {marcas.map((m) => (
            <SvgTexto key={`t${m}`} x={MARGEM.esq - 6} y={y(m) + 4} fontSize={11} fill={cores.textoSuave} textAnchor="end">
              {formato(m)}
            </SvgTexto>
          ))}
          <Polyline points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')} fill="none" stroke={marca} strokeWidth={2.5} strokeLinejoin="round" />
          {pontos.map((p, i) => (
            <Circle key={`${p.rotulo}${i}`} cx={x(i)} cy={y(p.valor)} r={4} fill={marca} stroke={cores.superficie} strokeWidth={1.5} />
          ))}
          {pontos.map((p, i) =>
            i % passoRotulo === 0 || i === pontos.length - 1 ? (
              <SvgTexto key={`r${i}`} x={x(i)} y={ALTURA - 6} fontSize={11} fill={cores.textoSuave} textAnchor="middle">
                {p.rotulo}
              </SvgTexto>
            ) : null,
          )}
        </Svg>
      ) : (
        <View style={{ height: ALTURA }} />
      )}
      <Texto variante="pequeno">
        Último: {formato(pontos[pontos.length - 1].valor)} {unidade} em {pontos[pontos.length - 1].rotulo}
      </Texto>
    </View>
  );
}
