import type { RegistroPeso } from '../api/tipos';
import { fracaoNoEixo } from './grafico';
import {
  escalaDoPeso, legendaDaEscala, linhaDoHistorico, noPeriodo, pesoParaTela, pontosDoPeso, resumoDoPeso, textoDaDiferenca,
  type DesdeAnterior, type ResumoDoPeso,
} from './resumoDoPeso';

/** Dados fictícios. `variacao` = peso − registro anterior por data (como a API manda). */
const peso = (id: string, data: string, pesoKg: number, variacao: number | null = null): RegistroPeso => ({ id, data, pesoKg, variacao, observacao: null });

function resumo(registros: RegistroPeso[]): ResumoDoPeso {
  const r = resumoDoPeso(registros);
  if (r.vazio) throw new Error('resumo vazio');
  return r;
}
const desde = (registros: RegistroPeso[]): DesdeAnterior => {
  const d = resumo(registros).desdeAnterior;
  if (!d) throw new Error('sem anterior');
  return d;
};

describe('resumo do peso', () => {
  it('registros fora de ordem: o último é o de data mais recente, não o da última posição', () => {
    const r = resumo([peso('b', '2026-09-02', 52.3), peso('c', '2026-10-01', 51.5), peso('a', '2026-08-19', 51)]);
    expect(r.rotuloUltimo).toBe('Último registro');
    expect(r.rotuloDiferenca).toBe('Desde o registro anterior');
    expect(r.ultimo).toEqual({ kg: 51.5, data: '2026-10-01', texto: '51,5 kg', dataTexto: '01/10/2026' });
    expect(desde([peso('b', '2026-09-02', 52.3), peso('c', '2026-10-01', 51.5), peso('a', '2026-08-19', 51)]).kgReferencia).toBe(52.3);
  });

  it('aumento: "+0,6 kg", seta sobe e a referência com data completa', () => {
    expect(desde([peso('a', '2026-08-19', 51), peso('b', '2026-09-02', 51.6)])).toEqual({
      diferenca: 0.6, seta: 'sobe', texto: '+0,6 kg', kgReferencia: 51, dataReferencia: '2026-08-19', referencia: '51,0 kg em 19/08/2026',
    });
  });

  it('redução: sinal de menos tipográfico (−), não o hífen', () => {
    const d = desde([peso('a', '2026-08-19', 51.6), peso('b', '2026-09-02', 51)]);
    expect(d.texto).toBe('−0,6 kg');
    expect(d.texto.startsWith('−')).toBe(true);
    expect(d.seta).toBe('desce');
    expect(d.diferenca).toBe(-0.6);
  });

  it('valores iguais: "0,0 kg · sem alteração" e seta igual', () => {
    expect(desde([peso('a', '2026-08-19', 80), peso('b', '2026-09-02', 80)])).toMatchObject({ diferenca: 0, seta: 'igual', texto: '0,0 kg · sem alteração', referencia: '80,0 kg em 19/08/2026' });
  });

  it('um registro: mantém o peso real e não tem anterior', () => {
    const r = resumo([peso('a', '2026-08-19', 74.25)]);
    expect(r.ultimo.texto).toBe('74,25 kg');
    expect(r.desdeAnterior).toBeNull();
  });

  it('zero registros: estado vazio explícito, nunca 0 kg', () => {
    expect(resumoDoPeso([])).toEqual({ vazio: true });
    expect(noPeriodo([])).toBeNull();
    expect(escalaDoPeso([])).toBeNull();
    expect(pontosDoPeso([])).toEqual([]);
  });

  it('não esconde diferença real de duas casas: 0,04 kg não vira "sem alteração"', () => {
    expect(desde([peso('a', '2026-08-19', 80), peso('b', '2026-09-02', 80.04)])).toMatchObject({ texto: '+0,04 kg', seta: 'sobe' });
  });

  it('mesmo dia (regra existente): data igual nunca é anterior e, no empate, vale o último da lista recebida', () => {
    const lista = [peso('a', '2026-08-19', 51), peso('b', '2026-09-02', 52), peso('c', '2026-09-02', 53)];
    const r = resumo(lista);
    expect(r.ultimo).toMatchObject({ kg: 53, data: '2026-09-02' });
    expect(r.desdeAnterior).toMatchObject({ kgReferencia: 51, dataReferencia: '2026-08-19', diferenca: 2 });
    // só registros no mesmo dia: não há anterior
    expect(resumo([peso('a', '2026-09-02', 52), peso('b', '2026-09-02', 53)]).desdeAnterior).toBeNull();
  });

  it('formatação com vírgula e ao menos uma casa', () => {
    expect(pesoParaTela(51)).toBe('51,0');
    expect(pesoParaTela(51.5)).toBe('51,5');
    expect(pesoParaTela(51.25)).toBe('51,25');
    expect(textoDaDiferenca(0.6)).toBe('+0,6 kg');
    expect(textoDaDiferenca(-1)).toBe('−1,0 kg');
    expect(textoDaDiferenca(0)).toBe('0,0 kg');
    expect(textoDaDiferenca(0.1 + 0.2 - 0.3)).toBe('0,0 kg'); // ruído de ponto flutuante não vira sinal
    expect(textoDaDiferenca(0.3 - 0.1 - 0.2)).toBe('0,0 kg'); // ruído negativo: sem "−0,0"
  });
});

