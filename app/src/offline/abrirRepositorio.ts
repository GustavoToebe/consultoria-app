import { fabricaExpo } from './bancoExpo';
import type { RepositorioLocal } from './repositorioLocal';
import { RepositorioSqlite } from './repositorioSqlite';

/**
 * Celular (Android/iOS): SQLite, um banco por usuário.
 * Na web, `abrirRepositorio.web.ts` usa o chave-valor.
 */
export function abrirRepositorio(usuarioId: string, novoId: () => string): RepositorioLocal {
  return new RepositorioSqlite(fabricaExpo, usuarioId, novoId);
}
