package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.DireitosLocais;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class DireitosInstanciaSplitTest {

    @Test
    void semPoliticaSplitConverteParaIsentoCompatibilidadeV1() {
        UUID consultoriaId = UUID.randomUUID();
        UUID contratacaoId = UUID.randomUUID();
        Instant agora = Instant.now();

        DireitosInstancia d = new DireitosInstancia(
                contratacaoId, UUID.randomUUID(), "TREINOS", consultoriaId, 2L, "ATIVA", true,
                null, null, new DireitosInstancia.Plano("pro", "Profissional"),
                Map.of("alunos_ativos", 50L), List.of("pdf"), agora, null);

        DireitosLocais local = d.paraLocal(consultoriaId, agora);

        assertThat(local.splitModo()).isEqualTo("ISENTO");
        assertThat(local.splitPercentualBps()).isZero();
        assertThat(local.saldoAbaterCentavos()).isZero();
        assertThat(local.metaMensalCentavos()).isZero();
        assertThat(local.cobrancaCentralId()).isNull();
    }

    @Test
    void comPoliticaSplitAbaterMensalidadeENormalizacaoDeModos() {
        UUID consultoriaId = UUID.randomUUID();
        UUID contratacaoId = UUID.randomUUID();
        UUID cobrancaCentralId = UUID.randomUUID();
        Instant agora = Instant.now();

        var split = new DireitosInstancia.PoliticaSplitDto(
                "ABATER_MENSALIDADE", 1500, 19990L, 5000L, 14990L, cobrancaCentralId);
        DireitosInstancia d = new DireitosInstancia(
                contratacaoId, UUID.randomUUID(), "TREINOS", consultoriaId, 3L, "ATIVA", true,
                null, null, new DireitosInstancia.Plano("pro", "Profissional"),
                Map.of(), List.of(), agora, split);

        DireitosLocais local = d.paraLocal(consultoriaId, agora);

        assertThat(local.splitModo()).isEqualTo("ABATER_MENSALIDADE");
        assertThat(local.splitPercentualBps()).isEqualTo(1500);
        assertThat(local.metaMensalCentavos()).isEqualTo(19990L);
        assertThat(local.saldoAbaterCentavos()).isEqualTo(14990L);
        assertThat(local.cobrancaCentralId()).isEqualTo(cobrancaCentralId);

        // Fallback quando restanteAbaterCentavos vem nulo (calcula meta - abatido)
        var splitCalculado = new DireitosInstancia.PoliticaSplitDto(
                "taxa_plataforma", 350, 10000L, 2500L, null, null);
        DireitosLocais local2 = new DireitosInstancia(
                contratacaoId, null, "TREINOS", consultoriaId, 4L, "ATIVA", true,
                null, null, new DireitosInstancia.Plano("pro", "Profissional"),
                Map.of(), List.of(), agora, splitCalculado).paraLocal(consultoriaId, agora);
        assertThat(local2.splitModo()).isEqualTo("TAXA_PLATAFORMA");
        assertThat(local2.splitPercentualBps()).isEqualTo(350);
        assertThat(local2.saldoAbaterCentavos()).isEqualTo(7500L);

        // TAXA_PERCENTUAL preservado e modo desconhecido cai em ISENTO
        var splitPercentual = new DireitosInstancia.PoliticaSplitDto("TAXA_PERCENTUAL", 500, 0L, 0L, 0L, null);
        DireitosLocais local3 = new DireitosInstancia(
                contratacaoId, null, "TREINOS", consultoriaId, 5L, "ATIVA", true,
                null, null, new DireitosInstancia.Plano("pro", "Profissional"),
                Map.of(), List.of(), agora, splitPercentual).paraLocal(consultoriaId, agora);
        assertThat(local3.splitModo()).isEqualTo("TAXA_PERCENTUAL");

        var splitDesconhecido = new DireitosInstancia.PoliticaSplitDto("OUTRO_MODO", 500, 0L, 0L, 0L, null);
        DireitosLocais local4 = new DireitosInstancia(
                contratacaoId, null, "TREINOS", consultoriaId, 6L, "ATIVA", true,
                null, null, new DireitosInstancia.Plano("pro", "Profissional"),
                Map.of(), List.of(), agora, splitDesconhecido).paraLocal(consultoriaId, agora);
        assertThat(local4.splitModo()).isEqualTo("ISENTO");
    }

    @Test
    void centralClientPostJsonAssinaCorpoRealEEnviaContentTypeJson() throws Exception {
        byte[] segredo = "segredo-saida-32-bytes-para-hmac-teste!!".getBytes(StandardCharsets.UTF_8);
        String segredoB64 = Base64.getEncoder().encodeToString(segredo);

        AtomicReference<String> contentTypeRecebido = new AtomicReference<>();
        AtomicReference<Boolean> assinaturaValida = new AtomicReference<>();
        AtomicReference<String> corpoRecebido = new AtomicReference<>();

        HttpServer servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/", troca -> {
            byte[] corpo = troca.getRequestBody().readAllBytes();
            String caminho = troca.getRequestURI().getRawPath();
            var h = troca.getRequestHeaders();
            String esperada = HmacAssinatura.assinar(segredo, troca.getRequestMethod(), caminho,
                    h.getFirst(IntegracaoFiltro.TIMESTAMP), h.getFirst(IntegracaoFiltro.NONCE), corpo);
            assinaturaValida.set(esperada.equals(h.getFirst(IntegracaoFiltro.ASSINATURA)));
            contentTypeRecebido.set(h.getFirst("Content-Type"));
            corpoRecebido.set(new String(corpo, StandardCharsets.UTF_8));
            byte[] resp = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
            troca.sendResponseHeaders(200, resp.length);
            troca.getResponseBody().write(resp);
            troca.close();
        });
        servidor.start();
        try {
            String url = "http://127.0.0.1:" + servidor.getAddress().getPort();
            var props = new IntegracaoProperties(true, "in:" + segredoB64, "saida-1", segredoB64, url, "TREINOS", 72, false);
            var chaves = new ChavesDeIntegracao(props);
            var client = new CentralClient(props, chaves);

            String jsonCorpo = "{\"valorAbatidoCentavos\":2500}";
            var respJson = client.postJson("/integracao/v1/teste", jsonCorpo.getBytes(StandardCharsets.UTF_8));
            assertThat(respJson.sucesso()).isTrue();
            assertThat(assinaturaValida.get()).isTrue();
            assertThat(contentTypeRecebido.get()).isEqualTo("application/json");
            assertThat(corpoRecebido.get()).isEqualTo(jsonCorpo);

            // post sem corpo continua compatível
            var respVazio = client.post("/integracao/v1/vazio");
            assertThat(respVazio.sucesso()).isTrue();
            assertThat(assinaturaValida.get()).isTrue();
            assertThat(contentTypeRecebido.get()).isNull();
            assertThat(corpoRecebido.get()).isEmpty();
        } finally {
            servidor.stop(0);
        }
    }
}
