/**
 * O link de indicação do aluno leva o código no fragmento (`/inscricao/<codigo>?origem=indicacao#indicacao=<uuid>`): o
 * fragmento não vai ao servidor, ao log de acesso nem ao Referer. A página o lê, guarda na guia (`sessionStorage`), tira
 * do endereço e o manda no envio. O código nunca é exibido nem vai a log ou mensagem de erro; a API confere em silêncio.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chave própria na guia (o contato guardado usa `inscricao_<codigo>`). */
export const CHAVE_DA_INDICACAO = 'indicacao_codigo';

type Guarda = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** O código do fragmento só se for um UUID válido (em minúsculas); senão `null`. Nunca lança. */
export function lerIndicacaoDoFragmento(hash: string | null | undefined): string | null {
  try {
    const valor = (new URLSearchParams((hash ?? '').replace(/^#/, '')).get('indicacao') ?? '').trim();
    return UUID.test(valor) ? valor.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Guarda o código na guia; sem armazenamento (modo privado) a indicação só se perde. */
export function guardarIndicacao(guarda: Guarda | null, codigo: string): void {
  try { guarda?.setItem(CHAVE_DA_INDICACAO, codigo); } catch { /* guia sem armazenamento: só não guarda */ }
}

/** O código guardado; valor que não é UUID (ou leitura que falha) é apagado e vira `null`. */
export function indicacaoGuardada(guarda: Guarda | null): string | null {
  try {
    const salvo = guarda?.getItem(CHAVE_DA_INDICACAO) ?? null;
    if (salvo === null) return null;
    if (UUID.test(salvo)) return salvo.toLowerCase();
    apagarIndicacao(guarda);
    return null;
  } catch {
    apagarIndicacao(guarda);
    return null;
  }
}

export function apagarIndicacao(guarda: Guarda | null): void {
  try { guarda?.removeItem(CHAVE_DA_INDICACAO); } catch { /* idem */ }
}
