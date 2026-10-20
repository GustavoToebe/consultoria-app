package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Ações em lote da lista de alunos: tudo ou nada, só da consultoria, com uma auditoria por aluno. Dados fictícios. */
@AutoConfigureMockMvc
class AlunoLoteIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode admin;
    private JsonNode membro;
    private UUID a1;
    private UUID a2;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        String perfil = api.post("/perfis", admin, Map.of("nome", "Treinador do lote",
                "permissoes", Set.of("ALUNO_LER", "ALUNO_ALTERAR")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro do lote",
                "email", ApiDeTeste.emailUnico("lote"), "perfilId", perfil), 200);
        membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        a1 = api.criarAluno(admin, "Aluno um do lote");
        a2 = api.criarAluno(admin, "Aluno dois do lote");
    }

    private String idDoMembro() {
        return membro.path("usuario").path("id").asString();
    }

    private int auditorias(String acao, UUID aluno) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid",
                Integer.class, acao, aluno.toString());
    }

    private JsonNode detalhe(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno, admin, 200);
    }

    @Test
    void trocarResponsavelAlteraTodosEAuditaCadaUm() throws Exception {
        JsonNode r = api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(a1, a2), "responsavelId", idDoMembro()), 200);
        assertThat(r.path("selecionados").asInt()).isEqualTo(2);
        assertThat(r.path("alterados").asInt()).isEqualTo(2);
        assertThat(detalhe(a1).path("responsavelId").asString()).isEqualTo(idDoMembro());
        assertThat(detalhe(a2).path("responsavelId").asString()).isEqualTo(idDoMembro());
        assertThat(auditorias("ALUNO_RESPONSAVEL_ALTERADO", a1)).isEqualTo(1);
        assertThat(auditorias("ALUNO_RESPONSAVEL_ALTERADO", a2)).isEqualTo(1);

        // Repetir não muda nada e não audita de novo; id repetido na lista conta uma vez.
        JsonNode de_novo = api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(a1, a1, a2), "responsavelId", idDoMembro()), 200);
        assertThat(de_novo.path("selecionados").asInt()).isEqualTo(2);
        assertThat(de_novo.path("alterados").asInt()).isZero();
        assertThat(auditorias("ALUNO_RESPONSAVEL_ALTERADO", a1)).isEqualTo(1);
    }

    @Test
    void responsavelInvalidoOuAlunoDeOutraConsultoriaNaoMudaNada() throws Exception {
        JsonNode original = detalhe(a1);
        api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(a1, a2), "responsavelId", UUID.randomUUID()), 404);

        JsonNode outro = api.novoTreinador();
        UUID estranho = api.criarAluno(outro, "Aluno de outra consultoria");
        api.post("/alunos/lote/responsavel", admin,
                Map.of("alunoIds", List.of(a1, estranho), "responsavelId", idDoMembro()), 404);
        api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(a1, estranho)), 404);

        assertThat(detalhe(a1).path("responsavelId").asString()).isEqualTo(original.path("responsavelId").asString());
        assertThat(detalhe(a1).path("ativo").asBoolean()).isTrue();
        assertThat(api.get("/alunos/" + estranho, outro, 200).path("ativo").asBoolean()).isTrue();
        assertThat(auditorias("ALUNO_RESPONSAVEL_ALTERADO", a1)).isZero();
    }

    @Test
    void trocarQuestionarioEVoltarAoPadrao() throws Exception {
        JsonNode q = api.post("/questionarios", admin, Map.of("nome", "Questionário do lote", "origem", "FABRICA"), 200);
        api.post("/questionarios/" + q.path("id").asString() + "/publicar", admin,
                Map.of("versao", q.path("versao").asLong(), "confirmarAvisos", false), 200);

        JsonNode r = api.post("/alunos/lote/questionario", admin,
                Map.of("alunoIds", List.of(a1, a2), "questionarioId", q.path("id").asString()), 200);
        assertThat(r.path("alterados").asInt()).isEqualTo(2);
        assertThat(detalhe(a2).path("questionarioId").asString()).isEqualTo(q.path("id").asString());
        assertThat(auditorias("ALUNO_QUESTIONARIO_ALTERADO", a1)).isEqualTo(1);

        Map<String, Object> padrao = new java.util.HashMap<>();
        padrao.put("alunoIds", List.of(a1, a2));
        padrao.put("questionarioId", null);
        assertThat(api.post("/alunos/lote/questionario", admin, padrao, 200).path("alterados").asInt()).isEqualTo(2);
        assertThat(detalhe(a1).path("questionarioId").isNull()).isTrue();

        // Questionário rascunho (não publicado) é recusado e nada muda.
        JsonNode rascunho = api.post("/questionarios", admin, Map.of("nome", "Rascunho do lote", "origem", "FABRICA"), 200);
        api.post("/alunos/lote/questionario", admin,
                Map.of("alunoIds", List.of(a1), "questionarioId", rascunho.path("id").asString()), 409);
        assertThat(detalhe(a1).path("questionarioId").isNull()).isTrue();
    }

    @Test
    void desativarEncerraAcessoEPulaQuemJaEstaInativo() throws Exception {
        JsonNode login = api.convidarEEntrar(admin, a1);
        api.get("/aluno/painel", login, 200);
        api.patch("/alunos/" + a2 + "/situacao", admin, Map.of("ativo", false), 200);

        JsonNode r = api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(a1, a2)), 200);
        assertThat(r.path("selecionados").asInt()).isEqualTo(2);
        assertThat(r.path("alterados").asInt()).isEqualTo(1);
        assertThat(detalhe(a1).path("ativo").asBoolean()).isFalse();
        assertThat(auditorias("ALUNO_SITUACAO", a1)).isEqualTo(1);
        assertThat(auditorias("ALUNO_SITUACAO", a2)).isEqualTo(1);
        api.get("/aluno/painel", login, 401);
    }

    @Test
    void alunoAnonimizadoRecusaTrocasEODesativarAPula() throws Exception {
        api.patch("/alunos/" + a2 + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + a2 + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno dois do lote"), 200);

        api.post("/alunos/lote/responsavel", admin, Map.of("alunoIds", List.of(a1, a2), "responsavelId", idDoMembro()), 409);
        api.post("/alunos/lote/questionario", admin, Map.of("alunoIds", List.of(a1, a2)), 409);
        assertThat(detalhe(a1).path("responsavelId").asString()).isNotEqualTo(idDoMembro());

        JsonNode r = api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(a1, a2)), 200);
        assertThat(r.path("alterados").asInt()).isEqualTo(1);
        assertThat(detalhe(a2).path("anonimizado").asBoolean()).isTrue();
    }

    @Test
    void limiteDeCemEListaVaziaSaoRecusados() throws Exception {
        List<UUID> muitos = new ArrayList<>();
        for (int i = 0; i < 101; i++) muitos.add(UUID.randomUUID());
        api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", muitos), 400);
        api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of()), 400);
        assertThat(detalhe(a1).path("ativo").asBoolean()).isTrue();
    }

    @Test
    void semAlunoAlterarERecusado() throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Só leitura do lote",
                "permissoes", Set.of("ALUNO_LER")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Leitor do lote",
                "email", ApiDeTeste.emailUnico("leitor"), "perfilId", perfil), 200);
        JsonNode leitor = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        api.post("/alunos/lote/desativar", leitor, Map.of("alunoIds", List.of(a1)), 403);
        assertThat(detalhe(a1).path("ativo").asBoolean()).isTrue();
    }
}
