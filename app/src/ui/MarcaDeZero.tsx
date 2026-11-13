import { G, Line, Text as SvgTexto } from 'react-native-svg';

import { reaisCompactos } from '../dominio/financeiro';

/**
 * Zero nos gráficos de barras (SVG): nunca uma barra preenchida (parece quantidade positiva), só um traço fino neutro sobre a
 * linha de base com o rótulo "R$ 0" visível. Igual para as duas séries; sem dado (`null`) o gráfico não desenha nada aqui.
 * A âncora `end` (barra da esquerda) e `start` (da direita) abrem o rótulo para fora do par, então dois zeros no mesmo mês não se
 * sobrepõem nem cobrem a barra vizinha. `ui/GraficoBarras` e `treinador/painel/BarrasDoRecebido` usam esta peça.
 */
export function MarcaDeZero({ x, largura, yBase, ancora, fonte, cor }: {
  /** Lado esquerdo do lugar da barra. */
  x: number;
  /** Largura do lugar da barra. */
  largura: number;
  /** Altura (y) da linha de base. */
  yBase: number;
  ancora: 'start' | 'end';
  fonte: number;
  cor: string;
}) {
  return (
    <G>
      <Line x1={x} x2={x + largura} y1={yBase} y2={yBase} stroke={cor} strokeWidth={2} strokeLinecap="round" />
      <SvgTexto x={ancora === 'end' ? x + largura - 1 : x + 1} y={yBase - 5} fontSize={fonte} fill={cor} textAnchor={ancora}>{reaisCompactos(0)}</SvgTexto>
    </G>
  );
}
