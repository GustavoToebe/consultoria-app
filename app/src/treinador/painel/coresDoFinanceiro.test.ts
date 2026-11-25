import { coresComBordasReforcadas, coresComContraste } from '../../dominio/preferencias';
import { contraste, corDaEntradaAvulsa, PALETAS, type Cores, type VarianteDoTema } from '../../tema/tokens';

/** As nove paletas, também com contraste alto e com bordas reforçadas (as superfícies mudam; a cor de dado não). */
const VARIANTES: [string, Cores, VarianteDoTema][] = Object.values(PALETAS).flatMap((p) => [
  [p.nome, p.cores, p.variante],
  [`${p.nome} com contraste alto`, coresComContraste(p.cores, 'ALTO', p.modo === 'ESCURO'), p.variante],
  [`${p.nome} com bordas reforçadas`, coresComBordasReforcadas(p.cores, true), p.variante],
]) as [string, Cores, VarianteDoTema][];

describe.each(VARIANTES)('verde claro da entrada avulsa (%s)', (_nome, cores, variante) => {
  const verdeClaro = corDaEntradaAvulsa(variante);

  it('é marca de gráfico (3:1) sobre o cartão e o poço, e texto de valor (4,5:1) sobre o cartão e o poço nas claras', () => {
    for (const fundo of [cores.superficie, cores.superficie2]) {
      expect(contraste(verdeClaro, fundo)).toBeGreaterThanOrEqual(variante === 'escuro' ? 3 : 4.5);
    }
  });

  it('se separa do verde do recebido (sucesso) em luminosidade, para o par de barras não colapsar', () => {
    expect(contraste(verdeClaro, cores.sucesso)).toBeGreaterThanOrEqual(1.25);
  });
});
