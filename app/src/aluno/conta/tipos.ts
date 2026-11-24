/** O que a Conta lê uma vez (`useCarregar`) e passa às peças: as linhas, o cabeçalho e as folhas mostram o mesmo dado. */
export interface Carga<T> {
  dados: T | undefined;
  erro: unknown;
  carregando: boolean;
  recarregar: () => void;
  definir: (dados: T) => void;
}
