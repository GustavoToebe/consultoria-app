package br.com.treinos.api.comunidade;

import br.com.treinos.api.fotos.FotosDeTeste;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * O download da miniatura contra um servidor de mentira do JDK (sem rede). Cada id de teste diz o que o servidor faz. Prova o host
 * fixo, o caminho montado só do id, o redirecionamento não seguido, os tempos, o limite de 300 KB e a conferência de tipo e
 * assinatura.
 */
class YoutubeCapaClienteTest {

    private static final String OK = "AAAAAAAAAAA";
    private static final String REDIRECIONA = "BBBBBBBBBBB";
    private static final String DECLARA_GRANDE = "CCCCCCCCCCC";
    private static final String CORPO_INFINITO = "DDDDDDDDDDD";
    private static final String TIPO_ERRADO = "EEEEEEEEEEE";
    private static final String PNG_COMO_JPEG = "FFFFFFFFFFF";
    private static final String NAO_EXISTE = "GGGGGGGGGGG";
    private static final String CORPO_PARADO = "HHHHHHHHHHH";
    private static final String SEM_RESPOSTA = "IIIIIIIIIII";
    private static final String NO_LIMITE = "JJJJJJJJJJJ";
    private static final String UM_BYTE_ACIMA = "KKKKKKKKKKK";
    private static final String TIPO_COM_PARAMETRO = "LLLLLLLLLLL";
    private static final String ERRO_500 = "MMMMMMMMMMM";

    private HttpServer servidor;
    private final List<String> pedidos = new CopyOnWriteArrayList<>();
    private final AtomicInteger acertosDoAlvo = new AtomicInteger();
    private byte[] jpeg;
    private ListAppender<ILoggingEvent> saidaDoLog;

    @BeforeEach
    void subir() throws IOException {
        jpeg = FotosDeTeste.jpeg(Color.RED, 120, false);
        servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        servidor.createContext("/alvo", troca -> {
            acertosDoAlvo.incrementAndGet();
            enviar(troca, 200, "image/jpeg", jpeg);
        });
        servidor.createContext("/", this::tratar);
        servidor.setExecutor(Executors.newCachedThreadPool());
        servidor.start();
    }

    @BeforeEach
    void capturarOLog() {
        saidaDoLog = new ListAppender<>();
        saidaDoLog.start();
        ((Logger) LoggerFactory.getLogger(YoutubeCapaCliente.class)).addAppender(saidaDoLog);
    }

    @AfterEach
    void descer() {
        ((Logger) LoggerFactory.getLogger(YoutubeCapaCliente.class)).detachAppender(saidaDoLog);
        servidor.stop(0);
    }

