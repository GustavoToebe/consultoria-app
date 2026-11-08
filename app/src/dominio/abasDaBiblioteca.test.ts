import { abaInicial, abasDaBiblioteca } from './abasDaBiblioteca';

const com = (...codigos: string[]) => (c: string) => codigos.includes(c);

describe('abas da Biblioteca', () => {
  it('Medicação e ergogênicos só aparece com ERGOGENICO_LER', () => {
    const sem = abasDaBiblioteca(com('BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR')).map((a) => a.valor);
    expect(sem).toEqual(['exercicios', 'alimentos', 'catalogo']);
    const com1 = abasDaBiblioteca(com('BIBLIOTECA_LER', 'ERGOGENICO_LER')).map((a) => a.valor);
    expect(com1).toEqual(['exercicios', 'alimentos', 'ergogenicos', 'catalogo']);
  });

  it('o endereço escolhe a aba, mas nunca uma que o perfil não vê', () => {
    const permitidas = abasDaBiblioteca(com('BIBLIOTECA_LER'));
    expect(abaInicial('suplementos', permitidas)).toBe('alimentos');
    expect(abaInicial(['alimentos', 'csv'], permitidas)).toBe('alimentos');
    expect(abaInicial('ergogenicos', permitidas)).toBe('exercicios');
    expect(abaInicial('qualquer', permitidas)).toBe('exercicios');
    expect(abaInicial(undefined, permitidas)).toBe('exercicios');
    expect(abaInicial('ergogenicos', abasDaBiblioteca(com('BIBLIOTECA_LER', 'ERGOGENICO_LER')))).toBe('ergogenicos');
  });
});
