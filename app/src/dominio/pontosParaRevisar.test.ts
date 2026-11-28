import type { ExercicioPlano, Grupo, Serie, Sessao, TecnicaDeGrupo } from '../api/tipos';
import { agrupar } from './agrupamento';
import { blocoSemDescanso, pontosDaSessao, pontosDoPlano, resumoDasPendencias, textoDosPontos } from './pontosParaRevisar';

const serie = (uid: string, descansoSegundos: number | null, extra: Partial<Serie> = {}): Serie => ({
  uid, tipo: 'WORKING', repsMin: 8, repsMax: 10, carga: null, esforco: null, descansoSegundos, ...extra,
});
const exercicio = (uid: string, nome: string, series: Serie[], extra: Partial<ExercicioPlano> = {}): ExercicioPlano => ({
  uid, exercicioId: null, nome, modalidade: 'MUSCULACAO', videoUrl: null, observacao: null, progressao: false, unidade: 'kg', series, ...extra,
});
const sessao = (uid: string, exercicios: ExercicioPlano[], grupos: Grupo[] = []): Sessao => ({
  uid, nome: 'A', diaSemana: 1, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, exercicios, grupos,
});
const grupo = (uid: string, tecnica: TecnicaDeGrupo): Grupo => ({ uid, tecnica, descansoAposSegundos: 90, voltas: null });

describe('blocoSemDescanso', () => {
  it('acusa o bloco com uma série sem descanso, também misto, e aceita 0', () => {
    expect(blocoSemDescanso({ inicio: 0, series: [serie('a', null)] })).toBe(true);
    expect(blocoSemDescanso({ inicio: 0, series: [serie('a', 90), serie('b', null), serie('c', 60)] })).toBe(true);
    expect(blocoSemDescanso({ inicio: 0, series: [serie('a', 0), serie('b', 90)] })).toBe(false);
  });
  it('cluster sem descanso vale a mesma regra', () => {
    const cluster = serie('a', null, { tecnica: { tipo: 'CLUSTER', blocos: [4, 2], pausaSegundos: 15 } });
    expect(blocoSemDescanso({ inicio: 0, series: [cluster] })).toBe(true);
  });
});

describe('pontosDaSessao', () => {
  it('numera pelo bloco, aponta a 1ª série do bloco e o campo da 1ª pendente', () => {
    const series = [serie('a', 60, { tipo: 'WARMUP' }), serie('b', 90), serie('c', null), serie('d', 90)];
    expect(agrupar(series)).toHaveLength(2);
    const [p, ...resto] = pontosDaSessao(sessao('s1', [exercicio('e1', 'Agachamento livre', series)]), 2);
    expect(resto).toEqual([]);
    expect(p).toEqual({
      sessaoUid: 's1', sessaoIndice: 2, exercicioUid: 'e1', exercicioNome: 'Agachamento livre', serieUid: 'b', bloco: 1,
      texto: 'Agachamento livre · Série 2 sem descanso', caminho: 'sessoes[2].exercicios[0].series[2].descansoSegundos',
    });
  });

  it('ignora cardio', () => {
    const cardio = exercicio('e1', 'Esteira', [serie('a', null, { tipo: null, repsMin: null, repsMax: null, cardio: { duracaoMin: 20 } })], { modalidade: 'CARDIO' });
    expect(pontosDaSessao(sessao('s1', [cardio]), 0)).toEqual([]);
  });

  it('ignora membro de superset e conta o de pré-exaustão', () => {
    const s = sessao('s1', [
      exercicio('e1', 'Supino', [serie('a', null)], { grupoUid: 'g1' }),
      exercicio('e2', 'Remada', [serie('b', null)], { grupoUid: 'g1' }),
      exercicio('e3', 'Crucifixo', [serie('c', null)], { grupoUid: 'g2' }),
      exercicio('e4', 'Supino reto', [serie('d', null)], { grupoUid: 'g2' }),
    ], [grupo('g1', 'SUPERSET'), grupo('g2', 'PRE_EXAUSTAO')]);
    expect(pontosDaSessao(s, 0).map((p) => p.exercicioUid)).toEqual(['e3', 'e4']);
  });

  it('sessão sem exercícios não tem ponto', () => {
    expect(pontosDaSessao(sessao('s1', []), 0)).toEqual([]);
  });

  it('nome vazio vira "Exercício N"', () => {
    const [p] = pontosDaSessao(sessao('s1', [exercicio('e1', 'Leg press', [serie('a', 60)]), exercicio('e2', '  ', [serie('b', null)])]), 0);
    expect(p.texto).toBe('Exercício 2 · Série 1 sem descanso');
  });
});

describe('pontosDoPlano', () => {
  it('segue a ordem de sessão, exercício e bloco', () => {
    const plano = {
      sessoes: [
        sessao('s1', [exercicio('e1', 'A', [serie('a', null), serie('b', 60, { tipo: 'BACK_OFF' }), serie('c', null, { tipo: 'WARMUP' })]), exercicio('e2', 'B', [serie('d', null)])]),
        sessao('s2', [exercicio('e3', 'C', [serie('e', null)])]),
      ],
    };
    expect(pontosDoPlano(plano).map((p) => p.texto)).toEqual(['A · Série 1 sem descanso', 'A · Série 3 sem descanso', 'B · Série 1 sem descanso', 'C · Série 1 sem descanso']);
    expect(pontosDoPlano(plano)[3].sessaoIndice).toBe(1);
  });
});

describe('textoDosPontos', () => {
  it('singular e plural', () => {
    expect(textoDosPontos(1)).toBe('1 ponto para revisar');
    expect(textoDosPontos(3)).toBe('3 pontos para revisar');
  });
});

describe('resumoDasPendencias', () => {
  const [ponto] = pontosDaSessao(sessao('s1', [exercicio('e1', 'Agachamento', [serie('a', null)])]), 0);
  const erro = { caminho: 'sessoes[0].nome', mensagem: 'Informe o nome.' };

  it('sem nada', () => {
    expect(resumoDasPendencias({ erros: [], pontos: [], modelo: true })).toEqual({ total: 0, tom: 'sucesso', texto: 'Sem pendências', alvo: null });
    expect(resumoDasPendencias({ erros: [], pontos: [], modelo: false })).toEqual({ total: 0, tom: 'sucesso', texto: 'Pronto para publicar', alvo: null });
  });

  it('só pontos: âmbar e o alvo é o 1º ponto', () => {
    expect(resumoDasPendencias({ erros: [], pontos: [ponto], modelo: true })).toEqual({ total: 1, tom: 'atencao', texto: '1 pendência', alvo: { tipo: 'ponto', ponto } });
    expect(resumoDasPendencias({ erros: [], pontos: [ponto, ponto], modelo: false })).toEqual({ total: 2, tom: 'atencao', texto: '2 pontos para revisar', alvo: { tipo: 'ponto', ponto } });
  });

  it('erro e pontos: vermelho e o erro vem primeiro', () => {
    expect(resumoDasPendencias({ erros: [erro], pontos: [ponto], modelo: true })).toEqual({ total: 2, tom: 'perigo', texto: '2 pendências', alvo: { tipo: 'erro' } });
    expect(resumoDasPendencias({ erros: [erro], pontos: [ponto], modelo: false })).toEqual({ total: 2, tom: 'perigo', texto: '1 problema para publicar', alvo: { tipo: 'erro' } });
  });
});
