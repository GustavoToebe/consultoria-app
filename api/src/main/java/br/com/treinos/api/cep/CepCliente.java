package br.com.treinos.api.cep;

import br.com.treinos.api.web.Formatos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Chamada ao serviço público de CEP. Tem tempo máximo de conexão e de resposta (o serviço travado nunca prende uma
 * requisição), não segue redirecionamento e nunca registra o CEP. O endereço vem só da configuração; o CEP entra nele
 * depois de conferido (8 dígitos).
 */
class CepCliente {

    /** {@code endereco} cheio = achou; {@code naoExiste} = o serviço respondeu que o CEP não existe; os dois vazios = falhou. */
    record Resposta(Optional<EnderecoDoCep> endereco, boolean naoExiste) {
        static Resposta achou(EnderecoDoCep e) {
            return new Resposta(Optional.of(e), false);
        }

        static Resposta inexistente() {
            return new Resposta(Optional.empty(), true);
        }

        static Resposta falhou() {
            return new Resposta(Optional.empty(), false);
        }
    }

    private static final Logger log = LoggerFactory.getLogger(CepCliente.class);
    private static final Duration CONEXAO = Duration.ofSeconds(3);
    private static final Duration RESPOSTA = Duration.ofSeconds(4);
    /** Resposta de CEP tem poucas centenas de bytes: acima disto não é do serviço de CEP. */
    private static final int CORPO_MAX_BYTES = 16 * 1024;
    private static final int LOGRADOURO_MAX = 200;
    private static final int BAIRRO_MAX = 100;
    private static final int CIDADE_MAX = 100;

    /** Lê o corpo fora da thread da chamada, para o tempo total poder cortar uma leitura parada. */
    private static final ExecutorService LEITURA = Executors.newVirtualThreadPerTaskExecutor();

    private record Lida(int status, String corpo) { }

    private final HttpClient http;
    private final Duration total;
    private final JsonMapper json = new JsonMapper();

    CepCliente() {
        this(CONEXAO, RESPOSTA);
    }

    /** {@code total} vale para a resposta inteira (cabeçalho e corpo), não só para a conexão. */
    CepCliente(Duration conexao, Duration total) {
        this.http = HttpClient.newBuilder().connectTimeout(conexao).followRedirects(HttpClient.Redirect.NEVER).build();
        this.total = total;
    }

    /** Consulta o modelo de endereço {@code modelo} (com {@code {cep}}) para o CEP de 8 dígitos. */
    Resposta consultar(String modelo, String cep) {
        Lida lida;
        try {
            lida = baixar(modelo, cep);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Resposta.falhou();
        }
        if (lida == null) {
            return Resposta.falhou();
        }
        int status = lida.status();
        String corpo = lida.corpo();
        // 400 do ViaCEP e 404 da BrasilAPI dizem que o CEP não existe.
        if (status == 404 || status == 400) {
            return Resposta.inexistente();
        }
        if (status != 200) {
            log.warn("CEP: serviço respondeu {}.", status);
            return Resposta.falhou();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(corpo);
        } catch (RuntimeException e) {
            log.warn("CEP: resposta que não é JSON.");
            return Resposta.falhou();
        }
        if (raiz == null || !raiz.isObject()) {
            return Resposta.falhou();
        }
        // ViaCEP responde 200 com {"erro": true} para CEP que não existe.
        if (raiz.path("erro").asBoolean(false) || "true".equals(raiz.path("erro").asString(""))) {
            return Resposta.inexistente();
        }
        // ViaCEP: logradouro/bairro/localidade/uf. BrasilAPI: street/neighborhood/city/state.
        String logradouro = texto(raiz, "logradouro", "street", LOGRADOURO_MAX);
        String bairro = texto(raiz, "bairro", "neighborhood", BAIRRO_MAX);
        String cidade = texto(raiz, "localidade", "city", CIDADE_MAX);
        String uf;
        try {
            uf = Formatos.uf(primeiro(raiz, "uf", "state"));
        } catch (RuntimeException e) {
            uf = null;
        }
        // CEP geral de cidade pequena vem sem rua; sem cidade e UF não há o que preencher.
        if (cidade.isEmpty() || uf == null) {
            return Resposta.falhou();
        }
        return Resposta.achou(new EnderecoDoCep(logradouro, bairro, cidade, uf));
    }

    /**
     * Chama o serviço e lê o corpo (até {@link #CORPO_MAX_BYTES}) dentro do tempo total. Estourou o tempo, o corpo é grande
     * demais ou a conexão falhou: {@code null} (= serviço fora). Nunca registra a URL nem o CEP.
     */
    private Lida baixar(String modelo, String cep) throws InterruptedException {
        long limite = System.nanoTime() + total.toNanos();
        CompletableFuture<HttpResponse<InputStream>> envio;
        try {
            HttpRequest requisicao = HttpRequest.newBuilder(URI.create(modelo.replace("{cep}", cep))).timeout(total)
                    .header("Accept", "application/json").GET().build();
            envio = http.sendAsync(requisicao, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IllegalArgumentException e) {
            log.warn("CEP: endereço do serviço inválido.");
            return null;
        }
        HttpResponse<InputStream> resposta;
        try {
            resposta = envio.get(total.toNanos(), TimeUnit.NANOSECONDS);
        } catch (TimeoutException e) {
            envio.cancel(true);
            log.warn("CEP: serviço demorou além do limite.");
            return null;
        } catch (ExecutionException e) {
            log.warn("CEP: serviço sem resposta ({}).", e.getCause() == null ? "?" : e.getCause().getClass().getSimpleName());
            return null;
        }
        InputStream entrada = resposta.body();
        Future<byte[]> leitura = LEITURA.submit(() -> entrada.readNBytes(CORPO_MAX_BYTES + 1));
        try {
            byte[] bytes = leitura.get(Math.max(1, limite - System.nanoTime()), TimeUnit.NANOSECONDS);
            if (bytes.length > CORPO_MAX_BYTES) {
                log.warn("CEP: resposta grande demais.");
                return null;
            }
            return new Lida(resposta.statusCode(), new String(bytes, StandardCharsets.UTF_8));
        } catch (TimeoutException e) {
            log.warn("CEP: leitura da resposta demorou além do limite.");
            return null;
        } catch (ExecutionException e) {
            log.warn("CEP: falha ao ler a resposta ({}).", e.getCause() == null ? "?" : e.getCause().getClass().getSimpleName());
            return null;
        } finally {
            leitura.cancel(true);
            try {
                entrada.close();
            } catch (IOException ignorado) {
                // o corpo já foi lido ou descartado
            }
        }
    }

    private static String primeiro(JsonNode raiz, String a, String b) {
        String valor = raiz.path(a).asString("");
        return valor.isBlank() ? raiz.path(b).asString("") : valor;
    }

    /** Texto sem espaços sobrando nem caracteres de controle, limitado ao tamanho do campo do cadastro. */
    private static String texto(JsonNode raiz, String a, String b, int maximo) {
        String limpo = primeiro(raiz, a, b).replaceAll("\\p{Cntrl}", " ").trim();
        return limpo.length() > maximo ? limpo.substring(0, maximo).trim() : limpo;
    }
}
