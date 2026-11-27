/** Na web não há push: nada é pedido ao navegador, nada é registrado e o "Sair" não chama a API do token. */

export const DESTINO_DO_TOQUE_DE_ATENCAO = '/treinador/atualizacoes?comAtencao=true';

export async function pushPermitido(): Promise<boolean | null> {
  return null;
}
export async function ativarPushDoTreinador(): Promise<'ok' | 'negada' | 'indisponivel'> {
  return 'indisponivel';
}
export async function registrarPushDoTreinador(): Promise<void> {
  // Nada a registrar.
}
export async function removerPushDoTreinadorAoSair(): Promise<void> {
  // Nada a apagar.
}
export async function ouvirToqueNaNotificacao(_navegar: (destino: string) => void): Promise<() => void> {
  return () => undefined;
}
