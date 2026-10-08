import { interpolarNumero } from './numeroAnimado';
it('interpola e respeita casas decimais', () => {
 expect(interpolarNumero(10, 20, 0.5)).toBe(15);
 expect(interpolarNumero(10, 11, 0.333, 2)).toBe(10.33);
 expect(interpolarNumero(20, 10, 0.5)).toBe(15);
});
it('limita o passo e não inventa zero para valores ausentes', () => {
 expect(interpolarNumero(1, 2, -1)).toBe(1);
 expect(interpolarNumero(1, 2, 2)).toBe(2);
 expect(interpolarNumero(10, null, 0.5)).toBeNull();
 expect(interpolarNumero(null, 10, 0.5)).toBe(10);
});
