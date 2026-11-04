import { ERRO_DO_LIMITE, lerLimiteDeAlunos, limiteParaCampo, situacaoDoLimite, textoDoLimite } from './limiteDeAlunos';

describe('lerLimiteDeAlunos', () => {
  it('vazio (ou só espaços) é sem limite', () => {
    expect(lerLimiteDeAlunos('')).toEqual({ ok: true, limite: null });
    expect(lerLimiteDeAlunos('   ')).toEqual({ ok: true, limite: null });
  });
  it('inteiro de 0 a 999', () => {
    expect(lerLimiteDeAlunos('0')).toEqual({ ok: true, limite: 0 });
    expect(lerLimiteDeAlunos(' 30 ')).toEqual({ ok: true, limite: 30 });
    expect(lerLimiteDeAlunos('999')).toEqual({ ok: true, limite: 999 });
    expect(lerLimiteDeAlunos('007')).toEqual({ ok: true, limite: 7 });
  });
  it('fora da faixa ou não inteiro é recusado, sem repetir o valor', () => {
    for (const ruim of ['1000', '-1', '+3', '1,5', '1.5', 'abc', '1e2', '12 3']) {
      const r = lerLimiteDeAlunos(ruim);
      expect(r).toEqual({ ok: false, erro: ERRO_DO_LIMITE });
      if (!r.ok) expect(r.erro).not.toContain(ruim);
    }
  });
});

describe('textos do limite', () => {
  it('campo: nulo vira vazio, número vira texto', () => {
    expect(limiteParaCampo(null)).toBe('');
    expect(limiteParaCampo(undefined)).toBe('');
    expect(limiteParaCampo(0)).toBe('0');
    expect(limiteParaCampo(25)).toBe('25');
  });
  it('resumo no cartão do membro', () => {
    expect(textoDoLimite(null)).toBe('Sem limite de alunos');
    expect(textoDoLimite(0)).toBe('Limite: 0 (não recebe aluno novo)');
    expect(textoDoLimite(1)).toBe('Limite: 1 aluno');
    expect(textoDoLimite(30)).toBe('Limite: 30 alunos');
  });
});

describe('situacaoDoLimite', () => {
  it('sem limite, com vaga, cheio e acima (D4: quem passou não perde aluno)', () => {
    expect(situacaoDoLimite(50, null)).toBe('sem-limite');
    expect(situacaoDoLimite(29, 30)).toBe('com-vaga');
    expect(situacaoDoLimite(30, 30)).toBe('cheio');
    expect(situacaoDoLimite(0, 0)).toBe('cheio');
    expect(situacaoDoLimite(31, 30)).toBe('acima');
  });
});
