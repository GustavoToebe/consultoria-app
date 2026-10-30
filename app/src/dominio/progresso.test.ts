import type { ProgressoPonto } from '../api/tipos';
import { agruparPorGrupo, avisoDoGrafico, linhasDaTabela, pontosDoGrafico, resumoDoProgresso, textoDoResumo } from './progresso';

const p = (data: string, maiorCargaTrabalho: number | null, repeticoes: number | null = null): ProgressoPonto => ({ data, maiorCargaTrabalho, repeticoes });

describe('resumoDoProgresso', () => {
  it('lista vazia: sem primeiro nem último', () => {
    expect(resumoDoProgresso([])).toEqual({ primeiro: null, ultimo: null });
    expect(textoDoResumo(resumoDoProgresso([]))).toBeNull();
  });
  it('um registro: só o último', () => {
    const r = resumoDoProgresso([p('2026-10-02', 42.5, 12)]);
    expect(r.primeiro).toBeNull();
    expect(r.ultimo).toEqual({ data: '2026-10-02', carga: 42.5, repeticoes: 12 });
    expect(textoDoResumo(r)).toBe('Último: 42,5 kg × 12 em 02/10');
  });
  it('pega o primeiro e o último com carga, ignorando os sem carga no meio e nas pontas', () => {
    const r = resumoDoProgresso([p('2026-08-30', null, 8), p('2026-09-04', 40, 10), p('2026-09-18', null, 9), p('2026-10-02', 42.5, 12), p('2026-10-09', null, 6)]);
    expect(r.primeiro).toEqual({ data: '2026-09-04', carga: 40 });
    expect(r.ultimo).toEqual({ data: '2026-10-02', carga: 42.5, repeticoes: 12 });
    expect(textoDoResumo(r)).toBe('Primeiro: 40 kg em 04/09 · Último: 42,5 kg × 12 em 02/10');
  });
  it('último sem repetições vira "—"', () => {
    const r = resumoDoProgresso([p('2026-09-04', 40, 10), p('2026-10-02', 45, null)]);
    expect(r.ultimo?.repeticoes).toBeNull();
    expect(textoDoResumo(r)).toBe('Primeiro: 40 kg em 04/09 · Último: 45 kg × — em 02/10');
  });
  it('não depende da ordem em que a API devolve', () => {
    const r = resumoDoProgresso([p('2026-10-02', 42.5, 12), p('2026-09-04', 40, 10)]);
    expect(r.primeiro?.data).toBe('2026-09-04');
    expect(r.ultimo?.data).toBe('2026-10-02');
  });
  it('só dias sem carga: nada a resumir', () => {
    expect(resumoDoProgresso([p('2026-09-04', null, 10), p('2026-10-02', null, 12)])).toEqual({ primeiro: null, ultimo: null });
  });
});

describe('pontosDoGrafico', () => {
  it('só as datas com carga, em ordem crescente', () => {
    const pontos = pontosDoGrafico([p('2026-10-02', 42.5, 12), p('2026-09-18', null, 9), p('2026-09-04', 40, 10)]);
    expect(pontos).toEqual([{ data: '2026-09-04', carga: 40 }, { data: '2026-10-02', carga: 42.5 }]);
  });
  it('carga zero registrada continua sendo ponto (zero é dado; só nulo some)', () => {
    expect(pontosDoGrafico([p('2026-09-04', 0)])).toEqual([{ data: '2026-09-04', carga: 0 }]);
  });
  it('lista vazia ou só nulos: sem pontos', () => {
    expect(pontosDoGrafico([])).toEqual([]);
    expect(pontosDoGrafico([p('2026-09-04', null)])).toEqual([]);
  });
});

describe('linhasDaTabela', () => {
  const todos = ['01', '02', '03', '04', '05', '06', '07'].map((d) => p(`2026-09-${d}`, 40));
  it('mostra as mais recentes primeiro e corta no limite', () => {
    expect(linhasDaTabela(todos, 5).map((x) => x.data)).toEqual(['2026-09-07', '2026-09-06', '2026-09-05', '2026-09-04', '2026-09-03']);
  });
  it('sem limite devolve todas, da mais recente para a mais antiga', () => {
    const t = linhasDaTabela(todos, null);
    expect(t).toHaveLength(7);
    expect(t[6].data).toBe('2026-09-01');
  });
  it('não altera a lista recebida', () => {
    const copia = [...todos];
    linhasDaTabela(todos, 5);
    expect(todos).toEqual(copia);
  });
});

describe('agruparPorGrupo', () => {
  const o = (valor: string, grupo: string) => ({ valor, rotulo: valor, grupo });
  it('ordem dos grupos igual à de opcoesDeProgresso: alfabética em pt-BR e "Sem grupo" por último', () => {
    const grupos = agruparPorGrupo([o('prancha', 'Sem grupo'), o('supino', 'Peito'), o('remada', 'Costas'), o('crucifixo', 'Peito'), o('agachamento', 'Ágil')]);
    expect(grupos.map((g) => g.grupo)).toEqual(['Ágil', 'Costas', 'Peito', 'Sem grupo']);
  });
  it('mantém a ordem recebida dentro de cada grupo', () => {
    const grupos = agruparPorGrupo([o('supino', 'Peito'), o('remada', 'Costas'), o('crucifixo', 'Peito')]);
    expect(grupos.find((g) => g.grupo === 'Peito')?.opcoes.map((x) => x.valor)).toEqual(['supino', 'crucifixo']);
  });
  it('lista vazia: nenhum grupo', () => {
    expect(agruparPorGrupo([])).toEqual([]);
  });
});

test('aviso do gráfico explica por que ele não aparece', () => {
  expect(avisoDoGrafico(0, true)).toBeNull();
  expect(avisoDoGrafico(1, true)).toBe('O gráfico aparece quando houver registros em pelo menos duas datas.');
  expect(avisoDoGrafico(2, true)).toBeNull();
  expect(avisoDoGrafico(5, false)).toBe('Os gráficos estão desligados nas suas preferências (Perfil › Preferências).');
});
