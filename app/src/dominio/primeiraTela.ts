import type { TelaDoCatalogo } from './telas';

/**
 * Para onde mandar quem abre `/treinador` sem poder ver o Início (sem `PAINEL_VER`, N1): a primeira tela do menu
 * (ordem do catálogo) que a pessoa abre. Nunca devolve o próprio Início nem uma ação, então o redirecionamento não
 * volta para onde estava; `null` = nenhuma tela (o aviso "Sem acesso" fica).
 */
export function primeiraTelaPermitida(permitidas: readonly TelaDoCatalogo[]): string | null {
  return permitidas.find((t) => !t.acao && t.href !== '/treinador')?.href ?? null;
}
