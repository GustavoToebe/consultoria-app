/**
 * Reaproveita a foto já pedida (ou em andamento) pelo mesmo id por `ttlMs`: a linha da lista de colegas e a folha do perfil
 * abrem a mesma foto e não devem pedi-la duas vezes (cada pedido gasta o balde da API). Só em memória: o item sai sozinho
 * depois do prazo e na falha (que não fica guardada). Quem pede só chega aqui depois de a API confirmar `temFoto` neste
 * login, então a foto guardada nunca é mostrada sem essa confirmação.
 */
export function criarFotosEmMemoria<T>(buscar: (id: string) => Promise<T>, ttlMs: number): (id: string) => Promise<T> {
  const guardadas = new Map<string, Promise<T>>();
  return (id) => {
    const existente = guardadas.get(id);
    if (existente) return existente;
    const promessa = buscar(id);
    guardadas.set(id, promessa);
    const apagar = () => { if (guardadas.get(id) === promessa) guardadas.delete(id); };
    // shortcut: prazo fixo, sem limpar no "Sair" (≤ 1 min em memória); trocar por limpeza no encerramento se o prazo crescer.
    setTimeout(apagar, ttlMs);
    promessa.catch(apagar);
    return promessa;
  };
}