describe('registros inválidos (comportamento atual: o filtro `valido` os ignora)', () => {
  const ruim = [peso('n', '2026-09-10', Number.NaN), peso('v', '', 70), peso('i', '2026-09-11', Number.POSITIVE_INFINITY)];

  it('só inválidos: resumo vazio, sem período, sem escala e sem pontos', () => {
    expect(resumoDoPeso(ruim)).toEqual({ vazio: true });
    expect(noPeriodo(ruim)).toBeNull();
    expect(escalaDoPeso(ruim)).toBeNull();
    expect(pontosDoPeso(ruim)).toEqual([]);
  });

  it('misturados com válidos: não entram no último, no anterior, no período, na escala nem nos pontos', () => {
    const boa = [peso('a', '2026-08-19', 51), peso('b', '2026-09-02', 51.6)];
    const mistura = [...ruim, ...boa, peso('x', '2026-12-01', Number.NaN)];
    expect(resumoDoPeso(mistura)).toEqual(resumoDoPeso(boa));
    expect(noPeriodo(mistura)).toEqual(noPeriodo(boa));
    expect(escalaDoPeso(mistura)).toEqual(escalaDoPeso(boa));
    expect(pontosDoPeso(mistura)).toEqual(pontosDoPeso(boa));
    expect(pontosDoPeso(mistura)).toHaveLength(2);
  });
});

describe('no período', () => {
  it('só com 2 ou mais registros; primeira e última medição em qualquer ordem', () => {
    expect(noPeriodo([peso('a', '2026-08-19', 51)])).toBeNull();
    expect(noPeriodo([peso('c', '2026-10-01', 50), peso('a', '2026-08-19', 51), peso('b', '2026-09-02', 52)])).toEqual({
      rotulo: 'No período',
      primeiro: { kg: 51, data: '2026-08-19' },
      ultimo: { kg: 50, data: '2026-10-01' },
      datas: '19/08/2026 a 01/10/2026',
    });
  });
});

describe('linha do histórico', () => {
  const lista = [peso('c', '2026-10-12', 79.3, -0.7), peso('b', '2026-10-05', 80, 0), peso('a', '2026-09-28', 80, null)];

  it('variação com "desde dd/mm" do registro anterior e a cor pela meta (sem mudar a regra)', () => {
    expect(linhaDoHistorico({ ...lista[0], metaDoPeso: 'REDUZIR' }, lista)).toEqual({ texto: '−0,7 kg', seta: 'desce', desde: 'desde 05/10', tom: 'positivo' });
    expect(linhaDoHistorico({ ...lista[0], metaDoPeso: 'AUMENTAR' }, lista).tom).toBe('problema');
    expect(linhaDoHistorico(lista[0], lista).tom).toBe('neutro');
    expect(linhaDoHistorico(lista[1], lista)).toEqual({ texto: '0,0 kg', seta: 'igual', desde: 'desde 28/09', tom: 'neutro' });
  });

  it('primeira linha, sem anterior: "Sem registro anterior"', () => {
    expect(linhaDoHistorico(lista[2], lista)).toEqual({ texto: 'Sem registro anterior', seta: null, desde: null, tom: 'neutro' });
  });

  it('anterior fora da lista: o número da API fica e o "desde" é nulo', () => {
    expect(linhaDoHistorico(lista[0], [lista[0]])).toMatchObject({ texto: '−0,7 kg', desde: null });
  });
});