    private void tratar(HttpExchange troca) throws IOException {
        pedidos.add(troca.getRequestURI().getRawPath() + (troca.getRequestURI().getRawQuery() == null ? "" : "?" + troca.getRequestURI().getRawQuery()));
        String caminho = troca.getRequestURI().getPath();
        String id = caminho.split("/").length > 2 ? caminho.split("/")[2] : "";
        switch (id) {
            case OK -> enviar(troca, 200, "image/jpeg", jpeg);
            case REDIRECIONA -> {
                troca.getResponseHeaders().add("Location", "/alvo");
                troca.sendResponseHeaders(302, -1);
                troca.close();
            }
            case DECLARA_GRANDE -> enviar(troca, 200, "image/jpeg", comAssinatura(300_001));
            case CORPO_INFINITO -> {
                troca.getResponseHeaders().add("Content-Type", "image/jpeg");
                troca.sendResponseHeaders(200, 0);
                try {
                    byte[] bloco = comAssinatura(64_000);
                    for (int i = 0; i < 40; i++) {
                        troca.getResponseBody().write(bloco);
                    }
                } catch (IOException cortado) {
                    // o cliente abortou: é o esperado
                }
                troca.close();
            }
            case TIPO_ERRADO -> enviar(troca, 200, "text/html", jpeg);
            case PNG_COMO_JPEG -> enviar(troca, 200, "image/jpeg", png());
            case NAO_EXISTE -> enviar(troca, 404, "text/html", "nao".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            case ERRO_500 -> enviar(troca, 500, "text/html", "erro".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            case CORPO_PARADO -> {
                troca.getResponseHeaders().add("Content-Type", "image/jpeg");
                troca.sendResponseHeaders(200, 5_000);
                troca.getResponseBody().write(Arrays.copyOf(jpeg, 10));
                troca.getResponseBody().flush();
                dormir();
                troca.close();
            }
            case SEM_RESPOSTA -> {
                dormir();
                troca.close();
            }
            case NO_LIMITE -> enviar(troca, 200, "image/jpeg", comAssinatura(300_000));
            case UM_BYTE_ACIMA -> {
                troca.getResponseHeaders().add("Content-Type", "image/jpeg");
                troca.sendResponseHeaders(200, 0);
                troca.getResponseBody().write(comAssinatura(300_001));
                troca.close();
            }
            case TIPO_COM_PARAMETRO -> enviar(troca, 200, "image/jpeg; charset=binary", jpeg);
            default -> enviar(troca, 404, "text/html", new byte[0]);
        }
    }

    private static void dormir() {
        try {
            Thread.sleep(3_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static void enviar(HttpExchange troca, int status, String tipo, byte[] corpo) throws IOException {
        troca.getResponseHeaders().add("Content-Type", tipo);
        try {
            troca.sendResponseHeaders(status, corpo.length == 0 ? -1 : corpo.length);
            if (corpo.length > 0) {
                troca.getResponseBody().write(corpo);
            }
        } catch (IOException cortado) {
            // o cliente abortou antes do fim (corpo grande demais): é o esperado
        }
        troca.close();
    }

    /** Corpo com a assinatura de JPEG e o resto zerado: só o tamanho e o começo importam para estes casos. */
    private static byte[] comAssinatura(int tamanho) {
        byte[] c = new byte[tamanho];
        c[0] = (byte) 0xFF;
        c[1] = (byte) 0xD8;
        c[2] = (byte) 0xFF;
        return c;
    }

    private static byte[] png() throws IOException {
        BufferedImage imagem = new BufferedImage(16, 16, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        ImageIO.write(imagem, "png", saida);
        return saida.toByteArray();
    }

    private YoutubeCapaCliente cliente() {
        return new YoutubeCapaCliente("http://127.0.0.1:" + servidor.getAddress().getPort(), Duration.ofSeconds(2), Duration.ofMillis(800));
    }

    @Test
    void ohostEFixoEOEnderecoSeMontaSoDoId() {
        assertThat(YoutubeCapaCliente.BASE_PADRAO).isEqualTo("https://i.ytimg.com");
        assertThat(new YoutubeCapaCliente().enderecoDe("dQw4w9WgXcQ").toString())
                .isEqualTo("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
        assertThat(new YoutubeCapaCliente().enderecoDe("-kqeSi8iHBs").getHost()).isEqualTo("i.ytimg.com");
    }

    @ParameterizedTest
    @ValueSource(strings = {"dQw4w9WgXc", "dQw4w9WgXcQQ", "dQw4w9WgXc/", "dQw4w9Wg@Q?", "../../etc/p", "evil.com/abc", "dQw4w9WgXc\n",
            "dQw4w9WgXc.", "%2e%2e%2f%2e%2e%2f", ""})
    void idForaDoPadraoNaoMontaEnderecoNemChamaARede(String id) {
        assertThatThrownBy(() -> cliente().enderecoDe(id)).isInstanceOf(IllegalArgumentException.class);
        assertThat(cliente().baixar(id)).isNull();
        assertThat(cliente().baixar(null)).isNull();
        assertThat(pedidos).isEmpty();
    }

    @Test
    void baixaSoOCaminhoFixoDoIdSemParametros() {
        assertThat(cliente().baixar(OK)).isEqualTo(jpeg);
        assertThat(pedidos).containsExactly("/vi/" + OK + "/hqdefault.jpg");
    }

    @Test
    void tipoComParametroDeCharsetVale() {
        assertThat(cliente().baixar(TIPO_COM_PARAMETRO)).isEqualTo(jpeg);
    }

    @Test
    void redirecionamentoNaoESeguido() {
        assertThat(cliente().baixar(REDIRECIONA)).isNull();
        assertThat(acertosDoAlvo).hasValue(0);
        assertThat(pedidos).containsExactly("/vi/" + REDIRECIONA + "/hqdefault.jpg");
    }

    @Test
    void statusDiferenteDe200EhFalha() {
        assertThat(cliente().baixar(NAO_EXISTE)).isNull();
        assertThat(cliente().baixar(ERRO_500)).isNull();
    }

    @Test
    void corpoNoLimiteDe300KbPassaEUmByteAcimaAborta() {
        assertThat(cliente().baixar(NO_LIMITE)).hasSize(300_000);
        assertThat(cliente().baixar(UM_BYTE_ACIMA)).isNull();
        assertThat(cliente().baixar(DECLARA_GRANDE)).isNull();
    }

    @Test
    void corpoSemFimSemContentLengthAbortaNoLimite() {
        long inicio = System.nanoTime();
        assertThat(cliente().baixar(CORPO_INFINITO)).isNull();
        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofSeconds(2));
    }

    @Test
    void naoEJpegEhRecusadoPeloTipoOuPelaAssinatura() {
        assertThat(cliente().baixar(TIPO_ERRADO)).isNull();
        assertThat(cliente().baixar(PNG_COMO_JPEG)).isNull();
    }

    @Test
    void tempoDeRespostaCortaCorpoParadoEServidorMudo() {
        long inicio = System.nanoTime();
        assertThat(cliente().baixar(CORPO_PARADO)).isNull();
        assertThat(cliente().baixar(SEM_RESPOSTA)).isNull();
        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofMillis(2_800));
    }

    @Test
    void tempoDeConexaoCortaEnderecoQueNaoResponde() {
        // 192.0.2.1 (TEST-NET-1) não roteia: a conexão não completa. Se a rede do teste recusar na hora, também é falha.
        var cliente = new YoutubeCapaCliente("http://192.0.2.1:81", Duration.ofMillis(500), Duration.ofSeconds(3));
        long inicio = System.nanoTime();
        assertThat(cliente.baixar(OK)).isNull();
        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofMillis(3_500));
    }

    /**
     * A corrida real (resposta que chega entre o fim do prazo e o {@code cancel}) não é reproduzível de forma estável contra o
     * servidor de mentira: o teste cobre o helper com um envio já completo, em que {@code cancel} devolve {@code false}.
     */
    @Test
    @SuppressWarnings("unchecked")
    void envioDescartadoQueJaCompletouFechaOCorpo() {
        var fechado = new AtomicBoolean();
        InputStream corpo = new ByteArrayInputStream(new byte[0]) {
            @Override
            public void close() throws IOException {
                fechado.set(true);
                super.close();
            }
        };
        HttpResponse<InputStream> resposta = mock(HttpResponse.class);
        when(resposta.body()).thenReturn(corpo);
        var envio = CompletableFuture.completedFuture(resposta);

        YoutubeCapaCliente.descartar(envio);

        assertThat(fechado).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void erroAoFecharOCorpoDoEnvioDescartadoNaoEscapa() {
        HttpResponse<InputStream> resposta = mock(HttpResponse.class);
        when(resposta.body()).thenReturn(new InputStream() {
            @Override
            public int read() {
                return -1;
            }

            @Override
            public void close() throws IOException {
                throw new IOException("falha ao fechar");
            }
        });
        var envio = CompletableFuture.completedFuture(resposta);

        assertThatCode(() -> YoutubeCapaCliente.descartar(envio)).doesNotThrowAnyException();
        assertThat(envio).isNotCancelled();
    }

    @Test
    void envioDescartadoSemRespostaFicaCancelado() {
        var envio = new CompletableFuture<HttpResponse<InputStream>>();

        YoutubeCapaCliente.descartar(envio);

        assertThat(envio).isCancelled();
    }

    @Test
    void servidorForaDoArEhFalha() throws IOException {
        var cliente = clienteSemServidor();
        assertThat(cliente.baixar(OK)).isNull();
    }

    private static YoutubeCapaCliente clienteSemServidor() throws IOException {
        int porta;
        try (var livre = new java.net.ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            porta = livre.getLocalPort();
        }
        return new YoutubeCapaCliente("http://127.0.0.1:" + porta, Duration.ofSeconds(1), Duration.ofSeconds(1));
    }

    private static InputStream corpoQueRegistraOFechamento(AtomicBoolean fechado) {
        return new ByteArrayInputStream(new byte[0]) {
            @Override
            public void close() throws IOException {
                fechado.set(true);
                super.close();
            }
        };
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<InputStream> respostaFalsa(int status, Map<String, List<String>> cabecalhos, InputStream corpo) {
        HttpResponse<InputStream> resposta = mock(HttpResponse.class);
        when(resposta.statusCode()).thenReturn(status);
        when(resposta.headers()).thenReturn(HttpHeaders.of(cabecalhos, (a, b) -> true));
        when(resposta.body()).thenReturn(corpo);
        return resposta;
    }

    private long prazo() {
        return System.nanoTime() + Duration.ofSeconds(1).toNanos();
    }

    @Test
    void contentLengthNaoNumericoEhFalhaNeutraEFechaOCorpo() throws InterruptedException {
        var fechado = new AtomicBoolean();
        var resposta = respostaFalsa(200, Map.of("Content-Type", List.of("image/jpeg"), "Content-Length", List.of("abc")),
                corpoQueRegistraOFechamento(fechado));

        var resultado = cliente().conferir(resposta, prazo());

        assertThat(resultado.bytes()).isNull();
        assertThat(resultado.motivo()).isEqualTo("CABECALHO");
        assertThat(fechado).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void falhaInesperadaAoLerOsCabecalhosFechaOCorpoEViraRede() throws InterruptedException {
        var fechado = new AtomicBoolean();
        HttpResponse<InputStream> resposta = mock(HttpResponse.class);
        when(resposta.statusCode()).thenReturn(200);
        when(resposta.headers()).thenThrow(new IllegalStateException("host interno 10.0.0.1"));
        when(resposta.body()).thenReturn(corpoQueRegistraOFechamento(fechado));

        var resultado = cliente().conferir(resposta, prazo());

        assertThat(resultado.bytes()).isNull();
        assertThat(resultado.motivo()).isEqualTo("REDE IllegalStateException");
        assertThat(fechado).isTrue();
    }

    @Test
    void envioCanceladoEhFalhaNeutraSemExcecao() {
        var envio = new CompletableFuture<HttpResponse<InputStream>>();
        envio.cancel(true);

        assertThatCode(() -> {
            var resultado = cliente().receber(envio, prazo());
            assertThat(resultado.bytes()).isNull();
            assertThat(resultado.motivo()).isEqualTo("TEMPO");
        }).doesNotThrowAnyException();
    }

    @Test
    void falhaDoEnvioViraRedeComSoONomeDaClasse() throws InterruptedException {
        var envio = CompletableFuture.<HttpResponse<InputStream>>failedFuture(new java.net.ConnectException("10.1.2.3 recusou"));

        var resultado = cliente().receber(envio, prazo());

        assertThat(resultado.motivo()).isEqualTo("REDE ConnectException");
    }

    /** Roda {@code baixar} e devolve a única mensagem de log que ele escreveu. */
    private String logDe(String id) {
        saidaDoLog.list.clear();
        assertThat(cliente().baixar(id)).isNull();
        assertThat(saidaDoLog.list).hasSize(1);
        assertThat(saidaDoLog.list.getFirst().getLevel()).isEqualTo(Level.WARN);
        return saidaDoLog.list.getFirst().getFormattedMessage();
    }

    @ParameterizedTest
    @CsvSource({NAO_EXISTE + ",STATUS 404", ERRO_500 + ",STATUS 500", REDIRECIONA + ",STATUS 302", TIPO_ERRADO + ",TIPO",
            PNG_COMO_JPEG + ",ASSINATURA", DECLARA_GRANDE + ",TAMANHO", UM_BYTE_ACIMA + ",TAMANHO", SEM_RESPOSTA + ",TEMPO",
            CORPO_PARADO + ",TEMPO"})
    void logDaFalhaTrazSoOMotivoFixoSemUrlNemId(String id, String motivo) {
        String mensagem = logDe(id);

        assertThat(mensagem).isEqualTo("Falha ao buscar capa: " + motivo);
        assertThat(mensagem).doesNotContain(id).doesNotContainIgnoringCase("ytimg").doesNotContainIgnoringCase("http")
                .doesNotContain("127.0.0.1");
    }

    @Test
    void logDeRedeTrazSoONomeDaClasseDaCausa() throws IOException {
        saidaDoLog.list.clear();
        assertThat(clienteSemServidor().baixar(OK)).isNull();

        assertThat(saidaDoLog.list).hasSize(1);
        String mensagem = saidaDoLog.list.getFirst().getFormattedMessage();
        assertThat(mensagem).isEqualTo("Falha ao buscar capa: REDE ConnectException");
        assertThat(mensagem).doesNotContain(OK).doesNotContainIgnoringCase("http").doesNotContain("127.0.0.1");
    }

    @Test
    void sucessoNaoLogaFalha() {
        assertThat(cliente().baixar(OK)).isEqualTo(jpeg);
        assertThat(saidaDoLog.list).isEmpty();
    }
}
