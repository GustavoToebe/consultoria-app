import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Chave-valor do `RepositorioChaveValor` (web: AsyncStorage = localStorage) e de onde o `RepositorioSqlite` migra o
 * que a versão anterior do app guardou no celular. Nos testes, a versão em memória.
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
