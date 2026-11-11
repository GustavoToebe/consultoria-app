package br.com.treinos.api.painel;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Atividade recente do Início com "Meus alunos": o teto de 300 séries vale <b>dentro do escopo</b>. Antes, as 300 mais
 * recentes da consultoria inteira eram lidas e só depois se descartavam as de fora, então um treinador com poucos
 * registros ficava com a lista vazia enquanto o colega tinha mais de 300 séries recentes. Dados fictícios.
 */
@AutoConfigureMockMvc
class PainelAtividadeRecenteIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @Test
    void tetoDeTrezentasSeriesValeSoDentroDoEscopoDeMeusAlunos() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        JsonNode primeiro = membro(api, admin);
        JsonNode segundo = membro(api, admin);

        UUID alunoDoPrimeiro = aluno(api, admin, "Aluno do primeiro responsável", primeiro);
        UUID alunoDoSegundo = aluno(api, admin, "Aluno do segundo responsável", segundo);

        // O primeiro registra pouco e antes; o segundo registra depois mais de 300 séries (3 por dia, 116 dias).
        List<LocalDate> poucos = List.of(hoje.minusDays(1));
        List<LocalDate> muitos = new ArrayList<>();
        for (int i = -60; i <= 55; i++) {
            muitos.add(hoje.plusDays(i));
        }
        registrar(api, admin, alunoDoPrimeiro, poucos);
        registrar(api, admin, alunoDoSegundo, muitos);

        JsonNode doPrimeiro = api.get("/painel?meus=true", primeiro, 200).path("ultimasExecucoes");
        assertThat(doPrimeiro).hasSize(1);
        assertThat(doPrimeiro.get(0).path("aluno").path("id").asString()).isEqualTo(alunoDoPrimeiro.toString());
        assertThat(doPrimeiro.get(0).path("series").asInt()).isEqualTo(3);

        JsonNode doSegundo = api.get("/painel?meus=true", segundo, 200).path("ultimasExecucoes");
        assertThat(doSegundo).hasSize(10);
        doSegundo.forEach(e -> assertThat(e.path("aluno").path("id").asString()).isEqualTo(alunoDoSegundo.toString()));

        // Sem "Meus alunos" nada muda: o escopo é a consultoria, onde o do segundo continua mais recente.
        JsonNode todos = api.get("/painel?meus=false", admin, 200).path("ultimasExecucoes");
        assertThat(todos).hasSize(10);
        todos.forEach(e -> assertThat(e.path("aluno").path("id").asString()).isEqualTo(alunoDoSegundo.toString()));
    }

    private JsonNode membro(ApiDeTeste api, JsonNode admin) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", Set.of("PAINEL_VER", "ALUNO_LER", "REGISTRO_LER")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static UUID aluno(ApiDeTeste api, JsonNode admin, String nome, JsonNode responsavel) throws Exception {
        return UUID.fromString(api.post("/alunos", admin, Map.of("nome", nome, "responsavelId", idDe(responsavel)), 200)
                .path("id").asString());
    }

    private static String idDe(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Publica um treino e registra as três séries do plano em cada dia dado, em lotes (o lote aceita até 300). */
    private void registrar(ApiDeTeste api, JsonNode admin, UUID aluno, List<LocalDate> dias) throws Exception {
        ApiDeTeste.TreinoDeTeste treino = ApiDeTeste.treino();
        api.publicarTreino(admin, aluno, treino.conteudo());
        JsonNode login = api.convidarEEntrar(admin, aluno);
        String versaoId = api.get("/aluno/painel", login, 200).path("treino").path("versaoId").asString();
        List<Map<String, Object>> registros = new ArrayList<>();
        for (LocalDate dia : dias) {
            for (UUID serie : List.of(treino.fsUid(), treino.wsUid(), treino.backOffUid())) {
                Map<String, Object> r = new LinkedHashMap<>();
                r.put("id", UUID.randomUUID().toString());
                r.put("planoVersaoId", versaoId);
                r.put("sessaoUid", treino.sessaoUid().toString());
                r.put("exercicioUid", treino.exercicioUid().toString());
                r.put("serieUid", serie.toString());
                r.put("data", dia.toString());
                r.put("carga", "50");
                r.put("repeticoes", 8);
                r.put("concluida", true);
                r.put("alteradoNoAparelhoEm", Instant.now().toString());
                registros.add(r);
            }
        }
        for (int i = 0; i < registros.size(); i += 150) {
            JsonNode resposta = api.post("/aluno/execucoes/lote", login,
                    Map.of("registros", registros.subList(i, Math.min(registros.size(), i + 150))), 200);
            resposta.path("resultados").forEach(x -> assertThat(x.path("situacao").asString()).isEqualTo("ACEITO"));
        }
    }
}
