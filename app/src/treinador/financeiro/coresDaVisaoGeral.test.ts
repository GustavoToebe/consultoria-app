import { cartoesDoPainel } from '../../dominio/financeiro';
import { coresComBordasReforcadas, coresComContraste } from '../../dominio/preferencias';
import { contraste, PALETAS, type Cores } from '../../tema/tokens';

/** As nove paletas, também com contraste alto e com bordas reforçadas (as superfícies mudam; a cor de situação não). */
const VARIANTES: [string, Cores][] = Object.values(PALETAS).flatMap((p) => [
  [p.nome, p.cores],
  [`${p.nome} com contraste alto`, coresComContraste(p.cores, 'ALTO', p.modo === 'ESCURO')],
  [`${p.nome} com bordas reforçadas`, coresComBordasReforcadas(p.cores, true)],
]) as [string, Cores][];

describe('Financeiro sem azul nem roxo (25/11)', () => {
  it('os seis números da Visão geral só têm cor de situação: verde, âmbar, vermelho; o resto é neutro', () => {
    const cartoes = cartoesDoPainel({
      recebidoCentavos: 120000, aReceberCentavos: 50000, emAtraso: { valorCentavos: 10000, cobrancas: 1 },
      receitaRecorrenteMensalCentavos: 90000, alunosPagantes: 3, valorMedioPorAlunoCentavos: 30000,
    });
    const funcoes = cartoes.map((c) => c.enfase);
    expect(funcoes).toEqual(['verde', 'ambar', 'vermelho', 'neutro', 'neutro', 'neutro']);
    for (const proibida of ['azul', 'ciano', 'violeta']) expect(funcoes).not.toContain(proibida);
  });
});

describe.each(VARIANTES)('gráfico "Recebido e previsto por mês" (%s)', (_nome, cores) => {
  it('o recebido (verde de sucesso) é marca de gráfico (3:1) sobre o cartão', () => {
    expect(contraste(cores.sucesso, cores.superficie)).toBeGreaterThanOrEqual(3);
  });

  it('o contorno do previsto (textoSuave) é marca (3:1) sobre o cartão e a legenda continua legível (4,5:1)', () => {
    expect(contraste(cores.textoSuave, cores.superficie)).toBeGreaterThanOrEqual(4.5);
  });
});
