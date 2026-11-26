package br.com.treinos.api.push;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
 * Push de "plano liberado" (V105, tipo {@code PLANO_LIBERADO} da fila): sai com o texto fixo do tipo, sem nome nem dado do plano,
 * convive na fila com o aviso de compromisso do mesmo usuário e não duplica o PENDENTE. Expo de mentira; só o que o teste criou.
 */
@AutoConfigureMockMvc
class PushPlanoLiberadoIntegrationTest extends AbstractIntegrationTest {

    private static final ExpoFalso EXPO = new ExpoFalso();
    private static final String SENTINELA_NOME = "Aluno Sentinela Pl4";
    private static final String CORPO = "Seu novo plano está disponível. Abra o app para ver.";

    @DynamicPropertySource
    static void expoDeMentira(DynamicPropertyRegistry registry) {
        registry.add("treinos.push.expo-url", EXPO::url);
        registry.add("treinos.push.timeout-segundos", () -> "1");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PushDoExpo job;

    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode login;
    private UUID usuarioId;
    private UUID consultoriaId;
    private String token;

    @BeforeEach
    void preparar() throws Exception {
        EXPO.zerar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        UUID aluno = api.criarAluno(admin, SENTINELA_NOME);
        login = api.convidarEEntrar(admin, aluno);
        usuarioId = UUID.fromString(login.path("usuario").path("id").asString());
        consultoriaId = jdbc.queryForObject("select consultoria_id from usuario where id = ?", UUID.class, usuarioId);
        token = "ExponentPushToken[" + UUID.randomUUID().toString().replace("-", "") + "]";
        api.put("/aluno/push-token", login, Map.of("token", token, "plataforma", "ANDROID"), 204);
    }

    @AfterEach
    void limpar() {
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'TESTE' where situacao = 'PENDENTE' and consultoria_id = ?",
                consultoriaId);
    }

    private int pendentes(String tipo) {
        return jdbc.queryForObject("select count(*) from push_envio where usuario_id = ? and tipo = ? and situacao = 'PENDENTE'",
                Integer.class, usuarioId, tipo);
    }

    private void publicarTreinoDoAluno() throws Exception {
        UUID aluno = jdbc.queryForObject("select id from aluno where usuario_id = ?", UUID.class, usuarioId);
        api.publicarTreino(admin, aluno, ApiDeTeste.treino().conteudo());
    }

    @Test
    void planoLiberadoSaiComOTextoFixoDoTipoSemDadoPessoal() throws Exception {
        publicarTreinoDoAluno();
        assertThat(pendentes("PLANO_LIBERADO")).isEqualTo(1);

        job.rodar();

        var minhas = EXPO.chamadas().stream().filter(c -> c.corpo().contains(token)).toList();
        assertThat(minhas).hasSize(1);
        JsonNode mensagem = json.readTree(minhas.get(0).corpo()).get(0);
        assertThat(mensagem.path("body").asString()).isEqualTo(CORPO);
        assertThat(mensagem.path("title").asString()).isEqualTo("Plano liberado");
        assertThat(mensagem.path("data").path("tipo").asString()).isEqualTo("plano");
        assertThat(minhas.get(0).corpo()).doesNotContain(SENTINELA_NOME);
        assertThat(pendentes("PLANO_LIBERADO")).isZero();
        assertThat(jdbc.queryForObject("select count(*) from push_envio where usuario_id = ? and tipo = 'PLANO_LIBERADO' "
                + "and situacao = 'ENVIADO'", Integer.class, usuarioId)).isEqualTo(1);
    }

    @Test
    void naoDuplicaOPendenteEConviveComOAvisoDeCompromisso() throws Exception {
        publicarTreinoDoAluno();
        publicarTreinoDoAluno();
        assertThat(pendentes("PLANO_LIBERADO")).isEqualTo(1);

        // O índice é por usuário E tipo: um PENDENTE de compromisso não é barrado pelo de plano.
        jdbc.update("insert into push_envio (id, consultoria_id, usuario_id, tipo) values (?, ?, ?, 'COMPROMISSO')",
                UUID.randomUUID(), consultoriaId, usuarioId);
        assertThat(pendentes("COMPROMISSO")).isEqualTo(1);
        assertThat(pendentes("PLANO_LIBERADO")).isEqualTo(1);
    }
}
