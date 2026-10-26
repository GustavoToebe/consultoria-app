import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgTexto } from 'react-native-svg';

import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { faixasSobrePontos, type FaixaDoGrafico } from '../dominio/cicloMenstrual';
import { caminhoSuave, marcasDoEixo } from '../dominio/grafico';
import { Texto } from './Texto';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
  /** Data ISO, para alinhar as faixas do ciclo atrás da linha. */
  data?: string;
}

const ALTURA_BASE = 240;
const MARGEM_BASE = { topo: 14, base: 24, esq: 58, dir: 18 };

/**
 * Gráfico de linha (SVG): curva suave com a área abaixo preenchida, pontos nos registros e eixo vertical com a
 * unidade ("82 kg"). Pontos já na ordem do eixo horizontal; só desenha o que foi registrado. A linha é da cor do texto,
 * nunca da marca (a marca não é dado). `semUltimo`: quem já mostra o resumo "Último…" acima não repete a linha de baixo.
 */
export function GraficoLinha({ pontos, unidade, descricao, semUltimo, faixas }: {
  pontos: PontoGrafico[]; unidade: string; descricao: string; semUltimo?: boolean; faixas?: FaixaDoGrafico[];
}) {
  const { cores, fatorTexto } = useTema();
  const linha = cores.texto;
  // Os rótulos do eixo acompanham o tamanho do texto; margens e altura crescem junto para não cortar.
  const fonte = escalar(11, fatorTexto);
  const MARGEM = { ...MARGEM_BASE, base: escalar(MARGEM_BASE.base, fatorTexto), esq: escalar(MARGEM_BASE.esq, fatorTexto) };
  const ALTURA = ALTURA_BASE + (MARGEM.base - MARGEM_BASE.base);
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
  const passoRotulo = Math.max(1, Math.ceil(pontos.length / Math.max(Math.floor(areaW / 72), 1)));
  const curva = caminhoSuave(pontos.map((p, i) => ({ x: x(i), y: y(p.valor) })));
  const bandas = faixasSobrePontos(pontos, faixas ?? []);
  const meio = pontos.length <= 1 ? 12 : Math.abs(x(1) - x(0)) / 2;
  const formato = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

  return (
    <View onLayout={aoMedir} accessible accessibilityRole="image" accessibilityLabel={descricao} style={{ gap: espaco(0.5) }}>
      {largura > 0 ? (
        <Svg width={w} height={ALTURA} aria-hidden>
          {bandas.map((f) => (
            <Rect key={`${f.rotulo}${f.de}`} x={Math.max(MARGEM.esq, x(f.de) - meio)} y={MARGEM.topo}
              width={Math.max(4, Math.min(w - MARGEM.dir, x(f.ate) + meio) - Math.max(MARGEM.esq, x(f.de) - meio))}
              height={areaH} fill={f.tom} fillOpacity={0.45} />
          ))}
          {marcas.map((m) => (
            <Line key={m} x1={MARGEM.esq} x2={w - MARGEM.dir} y1={y(m)} y2={y(m)} stroke={cores.borda} strokeWidth={1} />
          ))}
          {marcas.map((m) => (
            <SvgTexto key={`t${m}`} x={MARGEM.esq - 6} y={y(m) + 4} fontSize={fonte} fill={cores.textoSuave} textAnchor="end">
              {formato(m)} {unidade}
            </SvgTexto>
          ))}
          <Path d={`${curva}L${x(pontos.length - 1)},${y(min)}L${x(0)},${y(min)}Z`} fill={linha} fillOpacity={0.08} />
          <Path d={curva} fill="none" stroke={linha} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {pontos.map((p, i) => (
            <Circle key={`${p.rotulo}${i}`} cx={x(i)} cy={y(p.valor)} r={4} fill={linha} stroke={cores.superficie} strokeWidth={1.5} />
          ))}
          {pontos.map((p, i) =>
            i % passoRotulo === 0 || i === pontos.length - 1 ? (
              <SvgTexto key={`r${i}`} x={x(i)} y={ALTURA - 6} fontSize={fonte} fill={cores.textoSuave} textAnchor="middle">
                {p.rotulo}
              </SvgTexto>
            ) : null,
          )}
        </Svg>
      ) : (
        <View style={{ height: ALTURA }} />
      )}
      {bandas.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) }}>
          {[...new Map(bandas.map((f) => [f.rotulo, f.tom])).entries()].map(([rotulo, tom]) => (
            <View key={rotulo} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) }}>
              <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: tom }} />
              <Texto variante="pequeno">{rotulo}</Texto>
            </View>
          ))}
        </View>
      ) : null}
      {semUltimo ? null : (
        <Texto variante="pequeno">
          Último: {formato(pontos[pontos.length - 1].valor)} {unidade} em {pontos[pontos.length - 1].rotulo}
        </Texto>
      )}
    </View>
  );
}
