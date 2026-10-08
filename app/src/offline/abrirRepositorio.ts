import { asyncStorage } from './armazenamento';
import { fabricaExpo } from './bancoExpo';
import type { RepositorioLocal } from './repositorioLocal';
import { RepositorioSqlite } from './repositorioSqlite';

/**
 * Celular (Android/iOS): SQLite, um banco por usuário. Traz o que a versão anterior guardou no AsyncStorage.
 * Na web, `abrirRepositorio.web.ts` usa o chave-valor.
 */
export function abrirRepositorio(usuarioId: string, novoId: () => string): RepositorioLocal {
  return new RepositorioSqlite(fabricaExpo, usuarioId, novoId, undefined, asyncStorage);
}
