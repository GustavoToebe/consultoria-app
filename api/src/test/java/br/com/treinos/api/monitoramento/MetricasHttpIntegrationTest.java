package br.com.treinos.api.monitoramento;

import br.com.treinos.api.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/** HTTP real: só o coletor com a credencial exclusiva lê as métricas, agregadas, e a credencial não abre mais nada. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "monitoramento.token=credencial_local_de_teste_sem_uso_real_12345")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MetricasHttpIntegrationTest extends AbstractIntegrationTest {

    private static final String CREDENCIAL = "Monitoring credencial_local_de_teste_sem_uso_real_12345";

    @Value("${local.server.port}")
    int porta;

    private HttpResponse<String> consultar(String caminho, String autorizacao) throws Exception {
        HttpRequest.Builder pedido = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + porta + caminho)).GET();
        if (autorizacao != null) {
            pedido.header("Authorization", autorizacao);
        }
        return HttpClient.newHttpClient().send(pedido.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void apenasOColetorLeAsMetricasAgregadas() throws Exception {
        assertThat(consultar("/actuator/health", null).statusCode()).isEqualTo(200);
        assertThat(consultar("/monitoramento/metrics", null).statusCode()).isEqualTo(401);
        assertThat(consultar("/monitoramento/metrics", "Monitoring errado").statusCode()).isEqualTo(401);
        assertThat(consultar("/monitoramento/metrics", "Bearer " + CREDENCIAL.substring(11)).statusCode()).isEqualTo(401);

        HttpResponse<String> metricas = consultar("/monitoramento/metrics", CREDENCIAL);
        assertThat(metricas.statusCode()).isEqualTo(200);
        assertThat(metricas.body()).contains("ecossistema_http_servidor_duracao_seconds_count", "ecossistema_jvm_memoria_bytes")
                .doesNotContain("uri=", "tenant=", "/actuator/health", "credencial_local");
        assertThat(metricas.headers().firstValue("Cache-Control")).contains("no-store");
    }

    @Test
    void aCredencialDeColetaNaoAbreRotaDeNegocio() throws Exception {
        assertThat(consultar("/alunos", CREDENCIAL).statusCode()).isEqualTo(401);
        assertThat(consultar("/eu", CREDENCIAL).statusCode()).isEqualTo(401);
    }
}
