import { rotuloCurtoDoMes, rotuloDoMesNumerico } from './mesDaCompetencia';

describe('mês e competência em MM/AAAA', () => {
  it('mês (`AAAA-MM`) e competência (`AAAA-MM-DD`) viram MM/AAAA', () => {
    expect(rotuloDoMesNumerico('2026-11')).toBe('11/2026');
    expect(rotuloDoMesNumerico('2026-01-05')).toBe('01/2026');
    expect(rotuloDoMesNumerico('2025-12-31')).toBe('12/2025');
  });

  it('o curto do eixo do gráfico é MM/AA', () => {
    expect(rotuloCurtoDoMes('2026-11')).toBe('11/26');
    expect(rotuloCurtoDoMes('2030-02-10')).toBe('02/30');
  });

  it('fora do formato ou mês inválido é "—", nos dois', () => {
    for (const ruim of ['', '2026', '2026-13', '2026-00', '2026-1', '2026-111', 'maio', '11/2026', null, undefined]) {
      expect(rotuloDoMesNumerico(ruim)).toBe('—');
      expect(rotuloCurtoDoMes(ruim)).toBe('—');
    }
  });
});
