import { alternarComLimite, marcarVisiveis } from './selecaoMultipla';

describe('alternarComLimite', () => {
  it('marca e desmarca dentro do limite', () => {
    const a = alternarComLimite(new Set(['x']), 'y', true, 2);
    expect([...a.marcados]).toEqual(['x', 'y']);
    expect(a.recusado).toBe(false);
    expect([...alternarComLimite(a.marcados, 'x', false, 2).marcados]).toEqual(['y']);
  });
  it('recusa marcar além do limite e não altera o conjunto', () => {
    const a = alternarComLimite(new Set(['x', 'y']), 'z', true, 2);
    expect(a.recusado).toBe(true);
    expect([...a.marcados]).toEqual(['x', 'y']);
  });
  it('desmarcar com o limite cheio sempre é permitido', () => {
    expect(alternarComLimite(new Set(['x', 'y']), 'y', false, 2).recusado).toBe(false);
  });
  it('marcar de novo quem já está marcado não conta como recusa', () => {
    expect(alternarComLimite(new Set(['x', 'y']), 'y', true, 2).recusado).toBe(false);
  });
});

describe('marcarVisiveis', () => {
  it('marca os visíveis na ordem até o limite e conta os deixados', () => {
    const r = marcarVisiveis(['a', 'b', 'c', 'd'], new Set(), 3);
    expect([...r.marcados]).toEqual(['a', 'b', 'c']);
    expect(r.deixados).toBe(1);
  });
  it('mantém o que já estava marcado e respeita o limite total', () => {
    const r = marcarVisiveis(['a', 'b', 'c'], new Set(['z']), 3);
    expect([...r.marcados]).toEqual(['z', 'a', 'b']);
    expect(r.deixados).toBe(1);
  });
  it('não conta como deixado o visível que já estava marcado', () => {
    const r = marcarVisiveis(['a', 'b'], new Set(['a', 'b']), 2);
    expect(r.deixados).toBe(0);
  });
  it('lista vazia não muda nada', () => {
    const r = marcarVisiveis([], new Set(['a']), 10);
    expect([...r.marcados]).toEqual(['a']);
    expect(r.deixados).toBe(0);
  });
});
