import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgTexto } from 'react-native-svg';

import { faixasSobrePontos, type FaixaDoGrafico } from '../dominio/cicloMenstrual';
import { caminhoSuave, fracaoNoEixo, marcasDaEscala, marcasDoEixo } from '../dominio/grafico';
import { escalar } from '../dominio/preferencias';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Texto } from './Texto';

export interface PontoGrafico {
  rotulo: string;
  valor: number;
  /** Data ISO, para alinhar as faixas do ciclo atrás da linha. */
  data?: string;
}

const ALTURA_BASE = 240;
const MARGEM_BASE = { topo: 14, base: 24, esq: 58, dir: 18 };
const TAMANHO_TOQUE = 36;
const LARGURA_DICA = 120;
const ALTURA_DICA = 26;
const ESPACO_DICA = 12;
const MARGEM_SEGURA = 4;

/**
 * Gráfico de linha (SVG): curva suave com a área abaixo preenchida, pontos nos registros e eixo vertical com a
 * unidade ("82 kg"). O eixo horizontal acompanha a data quando todo ponto a traz; sem data, o espaço segue a lista.
 * Pontos já na ordem do eixo; só desenha o que foi registrado. A linha é da cor do texto,
 * nunca da marca (a marca não é dado). Ao passar o mouse ou tocar em cada ponto, exibe o balão com o valor e a data.
 * `semUltimo`: quem já mostra o resumo "Último…" acima não repete a linha de baixo.
 */
