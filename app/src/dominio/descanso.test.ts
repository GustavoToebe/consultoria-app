import { iniciarDescanso, restante, terminado, ajustarDescanso, segundosDigitados, rotuloDescanso, DESCANSO_MAXIMO } from './descanso';
it('acompanha o relógio mesmo após longo tempo em segundo plano', () => {
 const d = iniciarDescanso(90, 1000);
 expect(restante(d, 31000)).toBe(60000);
 expect(restante(d, 92000)).toBe(0);
 expect(terminado(d, 92000)).toBe(true);
});
it('ajusta quinze segundos sem ficar negativo e pode reiniciar terminado', () => {
 const d = iniciarDescanso(10, 1000);
 expect(ajustarDescanso(d, -15, 2000).terminaEm).toBe(2000);
 expect(restante(ajustarDescanso(d, 15, 12000), 12000)).toBe(15000);
 expect(ajustarDescanso(d, 15, 2000).duracaoMs).toBe(24000);
});
it('converte minutos e segundos digitados e limita o máximo', () => {
 expect(segundosDigitados('1', '30')).toBe(90);
 expect(segundosDigitados('', '45')).toBe(45);
 expect(segundosDigitados('2', '')).toBe(120);
 expect(segundosDigitados('0', '0')).toBeNull();
 expect(segundosDigitados('', '')).toBeNull();
 expect(segundosDigitados('1a', ',5')).toBe(65);
 expect(segundosDigitados('99', '99')).toBe(DESCANSO_MAXIMO);
});
it('escreve o tempo por extenso curto', () => {
 expect(rotuloDescanso(30)).toBe('30 s');
 expect(rotuloDescanso(60)).toBe('1 min');
 expect(rotuloDescanso(90)).toBe('1 min 30 s');
 expect(rotuloDescanso(300)).toBe('5 min');
});
