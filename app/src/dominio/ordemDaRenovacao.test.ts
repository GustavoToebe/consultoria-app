import { NOTAS_DA_RENOVACAO, PASSOS_DA_RENOVACAO, TEXTO_DA_ORDEM_DA_RENOVACAO } from './ordemDaRenovacao';

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

  it('monta o texto do ⓘ com um passo numerado por linha e as notas no fim', () => {
    const linhas = TEXTO_DA_ORDEM_DA_RENOVACAO.split('\n');
    expect(linhas[0]).toBe('Ordem sugerida para renovar o ciclo:');
    expect(linhas.slice(1, 7)).toEqual(PASSOS_DA_RENOVACAO.map((p, i) => `${i + 1}. ${p}`));
    expect(linhas[7]).toBe('');
    expect(linhas.slice(8)).toEqual([...NOTAS_DA_RENOVACAO]);
  });
});
