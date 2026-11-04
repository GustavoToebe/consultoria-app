package br.com.treinos.api.push;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quais aparelhos já receberam um envio que ainda está na fila (só em memória, nesta instância da API). Serve para a nova
 * tentativa de um envio que falhou EM PARTE ({@code MessageRateExceeded} num dos aparelhos, ou a conclusão "enviado" que não
 * gravou) ir só aos aparelhos que ainda não receberam, em vez de repetir o aviso a todos.
 *
 * <p>Nada disto vai ao banco (a fila continua guardando só o usuário e o andamento) nem a log: guarda só o sha256 de cada token,
 * nunca o valor. A API reiniciada esquece tudo e a nova tentativa volta a ir a todos os aparelhos (o texto é o mesmo). Uma
 * entrada some quando o envio é concluído ou depois de {@code validade} (o pendente expira na fila com o mesmo prazo).
 */
final class EntreguesNoEnvio {

    private record Entregues(Instant desde, Set<String> hashes) { }

    private final Map<UUID, Entregues> porEnvio = new ConcurrentHashMap<>();
    private final Clock relogio;

    EntreguesNoEnvio(Clock relogio) {
        this.relogio = relogio;
    }

    /** O Expo aceitou a mensagem deste token para este envio. */
    void recebeu(UUID envioId, String token) {
        porEnvio.computeIfAbsent(envioId, id -> new Entregues(relogio.instant(), ConcurrentHashMap.newKeySet()))
                .hashes().add(hash(token));
    }

    /** Os tokens que ainda não receberam este envio, na mesma ordem. */
    List<String> semReceber(UUID envioId, List<String> tokens) {
        Entregues entregues = porEnvio.get(envioId);
        if (entregues == null) {
            return tokens;
        }
        return tokens.stream().filter(t -> !entregues.hashes().contains(hash(t))).toList();
    }

    /** O envio terminou (enviado, cancelado ou falhou de vez): não há nova tentativa a filtrar. */
    void esquecer(UUID envioId) {
        porEnvio.remove(envioId);
    }

    /** Envio que começou a ser entregue há mais de {@code validade} já expirou na fila: a memória dele pode sair. */
    void esquecerAntigos(Duration validade) {
        Instant limite = relogio.instant().minus(validade);
        porEnvio.values().removeIf(e -> e.desde().isBefore(limite));
    }

    int emAndamento() {
        return porEnvio.size();
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível.", e);
        }
    }
}
