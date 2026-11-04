import { filtrarPastas, pastasParaCopiarNaNova } from './pastas';

const ativa = { id: 'a', concluidaEm: null };
const concluida = { id: 'c', concluidaEm: '2026-09-21T10:00:00Z' };

describe('pastas: filtro por situação', () => {
  it('todas devolve a lista inteira', () => {
    expect(filtrarPastas([ativa, concluida], 'todas')).toEqual([ativa, concluida]);
  });

  it('ativas deixa só as sem data de conclusão', () => {
    expect(filtrarPastas([ativa, concluida], 'abertas')).toEqual([ativa]);
  });

  it('concluídas deixa só as com data de conclusão', () => {
    expect(filtrarPastas([ativa, concluida], 'concluidas')).toEqual([concluida]);
  });

  it('lista vazia continua vazia', () => {
    expect(filtrarPastas([], 'abertas')).toEqual([]);
  });
});

describe('pastas: copiar na pasta nova', () => {
  const outra = { id: 'b', concluidaEm: '2026-10-01T12:00:00Z' };

  it('não oferece cópia com uma pasta só, mesmo finalizada', () => {
    expect(pastasParaCopiarNaNova([concluida])).toEqual([]);
  });

  it('não oferece cópia quando nenhuma está finalizada', () => {
    expect(pastasParaCopiarNaNova([ativa, { id: 'b', concluidaEm: null }])).toEqual([]);
  });

  it('com mais de uma pasta, oferece só as finalizadas', () => {
    expect(pastasParaCopiarNaNova([ativa, concluida, outra])).toEqual([concluida, outra]);
  });
});
