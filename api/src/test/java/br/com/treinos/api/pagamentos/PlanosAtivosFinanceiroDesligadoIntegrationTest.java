package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D3 de {@code docs/planos/planos-ativos-do-aluno.md}: com {@code TREINOS_PAGAMENTOS_HABILITADO=false} a ficha traz
 * {@code planosAtivos} nulo, mesmo com contratação ATIVA gravada (nunca "não contratou" por falta de dado).
 */
@AutoConfigureMockMvc
class PlanosAtivosFinanceiroDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarOsPagamentos(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void comOFinanceiroDesligadoAFichaTrazPlanosAtivosNulo() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Financeiro Desligado");
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?::uuid", UUID.class, aluno.toString());
        UUID plano = UUID.randomUUID();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        // Gravado enquanto o módulo estava ligado: com a chave desligada a ficha não o mostra.
        jdbc.update("insert into plano_comercial(id, consultoria_id, nome, valor_centavos, periodicidade, inclui_treino, inclui_dieta) "
                + "values (?::uuid, ?::uuid, ?, 10000, 'MENSAL', true, false)", plano.toString(), consultoria.toString(), "Plano " + plano);
        jdbc.update("insert into contratacao_aluno(id, consultoria_id, aluno_id, plano_comercial_id, periodicidade, valor_centavos, "
                + "inicio, ancora, dia_vencimento, situacao) values (?::uuid, ?::uuid, ?::uuid, ?::uuid, 'MENSAL', 10000, "
                + "?::date, ?::date, 10, 'ATIVA')", UUID.randomUUID().toString(), consultoria.toString(), aluno.toString(),
                plano.toString(), hoje.toString(), hoje.toString());

        JsonNode ficha = api.get("/alunos/" + aluno, admin, 200);

        assertThat(ficha.has("planosAtivos")).isTrue();
        assertThat(ficha.get("planosAtivos").isNull()).isTrue();
    }
}
