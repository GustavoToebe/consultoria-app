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
