package br.com.treinos.api.importacao.assistida.ia;

import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Falha do provedor que pode passar sozinha (tempo esgotado, rede, HTTP 429 ou 5xx, evento de sobrecarga): o roteador
 * tenta mais uma vez, depois de {@code esperaPedida} quando o provedor a mandou ({@code retry-after}).
 * Resposta cortada ou que não decodifica nunca é isto: repetir gastaria de novo sem mudar o resultado.
 */
final class FalhaPassageiraDoProvedor extends IllegalStateException {

    private static final long serialVersionUID = 1L;
    /** O provedor pode pedir minutos; a leitura do arquivo não espera mais do que isto. */
    static final Duration TETO_DA_ESPERA = Duration.ofSeconds(30);

    private final Duration esperaPedida;

    FalhaPassageiraDoProvedor(String mensagem) {
        this(mensagem, null);
    }

    FalhaPassageiraDoProvedor(String mensagem, Duration esperaPedida) {
        super(mensagem);
        this.esperaPedida = esperaPedida;
    }

    /** Quanto o provedor pediu para esperar, já com o teto; nulo se não pediu. */
    Duration esperaPedida() {
        return esperaPedida;
    }

    /** HTTP que vale uma nova tentativa: limite de uso e erro do servidor do provedor (inclui o 529 do Claude). */
    static boolean statusPassageiro(int status) {
        return status == 429 || status >= 500;
    }

    /** Resposta HTTP diferente de 200. O corpo fica de fora da mensagem: pode ecoar o conteúdo enviado. */
    static IllegalStateException doStatus(String provedor, HttpResponse<?> resposta) {
        String falha = "Falha na chamada " + provedor + " (HTTP " + resposta.statusCode() + ").";
        return statusPassageiro(resposta.statusCode())
                ? new FalhaPassageiraDoProvedor(falha, retryAfter(resposta.headers())) : new IllegalStateException(falha);
    }

    /** {@code retry-after} em segundos, até o teto; data HTTP, valor torto ou ausente = nulo (vale a espera padrão). */
    static Duration retryAfter(HttpHeaders cabecalhos) {
        return cabecalhos.firstValue("retry-after").map(v -> {
            try {
                long segundos = Long.parseLong(v.strip());
                return segundos < 0 ? null : Duration.ofSeconds(Math.min(segundos, TETO_DA_ESPERA.toSeconds()));
            } catch (NumberFormatException e) {
                return null;
            }
        }).orElse(null);
    }
}
