/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Peças que tinham cor fixa e passaram a usar tokens (04/11): véu (`VEU`), `Switch` (`ui/interruptor`) e a sombra dos
 * painéis flutuantes (`SOMBRA_FLUTUANTE`). Trava para a cor fixa não voltar; a cor nova entra em `tema/tokens.ts`.
 */
const ARQUIVOS = [
  'ui/Passeio.tsx',
  'components/ui/alert-dialog.tsx',
  'components/ui/switch.tsx',
  'ui/EscolhaSuspensa.tsx',
  'ui/SelecaoMultiplaSuspensa.tsx',
  'ui/Calendario.tsx',
  'ui/BuscaGlobal.tsx',
  'ui/CartaoDoUsuario.tsx',
];
const COR_FIXA = /rgba?\(|['"`]#[0-9a-fA-F]{3,8}['"`]|\b(?:bg|text|border)-(?:black|white)\b/;

it.each(ARQUIVOS)('%s não tem cor fixa', (arquivo) => {
  const linhas = readFileSync(resolve(__dirname, '..', arquivo), 'utf8').split('\n');
  expect(linhas.filter((l) => COR_FIXA.test(l))).toEqual([]);
});
