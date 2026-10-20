package br.com.treinos.api.cep;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A busca de CEP contra dois serviços de mentira (servidor do JDK, sem rede): o principal no formato do ViaCEP e a
 * reserva no da BrasilAPI. Cada CEP de teste diz o que o serviço responde.
 */
class CepServiceTest {

    private HttpServer servidor;
    private final AtomicInteger chamadasPrincipal = new AtomicInteger();
    private final AtomicInteger chamadasReserva = new AtomicInteger();
    /** CEP → [status, corpo] de cada serviço; CEP que não está no mapa dá 404. */
    private final Map<String, Object[]> principal = new ConcurrentHashMap<>();
    private final Map<String, Object[]> reserva = new ConcurrentHashMap<>();

    @BeforeEach
    void subir() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        servidor.createContext("/principal/", troca -> responder(troca, principal, chamadasPrincipal));
        servidor.createContext("/reserva/", troca -> responder(troca, reserva, chamadasReserva));
        // Serviço que manda o cabeçalho e uma parte do corpo e fica parado (várias threads: um parado não trava o outro).
        servidor.createContext("/lento/", troca -> {
            troca.sendResponseHeaders(200, 500);
            troca.getResponseBody().write("{\"loc".getBytes(StandardCharsets.UTF_8));
            troca.getResponseBody().flush();
            try {
                Thread.sleep(4_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            troca.close();
        });
        servidor.setExecutor(Executors.newCachedThreadPool());
        servidor.start();
    }

    @AfterEach
    void descer() {
        servidor.stop(0);
    }

    private static void responder(com.sun.net.httpserver.HttpExchange troca, Map<String, Object[]> respostas, AtomicInteger contador)
            throws IOException {
        contador.incrementAndGet();
        String caminho = troca.getRequestURI().getPath();
        String cep = caminho.substring(caminho.lastIndexOf('/') + 1);
        Object[] resposta = respostas.getOrDefault(cep, new Object[] {404, "{}"});
        byte[] bytes = ((String) resposta[1]).getBytes(StandardCharsets.UTF_8);
        troca.getResponseHeaders().add("Content-Type", "application/json");
        troca.sendResponseHeaders((Integer) resposta[0], bytes.length);
        troca.getResponseBody().write(bytes);
        troca.close();
    }

    private String base() {
        return "http://127.0.0.1:" + servidor.getAddress().getPort();
    }

    private CepService servico(boolean habilitado, Clock clock) {
        return new CepService(new CepProperties(habilitado, base() + "/principal/{cep}", base() + "/reserva/{cep}"), new CepCliente(), clock);
    }

    private CepService servico() {
        return servico(true, Clock.systemUTC());
    }

    private static final String VIACEP = "{\"cep\":\"85807-677\",\"logradouro\":\"Rua Exemplo\",\"complemento\":\"\",\"bairro\":\"Centro\","
            + "\"localidade\":\"Cascavel\",\"uf\":\"PR\"}";

    private static void codigo(Runnable acao, String esperado) {
        assertThatThrownBy(acao::run).isInstanceOfSatisfying(CepException.class,
                e -> assertThat(e.getCodigo()).isEqualTo(esperado));
    }

    @Test
    void achaOEnderecoAceitandoCepComMascaraEGuardaPorUmDia() {
        principal.put("85807677", new Object[] {200, VIACEP});
        var servico = servico();
        assertThat(servico.buscar("85807-677")).isEqualTo(new EnderecoDoCep("Rua Exemplo", "Centro", "Cascavel", "PR"));
        assertThat(servico.buscar("85807677")).isEqualTo(new EnderecoDoCep("Rua Exemplo", "Centro", "Cascavel", "PR"));
        assertThat(chamadasPrincipal).hasValue(1);
    }

    @Test
    void depoisDeUmDiaConsultaDeNovo() {
        principal.put("85807677", new Object[] {200, VIACEP});
        var agora = new Instant[] {Instant.parse("2026-10-20T12:00:00Z")};
        Clock relogio = new Clock() {
            @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override public Instant instant() { return agora[0]; }
        };
        var servico = servico(true, relogio);
        servico.buscar("85807677");
        agora[0] = agora[0].plus(Duration.ofHours(25));
        servico.buscar("85807677");
        assertThat(chamadasPrincipal).hasValue(2);
    }

    @Test
    void cepQueNaoExisteEh404SemTentarAReserva() {
        principal.put("00000000", new Object[] {200, "{\"erro\":true}"});
        codigo(() -> servico().buscar("00000-000"), "CEP_NAO_ENCONTRADO");
        assertThat(chamadasReserva).hasValue(0);
    }

    @Test
    void principalForaDoArUsaAReservaNoFormatoDaBrasilApi() {
        principal.put("85807677", new Object[] {503, "{}"});
        reserva.put("85807677", new Object[] {200, "{\"cep\":\"85807677\",\"state\":\"pr\",\"city\":\"Cascavel\",\"neighborhood\":\"Centro\","
                + "\"street\":\"Rua Exemplo\"}"});
        assertThat(servico().buscar("85807677")).isEqualTo(new EnderecoDoCep("Rua Exemplo", "Centro", "Cascavel", "PR"));
    }

    @Test
    void osDoisForaDoArEh503() {
        principal.put("85807677", new Object[] {500, "{}"});
        reserva.put("85807677", new Object[] {200, "<html>nao e json</html>"});
        codigo(() -> servico().buscar("85807677"), "CEP_INDISPONIVEL");
    }

    @Test
    void respostaSemCidadeOuComUfInvalidaNaoPreencheNada() {
        principal.put("11111111", new Object[] {200, "{\"logradouro\":\"Rua X\",\"localidade\":\"\",\"uf\":\"PR\"}"});
        principal.put("22222222", new Object[] {200, "{\"logradouro\":\"Rua X\",\"localidade\":\"Cidade\",\"uf\":\"ZZ\"}"});
        reserva.put("11111111", new Object[] {500, "{}"});
        reserva.put("22222222", new Object[] {500, "{}"});
        codigo(() -> servico().buscar("11111111"), "CEP_INDISPONIVEL");
        codigo(() -> servico().buscar("22222222"), "CEP_INDISPONIVEL");
    }

    @Test
    void cepGeralSemRuaPreencheCidadeEUf() {
        principal.put("85800000", new Object[] {200, "{\"logradouro\":\"\",\"bairro\":\"\",\"localidade\":\"Cascavel\",\"uf\":\"PR\"}"});
        assertThat(servico().buscar("85800000")).isEqualTo(new EnderecoDoCep("", "", "Cascavel", "PR"));
    }

    @Test
    void respostaGrandeDemaisContaComoServicoForaDoAr() {
        principal.put("44444444", new Object[] {200, "{\"localidade\":\"Cidade\",\"uf\":\"SP\",\"x\":\"" + "A".repeat(20_000) + "\"}"});
        reserva.put("44444444", new Object[] {500, "{}"});
        codigo(() -> servico().buscar("44444444"), "CEP_INDISPONIVEL");
    }

    @Test
    void corpoQueParaNoMeioContaComoServicoForaDoArNoTempoTotal() {
        reserva.put("55555555", new Object[] {200, "{\"city\":\"Cascavel\",\"state\":\"PR\"}"});
        var servico = new CepService(new CepProperties(true, base() + "/lento/{cep}", base() + "/reserva/{cep}"),
                new CepCliente(Duration.ofSeconds(2), Duration.ofMillis(700)), Clock.systemUTC());
        long inicio = System.nanoTime();
        // O principal para no meio do corpo: estoura o tempo e a reserva responde.
        assertThat(servico.buscar("55555555")).isEqualTo(new EnderecoDoCep("", "", "Cascavel", "PR"));
        // Os dois parados: serviço fora do ar, e tudo termina bem antes de o servidor falso soltar o corpo.
        var parados = new CepService(new CepProperties(true, base() + "/lento/{cep}", base() + "/lento/{cep}"),
                new CepCliente(Duration.ofSeconds(2), Duration.ofMillis(700)), Clock.systemUTC());
        codigo(() -> parados.buscar("66666666"), "CEP_INDISPONIVEL");
        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofSeconds(3));
    }

    @Test
    void cepForaDoFormatoEh400SemChamarServico() {
        for (String ruim : new String[] {"123", "abcdefgh", "", "858076770", null}) {
            codigo(() -> servico().buscar(ruim), "CEP_INVALIDO");
        }
        assertThat(chamadasPrincipal).hasValue(0);
    }

    @Test
    void desligadaResponde503() {
        codigo(() -> servico(false, Clock.systemUTC()).buscar("85807677"), "CEP_INDISPONIVEL");
        assertThat(chamadasPrincipal).hasValue(0);
    }

    @Test
    void textoGrandeOuComControleEhLimpoELimitado() {
        String longo = "A".repeat(500);
        principal.put("33333333", new Object[] {200, "{\"logradouro\":\"  Rua\\tTeste\\n \",\"bairro\":\"" + longo + "\",\"localidade\":\"Cidade\",\"uf\":\"sp\"}"});
        var e = servico().buscar("33333333");
        assertThat(e.logradouro()).isEqualTo("Rua Teste");
        assertThat(e.bairro()).hasSize(100);
        assertThat(e.uf()).isEqualTo("SP");
    }
}