export function GraficoLinha({ pontos, unidade, descricao, semUltimo, faixas, escala, larguraInicial = 0 }: {
  pontos: PontoGrafico[]; unidade: string; descricao: string; semUltimo?: boolean; faixas?: FaixaDoGrafico[];
  /** Escala fixa (a NOTA de 1 a 5, por exemplo): o eixo vai do mínimo ao máximo dela, com as duas pontas marcadas. Sem ela, o eixo se ajusta aos pontos. */
  escala?: { min: number; max: number };
  /** Largura inicial (útil para testes ou renderização direta). */
  larguraInicial?: number;
}) {
  const { cores, fatorTexto } = useTema();
  const linha = cores.texto;
  // Os rótulos do eixo acompanham o tamanho do texto; margens e altura crescem junto para não cortar.
  const fonte = escalar(11, fatorTexto);
  const MARGEM = { ...MARGEM_BASE, base: escalar(MARGEM_BASE.base, fatorTexto), esq: escalar(MARGEM_BASE.esq, fatorTexto) };
  const ALTURA = ALTURA_BASE + (MARGEM.base - MARGEM_BASE.base);
  const [largura, setLargura] = useState(larguraInicial);
  const [pontoAtivo, setPontoAtivo] = useState<number | null>(null);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  if (pontos.length === 0) return null;

  const valores = pontos.map((p) => p.valor);
  const folga = Math.max((Math.max(...valores) - Math.min(...valores)) * 0.15, 0.5);
  // Com escala, o eixo é o dela; um ponto fora (escala trocada pelo treinador) alarga o eixo em vez de sumir do desenho.
  const min = escala ? Math.min(escala.min, ...valores) : Math.min(...valores) - folga;
  const max = escala ? Math.max(escala.max, ...valores) : Math.max(...valores) + folga;
  const w = Math.max(largura, 1);
  const areaW = w - MARGEM.esq - MARGEM.dir;
  const areaH = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (i: number) => MARGEM.esq + fracaoNoEixo(pontos, i) * areaW;
  const y = (v: number) => MARGEM.topo + (1 - (v - min) / (max - min)) * areaH;
  const marcas = escala ? marcasDaEscala(min, max) : marcasDoEixo(min, max);
  const passoRotulo = Math.max(1, Math.ceil(pontos.length / Math.max(Math.floor(areaW / 72), 1)));
  const curva = caminhoSuave(pontos.map((p, i) => ({ x: x(i), y: y(p.valor) })));
  const bandas = faixasSobrePontos(pontos, faixas ?? []);
  const meio = pontos.length <= 1 ? 12 : Math.abs(x(1) - x(0)) / 2;
  const formato = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

  const ativo = pontoAtivo !== null && pontoAtivo >= 0 && pontoAtivo < pontos.length ? pontos[pontoAtivo] : null;
  const ativoIdx = ativo ? pontoAtivo : null;

  const cxAtivo = ativoIdx !== null ? x(ativoIdx) : 0;
  const cyAtivo = ativo ? y(ativo.valor) : 0;

  // Clampa a posição horizontal para garantir que a dica nunca corte nas bordas esquerda e direita
  const maxLeft = Math.max(MARGEM_SEGURA, w - LARGURA_DICA - MARGEM_SEGURA);
  const dicaLeft = Math.max(MARGEM_SEGURA, Math.min(cxAtivo - LARGURA_DICA / 2, maxLeft));

  // Se o ponto estiver muito alto (perto do topo), posiciona a dica abaixo do ponto para não cortar no topo
  const cabeAcima = cyAtivo - ALTURA_DICA - ESPACO_DICA >= MARGEM_SEGURA;
  const dicaTop = cabeAcima ? cyAtivo - ALTURA_DICA - ESPACO_DICA : cyAtivo + ESPACO_DICA;

  const valorFormatado = `${formato(ativo?.valor ?? 0)}${unidade ? ` ${unidade}` : ''}`;
  const textoDica = ativo?.rotulo ? `${ativo.rotulo} · ${valorFormatado}` : valorFormatado;

  return (
    <View onLayout={aoMedir} accessible accessibilityRole="image" accessibilityLabel={descricao} style={{ gap: espaco(0.5) }}>
      {largura > 0 ? (
        <View style={{ position: 'relative', width: w, height: ALTURA }}>
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
            {ativoIdx !== null ? (
              <Line
                x1={x(ativoIdx)}
                x2={x(ativoIdx)}
                y1={MARGEM.topo}
                y2={ALTURA - MARGEM.base}
                stroke={cores.divisor}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
            {pontos.map((p, i) => {
              const selecionado = pontoAtivo === i;
              return (
                <G key={`${p.rotulo}${i}`}>
                  {selecionado ? (
                    <Circle cx={x(i)} cy={y(p.valor)} r={10} fill={linha} fillOpacity={0.18} />
                  ) : null}
                  <Circle
                    cx={x(i)}
                    cy={y(p.valor)}
                    r={selecionado ? 6 : 4}
                    fill={linha}
                    stroke={cores.superficie}
                    strokeWidth={selecionado ? 2 : 1.5}
                  />
                </G>
              );
            })}
            {pontos.map((p, i) =>
              i % passoRotulo === 0 || i === pontos.length - 1 ? (
                <SvgTexto key={`r${i}`} x={x(i)} y={ALTURA - 6} fontSize={fonte} fill={cores.textoSuave} textAnchor="middle">
                  {p.rotulo}
                </SvgTexto>
              ) : null,
            )}
          </Svg>
          {pontos.map((p, i) => (
            <Pressable
              key={`alvo-${p.rotulo}${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.rotulo}: ${formato(p.valor)} ${unidade}`}
              accessibilityState={{ selected: pontoAtivo === i }}
              onHoverIn={() => setPontoAtivo(i)}
              onHoverOut={() => setPontoAtivo((atual) => (atual === i ? null : atual))}
              onFocus={() => setPontoAtivo(i)}
              onBlur={() => setPontoAtivo((atual) => (atual === i ? null : atual))}
              onPress={() => setPontoAtivo((atual) => (atual === i ? null : i))}
              style={{
                position: 'absolute',
                left: x(i) - TAMANHO_TOQUE / 2,
                top: y(p.valor) - TAMANHO_TOQUE / 2,
                width: TAMANHO_TOQUE,
                height: TAMANHO_TOQUE,
                borderRadius: TAMANHO_TOQUE / 2,
                cursor: 'pointer',
              }}
            />
          ))}
          {ativo ? (
            <View
              pointerEvents="none"
              accessibilityRole="summary"
              style={[
                estilos.dica,
                {
                  backgroundColor: cores.texto,
                  borderColor: cores.superficie,
                  left: dicaLeft,
                  top: dicaTop,
                },
              ]}
            >
              <Texto numberOfLines={1} numerico style={[estilos.textoDica, { color: cores.superficie }]}>
                {textoDica}
              </Texto>
            </View>
          ) : null}
        </View>
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

const estilos = StyleSheet.create({
  dica: {
    position: 'absolute',
    width: LARGURA_DICA,
    paddingHorizontal: espaco(1),
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  textoDica: {
    fontFamily: fontes.semi,
    fontSize: 12,
    textAlign: 'center',
  },
});
