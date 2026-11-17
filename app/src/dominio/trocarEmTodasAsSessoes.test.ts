import type { AlternativaDeExercicio, ConteudoTreino } from '../api/tipos';
import { exercicio, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { trocarEmTodasAsSessoes } from './trocarEmTodasAsSessoes';

const alt = (id: string, nome = `Nome ${id}`, videoUrl: string | null = null): AlternativaDeExercicio => ({ exercicioId: id, nome, videoUrl });

const conteudo = (): ConteudoTreino => ({
  objetivo: null,
  orientacoes: null,
  sessoes: [
    sessao('a', [
      exercicio('e1', { exercicioId: 'agacha', nome: 'Agachamento', videoUrl: 'https://exemplo.com/a', equipamento: 'Barra', series: [serie('s1')], grupoUid: 'g', alternativas: [alt('leg', 'Leg press', 'https://exemplo.com/l'), alt('hack'), alt('smith')] }),
      exercicio('e2', { exercicioId: 'supino' }),
    ]),
    sessao('b', [exercicio('e3', { exercicioId: 'agacha', nome: 'Agachamento', series: [serie('s2')], alternativas: [alt('leg', 'Leg press', 'https://exemplo.com/l')] })]),
  ],
});

describe('trocarEmTodasAsSessoes', () => {
  it('troca o principal em todas as sessões e o antigo ocupa o lugar da alternativa (a lista não cresce)', () => {
    const original = conteudo();
    const { conteudo: novo, trocados } = trocarEmTodasAsSessoes(original, 'agacha', alt('leg', 'Leg press', 'https://exemplo.com/l'));
    expect(trocados).toBe(2);
    const [e1, e2] = novo.sessoes[0].exercicios;
    expect(e1).toMatchObject({ uid: 'e1', exercicioId: 'leg', nome: 'Leg press', videoUrl: 'https://exemplo.com/l', grupoUid: 'g', equipamento: null });
    expect(e1.series).toBe(original.sessoes[0].exercicios[0].series);
    expect(e1.alternativas).toEqual([alt('agacha', 'Agachamento', 'https://exemplo.com/a'), alt('hack'), alt('smith')]);
    expect(e2).toBe(original.sessoes[0].exercicios[1]);
    expect(novo.sessoes[1].exercicios[0].alternativas).toEqual([alt('agacha', 'Agachamento', null)]);
    expect(novo.sessoes[1].exercicios[0].exercicioId).toBe('leg');
  });

  it('não muda o conteúdo recebido (o rascunho é imutável aqui)', () => {
    const original = conteudo();
    trocarEmTodasAsSessoes(original, 'agacha', alt('leg'));
    expect(original).toEqual(conteudo());
  });

  it('onde a escolhida não está na lista, o principal muda e a lista fica como estava', () => {
    const c = conteudo();
    c.sessoes[1].exercicios[0].alternativas = undefined;
    const { conteudo: novo, trocados } = trocarEmTodasAsSessoes(c, 'agacha', alt('leg', 'Leg press'));
    expect(trocados).toBe(2);
    expect(novo.sessoes[1].exercicios[0].exercicioId).toBe('leg');
    expect(novo.sessoes[1].exercicios[0].alternativas).toBeUndefined();
  });

  it('principal que não existe no plano, id vazio ou a própria escolhida: nada muda', () => {
    const c = conteudo();
    expect(trocarEmTodasAsSessoes(c, 'remada', alt('leg'))).toEqual({ conteudo: c, trocados: 0 });
    expect(trocarEmTodasAsSessoes(c, '', alt('leg')).trocados).toBe(0);
    expect(trocarEmTodasAsSessoes(c, 'agacha', alt('agacha')).conteudo).toBe(c);
  });
});
