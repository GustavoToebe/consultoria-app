import { aplicarEscolhaDoPainel, decidirCheck, painelDoCheck } from './painelDoCheck';

const base = { feita: false, carga: null, repeticoes: null, sugestaoKg: 60, semCampoDePeso: false };

describe('✓ com carga vazia e sugestão abre o painel (D2)', () => {
  it('abre o painel ao marcar com a carga vazia e com sugestão', () => {
    expect(decidirCheck(base)).toEqual({ acao: 'PAINEL', sugestaoKg: 60 });
    expect(decidirCheck({ ...base, repeticoes: 8 })).toEqual({ acao: 'PAINEL', sugestaoKg: 60 });
  });

  it('grava direto quando há carga digitada (inclusive 0), não há sugestão, não há campo de peso ou é desmarcar', () => {
    expect(decidirCheck({ ...base, carga: 55, repeticoes: 8 })).toEqual({ acao: 'GRAVAR', gravar: { carga: 55, repeticoes: 8, concluida: true } });
    expect(decidirCheck({ ...base, carga: 0 })).toEqual({ acao: 'GRAVAR', gravar: { carga: 0, repeticoes: null, concluida: true } });
    expect(decidirCheck({ ...base, sugestaoKg: null })).toEqual({ acao: 'GRAVAR', gravar: { carga: null, repeticoes: null, concluida: true } });
    expect(decidirCheck({ ...base, semCampoDePeso: true, repeticoes: 12 })).toEqual({ acao: 'GRAVAR', gravar: { carga: null, repeticoes: 12, concluida: true } });
    expect(decidirCheck({ ...base, feita: true, carga: 55, repeticoes: 8 })).toEqual({ acao: 'GRAVAR', gravar: { carga: 55, repeticoes: 8, concluida: false } });
    // Desmarcar nunca abre o painel, mesmo com a carga vazia.
    expect(decidirCheck({ ...base, feita: true })).toEqual({ acao: 'GRAVAR', gravar: { carga: null, repeticoes: null, concluida: false } });
  });

  it('textos do painel', () => {
    expect(painelDoCheck(60)).toEqual({
      pergunta: 'Fez com 60 kg?',
      opcoes: [
        { escolha: 'SIM', rotulo: 'Sim, 60 kg' },
        { escolha: 'OUTRA_CARGA', rotulo: 'Outra carga' },
        { escolha: 'SEM_CARGA', rotulo: 'Sem carga' },
      ],
    });
    expect(painelDoCheck(42.5).pergunta).toBe('Fez com 42,5 kg?');
  });

  it('cada escolha: Sim grava a sugestão, Sem carga grava feito sem carga, Outra carga não grava e leva ao campo', () => {
    expect(aplicarEscolhaDoPainel('SIM', 60, 7)).toEqual({ gravar: { carga: 60, repeticoes: 7, concluida: true } });
    expect(aplicarEscolhaDoPainel('SEM_CARGA', 60, null)).toEqual({ gravar: { carga: null, repeticoes: null, concluida: true } });
    expect(aplicarEscolhaDoPainel('OUTRA_CARGA', 60, 7)).toEqual({ gravar: null, focarCarga: true });
  });

  it('as repetições nunca são preenchidas pela regra: saem como o aluno deixou', () => {
    expect(aplicarEscolhaDoPainel('SIM', 60, null)).toEqual({ gravar: { carga: 60, repeticoes: null, concluida: true } });
  });

  it('com a progressão e o campo de reps vazio, a pergunta leva carga e repetições', () => {
    expect(painelDoCheck(77.5, 'kg', { sugestaoReps: 5, ultimaCargaKg: 75 })).toEqual({
      pergunta: 'Fez 77,5 kg × 5 reps?',
      opcoes: [
        { escolha: 'SIM', rotulo: 'Sim, 77,5 kg × 5' },
        { escolha: 'MANTER_ANTERIOR', rotulo: 'Manter 75 kg' },
        { escolha: 'OUTRA_CARGA', rotulo: 'Outra carga' },
        { escolha: 'SEM_CARGA', rotulo: 'Sem carga' },
      ],
    });
    expect(painelDoCheck(75, 'kg', { sugestaoReps: 6, repeticoesDigitadas: 5 }).pergunta).toBe('Fez com 75 kg?');
    expect(aplicarEscolhaDoPainel('SIM', 77.5, null, { sugestaoReps: 5 })).toEqual({ gravar: { carga: 77.5, repeticoes: 5, concluida: true } });
    expect(aplicarEscolhaDoPainel('SIM', 77.5, 4, { sugestaoReps: 5 })).toEqual({ gravar: { carga: 77.5, repeticoes: 4, concluida: true } });
    expect(aplicarEscolhaDoPainel('MANTER_ANTERIOR', 77.5, null, { sugestaoReps: 5, ultimaCargaKg: 75 })).toEqual({ gravar: { carga: 75, repeticoes: 5, concluida: true } });
  });
});
