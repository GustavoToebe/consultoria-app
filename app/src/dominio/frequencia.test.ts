import type { DiaDeTreino } from '../api/tipos';
import { frequenciaDe, planejarFrequencia, resumoDaFrequencia, textoDaContagem, treinosComRegistro, ultimoDiaComRegistro, type Frequencia } from './frequencia';

describe('resumoDaFrequencia (cartão "Frequência e mobilidade")', () => {
  const comPasta: Frequencia = { semana: 2, ultimo: null, pasta: { titulo: 'Hipertrofia', de: '2026-11-02', ate: '2026-11-12', limitada: false, treinos: 4 } };
  const vigente = { titulo: 'Hipertrofia' };

  it('com pasta e mobilidade: o rótulo da pasta uma vez e as duas linhas com semana e pasta', () => {
    expect(resumoDaFrequencia(comPasta, vigente, { naSemana: 1, naPasta: 0 })).toEqual({
      pasta: 'Pasta Hipertrofia (02/11 a 12/11)',
      comColunaDaPasta: true,
      linhas: [
        { rotulo: 'Treinos', semana: '2 treinos', naPasta: '4 treinos' },
        { rotulo: 'Mobilidade', semana: '1 dia', naPasta: 'Nenhum registro' },
      ],
    });
  });

  it('sem a permissão da mobilidade (ou com a busca dela em erro): só a linha Treinos', () => {
    expect(resumoDaFrequencia(comPasta, vigente, 'oculta').linhas.map((l) => l.rotulo)).toEqual(['Treinos']);
  });

  it('pasta sem mobilidade publicada: a frase só na linha da mobilidade', () => {
    expect(resumoDaFrequencia(comPasta, vigente, null).linhas[1]).toEqual({ rotulo: 'Mobilidade', aviso: 'A pasta vigente não tem mobilidade publicada.' });
  });

  it('sem pasta vigente: "Nenhuma pasta vigente." uma vez, sem a coluna da pasta e sem a linha da mobilidade', () => {
    const r = resumoDaFrequencia({ semana: 0, ultimo: null, pasta: null }, null, null);
    expect(r).toEqual({ pasta: 'Nenhuma pasta vigente.', comColunaDaPasta: false, linhas: [{ rotulo: 'Treinos', semana: 'Nenhum registro', naPasta: null }] });
    expect(resumoDaFrequencia({ semana: 0, ultimo: null, pasta: null }, null, 'oculta').linhas).toHaveLength(1);
  });

  it('pasta vigente sem período contável: rótulo sem datas e as duas células da pasta em "—"', () => {
    const r = resumoDaFrequencia({ semana: 1, ultimo: null, pasta: null }, { titulo: 'Futura' }, { naSemana: 0, naPasta: 0 });
    expect(r.pasta).toBe('Pasta Futura');
    expect(r.linhas).toEqual([
      { rotulo: 'Treinos', semana: '1 treino', naPasta: '—' },
      { rotulo: 'Mobilidade', semana: 'Nenhum registro', naPasta: '—' },
    ]);
  });

  it('pasta cortada no último ano: diz "últimos 12 meses"', () => {
    const longa: Frequencia = { ...comPasta, pasta: { ...comPasta.pasta!, de: '2025-11-13', limitada: true } };
    expect(resumoDaFrequencia(longa, vigente, 'oculta').pasta).toBe('Pasta Hipertrofia (13/11 a 12/11, últimos 12 meses)');
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
    expect(p.pasta).toBeNull();
    expect(p.consulta).toEqual(p.semana);
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
  it('pasta começada esta semana: a consulta começa na segunda', () => {
    const p = planejarFrequencia(hoje, { titulo: 'Nova', inicio: '2026-10-13', fim: '2026-10-27' });
    expect(p.consulta.de).toBe('2026-10-12');
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

describe('frequenciaDe e textoDaContagem', () => {
  it('conta a semana e a pasta com os mesmos dias', () => {
    const plano = planejarFrequencia('2026-10-14', { titulo: 'Plano', inicio: '2026-10-05', fim: '2026-10-30' });
    const dias = [dia('2026-10-06', ['a', [true]]), dia('2026-10-13', ['a', [true]])];
    expect(frequenciaDe(dias, plano)).toMatchObject({ semana: 1, pasta: { treinos: 2, titulo: 'Plano' } });
  });
  it('sem pasta contável a pasta fica nula', () => {
    expect(frequenciaDe([], planejarFrequencia('2026-10-14', null))).toEqual({ semana: 0, ultimo: null, pasta: null });
  });
  it('texto: — para ausente, Nenhum registro para zero', () => {
    expect(textoDaContagem(null)).toBe('—');
    expect(textoDaContagem(0)).toBe('Nenhum registro');
    expect(textoDaContagem(4)).toBe('4 treinos');
    expect(textoDaContagem(1)).toBe('1 treino');
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
