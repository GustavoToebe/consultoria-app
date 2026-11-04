import { CLARO } from '../tema/tokens';
import { aoPressionarMarcar, coresDoMarcar } from './marcar';
it('grava primeiro mesmo quando a animação nunca termina', () => {
  const ordem: string[] = [];
  aoPressionarMarcar({ aoTocar: () => { ordem.push('registro'); }, animar: () => { ordem.push('animação'); return new Promise(() => undefined); }, vibrar: () => { ordem.push('vibração'); } });
  expect(ordem).toEqual(['registro', 'animação', 'vibração']);
});
it('o ✓ desabilitado não tem a cara do habilitado, e feito continua verde mesmo desabilitado', () => {
  const vazio = coresDoMarcar(CLARO, { feito: false, desabilitado: false, pressionado: false });
  const desabilitado = coresDoMarcar(CLARO, { feito: false, desabilitado: true, pressionado: false });
  expect(desabilitado.borda).not.toBe(vazio.borda);
  expect(desabilitado.fundo).not.toBe(vazio.fundo);
  expect(coresDoMarcar(CLARO, { feito: true, desabilitado: true, pressionado: false }).fundo).toBe(CLARO.sucesso);
});
