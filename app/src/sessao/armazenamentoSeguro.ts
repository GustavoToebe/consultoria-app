import * as SecureStore from 'expo-secure-store';

/**
 * Refresh token no nativo: Keychain (iOS) / Keystore (Android) via expo-secure-store. Nunca AsyncStorage.
 * Na web este arquivo é trocado por `armazenamentoSeguro.web.ts` (o refresh fica no cookie HttpOnly).
 * iOS: item do Keychain só deste aparelho (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). O padrão (`WHEN_UNLOCKED`) deixaria o item
 * ir no backup do iCloud e ser restaurado noutro iPhone, com a sessão junto. O Android ignora a opção.
 */
const CHAVE_REFRESH = 'treinos.refresh';
const OPCOES: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function lerRefresh(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_REFRESH);
}

export async function salvarRefresh(token: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_REFRESH, token, OPCOES);
}

export async function apagarRefresh(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_REFRESH);
}
