package br.com.treinos.api.inscricoes;

/**
 * Situação do pagamento, só registro manual (decisão de 19/10): nenhuma integração e nada é confirmado sozinho. Não
 * decide o aceite, que é sempre um clique explícito do treinador.
 */
public enum PagamentoInscricao {
    NAO_CONTROLADO, AGUARDANDO, CONFIRMADO_MANUAL
}
