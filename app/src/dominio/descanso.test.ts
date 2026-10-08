import { iniciarDescanso, restante, terminado, ajustarDescanso } from './descanso';
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
