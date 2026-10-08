/**
 * Na web o refresh fica no cookie HttpOnly `TREINOS_REFRESH` (o JS não lê) e o access token só em memória.
 * Nada vai para localStorage. As funções existem só para o código ser o mesmo nas duas plataformas.
 */
export async function lerRefresh(): Promise<string | null> {
  return null;
}

export async function salvarRefresh(_token: string): Promise<void> {
  // O servidor grava o cookie.
}

export async function apagarRefresh(): Promise<void> {
  // O logout limpa o cookie no servidor.
}
