/**
 * Guarda comum dos scripts que tocam dado de aluno: caminho real (sem link simbólico) e a recusa de qualquer caminho
 * dentro do repositório. Mesma regra do `converter-planilha.mjs`: dado de aluno nunca vai para o git.
 */
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Caminho real do que já existe; o que ainda não existe, pelo caminho real da pasta mais próxima. */
export function real(caminho) {
  const absoluto = resolve(caminho);
  if (existsSync(absoluto)) return realpathSync(absoluto);
  const pai = dirname(absoluto);
  return pai === absoluto ? absoluto : join(real(pai), relative(pai, absoluto));
}

export const REPOSITORIO = real(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));

export const dentroDoRepositorio = (caminho) => {
  const r = relative(REPOSITORIO, caminho);
  return !r.startsWith('..') && !isAbsolute(r);
};
