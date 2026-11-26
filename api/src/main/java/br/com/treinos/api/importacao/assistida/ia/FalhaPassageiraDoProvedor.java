package br.com.treinos.api.importacao.assistida.ia;

/**
 * Falha do provedor que pode passar sozinha (tempo esgotado, rede, HTTP 429 ou 5xx): o roteador tenta mais uma vez.
 * Resposta cortada ou que não decodifica nunca é isto: repetir gastaria de novo sem mudar o resultado.
 */
final class FalhaPassageiraDoProvedor extends IllegalStateException {

    private static final long serialVersionUID = 1L;

    FalhaPassageiraDoProvedor(String mensagem) {
        super(mensagem);
    }

    /** HTTP que vale uma nova tentativa: limite de uso e erro do servidor do provedor. */
    static boolean statusPassageiro(int status) {
        return status == 429 || status >= 500;
    }
}
