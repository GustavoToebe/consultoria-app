package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A API subindo como na produção ANTES de existir qualquer variável da Kiwify, com o financeiro ligado e a InfinitePay também
 * desligada, sem chaves de cifra: sobe sem exigir nada, as rotas da Kiwify respondem 503 {@code KIWIFY_INDISPONIVEL}, as
 * conferências 503 (nenhum recebimento online ligado), os campos da Kiwify no plano são ignorados e uma credencial da Kiwify
 * parada no banco não derruba a subida (só derruba com a Kiwify ligada). Dados fictícios.
 */
@AutoConfigureMockMvc
class KiwifyDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void semNenhumaVariavel(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.habilitado", () -> "true");
        registry.add("treinos.pagamentos.chaves", () -> "");
        registry.add("treinos.pagamentos.chave-ativa", () -> "");
        registry.add("treinos.pagamentos.infinitepay.habilitado", () -> "false");
        registry.add("treinos.pagamentos.infinitepay.url-publica", () -> "");
        registry.add("treinos.pagamentos.kiwify.habilitado", () -> "false");
        // Como a produção: o conciliador agendado vale, mas com a flag desligada ele sai sem fazer nada.
        registry.add("treinos.pagamentos.kiwify.conciliacao-ativa", () -> "true");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private KiwifyProperties kiwify;
    @Autowired private CifraDePagamento cifra;
    @Autowired private ConciliadorKiwify conciliador;
    @Autowired private VerificacaoDasCredenciais verificacao;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void oContextoSobeSemExigirNadaEOConciliadorSaiSemFazerNada() {
        assertThat(kiwify.habilitado()).isFalse();
        assertThat(kiwify.conciliacaoAtiva()).isTrue();
        assertThat(cifra.configurada()).isFalse();
        assertThatCode(conciliador::conciliarAgora).doesNotThrowAnyException();
    }

    @Test
    void euDizQueAKiwifyNaoEstaLigadaETodasAsRotasDelaRespondem503() throws Exception {
        assertThat(api.get("/eu", admin, 200).get("kiwifyHabilitada").asBoolean()).isFalse();
        String indisponivel = "KIWIFY_INDISPONIVEL";
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("tokenDoWebhook", "token-ficticio-do-webhook-1234");
        corpo.put("clientId", "cliente-ficticio");
        corpo.put("clientSecret", "segredo-ficticio-1234");
        corpo.put("accountId", "conta-ficticia");

        assertThat(api.get("/financeiro/kiwify", admin, 503).get("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.put("/financeiro/kiwify", admin, corpo, 503).get("codigo").asString()).isEqualTo(indisponivel);
        assertThat(api.delete("/financeiro/kiwify", admin, 503).get("codigo").asString()).isEqualTo(indisponivel);
        var aviso = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/kiwify/" + "C".repeat(43))
                .contentType("application/json").content("{}")).andReturn().getResponse();
        assertThat(aviso.getStatus()).isEqualTo(503);
        assertThat(json.readTree(aviso.getContentAsString()).get("codigo").asString()).isEqualTo(indisponivel);
    }

    @Test
    void semNenhumRecebimentoOnlineLigadoAsConferenciasRespondem503() throws Exception {
        assertThat(api.get("/financeiro/conferencias", admin, 503).get("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
    }

    @Test
    void osCamposDaKiwifyNoPlanoSaoIgnoradosEAMensalidadeNaoVemMarcada() throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano " + UUID.randomUUID());
        corpo.put("valorCentavos", 15000L);
        corpo.put("periodicidade", "MENSAL");
        corpo.put("kiwifyAssinatura", true);
        corpo.put("kiwifyProdutoId", "prod-ficticio");

        JsonNode plano = api.post("/financeiro/planos", admin, corpo, 200);

        assertThat(plano.get("kiwifyAssinatura").asBoolean()).isFalse();
        assertThat(plano.path("kiwifyProdutoId").isNull()).isTrue();
        // E o mesmo produto pode ser pedido de novo sem "em uso": nada foi guardado.
        corpo.put("nome", "Plano " + UUID.randomUUID());
        assertThat(api.post("/financeiro/planos", admin, corpo, 200).get("kiwifyAssinatura").asBoolean()).isFalse();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Sem Kiwify " + UUID.randomUUID());
        api.post("/alunos/" + aluno + "/contratacoes", admin, Map.of("planoComercialId", plano.get("id").asString(),
                "inicio", java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA).toString(), "diaVencimento", 5), 200);
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            assertThat(c.path("cobrancaAutomatica").isNull()).isTrue();
        }
    }

    @Test
    void credencialDaKiwifyParadaNoBancoNaoDerrubaASubidaMasLigadaDerruba() {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        UUID credencial = UUID.randomUUID();
        // Id de chave ("teste") que a suíte conhece e este contexto não tem: é o caso que a conferência da subida recusaria.
        jdbc.update("insert into credencial_kiwify(id, consultoria_id, token_webhook_cifrado, client_id_cifrado, "
                + "client_secret_cifrado, account_id_cifrado, token_caminho) values (?::uuid, ?::uuid, "
                + "'v1:teste:AAAAAAAAAAAAAAAA:BBBB', 'v1:teste:AAAAAAAAAAAAAAAA:BBBB', 'v1:teste:AAAAAAAAAAAAAAAA:BBBB', "
                + "'v1:teste:AAAAAAAAAAAAAAAA:BBBB', ?)", credencial.toString(), consultoria.toString(), "K".repeat(43));
        try {
            assertThatCode(() -> verificacao.run(null)).doesNotThrowAnyException();

            var ligada = new KiwifyProperties(true, null, false);
            var semInfinitePay = new InfinitePayProperties(false, null, "https://api.teste.local", false);
            assertThatThrownBy(() -> new VerificacaoDasCredenciais(jdbc, cifra, semInfinitePay, ligada).run(null))
                    .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("teste:");
        } finally {
            jdbc.update("delete from credencial_kiwify where id = ?::uuid", credencial.toString());
        }
    }
}
