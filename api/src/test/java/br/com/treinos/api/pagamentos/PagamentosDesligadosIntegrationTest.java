package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
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
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção: pagamentos desligados. As rotas do financeiro respondem 503, mas a privacidade do aluno
 * (exportar e anonimizar) e a saída do aluno seguem funcionando sobre o que já estiver gravado.
 */
@AutoConfigureMockMvc
class PagamentosDesligadosIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarOsPagamentos(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    @Test
    void asRotasDoFinanceiroRespondem503EEuDizQueEstaDesligado() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Sem Pagamentos");
        for (String rota : new String[] {"/financeiro/planos", "/financeiro/cobrancas", "/financeiro/numeros",
                "/financeiro/painel", "/financeiro/inadimplentes", "/financeiro/lancamentos",
                "/financeiro/exportacao?de=" + hoje + "&ate=" + hoje, "/alunos/" + aluno + "/contratacoes",
                "/alunos/" + aluno + "/cobrancas"}) {
            assertThat(api.get(rota, admin, 503).path("codigo").asString()).as(rota).isEqualTo("FINANCEIRO_INDISPONIVEL");
        }
        api.post("/financeiro/planos", admin, Map.of("nome", "Plano", "valorCentavos", 100, "periodicidade", "MENSAL"), 503);
        api.post("/financeiro/lancamentos", admin,
                Map.of("data", hoje.toString(), "descricao", "x", "valorCentavos", 1, "tipo", "ENTRADA"), 503);
        api.post("/cobrancas/" + UUID.randomUUID() + "/cancelar", admin, Map.of("motivo", "x", "versao", 0), 503);

        JsonNode login = api.convidarEEntrar(admin, aluno);
        assertThat(api.get("/aluno/financeiro", login, 503).path("codigo").asString()).isEqualTo("FINANCEIRO_INDISPONIVEL");
        assertThat(api.get("/eu", admin, 200).get("pagamentosHabilitados").asBoolean()).isFalse();
        assertThat(api.get("/eu", login, 200).get("pagamentosHabilitados").asBoolean()).isFalse();
        // Com os pagamentos desligados o recebimento online também some, mesmo com a InfinitePay ligada: vale o 503 do financeiro.
        assertThat(api.get("/eu", admin, 200).get("recebimentoOnlineHabilitado").asBoolean()).isFalse();
        assertThat(api.get("/financeiro/recebimento-online", admin, 503).path("codigo").asString()).isEqualTo("FINANCEIRO_INDISPONIVEL");
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "treinador-fake"), 503);
        api.delete("/financeiro/recebimento-online", admin, 503);
        // A caixa de entrada dos avisos da InfinitePay e a conferência também ficam atrás do financeiro.
        assertThat(api.get("/financeiro/conferencias", admin, 503).path("codigo").asString()).isEqualTo("FINANCEIRO_INDISPONIVEL");
        assertThat(api.post("/financeiro/conferencias/" + UUID.randomUUID() + "/conferido", admin, Map.of(), 503)
                .path("codigo").asString()).isEqualTo("FINANCEIRO_INDISPONIVEL");
        var aviso = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/infinitepay/" + "A".repeat(43))
                .contentType("application/json").content("{}")).andReturn().getResponse();
        assertThat(aviso.getStatus()).isEqualTo(503);
        assertThat(json.readTree(aviso.getContentAsString()).path("codigo").asString()).isEqualTo("FINANCEIRO_INDISPONIVEL");
    }

    @Test
    void exportarEAnonimizarFuncionamComOModuloDesligado() throws Exception {
        String nome = "Carla Fictícia Desligada";
        UUID aluno = api.criarAluno(admin, nome);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?::uuid", UUID.class, aluno.toString());
        UUID plano = UUID.randomUUID();
        UUID contratacao = UUID.randomUUID();
        // Dado gravado enquanto o módulo estava ligado: o desligado não pode deixá-lo para trás.
        jdbc.update("insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade) values (?::uuid, ?::uuid, ?, 10000, 'MENSAL')",
                plano.toString(), consultoria.toString(), "Plano gravado " + plano);
        jdbc.update("insert into contratacao_aluno(id, consultoria_id, aluno_id, plano_comercial_id, periodicidade, valor_centavos, "
                + "motivo_valor, inicio, ancora, dia_vencimento, situacao) values (?::uuid, ?::uuid, ?::uuid, ?::uuid, 'MENSAL', 10000, "
                + "'Motivo fictício', ?::date, ?::date, 10, 'ATIVA')", contratacao.toString(), consultoria.toString(),
                aluno.toString(), plano.toString(), hoje.toString(), hoje.toString());
        jdbc.update("insert into cobranca_aluno(id, consultoria_id, contratacao_id, aluno_id, competencia, valor_centavos, vencimento, "
                + "situacao, observacao) values (?::uuid, ?::uuid, ?::uuid, ?::uuid, ?::date, 10000, ?::date, 'ABERTA', 'Observação fictícia')",
                UUID.randomUUID().toString(), consultoria.toString(), contratacao.toString(), aluno.toString(), hoje.toString(),
                hoje.toString());

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(dados.get("financeiro").get("contratacoes")).hasSize(1);
        assertThat(dados.get("financeiro").get("cobrancas")).hasSize(1);
        assertThat(dados.get("financeiro").get("cobrancas").get(0).get("observacao").asString()).isEqualTo("Observação fictícia");

        // Inativar encerra a contratação e cancela a cobrança aberta, mesmo com o módulo desligado.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(jdbc.queryForObject("select situacao from contratacao_aluno where id = ?::uuid", String.class, contratacao.toString()))
                .isEqualTo("ENCERRADA");
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where contratacao_id = ?::uuid", String.class,
                contratacao.toString())).isEqualTo("CANCELADA");

        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(jdbc.queryForObject("select motivo_valor from contratacao_aluno where id = ?::uuid", String.class, contratacao.toString()))
                .isNull();
        assertThat(jdbc.queryForObject("select observacao from cobranca_aluno where contratacao_id = ?::uuid", String.class,
                contratacao.toString())).isNull();
        assertThat(jdbc.queryForObject("select valor_centavos from cobranca_aluno where contratacao_id = ?::uuid", Long.class,
                contratacao.toString())).isEqualTo(10000L);
    }
}
