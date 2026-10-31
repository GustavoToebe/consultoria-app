import type { RegistroPeso } from '../api/tipos';
import { variacaoDoPeso, variacoesDoPeso } from './variacaoDoPeso';

/** Dados fictícios. A lista segue a API: mais recente primeiro, `variacao` = peso − registro anterior por data. */
const peso = (id: string, data: string, pesoKg: number, variacao: number | null): RegistroPeso => ({ id, data, pesoKg, variacao, observacao: null });

const lista: RegistroPeso[] = [
  peso('d', '2026-10-28', 80.5, 1.2),
  peso('c', '2026-10-12', 79.3, -0.7),
  peso('b', '2026-10-05', 80, 0),
  peso('a', '2026-09-28', 80, null),
];

describe('variação do peso', () => {
  it('sobe: sinal de mais, a seta e a data do registro de comparação', () => {
    expect(variacaoDoPeso(lista[0], lista)).toEqual({ texto: '+1,2 kg', seta: 'sobe', desde: '12/10' });
  });

  it('desce: sinal de menos tipográfico (−), não o hífen', () => {
    const v = variacaoDoPeso(lista[1], lista);
    expect(v).toEqual({ texto: '−0,7 kg', seta: 'desce', desde: '05/10' });
    expect(v?.texto.startsWith('−')).toBe(true);
  });

  it('igual: "0 kg" sem sinal e seta igual (o mesmo formato do resto do app)', () => {
    expect(variacaoDoPeso(lista[2], lista)).toEqual({ texto: '0 kg', seta: 'igual', desde: '28/09' });
  });

  it('sem anterior (primeiro registro do aluno, variação nula): nada a mostrar', () => {
    expect(variacaoDoPeso(lista[3], lista)).toBeNull();
    expect(variacaoDoPeso(peso('x', '2026-10-01', 70, null))).toBeNull();
    expect(variacaoDoPeso(peso('x', '2026-10-01', 70, Number.NaN), lista)).toBeNull();
  });

  it('anterior fora da lista (período que o cortou): a variação da API fica e o "desde" é nulo, sem inventar data', () => {
    const doPeriodo = [lista[0], lista[1]]; // o registro de 05/10 ficou de fora
    expect(variacaoDoPeso(lista[1], doPeriodo)).toEqual({ texto: '−0,7 kg', seta: 'desce', desde: null });
    expect(variacaoDoPeso(lista[0], doPeriodo)).toEqual({ texto: '+1,2 kg', seta: 'sobe', desde: '12/10' });
    expect(variacaoDoPeso(lista[0])).toEqual({ texto: '+1,2 kg', seta: 'sobe', desde: null }); // sem lista nenhuma
  });

  it('lista com buraco: o vizinho mais antigo que sobrou não é o da comparação da API, então não há "desde"', () => {
    const comBuraco = [lista[0], lista[2]]; // 28/10 (+1,2 contra 12/10) e 05/10: o de 12/10 sumiu
    expect(variacaoDoPeso(lista[0], comBuraco)).toEqual({ texto: '+1,2 kg', seta: 'sobe', desde: null });
  });

  it('a lista pode vir em qualquer ordem', () => {
    const embaralhada = [lista[2], lista[3], lista[0], lista[1]];
    expect(variacaoDoPeso(lista[0], embaralhada)?.desde).toBe('12/10');
  });

  it('casas como no resto do app (`numeroParaTela`): até duas, sem zero sobrando; resíduo de ponto flutuante some', () => {
    expect(variacaoDoPeso(peso('x', '2026-10-28', 81, 1), [peso('y', '2026-10-12', 80, null)])?.texto).toBe('+1 kg');
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80.25, 0.25), [peso('y', '2026-10-12', 80, null)])?.texto).toBe('+0,25 kg');
    expect(variacaoDoPeso(peso('x', '2026-10-28', 79.75, -0.25))?.texto).toBe('−0,25 kg');
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80, -0.7000000000000028))?.texto).toBe('−0,7 kg');
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80, 10))?.texto).toBe('+10 kg');
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80, 1.5))?.texto).toBe('+1,5 kg');
  });

  it('a seta segue o valor já arredondado: nunca "sobe" com "+0 kg"', () => {
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80, 0.001))).toEqual({ texto: '0 kg', seta: 'igual', desde: null });
    expect(variacaoDoPeso(peso('x', '2026-10-28', 80, -0.001))).toEqual({ texto: '0 kg', seta: 'igual', desde: null });
  });

  it('por lista: um resultado por id, sem mexer nos registros', () => {
    const antes = JSON.stringify(lista);
    const r = variacoesDoPeso(lista);
    expect(Object.keys(r).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(r.d?.texto).toBe('+1,2 kg');
    expect(r.a).toBeNull();
    expect(JSON.stringify(lista)).toBe(antes);
  });
});
