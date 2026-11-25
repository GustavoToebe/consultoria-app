import type { DiaDeTreino } from '../api/tipos';
import { frequenciaDe, planejarFrequencia, resumoDaFrequencia, treinosComRegistro, treinosPrevistosNaSemana, ultimoDiaComRegistro } from './frequencia';

describe('resumoDaFrequencia (cartão "Frequência e mobilidade")', () => {
  const comPasta = { semana: 2, semanaPassada: 3, pasta: { titulo: 'Hipertrofia', de: '2026-11-02', ate: '2026-11-12', limitada: false, treinos: 4 } };
  const vigente = { titulo: 'Hipertrofia' };

  it('com pasta e mobilidade: dois indicadores com a semana passada embaixo e o rótulo da pasta uma vez', () => {
    expect(resumoDaFrequencia(comPasta, vigente, { naSemana: 1, semanaPassada: 0 }, null)).toEqual({
      pasta: 'Pasta Hipertrofia (02/11 a 12/11)',
      comPasta: true,
      indicadores: [
        { rotulo: 'Treinos esta semana', valor: '2 treinos', estado: 'valor', detalhe: 'Semana passada: 3' },
        { rotulo: 'Mobilidade esta semana', valor: '1 dia', estado: 'valor', detalhe: 'Semana passada: 0' },
      ],
    });
  });

  it('com o previsto da pasta: "N de P treinos", plural pelo previsto', () => {
    const valor = (semana: number, previstos: number | null) => resumoDaFrequencia({ ...comPasta, semana }, vigente, 'oculta', previstos).indicadores[0].valor;
    expect(valor(1, 4)).toBe('1 de 4 treinos');
    expect(valor(0, 4)).toBe('0 de 4 treinos');
    expect(valor(1, 1)).toBe('1 de 1 treino');
    expect(valor(1, null)).toBe('1 treino');
    expect(resumoDaFrequencia({ ...comPasta, semana: 0 }, vigente, 'oculta', 4).indicadores[0].estado).toBe('zero');
  });

  it('sem a permissão da mobilidade (ou com a busca dela em erro): só os treinos', () => {
    expect(resumoDaFrequencia(comPasta, vigente, 'oculta', null).indicadores.map((i) => i.rotulo)).toEqual(['Treinos esta semana']);
  });

  it('pasta sem mobilidade publicada: "—" com o motivo no indicador da mobilidade', () => {
    expect(resumoDaFrequencia(comPasta, vigente, null, null).indicadores[1]).toEqual({
      rotulo: 'Mobilidade esta semana', valor: '—', estado: 'indisponivel', detalhe: null, motivo: 'A pasta vigente não tem mobilidade publicada.',
    });
  });

  it('sem pasta vigente: a nota uma vez, sem a mobilidade e sem o previsto; zero no plural', () => {
    const r = resumoDaFrequencia({ semana: 0, semanaPassada: 1, pasta: null }, null, { naSemana: 2, semanaPassada: 0 }, 4);
    expect(r).toEqual({ pasta: 'Nenhuma pasta vigente.', comPasta: false, indicadores: [
      { rotulo: 'Treinos esta semana', valor: '0 treinos', estado: 'zero', detalhe: 'Semana passada: 1' },
    ] });
  });

  it('mobilidade zerada é zero, "0 dias"', () => {
    expect(resumoDaFrequencia(comPasta, vigente, { naSemana: 0, semanaPassada: 2 }, null).indicadores[1]).toMatchObject({ valor: '0 dias', estado: 'zero', detalhe: 'Semana passada: 2' });
  });

  it('pasta vigente sem período contável: rótulo sem datas', () => {
    expect(resumoDaFrequencia({ semana: 1, semanaPassada: 0, pasta: null }, { titulo: 'Futura' }, 'oculta', null).pasta).toBe('Pasta Futura');
  });

  it('pasta cortada no último ano: diz "últimos 12 meses"', () => {
    const longa = { ...comPasta, pasta: { ...comPasta.pasta, de: '2025-11-13', limitada: true } };
    expect(resumoDaFrequencia(longa, vigente, 'oculta', null).pasta).toBe('Pasta Hipertrofia (13/11 a 12/11, últimos 12 meses)');
  });
});

describe('treinosPrevistosNaSemana', () => {
  const s = (tipo: 'TREINO' | 'ACESSORIOS', diaSemana: number | null, frequenciaSemanal: number | null) => ({ tipo, diaSemana, frequenciaSemanal });
  it('dia fixo conta 1 e sem dia fixo conta as vezes por semana; só sessões de treino', () => {
    expect(treinosPrevistosNaSemana([s('TREINO', 1, null), s('TREINO', 3, 2), s('TREINO', null, 2), s('ACESSORIOS', null, null)])).toBe(4);
  });
  it('uma sessão de treino sem dia nem vezes deixa o previsto desconhecido', () => {
    expect(treinosPrevistosNaSemana([s('TREINO', 1, null), s('TREINO', null, null)])).toBeNull();
  });
  it('sem sessão de treino não há previsto', () => {
    expect(treinosPrevistosNaSemana([])).toBeNull();
    expect(treinosPrevistosNaSemana([s('ACESSORIOS', 2, null)])).toBeNull();
  });
});

const serie = (concluida: boolean) => ({ id: 's', serieUid: 'su', tipo: 'WS', trabalho: true, carga: null, unidade: null, repeticoes: null, concluida, observacao: null });
const dia = (data: string, ...sessoes: [string, boolean[]][]): DiaDeTreino => ({
  data,
  sessoes: sessoes.map(([uid, series]) => ({ sessaoUid: uid, sessao: uid, planoVersaoId: 'v', exercicios: [{ exercicioUid: 'e', exercicioId: null, nome: 'Exercício', series: series.map(serie) }] })),
});

