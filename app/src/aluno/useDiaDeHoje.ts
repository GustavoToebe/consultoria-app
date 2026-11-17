import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { diaDeHojeEmBrasilia } from '../dominio/variacoesDaDieta';

/** De quanto em quanto tempo o dia é relido com a tela aberta (a virada da meia-noite de Brasília). */
const RELER_A_CADA_MS = 60_000;

/**
 * Dia da semana de hoje (1 = segunda ... 7 = domingo) pela data de Brasília, para a dieta por dia: relido a cada minuto e
 * quando o app volta para a frente (`AppState` `active`), então a variação de hoje troca sozinha na virada do dia.
 */
export function useDiaDeHojeEmBrasilia(): number {
  const [dia, setDia] = useState(() => diaDeHojeEmBrasilia());
  useEffect(() => {
    const reler = () => setDia(diaDeHojeEmBrasilia());
    const intervalo = setInterval(reler, RELER_A_CADA_MS);
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') reler(); });
    return () => { clearInterval(intervalo); app.remove(); };
  }, []);
  return dia;
}
