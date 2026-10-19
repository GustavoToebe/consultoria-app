package br.com.treinos.api.integracao;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/**
 * Chamadas do Saraiva à Central, assinadas com a chave de saída (contrato 2). Só existe com a integração ativa. Tem
 * tempo máximo de conexão e de resposta: a Central travada nunca prende uma requisição de usuário nem a subida da API.
 * O caminho assinado é o que vai depois da URL base, sem o que o proxy da Central retira (ex.: {@code /api}).
 */
@Component
@ConditionalOnProperty(name = "treinos.integracao.ativa", havingValue = "true")
public class CentralClient {

    public static final class Resposta {
        private final int status;
        private final byte[] corpo;

        public Resposta(int status, byte[] corpo) {
            this.status = status;
            this.corpo = corpo;
        }

        public int status() {
            return status;
        }

        public byte[] corpo() {
            return corpo;
        }

        public boolean sucesso() {
            return status >= 200 && status < 300;
        }
    }

    private static final Duration CONEXAO = Duration.ofSeconds(5);
    private static final Duration RESPOSTA = Duration.ofSeconds(10);
    /** A página de direitos tem no máximo 100 itens; acima disto algo está errado. */
    private static final int MAXIMO_BYTES = 8 * 1024 * 1024;

    private final ChavesDeIntegracao chaves;
    private final String base;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(CONEXAO).followRedirects(HttpClient.Redirect.NEVER).build();

    public CentralClient(IntegracaoProperties propriedades, ChavesDeIntegracao chaves) {
        this.chaves = chaves;
        this.base = propriedades.centralUrl().replaceAll("/+$", "");
    }

    /** {@code caminho} começa em {@code /integracao/v1/...} e inclui a query, exatamente como será enviado. */
    public Resposta get(String caminho) throws IOException, InterruptedException {
        return enviar("GET", caminho);
    }

    /** POST de corpo vazio (link de pagamento, contrato 6.4), assinado como o GET. */
    public Resposta post(String caminho) throws IOException, InterruptedException {
        return enviar("POST", caminho);
    }

    private Resposta enviar(String metodo, String caminho) throws IOException, InterruptedException {
        var chave = chaves.saida().orElseThrow(IntegracaoException::naoConfigurada);
        String timestamp = Long.toString(java.time.Instant.now().getEpochSecond());
        String nonce = UUID.randomUUID().toString();
        String assinatura = HmacAssinatura.assinar(chave.segredo(), metodo, caminho, timestamp, nonce, new byte[0]);
        HttpRequest requisicao = HttpRequest.newBuilder(URI.create(base + caminho)).timeout(RESPOSTA)
                .method(metodo, HttpRequest.BodyPublishers.noBody())
                .header(IntegracaoFiltro.CHAVE, chave.id())
                .header(IntegracaoFiltro.TIMESTAMP, timestamp)
                .header(IntegracaoFiltro.NONCE, nonce)
                .header(IntegracaoFiltro.ASSINATURA, assinatura)
                .header("Accept", "application/json")
                .build();
        HttpResponse<byte[]> resposta = http.send(requisicao, HttpResponse.BodyHandlers.ofByteArray());
        if (resposta.body().length > MAXIMO_BYTES) {
            throw new IOException("Resposta da central grande demais.");
        }
        return new Resposta(resposta.statusCode(), resposta.body());
    }
}
