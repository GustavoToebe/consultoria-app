// permissões em matriz (23/11)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CATALOGO_DE_EXEMPLO } from './catalogoDePermissoes.exemplo';
import { DEPENDENCIAS_DE_PERMISSAO } from './perfilEquipe';

/**
 * Paridade com o Java: lê `CatalogoPermissoes.java` e confere o espelho das dependências do app e a cópia do catálogo dos
 * testes. Em 23/11 faltavam `ERGOGENICO_LER → BIBLIOTECA_LER` e `ERGOGENICO_ALTERAR → ERGOGENICO_LER` no app: marcar só os
 * ergogênicos dava 400 no servidor.
 */
const java = readFileSync(resolve(__dirname, '../../../api/src/main/java/br/com/treinos/api/equipe/CatalogoPermissoes.java'), 'utf8');

it('dependências do app iguais às da API', () => {
  const daApi = Object.fromEntries(
    [...java.matchAll(/Map\.entry\("(\w+)",Set\.of\(([^)]*)\)\)/g)].map(([, codigo, lista]) => [codigo, [...lista.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort()]),
  );
  const doApp = Object.fromEntries(Object.entries(DEPENDENCIAS_DE_PERMISSAO).map(([c, l]) => [c, [...l].sort()]));
  expect(doApp).toEqual(daApi);
});

it('catálogo de exemplo igual ao da API (código, seção, módulo, descrição e sensível)', () => {
  const daApi = [...java.matchAll(/new Permissao\("(\w+)","([^"]*)","([^"]*)","([^"]*)",(true|false)\)/g)]
    .map(([, codigo, secao, modulo, descricao, sensivel]) => ({ codigo, secao, modulo, descricao, sensivel: sensivel === 'true' }));
  expect(daApi.length).toBeGreaterThan(40);
  expect(CATALOGO_DE_EXEMPLO).toEqual(daApi);
});
