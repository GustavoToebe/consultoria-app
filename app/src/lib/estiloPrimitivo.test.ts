import { estiloPrimitivo } from './estiloPrimitivo';
it('entrega objeto sem índices numéricos ao compositor do Radix', () => {
 const estilo = estiloPrimitivo([{ color: '#FFFFFF' }, false, [{ fontSize: 14 }, { color: '#000000' }]]);
 expect(estilo).toEqual({ color: '#000000', fontSize: 14 });
 expect(Object.keys(estilo)).not.toContain('0');
});
it('preserva o estilo dependente do estado pressionado', () => {
 const estilo = estiloPrimitivo(({ pressed }: {pressed:boolean}) => [{opacity:pressed?0.8:1}, {minHeight:44}]);
 expect(estilo({pressed:true})).toEqual({opacity:0.8,minHeight:44});
});
