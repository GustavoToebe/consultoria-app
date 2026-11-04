import { readFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * O `expo start` regrava o `app/tsconfig.json` quando ele não está do jeito que o CLI quer: sem `experiments.typedRoutes`
 * tira `.expo/types/**` e `expo-env.d.ts` do `include`; com ele, põe. Este teste roda a mesma função do CLI instalado e
 * falha se ela tiver o que mudar. Se um SDK novo mover o arquivo do CLI, o teste falha alto: ache a função nova e troque
 * o caminho.
 */
const raiz = join(__dirname, '..');
const lerJson = (arquivo: string) => JSON.parse(readFileSync(join(raiz, arquivo), 'utf8'));

interface FuncoesDoCli {
  getTSConfigUpdates: (ts: Record<string, unknown>) => { updates: Set<string> };
  getTSConfigRemoveUpdates: (ts: Record<string, unknown>) => { updates: Set<string> };
}

test('o expo start não reescreve o tsconfig.json', () => {
  const caminho = require.resolve('@expo/cli/build/src/start/server/type-generation/tsconfig', {
    paths: [dirname(require.resolve('expo/package.json'))],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cli: FuncoesDoCli = require(caminho);
  const tsconfig = lerJson('tsconfig.json');
  const rotasTipadas = !!lerJson('app.json').expo?.experiments?.typedRoutes;
  const { updates } = rotasTipadas ? cli.getTSConfigUpdates(tsconfig) : cli.getTSConfigRemoveUpdates(tsconfig);
  expect([...updates]).toEqual([]);
  // Sem `extends` o pré-requisito de TypeScript do CLI também regrava o arquivo.
  expect(tsconfig.extends).toBe('expo/tsconfig.base');
});