describe('treinosComRegistro', () => {
  it('conta cada par data+sessão uma vez, com pelo menos uma série concluída', () => {
    const dias = [dia('2026-10-05', ['a', [true, true]], ['b', [true]]), dia('2026-10-06', ['a', [false, true]])];
    expect(treinosComRegistro(dias, '2026-10-05', '2026-10-11')).toBe(3);
  });
  it('série não concluída não conta', () => {
    expect(treinosComRegistro([dia('2026-10-05', ['a', [false, false]])], '2026-10-05', '2026-10-11')).toBe(0);
  });
  it('só as datas do período (extremos incluídos)', () => {
    const dias = [dia('2026-10-04', ['a', [true]]), dia('2026-10-05', ['a', [true]]), dia('2026-10-11', ['a', [true]]), dia('2026-10-12', ['a', [true]])];
    expect(treinosComRegistro(dias, '2026-10-05', '2026-10-11')).toBe(2);
  });
  it('sem dias é zero', () => {
    expect(treinosComRegistro([], '2026-10-05', '2026-10-11')).toBe(0);
  });
});

describe('planejarFrequencia', () => {
  // 2026-10-14 é quarta-feira: a semana vai de segunda 12/10 até hoje.
  const hoje = '2026-10-14';
  it('sem pasta: só a semana', () => {
    const p = planejarFrequencia(hoje, null);
    expect(p.semana).toEqual({ de: '2026-10-12', ate: hoje });
    expect(p.semanaPassada).toEqual({ de: '2026-10-05', ate: '2026-10-11' });
    expect(p.pasta).toBeNull();
    expect(p.consulta).toEqual({ de: '2026-10-05', ate: hoje });
  });
  it('pasta em andamento vai do início até hoje e a consulta cobre a pasta', () => {
    const p = planejarFrequencia(hoje, { titulo: 'Plano 16', inicio: '2026-09-28', fim: '2026-10-27' });
    expect(p.pasta).toEqual({ de: '2026-09-28', ate: hoje, titulo: 'Plano 16', limitada: false });
    expect(p.consulta).toEqual({ de: '2026-09-28', ate: hoje });
  });
  it('pasta que já terminou vai até o fim dela e a semana segue valendo', () => {
    const p = planejarFrequencia(hoje, { titulo: 'Antiga', inicio: '2026-09-01', fim: '2026-09-30' });
    expect(p.pasta).toMatchObject({ de: '2026-09-01', ate: '2026-09-30' });
    expect(p.consulta).toEqual({ de: '2026-09-01', ate: hoje });
  });
  it('pasta começada esta semana: a consulta começa na segunda da semana passada', () => {
    const p = planejarFrequencia(hoje, { titulo: 'Nova', inicio: '2026-10-13', fim: '2026-10-27' });
    expect(p.consulta.de).toBe('2026-10-05');
  });
  it('pasta no futuro ou sem período não tem contagem', () => {
    expect(planejarFrequencia(hoje, { titulo: 'Futura', inicio: '2026-10-20', fim: '2026-11-20' }).pasta).toBeNull();
    expect(planejarFrequencia(hoje, { titulo: 'Sem fim', inicio: '2026-10-01', fim: null }).pasta).toBeNull();
    expect(planejarFrequencia(hoje, { titulo: 'Sem início', inicio: null, fim: '2026-10-30' }).pasta).toBeNull();
  });
  it('pasta com mais de um ano conta só o que a API entrega e avisa que limitou', () => {
    const p = planejarFrequencia(hoje, { titulo: 'Longa', inicio: '2024-01-01', fim: '2027-01-01' });
    expect(p.pasta).toMatchObject({ de: '2025-10-15', ate: hoje, limitada: true });
    expect(p.consulta.de).toBe('2025-10-15');
  });
});

describe('frequenciaDe', () => {
  it('conta a semana, a semana passada e a pasta com os mesmos dias', () => {
    const plano = planejarFrequencia('2026-10-14', { titulo: 'Plano', inicio: '2026-10-05', fim: '2026-10-30' });
    const dias = [dia('2026-10-06', ['a', [true]]), dia('2026-10-08', ['a', [true]]), dia('2026-10-13', ['a', [true]])];
    expect(frequenciaDe(dias, plano)).toMatchObject({ semana: 1, semanaPassada: 2, pasta: { treinos: 3, titulo: 'Plano' } });
  });
  it('sem pasta contável a pasta fica nula', () => {
    expect(frequenciaDe([], planejarFrequencia('2026-10-14', null))).toEqual({ semana: 0, semanaPassada: 0, ultimo: null, pasta: null });
  });
  it('o último treino não olha a semana passada (o Resumo diz "nesta semana" sem pasta)', () => {
    const plano = planejarFrequencia('2026-10-14', null);
    expect(frequenciaDe([dia('2026-10-07', ['a', [true]])], plano)).toMatchObject({ semanaPassada: 1, ultimo: null });
  });
});

describe('ultimoDiaComRegistro', () => {
  it('a data mais recente com série concluída, em qualquer ordem', () => {
    const dias = [dia('2026-10-13', ['a', [true]]), dia('2026-10-06', ['a', [true]]), dia('2026-10-14', ['a', [false]])];
    expect(ultimoDiaComRegistro(dias)).toBe('2026-10-13');
  });
  it('nenhum concluído = nulo', () => {
    expect(ultimoDiaComRegistro([dia('2026-10-14', ['a', [false]])])).toBeNull();
    expect(ultimoDiaComRegistro([])).toBeNull();
  });
});
