import type { Sessao } from '../../api/tipos';
import { fraseDaDataDoTreino, linhaDaSemana, temColunasDoAluno } from './arranjoDoTreino';

const sessao = (diaSemana: number | null, exercicios: number): Sessao => ({
  uid: 's', nome: 'Divisão fictícia', diaSemana, tipo: exercicios ? 'TREINO' : 'DESCANSO_ATIVO', frequenciaSemanal: null, observacao: null, cardio: null,
  exercicios: Array.from({ length: exercicios }, (_, i) => ({ uid: `e${i}`, exercicioId: null, nome: `E${i}`, modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series: [] })),
  grupos: [],
});

describe('linhaDaSemana', () => {
  it('o dia de hoje fica em destaque, com ou sem exercício', () => {
    expect(linhaDaSemana(sessao(1, 5), 1)).toBe('hoje');
    expect(linhaDaSemana(sessao(1, 0), 1)).toBe('hoje');
  });
  it('dia sem exercício é descanso; com exercício, treino; sem dia fixo nunca é hoje', () => {
    expect(linhaDaSemana(sessao(4, 0), 1)).toBe('descanso');
    expect(linhaDaSemana(sessao(3, 4), 1)).toBe('treino');
    expect(linhaDaSemana(sessao(null, 4), 1)).toBe('treino');
  });
});

describe('fraseDaDataDoTreino', () => {
  it('hoje não tem frase', () => {
    expect(fraseDaDataDoTreino('2026-10-19', '2026-10-19', true)).toBeNull();
  });
  it('data passada: só a de registrar', () => {
    expect(fraseDaDataDoTreino('2026-10-14', '2026-10-19', true)).toBe('Você está registrando o treino de 14/10/2026.');
  });
  it('data futura com o concluir ligado: as duas numa frase só', () => {
    expect(fraseDaDataDoTreino('2026-10-21', '2026-10-19', true)).toBe('Você está registrando o treino de 21/10/2026 e poderá concluí-lo a partir desse dia.');
  });
  it('data futura com o concluir desligado: só a de registrar (não havia a outra)', () => {
    expect(fraseDaDataDoTreino('2026-10-21', '2026-10-19', false)).toBe('Você está registrando o treino de 21/10/2026.');
  });
});

describe('temColunasDoAluno', () => {
  it('só a compacta fica com o desenho do celular', () => {
    expect(temColunasDoAluno('compacta')).toBe(false);
    expect((['normal', 'larga', 'ultralarga'] as const).every(temColunasDoAluno)).toBe(true);
  });
});
