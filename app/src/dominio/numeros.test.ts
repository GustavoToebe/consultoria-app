import type { MesDeNumeros } from '../api/tipos';
import { alunosELimite, contagemParaTela, linhasDaEquipe, MARCA_PARCIAL, resumoDasAtualizacoes, rotuloDoMes, rotuloDoMesCompleto, SEM_RESPONSAVEL, textoDoResumo, totalDoMes } from './numeros';

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

describe('tabela da equipe', () => {
  const equipe = [
    { usuarioId: 'u1', nome: 'Ana Fictícia', alunosAtivos: 12, limiteDeAlunos: 30, atualizacoesAtrasadas: 2, atualizacoesParaRevisar: 0 },
    { usuarioId: 'u2', nome: 'Bia Exemplo', alunosAtivos: 5, limiteDeAlunos: null, atualizacoesAtrasadas: null, atualizacoesParaRevisar: null },
  ];
  it('sem a equipe (sem EQUIPE_LER) não há tabela: nulo, não lista vazia', () => {
    expect(linhasDaEquipe({ equipe: null, semResponsavel: null })).toBeNull();
    expect(linhasDaEquipe({ equipe: undefined as unknown as null, semResponsavel: null })).toBeNull();
    expect(linhasDaEquipe(null)).toBeNull();
  });
  it('membros na ordem da API e "Sem responsável" por último, sem limite', () => {
    const linhas = linhasDaEquipe({ equipe, semResponsavel: { alunosAtivos: 3, atualizacoesAtrasadas: 1, atualizacoesParaRevisar: 4 } });
    expect(linhas?.map((l) => l.nome)).toEqual(['Ana Fictícia', 'Bia Exemplo', SEM_RESPONSAVEL]);
    expect(linhas?.[2]).toEqual({ chave: 'sem-responsavel', nome: SEM_RESPONSAVEL, alunosAtivos: 3, limite: undefined, atrasadas: 1, paraRevisar: 4 });
    expect(linhas?.[1].limite).toBeNull();
  });
  it('alunos / limite: sem limite é "sem limite", nunca "—"; "Sem responsável" só o número', () => {
    expect(alunosELimite({ alunosAtivos: 12, limite: 30 })).toBe('12 / 30');
    expect(alunosELimite({ alunosAtivos: 31, limite: 30 })).toBe('31 / 30');
    expect(alunosELimite({ alunosAtivos: 0, limite: 0 })).toBe('0 / 0');
    expect(alunosELimite({ alunosAtivos: 5, limite: null })).toBe('5 / sem limite');
    expect(alunosELimite({ alunosAtivos: 3, limite: undefined })).toBe('3');
  });
});
