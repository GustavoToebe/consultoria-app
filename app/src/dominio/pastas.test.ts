import { filtrarPastas } from './pastas';

const ativa = { id: 'a', concluidaEm: null };
const concluida = { id: 'c', concluidaEm: '2026-09-21T10:00:00Z' };

describe('pastas: filtro por situação', () => {
  it('todas devolve a lista inteira', () => {
    expect(filtrarPastas([ativa, concluida], 'todas')).toEqual([ativa, concluida]);
  });

  it('ativas deixa só as sem data de conclusão', () => {
    expect(filtrarPastas([ativa, concluida], 'ativas')).toEqual([ativa]);
  });

  it('concluídas deixa só as com data de conclusão', () => {
    expect(filtrarPastas([ativa, concluida], 'concluidas')).toEqual([concluida]);
  });

  it('lista vazia continua vazia', () => {
    expect(filtrarPastas([], 'ativas')).toEqual([]);
  });
});
