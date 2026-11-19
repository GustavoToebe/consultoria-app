package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
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

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O pagamento que chega pelo link de uma cobrança que depois foi renegociada (D14): o aluno já tinha o link da original, pagou, e a
 * InfinitePay avisa. A original está RENEGOCIADA e não vale mais: o aviso vai para a conferência (nunca baixa, nunca fica preso) e a
 * original continua como está. O conciliador agendado fica desligado no teste ({@code processarPendentes()} é chamado à mão). Dados
 * fictícios; nenhuma chamada real.
 */
@AutoConfigureMockMvc
class RenegociacaoComPagamentoOnlineIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();
    private static final long VALOR = 15_000L;

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
        registry.add("treinos.app-url", () -> "https://app.teste.local");
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ConciliadorInfinitePay conciliador;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private UUID consultoria;

    @BeforeEach
    void preparar() {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
    }

    @AfterEach
    void conferirEDeixarNeutro() {
        // A rodada é global: o que este teste deixou pendente não pode ser consultado pelos outros.
        if (consultoria != null) {
            jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                    + "where consultoria_id = ? and situacao = 'PENDENTE'", consultoria);
        }
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    @Test
    void pagamentoPeloLinkDaOriginalRenegociadaVaiParaConferirSemBaixaENadaFicaPreso() throws Exception {
        JsonNode login = api.novoTreinador();
        api.put("/financeiro/recebimento-online", login, Map.of("infiniteTag", "$TREINADOR-FAKE"), 200);
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
        String token = jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?", String.class, consultoria);
        UUID aluno = api.criarAluno(login, "Aluno Link Renegociado " + UUID.randomUUID());
        api.post("/financeiro/cobrancas-avulsas", login, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(aluno.toString()),
                "descricao", "Avulsa com link", "valorCentavos", VALOR, "primeiroVencimento", hoje.plusDays(5).toString(), "parcelas", 1), 201);
        JsonNode original = api.get("/alunos/" + aluno + "/cobrancas", login, 200).get(0);
        String id = original.get("id").asString();
        // O aluno já tem o link da original...
        api.post("/cobrancas/" + id + "/link", login, Map.of(), 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("itens", List.of(Map.of("cobrancaId", id, "versao", original.get("versao").asLong())));
        corpo.put("acrescimoCentavos", 0);
        corpo.put("descontoCentavos", 0);
        corpo.put("parcelas", 2);
        corpo.put("primeiroVencimento", hoje.plusDays(20).toString());
        corpo.put("pedidoId", UUID.randomUUID().toString());
        corpo.put("motivo", "Combinado com o aluno");
        // ...e a renegociação sai depois.
        api.post("/cobrancas/renegociar", login, corpo, 201);

        String transacao = "TX-" + UUID.randomUUID();
        String aviso = "{\"order_nsu\":\"" + id + "\",\"transaction_nsu\":\"" + transacao + "\",\"invoice_slug\":\"slug-abc\","
                + "\"amount\":15000,\"paid_amount\":15000,\"capture_method\":\"pix\"}";
        var resposta = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/infinitepay/" + token)
                .contentType("application/json").content(aviso)).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);

        conciliador.processarPendentes();

        Map<String, Object> linha = jdbc.queryForMap("select situacao, motivo, cobranca_id::text as cobranca from aviso_de_pagamento "
                + "where consultoria_id = ? and transacao = ?", consultoria, transacao);
        assertThat(linha.get("situacao")).as("não fica preso nem vira baixa").isEqualTo("CONFERIR");
        assertThat(linha.get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        assertThat(linha.get("cobranca")).isEqualTo(id);
        Map<String, Object> cobranca = jdbc.queryForMap("select situacao, forma, id_externo from cobranca_aluno where id = ?::uuid", id);
        assertThat(cobranca.get("situacao")).isEqualTo("RENEGOCIADA");
        assertThat(cobranca.get("forma")).isNull();
        assertThat(cobranca.get("id_externo")).isNull();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where consultoria_id = ? and situacao = 'PAGA'", Integer.class,
                consultoria)).isZero();
    }
}
