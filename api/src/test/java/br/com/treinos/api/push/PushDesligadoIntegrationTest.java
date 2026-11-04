package br.com.treinos.api.push;

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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção: o push fica no código, desligado ({@code TREINOS_PUSH_HABILITADO=false}). Registrar o token dá 503
 * {@code PUSH_INDISPONIVEL} (apagar continua valendo, para o "Sair"), {@code GET /eu} diz ao app para não pedir permissão, mudar compromisso não enfileira nada (mesmo
 * com um token já gravado) e o job não faz nada nem fala com o Expo. A suíte liga a chave; só esta classe a desliga.
 */
@AutoConfigureMockMvc
class PushDesligadoIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarOPush(DynamicPropertyRegistry registry) {
        registry.add("treinos.push.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PushDoExpo job;

    @Test
    void registrarDa503ApagarNaoEOJobNaoFazNada() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Push Desligado");
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        String usuarioId = login.path("usuario").path("id").asString();
        String token = "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]";

        assertThat(api.put("/aluno/push-token", login, Map.of("token", token, "plataforma", "ANDROID"), 503).path("codigo").asString())
                .isEqualTo("PUSH_INDISPONIVEL");
        assertThat(api.get("/eu", login, 200).get("pushHabilitado").asBoolean()).isFalse();
        assertThat(api.get("/eu", treinador, 200).get("pushHabilitado").asBoolean()).isFalse();

        // Mesmo com um token já gravado (de quando a chave esteve ligada), mudar compromisso não enfileira.
        jdbc.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) "
                + "select ?, consultoria_id, id, ?, 'ANDROID' from usuario where id = ?::uuid", UUID.randomUUID(), token, usuarioId);
        api.post("/agenda/compromissos", treinador, Map.of("alunoIds", List.of(aluno),
                "responsavelId", treinador.path("usuario").path("id").asString(),
                "data", LocalDate.now(Fuso.BRASILIA).plusDays(2).toString(), "hora", "10:00", "duracaoMinutos", 30), 200);
        assertThat(jdbc.queryForObject("select count(*) from push_envio where usuario_id = ?::uuid", Integer.class, usuarioId)).isZero();
        assertThat(job.rodar().executou()).isFalse();

        // Apagar não depende da chave: o "Sair" tira o token que ficou de quando ela estava ligada (com e sem corpo), só do
        // próprio usuário e só para aluno.
        api.delete("/aluno/push-token", treinador, 403);
        api.delete("/aluno/push-token", login, Map.of("token", token), 204);
        assertThat(tokensDe(usuarioId)).isZero();
        jdbc.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) "
                + "select ?, consultoria_id, id, ?, 'IOS' from usuario where id = ?::uuid", UUID.randomUUID(), token, usuarioId);
        api.delete("/aluno/push-token", login, 204);
        assertThat(tokensDe(usuarioId)).isZero();
    }

    private int tokensDe(String usuarioId) {
        return jdbc.queryForObject("select count(*) from push_token where usuario_id = ?::uuid", Integer.class, usuarioId);
    }
}
