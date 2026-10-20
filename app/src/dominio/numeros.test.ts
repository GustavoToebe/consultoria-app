import type { MesDeNumeros } from '../api/tipos';
import { contagemParaTela, MARCA_PARCIAL, resumoDasAtualizacoes, rotuloDoMes, rotuloDoMesCompleto, textoDoResumo, totalDoMes } from './numeros';

const mes = (m: string, extra: Partial<MesDeNumeros> = {}): MesDeNumeros => ({
  mes: m, parcial: false, alunosAtivos: 10, atualizacoesNoPrazo: 4, atualizacoesAtrasadas: 1, ...extra,
});

describe('contagemParaTela', () => {
  it('nulo é "—", zero é 0: sem dado nunca vira zero', () => {
    expect(contagemParaTela(null)).toBe('—');
    expect(contagemParaTela(undefined)).toBe('—');
    expect(contagemParaTela(0)).toBe('0');
    expect(contagemParaTela(12)).toBe('12');
  });
  it('o que não é número finito é sem dado', () => {
    expect(contagemParaTela(Number.NaN)).toBe('—');
    expect(contagemParaTela(Number.POSITIVE_INFINITY)).toBe('—');
    expect(contagemParaTela('7' as unknown as number)).toBe('—');
  });
});

describe('rótulos do mês', () => {
  it('2026-05 vira mai/2026, todos os doze meses', () => {
    expect(rotuloDoMes('2026-05')).toBe('mai/2026');
    expect(rotuloDoMes('2026-01')).toBe('jan/2026');
    expect(rotuloDoMes('2025-12')).toBe('dez/2025');
  });
  it('mês malformado é "—"', () => {
    for (const ruim of ['', '2026', '2026-13', '2026-00', 'maio', null, undefined]) expect(rotuloDoMes(ruim)).toBe('—');
  });
  it('o parcial leva "até hoje"; o fechado não', () => {
    expect(rotuloDoMesCompleto(mes('2026-10', { parcial: true }))).toBe(`out/2026 (${MARCA_PARCIAL})`);
    expect(rotuloDoMesCompleto(mes('2026-09'))).toBe('set/2026');
  });
});

describe('totalDoMes', () => {
  it('soma no prazo e atrasadas', () => {
    expect(totalDoMes(mes('2026-05'))).toBe(5);
    expect(totalDoMes(mes('2026-05', { atualizacoesNoPrazo: 0, atualizacoesAtrasadas: 0 }))).toBe(0);
  });
  it('um lado sem dado não vira total (nulo ≠ zero)', () => {
    expect(totalDoMes(mes('2026-05', { atualizacoesAtrasadas: null }))).toBeNull();
    expect(totalDoMes(mes('2026-05', { atualizacoesNoPrazo: null }))).toBeNull();
    expect(totalDoMes(mes('2026-05', { atualizacoesNoPrazo: null, atualizacoesAtrasadas: null }))).toBeNull();
  });
});

describe('resumoDasAtualizacoes', () => {
  const fechados = [mes('2026-05'), mes('2026-06', { atualizacoesNoPrazo: 6, atualizacoesAtrasadas: 0 }), mes('2026-07', { atualizacoesNoPrazo: 3, atualizacoesAtrasadas: 2 })];

  it('soma só os meses fechados; o parcial fica de fora', () => {
    const r = resumoDasAtualizacoes([...fechados, mes('2026-08', { parcial: true, atualizacoesNoPrazo: 99, atualizacoesAtrasadas: 99 })]);
    expect(r).toEqual({ meses: 3, noPrazo: 13, atrasadas: 3, total: 16 });
  });
  it('mês fechado com buraco: sem resumo, nunca soma parcial', () => {
    expect(resumoDasAtualizacoes([...fechados, mes('2026-08', { atualizacoesAtrasadas: null })])).toBeNull();
    expect(resumoDasAtualizacoes([mes('2026-04', { atualizacoesNoPrazo: null }), ...fechados])).toBeNull();
  });
  it('buraco só no mês corrente não impede o resumo dos fechados', () => {
    const r = resumoDasAtualizacoes([...fechados, mes('2026-08', { parcial: true, atualizacoesNoPrazo: null, atualizacoesAtrasadas: null })]);
    expect(r?.total).toBe(16);
  });
  it('zeros que a API mandou contam; sem mês fechado ou lista vazia, nada', () => {
    expect(resumoDasAtualizacoes([mes('2026-05', { atualizacoesNoPrazo: 0, atualizacoesAtrasadas: 0 })])).toEqual({ meses: 1, noPrazo: 0, atrasadas: 0, total: 0 });
    expect(resumoDasAtualizacoes([])).toBeNull();
    expect(resumoDasAtualizacoes([mes('2026-08', { parcial: true })])).toBeNull();
  });
});

describe('textoDoResumo', () => {
  it('plural e singular', () => {
    expect(textoDoResumo({ meses: 5, noPrazo: 17, atrasadas: 3, total: 20 })).toBe('Nos 5 meses fechados: 20 atualizações (17 no prazo, 3 atrasadas).');
    expect(textoDoResumo({ meses: 1, noPrazo: 0, atrasadas: 1, total: 1 })).toBe('No mês fechado: 1 atualização (0 no prazo, 1 atrasada).');
  });
});
