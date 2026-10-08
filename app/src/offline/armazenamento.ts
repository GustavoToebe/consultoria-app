import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Chave-valor por trás do repositório offline. No app é o AsyncStorage (SQLite no Android, arquivo no iOS,
 * localStorage na web); nos testes, a versão em memória. Trocar por expo-sqlite não muda o repositório.
 */
export interface ChaveValor {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string): Promise<void>;
  apagar(chaves: string[]): Promise<void>;
  chaves(): Promise<string[]>;
}

export const asyncStorage: ChaveValor = {
  ler: (chave) => AsyncStorage.getItem(chave),
  gravar: (chave, valor) => AsyncStorage.setItem(chave, valor),
  apagar: (chaves) => AsyncStorage.multiRemove(chaves),
  chaves: async () => [...(await AsyncStorage.getAllKeys())],
};

export function emMemoria(): ChaveValor & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    ler: async (chave) => dados.get(chave) ?? null,
    gravar: async (chave, valor) => {
      dados.set(chave, valor);
    },
    apagar: async (chaves) => {
      for (const c of chaves) dados.delete(c);
    },
    chaves: async () => [...dados.keys()],
  };
}
