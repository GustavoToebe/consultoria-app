package br.com.treinos.api.contratos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Com {@code TREINOS_CONTRATOS_HABILITADO=false} nada trava, nem com contrato pendente vencido no banco (a trava nem consulta), e o
 * {@code GET /eu} diz {@code contratoPendenteVencido=false}. O prazo da consultoria também dá 503. Contexto próprio por causa da chave.
 */
@AutoConfigureMockMvc
class ContratoTravaDesligadaIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligar(DynamicPropertyRegistry registro) {
        registro.add("treinos.contratos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void comAChaveDesligadaNadaTravaMesmoComContratoVencidoNoBanco() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        api.publicarTreino(admin, aluno, ApiDeTeste.treino().conteudo());
        JsonNode login = api.convidarEEntrar(admin, aluno);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        // Com o módulo desligado a API não gera contrato: a linha vai direto ao banco (pendente, prazo vencido há dois dias).
        jdbc.update("insert into contrato_aluno (id, consultoria_id, aluno_id, origem, titulo, texto, sha256, signatario, situacao, prazo_ate,"
                        + " pedido_id) values (?, ?, ?, 'MODELO', 'Contrato fictício', 'Texto fictício.', ?, 'ALUNO', 'PENDENTE',"
                        + " now() - interval '2 days', ?)",
                UUID.randomUUID(), consultoria, aluno, "a".repeat(64), UUID.randomUUID());

        api.get("/aluno/painel", login, 200);
        api.get("/aluno/dieta", login, 200);
        assertThat(api.get("/eu", login, 200).get("aluno").get("contratoPendenteVencido").asBoolean()).isFalse();

        // As rotas do contrato seguem em 503, como sempre; e o prazo da consultoria também.
        assertThat(api.get("/aluno/contratos", login, 503).get("codigo").asString()).isEqualTo("CONTRATOS_INDISPONIVEL");
        assertThat(api.get("/consultoria/contratos", admin, 503).get("codigo").asString()).isEqualTo("CONTRATOS_INDISPONIVEL");
        assertThat(api.put("/consultoria/contratos", admin, Map.of("prazoDias", 5), 503).get("codigo").asString())
                .isEqualTo("CONTRATOS_INDISPONIVEL");
    }
}
