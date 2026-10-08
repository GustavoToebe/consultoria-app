/** Escolhe 3 a 5 marcas redondas dentro de [min, max] para o eixo vertical. */
export function marcasDoEixo(min: number, max: number): number[] {
  const faixa = max - min;
  if (faixa <= 0) return [min];
  const passoBruto = faixa / 3;
  const potencia = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= passoBruto) ?? passoBruto;
  const marcas: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) marcas.push(Math.round(v * 100) / 100);
  return marcas;
}

export interface PontoXY {
  x: number;
  y: number;
}

/**
 * Caminho SVG de uma curva suave que passa por todos os pontos (cúbica monótona, Fritsch–Butland): não passa
 * dos valores registrados nem cria subidas e descidas que o peso não teve. `x` deve ser crescente.
 */
export function caminhoSuave(pontos: PontoXY[]): string {
  const n = pontos.length;
  if (n === 0) return '';
  const p = (a: PontoXY) => `${Math.round(a.x * 100) / 100},${Math.round(a.y * 100) / 100}`;
  if (n === 1) return `M${p(pontos[0])}`;
  if (n === 2) return `M${p(pontos[0])}L${p(pontos[1])}`;
  const h = pontos.slice(1).map((a, i) => a.x - pontos[i].x);
  const m = pontos.slice(1).map((a, i) => (a.y - pontos[i].y) / h[i]);
  const t = pontos.map((_, i) => {
    if (i === 0) return m[0];
    if (i === n - 1) return m[n - 2];
    if (m[i - 1] * m[i] <= 0) return 0;
    return (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / m[i - 1] + (h[i] + 2 * h[i - 1]) / m[i]);
  });
  let d = `M${p(pontos[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const c1 = { x: a.x + h[i] / 3, y: a.y + (t[i] * h[i]) / 3 };
    const c2 = { x: b.x - h[i] / 3, y: b.y - (t[i + 1] * h[i]) / 3 };
    d += `C${p(c1)} ${p(c2)} ${p(b)}`;
  }
  return d;
}
