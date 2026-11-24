package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.treinos.api.pagamentos.ContratoDeTeste.HOJE;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.corpo;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.entrada;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.parcela;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contrato fechado com a InfinitePay (V098), contra a InfinitePay de mentira (nenhuma chamada real, só dados fictícios): o webhook
 * quita a cobrança do aviso e nenhuma das outras do contrato; valor diferente vai para conferir; o link nunca leva ao provedor o
 * rótulo da cobrança. O conciliador agendado fica desligado e {@code processarPendentes()} é chamado à mão. Cada teste cria a própria
 * consultoria e deixa seus avisos pendentes neutros no fim (a rodada é global).
 */
@AutoConfigureMockMvc
class ContratoFechadoInfinitePayIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();
    private static final String CAMINHO = "/publico/pagamentos/infinitepay/";

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ConciliadorInfinitePay conciliador;

    private ApiDeTeste api;
    private JsonNode admin;
    private ContratoDeTeste contrato;
    private UUID consultoria;
    private String token;

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        contrato = new ContratoDeTeste(api, admin);
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$TREINADOR-DO-CONTRATO"), 200);
        consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        token = jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?", String.class, consultoria);
    }

    @AfterEach
    void deixarNeutro() {
        jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                + "where consultoria_id = ? and situacao = 'PENDENTE'", consultoria);
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    /** Entrada de R$ 100,00 e duas parcelas de R$ 450,00, tudo em aberto. */
    private UUID novoContrato() throws Exception {
        UUID aluno = contrato.aluno();
        contrato.contratar(aluno, corpo(contrato.plano("TRIMESTRAL"), "PARCELADO_FIXO", 100_000L, entrada(10_000, HOJE, false, null),
                List.of(parcela(HOJE.plusDays(10), 45_000), parcela(HOJE.plusMonths(1), 45_000))), 200);
        return aluno;
    }

    private JsonNode daDescricao(UUID aluno, String descricao) throws Exception {
        return contrato.cobrancas(aluno).stream().filter(c -> descricao.equals(c.path("descricao").asString())).findFirst().orElseThrow();
    }

    private void avisar(JsonNode cobranca, String transacao) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("order_nsu", cobranca.get("id").asString());
        corpo.put("transaction_nsu", transacao);
        corpo.put("amount", cobranca.get("valorCentavos").asLong());
        corpo.put("capture_method", "pix");
        var resposta = mvc.perform(MockMvcRequestBuilders.post(CAMINHO + token).contentType("application/json")
                .content(json.writeValueAsString(corpo))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
    }

    @Test
    void oAvisoDeUmaParcelaQuitaSoEssaESeguemAsOutrasEmAberto() throws Exception {
        UUID aluno = novoContrato();
        JsonNode parcela1 = daDescricao(aluno, "Parcela 1/2");
        FALSA.valorDaConsulta(45_000);
        String transacao = "TX-" + UUID.randomUUID();

        avisar(parcela1, transacao);
        conciliador.processarPendentes();

        assertThat(daDescricao(aluno, "Parcela 1/2").get("situacao").asString()).isEqualTo("PAGA");
        assertThat(daDescricao(aluno, "Parcela 1/2").get("provedor").asString()).isEqualTo("INFINITEPAY");
        assertThat(daDescricao(aluno, "Parcela 2/2").get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(daDescricao(aluno, "Entrada").get("situacao").asString()).isEqualTo("ABERTA");
        JsonNode bloco = contrato.contratacao(aluno).get("contrato");
        assertThat(bloco.get("pagoCentavos").asLong()).isEqualTo(45_000);
        assertThat(bloco.get("saldoCentavos").asLong()).isEqualTo(55_000);
        assertThat(bloco.get("cobrancasPagas").asInt()).isEqualTo(1);
        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(jdbc.queryForObject("select situacao from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                String.class, consultoria, transacao)).isEqualTo("APLICADO");
    }

    @Test
    void valorDiferenteDoDaCobrancaVaiParaConferirESeguemTodasAbertas() throws Exception {
        UUID aluno = novoContrato();
        JsonNode entrada = daDescricao(aluno, "Entrada");
        FALSA.valorDaConsulta(9_999);
        String transacao = "TX-" + UUID.randomUUID();

        avisar(entrada, transacao);
        conciliador.processarPendentes();

        Map<String, Object> aviso = jdbc.queryForMap("select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                consultoria, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("VALOR_DIFERENTE");
        assertThat(contrato.cobrancas(aluno)).allMatch(c -> "ABERTA".equals(c.get("situacao").asString()));
        assertThat(contrato.contratacao(aluno).get("contrato").get("pagoCentavos").asLong()).isZero();
    }

    @Test
    void oLinkDaCobrancaDoContratoNuncaLevaORotuloAoProvedor() throws Exception {
        UUID aluno = novoContrato();
        FALSA.descricaoSemTexto("Entrada");
        api.post("/cobrancas/" + daDescricao(aluno, "Entrada").get("id").asString() + "/link", admin, Map.of(), 200);
        FALSA.descricaoSemTexto("Parcela");
        api.post("/cobrancas/" + daDescricao(aluno, "Parcela 1/2").get("id").asString() + "/link", admin, Map.of(), 200);

        var enviadas = FALSA.requisicoes("/links");
        assertThat(enviadas).hasSize(2);
        // Entrada e parcela: o mesmo texto fixo do servidor, nunca "Renegociação" nem o rótulo da cobrança.
        String mes = java.time.format.DateTimeFormatter.ofPattern("MM/yyyy").format(HOJE);
        assertThat(enviadas.get(0).corpo().get("items").get(0).get("description").asString()).isEqualTo("Contrato (" + mes + ")");
        String doMesDaParcela = java.time.format.DateTimeFormatter.ofPattern("MM/yyyy").format(HOJE.plusDays(10));
        assertThat(enviadas.get(1).corpo().get("items").get(0).get("description").asString())
                .isEqualTo("Contrato (" + doMesDaParcela + ")");
    }

    @Test
    void pagamentoDeParcelaCanceladaPeloEncerrarVaiParaConferirComContratoESaldoIntactos() throws Exception {
        UUID aluno = novoContrato();
        JsonNode contratacao = contrato.contratacao(aluno);
        JsonNode previa = api.get("/contratacoes/" + contratacao.get("id").asString() + "/previa-de-encerramento", admin, 200);
        List<String> futuras = new java.util.ArrayList<>();
        previa.get("aCancelar").forEach(c -> futuras.add(c.get("cobrancaId").asString()));
        JsonNode parcela1 = daDescricao(aluno, "Parcela 1/2");
        api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin, Map.of("versao", contratacao.get("versao").asLong(),
                "saida", Map.of("opcao", "NAO_COBRAR", "cobrancasACancelar", futuras)), 200);
        assertThat(daDescricao(aluno, "Parcela 1/2").get("situacao").asString()).isEqualTo("CANCELADA");
        FALSA.valorDaConsulta(45_000);
        String transacao = "TX-" + UUID.randomUUID();

        avisar(parcela1, transacao);
        conciliador.processarPendentes();

        Map<String, Object> aviso = jdbc.queryForMap("select situacao, motivo from aviso_de_pagamento where consultoria_id = ? and transacao = ?",
                consultoria, transacao);
        assertThat(aviso.get("situacao")).isEqualTo("CONFERIR");
        assertThat(aviso.get("motivo")).isEqualTo("COBRANCA_CANCELADA");
        assertThat(daDescricao(aluno, "Parcela 1/2").get("situacao").asString()).isEqualTo("CANCELADA");
        JsonNode bloco = contrato.contratacao(aluno).get("contrato");
        assertThat(bloco.get("pagoCentavos").asLong()).isZero();
        assertThat(bloco.get("saldoCentavos").asLong()).isEqualTo(100_000);
        assertThat(contrato.contratacao(aluno).get("situacao").asString()).isEqualTo("ENCERRADA");
    }
}