describe('gráfico do peso', () => {
  it('intervalos irregulares: a posição horizontal é proporcional à data, não ao índice', () => {
    const pontos = pontosDoPeso([
      peso('d', '2026-09-11', 53), peso('a', '2026-01-14', 50), peso('c', '2026-07-18', 52), peso('b', '2026-05-16', 51),
    ]);
    expect(pontos.map((p) => p.rotulo)).toEqual(['14/01', '16/05', '18/07', '11/09']); // fora de ordem na entrada
    const x = pontos.map((_, i) => fracaoNoEixo(pontos, i));
    // 240 dias de 14/01 a 11/09: 122 até 16/05 e 185 até 18/07 (um espaço por índice daria 1/3 e 2/3)
    expect(x[0]).toBe(0);
    expect(x[1]).toBeCloseTo(122 / 240, 10);
    expect(x[2]).toBeCloseTo(185 / 240, 10);
    expect(x[3]).toBe(1);
    expect(x[1]).not.toBeCloseTo(1 / 3, 2);
  });

  it('mesmo dia: os dois pontos ficam no mesmo lugar e a ordem recebida se mantém', () => {
    const pontos = pontosDoPeso([peso('a', '2026-01-14', 50), peso('b', '2026-02-01', 51), peso('c', '2026-02-01', 52)]);
    expect(pontos.map((p) => p.valor)).toEqual([50, 51, 52]);
    expect(fracaoNoEixo(pontos, 1)).toBe(fracaoNoEixo(pontos, 2));
  });

  it('escala ajustada aos valores, com margem pequena e pontas redondas (50 a 52,5)', () => {
    const escala = escalaDoPeso([peso('a', '2026-08-19', 50.4), peso('b', '2026-09-02', 52.1), peso('c', '2026-09-20', 51)]);
    expect(escala).toEqual({ min: 50, max: 52.5 });
    expect(legendaDaEscala(escala as { min: number; max: number })).toBe('Escala vertical: 50 a 52,5 kg · pontos = registros');
  });

  it('a escala sempre contém todos os valores e nunca começa em zero artificial', () => {
    for (const valores of [[50.4, 52.1], [80, 80.1], [61.37, 61.4, 70.2], [45, 120]]) {
      const e = escalaDoPeso(valores.map((v, i) => peso(String(i), `2026-01-0${i + 1}`, v)));
      expect(e).not.toBeNull();
      expect(e!.min).toBeGreaterThan(0);
      expect(e!.min).toBeLessThanOrEqual(Math.min(...valores));
      expect(e!.max).toBeGreaterThanOrEqual(Math.max(...valores));
    }
  });

  it('as pontas são sempre múltiplos de 0,5, em vários conjuntos de pesos', () => {
    const conjuntos = [[50.4, 52.1], [80, 80.1], [61.37, 61.4, 70.2], [45, 120], [30, 250], [70], [53.33, 53.34], [100.9, 101.1, 99.2], [48.2, 49.9, 55.55], [91.234, 62.5]];
    for (const valores of conjuntos) {
      const e = escalaDoPeso(valores.map((v, i) => peso(String(i), `2026-01-${String(i + 1).padStart(2, '0')}`, v)))!;
      expect(Number.isInteger(e.min * 2)).toBe(true);
      expect(Number.isInteger(e.max * 2)).toBe(true);
      expect(e.max).toBeGreaterThan(e.min);
    }
  });

  it('todos iguais (linha horizontal): intervalo válido em volta do valor', () => {
    const e = escalaDoPeso([peso('a', '2026-08-19', 70), peso('b', '2026-09-02', 70)]);
    expect(e).toEqual({ min: 69.5, max: 70.5 });
    expect(escalaDoPeso([peso('a', '2026-08-19', 70)])).toEqual({ min: 69.5, max: 70.5 }); // um registro: só o ponto
    expect(legendaDaEscala(e!)).toBe('Escala vertical: 69,5 a 70,5 kg · pontos = registros');
  });

  it('extremos (30 e 250 kg): intervalo válido e positivo, pontas redondas', () => {
    const e = escalaDoPeso([peso('a', '2026-08-19', 30), peso('b', '2026-09-02', 250)])!;
    expect(e).toEqual({ min: 10, max: 270 });
    expect(legendaDaEscala(e)).toBe('Escala vertical: 10 a 270 kg · pontos = registros');
  });
});
