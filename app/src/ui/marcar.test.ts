import { aoPressionarMarcar } from './marcar';
it('grava primeiro mesmo quando a animação nunca termina', () => {
  const ordem: string[] = [];
  aoPressionarMarcar({ aoTocar: () => { ordem.push('registro'); }, animar: () => { ordem.push('animação'); return new Promise(() => undefined); }, vibrar: () => { ordem.push('vibração'); } });
  expect(ordem).toEqual(['registro', 'animação', 'vibração']);
});
