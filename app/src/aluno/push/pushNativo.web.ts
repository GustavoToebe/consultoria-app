import type { PlataformaDoPush } from '../../dominio/pushDoAluno';

/** Na web não há push: nada é pedido ao navegador e o interruptor nem aparece. */
export type PushDoAparelho =
  | { estado: 'ok'; token: string; plataforma: PlataformaDoPush }
  | { estado: 'negada' }
  | { estado: 'indisponivel' };

export async function pushPermitido(): Promise<boolean | null> {
  return null;
}
export async function obterPushDoAparelho(_pedirPermissao: boolean): Promise<PushDoAparelho> {
  return { estado: 'indisponivel' };
}
export async function removerPushDoAparelho(): Promise<void> {
  // Nada a apagar.
}
export async function registrarPushDoAparelho(): Promise<void> {
  // Nada a registrar.
}
export async function desligarPushDoAparelho(): Promise<void> {
  // Nada a apagar.
}
