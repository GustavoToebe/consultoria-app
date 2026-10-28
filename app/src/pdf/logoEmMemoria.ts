/** Logos prontas (já reduzidas), por `logoUrl`, que leva `?v=<versão>`: logo trocada vira chave nova. Só memória. */
const prontas = new Map<string, string>();
/** Downloads em andamento: dois PDFs seguidos na mesma logo esperam o mesmo download. */
const emAndamento = new Map<string, Promise<string | null>>();
/** Sobe a cada limpeza: um download que termina depois do "Sair" não devolve a logo ao cache. */
let geracao = 0;

/** Esquece as logos guardadas (chamado no "Sair" e quando o servidor derruba a sessão). */
export function limparLogosEmMemoria(): void {
  geracao += 1;
  prontas.clear();
  emAndamento.clear();
}

/**
 * A logo de `logoUrl`: da memória se já foi preparada, senão `preparar` roda uma vez só (chamadas simultâneas dividem o
 * mesmo download). Só sucesso fica guardado; `null` (sem internet, logo ilegível) deixa a próxima chamada tentar de novo.
 */
export async function logoEmMemoria(logoUrl: string, preparar: (logoUrl: string) => Promise<string | null>): Promise<string | null> {
  const guardada = prontas.get(logoUrl);
  if (guardada) return guardada;
  const andando = emAndamento.get(logoUrl);
  if (andando) return andando;
  const dessaGeracao = geracao;
  const tarefa = preparar(logoUrl)
    .then((logo) => {
      if (logo && dessaGeracao === geracao) prontas.set(logoUrl, logo);
      return logo;
    })
    .finally(() => {
      if (dessaGeracao === geracao) emAndamento.delete(logoUrl);
    });
  emAndamento.set(logoUrl, tarefa);
  return tarefa;
}
