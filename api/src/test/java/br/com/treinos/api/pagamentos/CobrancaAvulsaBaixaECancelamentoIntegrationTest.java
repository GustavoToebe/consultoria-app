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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Baixa, desfazer, cancelar (também em lote) e link de uma cobrança AVULSA, que não tem contratação. Depende de {@code Travas} e
 * {@code BaixaDeCobranca} aceitarem cobrança sem contratação (item A da frente "Financeiro fase 1"): antes desse merge este teste
 * falha, de propósito, com a contratação nula; a integração depois do merge o confirma. Dados fictícios; nenhuma chamada real.
 */
@AutoConfigureMockMvc
class CobrancaAvulsaBaixaECancelamentoIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
        registry.add("treinos.app-url", () -> "https://app.teste.local");
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @AfterEach
    void conferirAFalsa() {
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    /** Aluno novo com uma avulsa; devolve a cobrança. */
    private JsonNode avulsa(String descricao, long valor) throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Avulsa " + UUID.randomUUID());
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(aluno.toString()), "descricao", descricao,
                "valorCentavos", valor, "primeiroVencimento", hoje.plusDays(5).toString(), "parcelas", 1), 201);
        return api.get("/alunos/" + aluno + "/cobrancas", admin, 200).get(0);
    }

    private JsonNode atual(JsonNode c) throws Exception {
        return api.get("/alunos/" + c.get("alunoId").asString() + "/cobrancas", admin, 200).get(0);
    }

    private int total(JsonNode c) throws Exception {
        return api.get("/alunos/" + c.get("alunoId").asString() + "/cobrancas", admin, 200).size();
    }

    @Test
    void baixaManualDesfazerEBaixaEmLoteDeAvulsaNaoGeramCobrancaSeguinte() throws Exception {
        JsonNode c = avulsa("Camiseta", 5_000);
        String id = c.get("id").asString();

        JsonNode paga = api.post("/cobrancas/" + id + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", c.get("versao").asLong()), 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(paga.get("tipo").asString()).isEqualTo("AVULSA");
        assertThat(total(c)).isEqualTo(1);

        JsonNode reaberta = api.post("/cobrancas/" + id + "/desfazer-baixa", admin,
                Map.of("motivo", "Engano", "versao", paga.get("versao").asLong()), 200);
        assertThat(reaberta.get("situacao").asString()).isEqualTo("ABERTA");

        JsonNode lote = api.post("/cobrancas/baixa-em-lote", admin, Map.of("itens",
                List.of(Map.of("cobrancaId", id, "versao", reaberta.get("versao").asLong())), "data", hoje.toString(),
                "forma", "DINHEIRO"), 200);
        assertThat(lote.get("resultados").get(0).get("ok").asBoolean()).isTrue();
        assertThat(atual(c).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(total(c)).isEqualTo(1);
    }

    @Test
    void cancelarIndividualEEmLoteDeAvulsaNaoGeraSeguinte() throws Exception {
        JsonNode a = avulsa("Camiseta A", 5_000);
        JsonNode b = avulsa("Camiseta B", 6_000);

        JsonNode cancelada = api.post("/cobrancas/" + a.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Desistiu", "versao", a.get("versao").asLong()), 200);
        assertThat(cancelada.get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(total(a)).isEqualTo(1);

        JsonNode lote = api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens",
                List.of(Map.of("cobrancaId", b.get("id").asString(), "versao", b.get("versao").asLong()))), 200);
        assertThat(lote.get("resultados").get(0).get("ok").asBoolean()).isTrue();
        assertThat(atual(b).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(total(b)).isEqualTo(1);
    }

    @Test
    void linkDeAvulsaUsaOValorDoServidorENuncaMandaADescricaoDoTreinadorAoProvedor() throws Exception {
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$TREINADOR-FAKE"), 200);
        JsonNode c = avulsa("Camiseta oficial do time (nome Fulano, joelho)", 8_990);
        String id = c.get("id").asString();
        FALSA.esperaPreco(8_990).esperaPedido(UUID.fromString(id));

        String url = api.post("/cobrancas/" + id + "/link", admin, Map.of(), 200).get("url").asString();

        assertThat(url).startsWith("https://checkout.falsa.test/pagar/");
        assertThat(FALSA.requisicoes()).hasSize(1);
        JsonNode corpo = FALSA.requisicoes().get(0).corpo();
        // Texto fixo com o mês do vencimento: o texto livre do treinador (nome, dado de saúde) nunca sai da API.
        assertThat(corpo.get("items").get(0).get("description").asString())
                .isEqualTo("Cobrança avulsa (" + c.get("vencimento").asString().substring(5, 7) + "/"
                        + c.get("vencimento").asString().substring(0, 4) + ")");
        assertThat(corpo.toString()).doesNotContain("Camiseta").doesNotContain("Fulano").doesNotContain("joelho");
        JsonNode lote = api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", List.of(id)), 200);
        assertThat(lote.get("resultados").get(0).get("url").asString()).isEqualTo(url);
    }
}
