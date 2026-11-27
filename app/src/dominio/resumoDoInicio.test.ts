import type { ConteudoDieta, ExercicioPlano, ItemDieta, Refeicao } from '../api/tipos';
import { dietaDeHoje, exerciciosNoHoje, minutosDoHorario, proximaRefeicao, textoDosOutrosExercicios } from './resumoDoInicio';

const exercicio = (uid: string, series: number, extra: Partial<ExercicioPlano> = {}) => ({
  uid, exercicioId: null, nome: `Exercício ${uid}`, modalidade: null, videoUrl: null, observacao: null, progressao: false, unidade: 'kg',
  series: Array.from({ length: series }, () => ({})), ...extra,
}) as unknown as ExercicioPlano;

const item = (kcal: number | null): ItemDieta => ({
  uid: `i${Math.random()}`, alimentoId: null, nome: 'Item fictício', quantidade: 100, unidade: 'g', kcal, proteina: 1, carboidrato: 1, gordura: 1, manual: true,
}) as ItemDieta;
const refeicao = (uid: string, horario: string | null, kcal: (number | null)[]): Refeicao => ({
  uid, nome: `Refeição ${uid}`, horario, observacao: null, opcoes: kcal.length ? [{ uid: `o${uid}`, rotulo: 'A', itens: kcal.map(item) }] : [],
});
const dieta = (refeicoes: Refeicao[], variacoes: ConteudoDieta['variacoes'] = []): ConteudoDieta => ({
  objetivo: null, dataInicio: null, profissional: null, observacoes: null, orientacoes: [], suplementacao: [], ergogenicos: null, aguaLitros: null,
  variacoes, refeicoes,
}) as ConteudoDieta;

describe('exerciciosNoHoje', () => {
  it('até 5, com as séries; o resto vira "+N exercícios"', () => {
    const r = exerciciosNoHoje(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((u) => exercicio(u, 3)));
    expect(r.itens).toHaveLength(5);
    expect(r.itens[0]).toEqual({ uid: 'a', nome: 'Exercício a', detalhe: '3 séries' });
    expect(r.mais).toBe(2);
    expect(textoDosOutrosExercicios(r.mais)).toBe('+2 exercícios');
    expect(textoDosOutrosExercicios(1)).toBe('+1 exercício');
  });

  it('uma série no singular; cardio diz "Cardio"; nome vazio é "—"', () => {
    const r = exerciciosNoHoje([exercicio('a', 1), exercicio('b', 1, { modalidade: 'CARDIO' }), exercicio('c', 2, { nome: '  ' })]);
    expect(r.itens.map((i) => i.detalhe)).toEqual(['1 série', 'Cardio', '2 séries']);
    expect(r.itens[2].nome).toBe('—');
    expect(r.mais).toBe(0);
  });
});

describe('horário e próxima refeição', () => {
  it('lê "7:30", "07h30", "12h" e "12:00"; o que não é hora é nulo', () => {
    expect(minutosDoHorario('7:30')).toBe(450);
    expect(minutosDoHorario('07h30')).toBe(450);
    expect(minutosDoHorario('12h')).toBe(720);
    expect(minutosDoHorario('12:00')).toBe(720);
    expect(minutosDoHorario('Depois do treino')).toBeNull();
    expect(minutosDoHorario('25:00')).toBeNull();
    expect(minutosDoHorario(null)).toBeNull();
  });

  it('a primeira com horário a partir de agora; sem horário não é destacada; depois da última, nenhuma', () => {
    const rs = [{ uid: 'a', horario: '07:00' }, { uid: 'b', horario: null }, { uid: 'c', horario: '12:00' }, { uid: 'd', horario: '19:30' }];
    expect(proximaRefeicao(rs, '06:00')).toBe('a');
    expect(proximaRefeicao(rs, '12:00')).toBe('c');
    expect(proximaRefeicao(rs, '12:01')).toBe('d');
    expect(proximaRefeicao(rs, '22:00')).toBeNull();
    expect(proximaRefeicao([{ uid: 'x', horario: null }], '06:00')).toBeNull();
  });
});

describe('dietaDeHoje', () => {
  it('carregando, erro e sem dieta publicada', () => {
    expect(dietaDeHoje({ conteudo: undefined, erro: false, dia: 1, agora: '12:00' })).toEqual({ tipo: 'carregando' });
    expect(dietaDeHoje({ conteudo: undefined, erro: true, dia: 1, agora: '12:00' })).toEqual({ tipo: 'erro' });
    expect(dietaDeHoje({ conteudo: null, erro: false, dia: 1, agora: '12:00' })).toEqual({ tipo: 'sem-dieta' });
  });

  it('kcal da opção A por refeição, o total do dia e a próxima; opção vazia não vira "0 kcal"; item sem kcal deixa "—"', () => {
    const r = dietaDeHoje({ conteudo: dieta([refeicao('a', '07:00', [200, 150]), refeicao('b', '12:00', []), refeicao('c', '19:00', [300, null])]), erro: false, dia: 1, agora: '10:00' });
    expect(r).toMatchObject({ tipo: 'ok', proxima: 'b', total: '— kcal', variacao: null });
    if (r.tipo !== 'ok') throw new Error();
    expect(r.refeicoes.map((x) => x.kcal)).toEqual(['350 kcal', null, '— kcal']);
    expect(dietaDeHoje({ conteudo: dieta([refeicao('a', null, [200])]), erro: false, dia: 1, agora: '10:00' })).toMatchObject({ total: '200 kcal', proxima: null });
  });

  it('com variações, as refeições da variação de hoje e o nome dela; dia sem dieta marcada é "sem-refeicoes-hoje"', () => {
    const conteudo = dieta([], [{ uid: 'v1', rotulo: 'Dia de treino', dias: [1, 3], refeicoes: [refeicao('a', '08:00', [100])] }]);
    expect(dietaDeHoje({ conteudo, erro: false, dia: 1, agora: '07:00' })).toMatchObject({ tipo: 'ok', variacao: 'Dia de treino', proxima: 'a' });
    expect(dietaDeHoje({ conteudo, erro: false, dia: 2, agora: '07:00' })).toEqual({ tipo: 'sem-refeicoes-hoje' });
  });
});
