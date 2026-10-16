/**
 * Apaga do aparelho o que é da sessão: credenciais, perfil salvo e as limpezas registradas por `aoSair` (dados offline
 * do aluno, favoritos...). Vale para o "Sair" e para o servidor que recusou a sessão no meio do uso: nos dois, os dados
 * da pessoa não devem ficar no aparelho.
 *
 * Ordem: credenciais primeiro (se algo falhar adiante, a sessão já não abre), depois o perfil salvo e por fim as
 * limpezas, cada uma isolada (uma que falhe não impede as outras). Sem `usuarioId` (sessão que nem chegou a abrir) não
 * há o que limpar por usuário. Só `limparSessaoLocal` pode lançar; as demais falhas são engolidas.
 */
export interface DependenciasDoEncerramento {
  /** Id de quem está encerrando, lido na hora (não uma cópia velha). */
  usuarioId: string | undefined;
  limparSessaoLocal: () => Promise<void>;
  removerPerfilSalvo: () => Promise<void>;
  limpezas: Iterable<(usuarioId: string) => Promise<void>>;
}

export async function apagarDadosDaSessaoLocal({
  usuarioId,
  limparSessaoLocal,
  removerPerfilSalvo,
  limpezas,
}: DependenciasDoEncerramento): Promise<void> {
  await limparSessaoLocal();
  await removerPerfilSalvo().catch(() => undefined);
  if (!usuarioId) return;
  for (const limpar of [...limpezas]) {
    await limpar(usuarioId).catch(() => undefined);
  }
}
