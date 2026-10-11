/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLARO, ESCURO, MARCA_NEUTRA, fontes, textoSobre } from './tokens';
import { variaveisDoTema } from './variaveis';
const css = readFileSync(resolve(__dirname, '../../global.css'), 'utf8');
it.each([['light', CLARO], ['dark', ESCURO]] as const)('espelha todos os tokens do tema %s no CSS', (tema, cores) => {
 const bloco = css.split(`@variant ${tema} {`)[1].split('}')[0];
 for (const [nome, valor] of Object.entries(variaveisDoTema(cores, MARCA_NEUTRA))) {
  expect(bloco).toContain(`${nome}: ${valor};`);
 }
 for (const fonte of Object.values(fontes)) expect(css).toContain(fonte);
 expect(css).toContain('--radius-md: 8px');
});
it('marca não altera cores de status e mantém contraste', () => {
 const a = variaveisDoTema(CLARO, '#ABCDEF');
 expect(a['--color-primary']).toBe('#ABCDEF');
 expect(a['--color-primary-foreground']).toBe(textoSobre('#ABCDEF'));
 expect(a['--color-sucesso']).toBe(CLARO.sucesso);
 expect(a['--color-destructive']).toBe(CLARO.perigoFundo);
 expect(a['--color-ring']).toBe(CLARO.anelFoco);
});

