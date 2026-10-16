package br.com.treinos.api.conta;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Chave {@code TREINOS_PLANO_APLICAR} desligada (padrão): direitos restritivos gravados, e nada é barrado. */
@AutoConfigureMockMvc
class PlanoDesligadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ContaLocalRepositorio contas;

    @Test
    void comAChaveDesligadaNadaEBarradoMesmoComDireitosRestritivos() throws Exception {
        var api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.path("usuario").path("id").asString());
        contas.gravarDireitos(new DireitosLocais(consultoria, UUID.randomUUID(), 1, "ATIVA", true, null, null, "GRATUITO",
                "Gratuito", Map.of("alunos_ativos", 1L, "membros_equipe", 1L), List.of(), Instant.now()));

        api.criarAluno(admin, "Aluno Fictício A");
        api.criarAluno(admin, "Aluno Fictício B");
        api.post("/receitas", admin, Map.of("tipo", "MOBILIDADE", "nome", "Modelo fictício", "conteudo",
                Map.of("orientacoes", "Todos os dias.", "secoes", List.of(Map.of("titulo", "Alongamentos", "itens",
                        List.of(Map.of("nome", "Gato e vaca", "prescricao", "2 x 20s")))))), 200);
        String perfil = null;
        for (var p : api.get("/perfis", admin, 200)) if (p.path("nome").asString().equals("Assistente")) perfil = p.path("id").asString();
        api.post("/usuarios/convites", admin, Map.of("nome", "Membro Fictício", "email", "a-" + UUID.randomUUID() + "@example.com", "perfilId", perfil), 200);

        assertThat(api.get("/eu", admin, 200).path("funcionalidadesDoPlano").valueStream().map(JsonNode::asString).toList())
                .containsExactly("MOBILIDADE", "PDF", "EQUIPE");
    }
}
