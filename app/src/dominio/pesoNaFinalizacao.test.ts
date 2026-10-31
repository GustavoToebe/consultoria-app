import { dataDoPesoDaAtualizacao, pesoDaAtualizacao, substituiPesoDaAtualizacao, textoDoPesoDaAtualizacao } from './pesoNaFinalizacao';

// Pesos fictícios.
const PESOS = [
  { id: 'r1', data: '2026-10-05', pesoKg: 83.1, variacao: null, observacao: null },
  { id: 'r2', data: '2026-10-20', pesoKg: 82.4, variacao: -0.7, observacao: null },
];

describe('dataDoPesoDaAtualizacao', () => {
  it('é a data da atualização depois de enviada', () => {
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: '2026-10-20', enviadaEm: '2026-10-20T10:00:00Z' })).toBe('2026-10-20');
  });

  it('não existe com a atualização aberta, sem data ou sem atualização', () => {
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: '2026-10-20', enviadaEm: null })).toBeNull();
    expect(dataDoPesoDaAtualizacao({ dataAtualizacao: null, enviadaEm: '2026-10-20T10:00:00Z' })).toBeNull();
    expect(dataDoPesoDaAtualizacao(null)).toBeNull();
    expect(dataDoPesoDaAtualizacao(undefined)).toBeNull();
  });
});

describe('pesoDaAtualizacao', () => {
  it('acha o peso registrado na data da atualização', () => {
    expect(pesoDaAtualizacao(PESOS, '2026-10-20')).toBe(PESOS[1]);
  });

  it('sem peso naquele dia, sem data ou sem lista: null', () => {
    expect(pesoDaAtualizacao(PESOS, '2026-10-21')).toBeNull();
    expect(pesoDaAtualizacao(PESOS, null)).toBeNull();
    expect(pesoDaAtualizacao([], '2026-10-20')).toBeNull();
    expect(pesoDaAtualizacao(undefined, '2026-10-20')).toBeNull();
  });
});

describe('textoDoPesoDaAtualizacao', () => {
  it('peso com vírgula e data curta no ano corrente', () => {
    expect(textoDoPesoDaAtualizacao(PESOS[1], '2026-10-31')).toBe('Peso da atualização já registrado: 82,4 kg em 20/10');
  });

  it('leva o ano quando é outro', () => {
    expect(textoDoPesoDaAtualizacao({ data: '2025-12-30', pesoKg: 80 }, '2026-01-05')).toBe('Peso da atualização já registrado: 80 kg em 30/12/2025');
  });
});

describe('substituiPesoDaAtualizacao', () => {
  const registrado = PESOS[1];

  it('avisa com peso digitado na mesma data do peso da atualização', () => {
    expect(substituiPesoDaAtualizacao('2026-10-20', registrado, 81.9)).toBe(true);
  });

  it('não avisa em outra data, sem peso digitado, sem peso registrado ou sem data', () => {
    expect(substituiPesoDaAtualizacao('2026-10-31', registrado, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao('2026-10-20', registrado, null)).toBe(false);
    expect(substituiPesoDaAtualizacao('2026-10-20', null, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao(null, registrado, 81.9)).toBe(false);
    expect(substituiPesoDaAtualizacao(undefined, registrado, 81.9)).toBe(false);
  });
});
