package br.com.treinos.api.comunidade;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Baixa a miniatura de um vídeo do YouTube (C25). O host é uma constante do código ({@link #BASE_PADRAO}): nenhuma URL, host
 * ou parte do link do usuário entra na chamada, só o id já conferido ({@link IdDoYoutube#ID}, conferido de novo aqui) no
 * caminho fixo {@code /vi/<id>/hqdefault.jpg}. A base só muda pelo construtor de teste (nunca por propriedade nem variável de
 * ambiente). Sem proxy, sem seguir redirecionamento, 3 s de conexão e 4 s no total (cabeçalho e corpo), corpo de até 300 KB
 * lido com limite (o {@code Content-Length} não vale como garantia), status 200, {@code Content-Type: image/jpeg} e
 * assinatura JPEG. Qualquer falha devolve {@code null}; o log não leva URL nem id.
 */
@Component
class YoutubeCapaCliente {

    /** O único host consultado em produção. */
    static final String BASE_PADRAO = "https://i.ytimg.com";
    static final int CORPO_MAX_BYTES = 300_000;

    private static final Logger log = LoggerFactory.getLogger(YoutubeCapaCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(3);
    private static final Duration RESPOSTA = Duration.ofSeconds(4);

    /** Lê o corpo fora da thread da chamada, para o tempo total poder cortar uma leitura parada. */
    private static final ExecutorService LEITURA = Executors.newVirtualThreadPerTaskExecutor();

    private final HttpClient http;
    private final String base;
    private final Duration total;

    @Autowired
    YoutubeCapaCliente() {
        this(BASE_PADRAO, CONEXAO, RESPOSTA);
    }

    /** Só para teste: base apontando para um servidor de mentira; {@code total} vale para a resposta inteira. */
    YoutubeCapaCliente(String base, Duration conexao, Duration total) {
        this.http = HttpClient.newBuilder().connectTimeout(conexao).followRedirects(HttpClient.Redirect.NEVER)
                .proxy(HttpClient.Builder.NO_PROXY).build();
        this.base = base;
        this.total = total;
    }

    /** O endereço monta-se só do id; id fora de {@code [A-Za-z0-9_-]{11}} é recusado antes de qualquer rede. */
    URI enderecoDe(String id) {
        if (id == null || !IdDoYoutube.ID.matcher(id).matches()) {
            throw new IllegalArgumentException("id inválido");
        }
        return URI.create(base + "/vi/" + id + "/hqdefault.jpg");
    }

    /** O JPEG baixado, ou {@code null} se algo falhou (rede, tempo, status, tipo, tamanho ou assinatura). Só isto vai a log. */
    byte[] baixar(String id) {
        URI endereco;
        try {
            endereco = enderecoDe(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
        byte[] jpeg;
        try {
            jpeg = ler(endereco);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        if (jpeg == null) {
            log.warn("Falha ao buscar capa.");
        }
        return jpeg;
    }

    /**
     * Chama e confere status, tipo e {@code Content-Length} antes de ler; lê no máximo {@link #CORPO_MAX_BYTES} + 1 byte dentro
     * do tempo total e confere a assinatura JPEG. Qualquer coisa fora disso: {@code null}.
     */
    private byte[] ler(URI endereco) throws InterruptedException {
        long limite = System.nanoTime() + total.toNanos();
        CompletableFuture<HttpResponse<InputStream>> envio;
        try {
            HttpRequest requisicao = HttpRequest.newBuilder(endereco).timeout(total).header("Accept", "image/jpeg").GET().build();
            envio = http.sendAsync(requisicao, HttpResponse.BodyHandlers.ofInputStream());
        } catch (RuntimeException e) {
            return null;
        }
        HttpResponse<InputStream> resposta;
        try {
            resposta = envio.get(total.toNanos(), TimeUnit.NANOSECONDS);
        } catch (TimeoutException | ExecutionException e) {
            descartar(envio);
            return null;
        } catch (InterruptedException e) {
            descartar(envio);
            throw e; // quem chama restaura a flag de interrupção
        }
        InputStream entrada = resposta.body();
        String tipo = resposta.headers().firstValue("Content-Type").orElse("").split(";", 2)[0].trim();
        // Redirecionamento não é seguido: 3xx cai aqui. O Content-Length só adianta a recusa; o limite real é o da leitura.
        if (resposta.statusCode() != 200 || !"image/jpeg".equalsIgnoreCase(tipo)
                || resposta.headers().firstValueAsLong("Content-Length").orElse(0L) > CORPO_MAX_BYTES) {
            fechar(entrada);
            return null;
        }
        Future<byte[]> leitura = LEITURA.submit(() -> entrada.readNBytes(CORPO_MAX_BYTES + 1));
        try {
            byte[] c = leitura.get(Math.max(1, limite - System.nanoTime()), TimeUnit.NANOSECONDS);
            boolean jpeg = c.length >= 3 && c.length <= CORPO_MAX_BYTES && (c[0] & 0xFF) == 0xFF && (c[1] & 0xFF) == 0xD8
                    && (c[2] & 0xFF) == 0xFF;
            return jpeg ? c : null;
        } catch (TimeoutException | ExecutionException e) {
            return null;
        } finally {
            leitura.cancel(true);
            fechar(entrada);
        }
    }

    /**
     * Desiste do envio. Se a resposta completou entre o fim do prazo e o {@code cancel} (ele devolve {@code false}), o corpo
     * chega depois e ninguém o leria: sem fechar, a conexão ficaria presa.
     */
    static void descartar(CompletableFuture<HttpResponse<InputStream>> envio) {
        envio.cancel(true);
        var unused = envio.thenAccept(r -> fechar(r.body())); // fire-and-forget: fechar já trata a exceção
    }

    private static void fechar(InputStream entrada) {
        try {
            entrada.close();
        } catch (IOException ignorado) {
            // o corpo já foi lido ou descartado
        }
    }
}
