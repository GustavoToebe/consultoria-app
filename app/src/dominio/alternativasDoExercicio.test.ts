import { adicionarAlternativa, alternativasDepoisDaTroca, motivoSemAdicionarAlternativa, podeSerAlternativa, removerAlternativa } from './alternativasDoExercicio';
import { exercicio } from './exemplosDeTreino.apoioTeste';

const bib = (id: string, modalidade = 'LIVRE') => ({ id, nome: `Nome ${id}`, modalidade, videoUrl: null });
const alt = (id: string) => ({ exercicioId: id, nome: `Nome ${id}`, videoUrl: null });
const agachamento = exercicio('u1', { exercicioId: 'agach', nome: 'Agachamento', modalidade: 'LIVRE' });

describe('alternativas do exercício', () => {
  it('só do mesmo tipo: cardio por cardio, carga por carga', () => {
    expect(podeSerAlternativa(agachamento, bib('leg', 'MAQUINA'))).toBe(true);
    expect(podeSerAlternativa(agachamento, bib('esteira', 'CARDIO'))).toBe(false);
    const esteira = exercicio('u2', { exercicioId: 'esteira', modalidade: 'CARDIO' });
    expect(podeSerAlternativa(esteira, bib('bike', 'CARDIO'))).toBe(true);
    expect(podeSerAlternativa(esteira, bib('leg', 'MAQUINA'))).toBe(false);
  });

  it('nem o principal nem uma que já está na lista', () => {
    const com = { ...agachamento, alternativas: [alt('leg')] };
    expect(podeSerAlternativa(com, bib('agach'))).toBe(false);
    expect(podeSerAlternativa(com, bib('leg'))).toBe(false);
    expect(podeSerAlternativa(com, bib('hack'))).toBe(true);
  });

  it('adiciona no fim até 3 e depois diz o motivo', () => {
    let e = agachamento;
    expect(motivoSemAdicionarAlternativa(e)).toBeNull();
    for (const id of ['leg', 'hack', 'bulgaro']) e = adicionarAlternativa(e, bib(id));
    expect(e.alternativas?.map((a) => a.exercicioId)).toEqual(['leg', 'hack', 'bulgaro']);
    expect(motivoSemAdicionarAlternativa(e)).toMatch(/^Já tem 3 alternativas/);
    expect(adicionarAlternativa(e, bib('afundo'))).toBe(e);
    // O que não pode ser alternativa não muda nada.
    expect(adicionarAlternativa(agachamento, bib('agach'))).toBe(agachamento);
  });

  it('remover a última tira a chave (a API omite a lista vazia)', () => {
    const e = { ...agachamento, alternativas: [alt('leg'), alt('hack')] };
    expect(removerAlternativa(e, 0).alternativas).toEqual([alt('hack')]);
    expect('alternativas' in removerAlternativa(removerAlternativa(e, 0), 0)).toBe(false);
  });

  it('trocar o principal tira a alternativa que virou ele; de ou para cardio tira todas', () => {
    const e = { ...agachamento, alternativas: [alt('leg'), alt('hack')] };
    expect(alternativasDepoisDaTroca({ ...e, exercicioId: 'leg' }, 'LIVRE').alternativas).toEqual([alt('hack')]);
    expect(alternativasDepoisDaTroca({ ...e, exercicioId: 'outro' }, 'LIVRE').alternativas).toEqual(e.alternativas);
    expect('alternativas' in alternativasDepoisDaTroca({ ...e, exercicioId: 'esteira', modalidade: 'CARDIO' }, 'LIVRE')).toBe(false);
    expect(alternativasDepoisDaTroca(agachamento, 'CARDIO')).toBe(agachamento);
  });
});
