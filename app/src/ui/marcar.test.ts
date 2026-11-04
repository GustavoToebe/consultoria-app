import { CLARO } from '../tema/tokens';
import { aoPressionarMarcar, coresDoMarcar } from './marcar';
it('grava primeiro mesmo quando a animação nunca termina', () => {
  const ordem: string[] = [];
  aoPressionarMarcar({ aoTocar: () => { ordem.push('registro'); }, animar: () => { ordem.push('animação'); return new Promise(() => undefined); }, vibrar: () => { ordem.push('vibração'); } });
  expect(ordem).toEqual(['registro', 'animação', 'vibração']);
});
it('o ✓ desabilitado não tem a cara do habilitado, nem quando já está feito', () => {
  const vazio = coresDoMarcar(CLARO, { feito: false, desabilitado: false, pressionado: false });
  const desabilitado = coresDoMarcar(CLARO, { feito: false, desabilitado: true, pressionado: false });
  const feitoEDesabilitado = coresDoMarcar(CLARO, { feito: true, desabilitado: true, pressionado: false });
  expect(desabilitado.borda).not.toBe(vazio.borda);
  expect(desabilitado.fundo).not.toBe(vazio.fundo);
  expect(feitoEDesabilitado.fundo).toBe(CLARO.superficie3);
  expect(feitoEDesabilitado.fundo).not.toBe(CLARO.sucesso);
});
