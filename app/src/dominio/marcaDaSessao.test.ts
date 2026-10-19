import type { Marca } from '../api/tipos';
import { mesmaMarca } from './marcaDaSessao';

const marca = { nome: 'Consultoria Teste', corPrimaria: '#123456' } as unknown as Marca;

describe('mesmaMarca', () => {
  it('é a mesma quando os campos são iguais, mesmo em objetos diferentes', () => {
    expect(mesmaMarca(marca, { ...marca })).toBe(true);
  });

  it('muda quando algum campo muda', () => {
    expect(mesmaMarca(marca, { ...marca, nome: 'Outra' } as Marca)).toBe(false);
  });

  it('nula e ausente são iguais entre si e diferentes de uma marca', () => {
    expect(mesmaMarca(null, undefined)).toBe(true);
    expect(mesmaMarca(null, marca)).toBe(false);
  });
});
