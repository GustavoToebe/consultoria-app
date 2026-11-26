import { DESTINOS, faltandoColuna, mapaDasSugestoes } from './mapeamentoDaImportacao';

const alunos = DESTINOS[0];

describe('mapeamento da importação', () => {
  it('monta o mapa pelas sugestões da API; campo sem sugestão fica em "Não importar"', () => {
    const { mapa, paraConferir } = mapaDasSugestoes([
      { campo: 'nome', coluna: 0, confianca: 'SINONIMO' },
      { campo: 'email', coluna: 2, confianca: 'EXATA' },
      { campo: 'telefone', coluna: 1, confianca: 'PARECIDA' },
    ], alunos, true);
    expect(mapa).toMatchObject({ nome: 0, telefone: 1, email: 2, cpf: null });
    expect([...paraConferir]).toEqual(['telefone']);
  });

  it('ignora campo de outro destino, sensível sem permissão e a segunda sugestão da mesma coluna', () => {
    const { mapa } = mapaDasSugestoes([
      { campo: 'kcal', coluna: 0, confianca: 'EXATA' },
      { campo: 'cpf', coluna: 1, confianca: 'EXATA' },
      { campo: 'nome', coluna: 2, confianca: 'EXATA' },
      { campo: 'email', coluna: 2, confianca: 'SINONIMO' },
    ], alunos, false);
    expect(mapa.kcal).toBeUndefined();
    expect(mapa.cpf).toBeNull();
    expect(mapa.nome).toBe(2);
    expect(mapa.email).toBeNull();
  });

  it('alimentos: fibra é coluna opcional', () => {
    const destino = DESTINOS.find((d) => d.id === 'alimentos')!;
    expect(destino.campos.find((c) => c.id === 'fibra')?.obrigatorio).toBe(false);
    const { mapa } = mapaDasSugestoes(['nome', 'quantidade', 'unidade', 'kcal', 'proteina', 'carboidrato', 'gordura']
      .map((campo, coluna) => ({ campo, coluna, confianca: 'EXATA' as const })), destino, true);
    expect(faltandoColuna(destino, 'nome', mapa)).toEqual([]);
  });

  it('a chave por e-mail bloqueia quando a coluna falta', () => {
    const { mapa } = mapaDasSugestoes([{ campo: 'nome', coluna: 0, confianca: 'EXATA' }], alunos, true);
    expect(faltandoColuna(alunos, 'email', mapa)).toEqual(['E-mail']);
    expect(faltandoColuna(alunos, 'nome', mapa)).toEqual([]);
  });
});
