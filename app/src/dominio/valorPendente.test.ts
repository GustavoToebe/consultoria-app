import { acompanharPendente, digitarPendente, valorExibido, type ValorPendente } from './valorPendente';

describe('valor pendente (campo com gravação assíncrona)', () => {
  it('sem pendente, a caixa mostra o gravado e acompanhar não cria nada', () => {
    expect(acompanharPendente(undefined, 42)).toBeUndefined();
    expect(valorExibido(undefined, 42)).toBe(42);
  });

  it('digitado e ainda não gravado: a caixa mostra o digitado, não o gravado antigo', () => {
    const p = digitarPendente(undefined, 50, 42);
    expect(acompanharPendente(p, 42)).toBe(p); // o gravado ainda é o antigo: nada muda, mesmo objeto
    expect(valorExibido(p, 42)).toBe(50);
  });

  it('a gravação do último valor chegou: o pendente some e a caixa segue o gravado (o mesmo número)', () => {
    const p = digitarPendente(undefined, 50, 42);
    expect(acompanharPendente(p, 50)).toBeUndefined();
  });

  it('duas teclas em voo ("5" e "50"): o eco do "5" não derruba o pendente; a caixa continua em 50', () => {
    const p = digitarPendente(digitarPendente(undefined, 5, 42), 50, 42);
    expect(p).toEqual({ valor: 50, enviados: [5, 50], visto: 42 });
    const depoisDoCinco = acompanharPendente(p, 5);
    expect(depoisDoCinco).toEqual({ valor: 50, enviados: [5, 50], visto: 5 });
    expect(valorExibido(depoisDoCinco, 5)).toBe(50);
    expect(acompanharPendente(depoisDoCinco, 5)).toBe(depoisDoCinco); // a guarda: sem nova mudança, o mesmo objeto
    expect(acompanharPendente(depoisDoCinco, 50)).toBeUndefined();
  });

  it('voltar ao número que já estava gravado com outra tecla em voo: só some quando o último chega de verdade', () => {
    const p = digitarPendente(digitarPendente(undefined, 4, 42), 42, 42);
    const depoisDoQuatro = acompanharPendente(p, 4);
    expect(valorExibido(depoisDoQuatro, 4)).toBe(42);
    expect(acompanharPendente(depoisDoQuatro, 42)).toBeUndefined();
  });

  it('o gravado muda por fora para um valor que o campo nunca mandou: o pendente é descartado', () => {
    const p = digitarPendente(undefined, 50, 42);
    expect(acompanharPendente(p, 47)).toBeUndefined();
    expect(acompanharPendente(p, undefined as unknown as number)).toBeUndefined(); // registro sumiu
  });

  it('esvaziar o campo é um valor (null), não "sem pendente"', () => {
    const p: ValorPendente<number | null> = digitarPendente<number | null>(undefined, null, 42);
    expect(valorExibido(p, 42)).toBeNull();
    expect(acompanharPendente(p, 42)).toBe(p);
    expect(acompanharPendente(p, null)).toBeUndefined();
  });
});
