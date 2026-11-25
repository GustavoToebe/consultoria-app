import { Children, type ReactNode } from 'react';

import { colunasDaGradeDeIndicadores, MINIMO_DA_CELULA, VAO_DA_GRADE } from '../dominio/gradeDeIndicadores';
import { useTema } from '../tema/TemaProvider';
import { Grade } from './Grade';

/**
 * Indicadores em colunas iguais que dividem o total, sem cartão sozinho (`dominio/gradeDeIndicadores`), pela largura da
 * própria grade; total sem divisor (5, 7, 11, 13) em linhas equilibradas (diferem em no máximo 1 cartão, as de cima com os
 * que sobram) e cada linha esticada até a largura toda (5 em 3 + 2, 7 em 4 + 3 ou 3 + 2 + 2), nunca buraco. Todos da linha com a mesma altura: a célula estica e o filho precisa de `flexGrow: 1` (o
 * `CartaoDeIndicador` já tem). Filho `null` não conta no total. `minimo` é a célula mínima em px: o padrão (250) cabe
 * "R$ 100.000,00" na variante `destaque`; número menor (`titulo`, `bloco`) pode passar menos.
 */
export function GradeDeIndicadores({ children, minimo = MINIMO_DA_CELULA, vao = VAO_DA_GRADE }: {
  children: ReactNode;
  minimo?: number;
  vao?: number;
}) {
  const { fatorTexto } = useTema();
  const total = Children.toArray(children).length;
  return (
    <Grade gap={vao} ultimaLinha="esticar" colunas={(l) => colunasDaGradeDeIndicadores(l, total, { minimo, vao, fatorTexto })}>
      {children}
    </Grade>
  );
}
