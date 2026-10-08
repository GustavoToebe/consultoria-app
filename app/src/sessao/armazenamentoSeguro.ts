import * as SecureStore from 'expo-secure-store';

/**
 * Refresh token no nativo: Keychain (iOS) / Keystore (Android) via expo-secure-store. Nunca AsyncStorage.
 * Na web este arquivo é trocado por `armazenamentoSeguro.web.ts` (o refresh fica no cookie HttpOnly).
 */
const CHAVE_REFRESH = 'treinos.refresh';

export async function lerRefresh(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_REFRESH);
}

export async function salvarRefresh(token: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_REFRESH, token);
}

export async function apagarRefresh(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_REFRESH);
}
