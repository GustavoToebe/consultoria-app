/** Pede o link de pagamento à API (`POST /aluno/financeiro/cobrancas/{id}/link`). */
export type BuscarLinkDePagamento = () => Promise<{ url: string }>;

/**
 * O que aconteceu com o "Pagar":
 * - `aberta`: o pagamento foi aberto (em outra aba na web, no navegador do aparelho no celular);
 * - `bloqueada`: o navegador não deixou abrir a aba (nenhum link foi pedido);
 * - `link-invalido`: a API mandou um link que não é `https` seguro (a aba foi fechada);
 * - `indisponivel`: o aparelho não conseguiu abrir o link (celular).
 */
export type ResultadoDoPagamento = 'aberta' | 'bloqueada' | 'link-invalido' | 'indisponivel';
