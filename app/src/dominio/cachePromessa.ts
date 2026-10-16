/**
 * Uma busca compartilhada: quem chega enquanto ela corre recebe a mesma promessa, e o resultado bom fica guardado.
 * Falha NÃO fica guardada (a próxima chamada busca de novo). `forcar` descarta o que estava guardado e busca outra vez.
 */
export interface CachePromessa<T> {
  obter: (forcar?: boolean) => Promise<T>;
  /** O valor já resolvido, se houver (para a tela não piscar "carregando" na segunda vez). */
  atual: () => T | null;
}

export function criarCachePromessa<T>(buscar: (forcar: boolean) => Promise<T>): CachePromessa<T> {
  let promessa: Promise<T> | null = null;
  let valor: T | null = null;
  return {
    obter(forcar = false) {
      if (promessa && !forcar) {
        return promessa;
      }
      valor = null;
      const nova: Promise<T> = buscar(forcar).then(
        (resultado) => {
          if (promessa === nova) {
            valor = resultado;
          }
          return resultado;
        },
        (erro: unknown) => {
          if (promessa === nova) {
            promessa = null;
          }
          throw erro;
        },
      );
      promessa = nova;
      return nova;
    },
    atual: () => valor,
  };
}
