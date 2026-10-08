import { asyncStorage } from './armazenamento';
import { RepositorioChaveValor, type RepositorioLocal } from './repositorioLocal';

/** Web: chave-valor (localStorage). O SQLite na web exige cabeçalhos COOP/COEP e WASM; fica só no celular. */
export function abrirRepositorio(usuarioId: string, novoId: () => string): RepositorioLocal {
  return new RepositorioChaveValor(asyncStorage, usuarioId, novoId);
}
