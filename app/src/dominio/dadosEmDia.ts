/**
 * `useCarregar` mantém os dados da chave anterior enquanto a nova chega. Para uma lista de escolha isso é uma armadilha
 * (a página ou o aluno anterior aparece e dá para tocar nele): enquanto carrega, a escolha não tem dado nenhum e mostra o
 * esqueleto. Para tela de leitura, em que o dado antigo ajuda, não use.
 */
export function dadosEmDia<T>(dados: T | undefined, carregando: boolean): T | undefined {
  return carregando ? undefined : dados;
}
