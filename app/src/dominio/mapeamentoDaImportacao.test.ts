import { DESTINOS, faltandoColuna, sugerirMapeamento } from './mapeamentoDaImportacao';

const alunos = DESTINOS[0];

describe('mapeamento da importação', () => {
  it('acha a coluna sem acento, sem caixa e pelo sinônimo', () => {
    const mapa = sugerirMapeamento(['Nome do aluno', 'Telefone 1 (com DDD)', 'E-MAIL'], alunos.campos);
    expect(mapa.nome).toBe(0);
    expect(mapa.telefone).toBe(1);
    expect(mapa.email).toBe(2);
    expect(mapa.cpf).toBeNull();
  });

  it('não usa a mesma coluna duas vezes', () => {
    const mapa = sugerirMapeamento(['Nome'], alunos.campos);
    expect(mapa.nome).toBe(0);
    expect(Object.values(mapa).filter((v) => v === 0)).toHaveLength(1);
  });

  it('a chave por e-mail bloqueia quando a coluna falta', () => {
    const mapa = sugerirMapeamento(['Nome'], alunos.campos);
    expect(faltandoColuna(alunos, 'email', mapa)).toEqual(['E-mail']);
    expect(faltandoColuna(alunos, 'nome', mapa)).toEqual([]);
  });
});
