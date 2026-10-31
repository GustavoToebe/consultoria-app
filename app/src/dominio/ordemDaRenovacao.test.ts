import { NOTAS_DA_RENOVACAO, PASSOS_DA_RENOVACAO } from './ordemDaRenovacao';

describe('ordem sugerida para renovar o ciclo', () => {
  it('tem os seis passos na ordem combinada em 30/10', () => {
    expect(PASSOS_DA_RENOVACAO).toEqual([
      'Ler a atualização.',
      'Renovar a pasta.',
      'Revisar os rascunhos.',
      'Publicar cada plano.',
      'Dar o retorno ao aluno.',
      'Finalizar a pasta anterior.',
    ]);
  });

  it('deixa claro o que finalizar e publicar não fazem', () => {
    expect(NOTAS_DA_RENOVACAO).toContain('Finalizar não publica nada.');
    expect(NOTAS_DA_RENOVACAO).toContain('Publicar não abre um ciclo novo: para um novo período, renove a pasta.');
  });
});
