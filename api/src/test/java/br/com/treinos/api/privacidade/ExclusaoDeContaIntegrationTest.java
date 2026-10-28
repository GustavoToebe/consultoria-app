package br.com.treinos.api.privacidade;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** "Excluir minha conta" pelo próprio aluno (App Store 5.1.1(v), LGPD). Só dados fictícios. */
@AutoConfigureMockMvc
class ExclusaoDeContaIntegrationTest extends AbstractIntegrationTest {

    private static final String NOME = "Joana Fictícia";
    private static final String OBSERVACAO_SERIE = "Observação fictícia da série";
    private static final String COMENTARIO_SESSAO = "Comentário fictício da sessão";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoId;
    private String emailDoAluno;
    private JsonNode loginDoAluno;
    private UUID fotoPendente;
    private UUID outroAluno;
    private JsonNode loginDoOutro;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    /** Aluno com pasta, treino publicado, registro com observação, peso, lesão e uma foto pendente; e um colega da mesma consultoria. */
    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        emailDoAluno = ApiDeTeste.emailUnico("joana");
        alunoId = UUID.fromString(api.post("/alunos", admin, Map.of("nome", NOME, "email", emailDoAluno,
                "objetivo", "Objetivo fictício"), 200).get("id").asString());
        String pasta = api.post("/alunos/" + alunoId + "/pastas", admin, Map.of("titulo", "Pasta de " + NOME,
                "inicio", hoje.minusDays(10), "fim", hoje.plusDays(10)), 200).get("id").asString();
        var treino = ApiDeTeste.treino();
        api.publicarTreino(admin, alunoId, treino.conteudo());

        String codigo = api.post("/alunos/" + alunoId + "/convite", admin, null, 200).get("codigo").asString();
        loginDoAluno = api.post("/publico/convites/aceitar", null,
                Map.of("codigo", codigo, "email", emailDoAluno, "senha", ApiDeTeste.SENHA), 200);
        String versaoId = api.get("/aluno/painel", loginDoAluno, 200).get("treino").get("versaoId").asString();
        Map<String, Object> registro = new LinkedHashMap<>();
        registro.put("id", UUID.randomUUID().toString());
        registro.put("planoVersaoId", versaoId);
        registro.put("sessaoUid", treino.sessaoUid().toString());
        registro.put("exercicioUid", treino.exercicioUid().toString());
        registro.put("serieUid", treino.wsUid().toString());
        registro.put("data", hoje.toString());
        registro.put("carga", "40");
        registro.put("repeticoes", 6);
        registro.put("concluida", true);
        registro.put("observacao", OBSERVACAO_SERIE);
        registro.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/execucoes/lote", loginDoAluno, Map.of("registros", List.of(registro)), 200);
        concluirSessao(loginDoAluno, versaoId, treino.sessaoUid().toString());

        api.post("/alunos/" + alunoId + "/pesos", admin, Map.of("data", hoje.minusDays(2), "pesoKg", "70.10"), 200);
        api.post("/alunos/" + alunoId + "/lesoes", admin,
                Map.of("regiao", "Joelho", "descricao", "Descrição fictícia", "dataInicio", "2026-03-01", "situacao", "ATIVA"), 200);
        // Foto pendente direto no banco: o caminho do bucket é do FotosIntegrationTest; aqui importa a fila de remoção.
        fotoPendente = UUID.randomUUID();
        jdbc.update("insert into atualizacao_foto (id, consultoria_id, aluno_id, pasta_id, tamanho)"
                + " select ?, consultoria_id, id, ?::uuid, 1234 from aluno where id = ?", fotoPendente, pasta, alunoId);

        outroAluno = api.criarAluno(admin, "Outro aluno fictício");
        api.post("/alunos/" + outroAluno + "/pesos", admin, Map.of("data", hoje.minusDays(1), "pesoKg", "80.00"), 200);
        loginDoOutro = api.convidarEEntrar(admin, outroAluno);
        var treinoDoOutro = ApiDeTeste.treino();
        api.publicarTreino(admin, outroAluno, treinoDoOutro.conteudo());
        concluirSessao(loginDoOutro, api.get("/aluno/painel", loginDoOutro, 200).get("treino").get("versaoId").asString(),
                treinoDoOutro.sessaoUid().toString());
    }

    /** O aluno conclui a sessão do dia com um comentário (dado sensível). */
    private void concluirSessao(JsonNode login, String versaoId, String sessaoUid) throws Exception {
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", UUID.randomUUID().toString());
        sessao.put("planoVersaoId", versaoId);
        sessao.put("sessaoUid", sessaoUid);
        sessao.put("data", hoje.toString());
        sessao.put("concluida", true);
        sessao.put("resultado", "COMPLETA");
        sessao.put("duracaoSegundos", 3000);
        sessao.put("comentario", COMENTARIO_SESSAO);
        sessao.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/sessoes-concluidas", login, Map.of("registros", List.of(sessao)), 200);
    }

    private Map<String, Object> pedido(String senha, String confirmacao) {
        return Map.of("senha", senha, "confirmacao", confirmacao);
    }

    private int contar(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void senhaOuConfirmacaoErradaNaoMudaNada() throws Exception {
        JsonNode senha = api.post("/aluno/conta/excluir", loginDoAluno, pedido("outra-senha-ficticia", "EXCLUIR"), 400);
        assertThat(senha.get("codigo").asString()).isEqualTo("SENHA_INCORRETA");
        JsonNode confirmacao = api.post("/aluno/conta/excluir", loginDoAluno, pedido(ApiDeTeste.SENHA, "APAGAR"), 422);
        assertThat(confirmacao.get("codigo").asString()).isEqualTo("CONFIRMACAO_INVALIDA");
        assertThat(confirmacao.get("fieldErrors").get(0).get("field").asString()).isEqualTo("confirmacao");
        api.post("/aluno/conta/excluir", loginDoAluno, pedido(ApiDeTeste.SENHA, " "), 400);

        assertThat(contar("select count(*) from aluno where id = ? and ativo and anonimizado_em is null", alunoId)).isEqualTo(1);
        assertThat(contar("select count(*) from registro_peso where aluno_id = ?", alunoId)).isPositive();
        assertThat(contar("select count(*) from atualizacao_foto where id = ? and removida_em is null", fotoPendente)).isEqualTo(1);
        assertThat(contar("select count(*) from auditoria where acao = 'ALUNO_EXCLUIU_CONTA' and entidade_id = ?", alunoId)).isZero();
        api.get("/eu", loginDoAluno, 200);
        api.post("/auth/login", null, Map.of("email", emailDoAluno, "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void soOProprioAlunoLogado() throws Exception {
        api.post("/aluno/conta/excluir", admin, pedido(ApiDeTeste.SENHA, "EXCLUIR"), 403);
        api.post("/aluno/conta/excluir", null, pedido(ApiDeTeste.SENHA, "EXCLUIR"), 401);
        assertThat(contar("select count(*) from aluno where id = ? and anonimizado_em is null", alunoId)).isEqualTo(1);
    }

    @Test
    void excluirAnonimizaEncerraAsSessoesEFechaOLogin() throws Exception {
        String usuarioId = jdbc.queryForObject("select usuario_id::text from aluno where id = ?", String.class, alunoId);
        int series = contar("select count(*) from execucao_serie where aluno_id = ?", alunoId);
        assertThat(series).isPositive();
        assertThat(contar("select count(*) from plataforma.refresh_token where sujeito = ?", usuarioId)).isPositive();

        // Minúsculas e espaços nas pontas valem: o que importa é ter digitado a palavra.
        api.post("/aluno/conta/excluir", loginDoAluno, pedido(ApiDeTeste.SENHA, " excluir "), 204);

        // Anonimizado e inativo, como no caminho do treinador.
        assertThat(contar("select count(*) from aluno where id = ? and not ativo and anonimizado_em is not null"
                + " and nome = 'Aluno anonimizado' and email is null and objetivo is null", alunoId)).isEqualTo(1);
        Map<String, Object> usuario = jdbc.queryForMap("select nome, email, telefone, ativo from usuario where id = ?::uuid", usuarioId);
        assertThat(usuario.get("email").toString()).startsWith("anonimizado+").endsWith("@anonimizado.invalid");
        assertThat(usuario.get("ativo")).isEqualTo(false);
        for (String tabela : List.of("registro_peso", "lesao_aluno")) {
            assertThat(contar("select count(*) from " + tabela + " where aluno_id = ?", alunoId)).as(tabela).isZero();
        }
        assertThat(contar("select count(*) from execucao_serie where aluno_id = ? and observacao is not null", alunoId)).isZero();
        assertThat(contar("select count(*) from execucao_serie where aluno_id = ? and carga is not null", alunoId)).isEqualTo(series);
        assertThat(contar("select count(*) from pasta_plano where aluno_id = ? and titulo like '%Joana%'", alunoId)).isZero();
        // A sessão concluída fica (resultado, duração e data não identificam ninguém); só o comentário sai.
        assertThat(contar("select count(*) from sessao_concluida where aluno_id = ? and concluida and resultado = 'COMPLETA'",
                alunoId)).isEqualTo(1);
        assertThat(contar("select count(*) from sessao_concluida where aluno_id = ? and comentario is not null", alunoId)).isZero();
        // Foto fora do ar e na fila do bucket.
        assertThat(contar("select count(*) from atualizacao_foto where id = ? and removida_em is not null", fotoPendente)).isEqualTo(1);
        assertThat(contar("select count(*) from foto_remocao where objeto = ?", fotoPendente)).isEqualTo(1);

        // Sessões encerradas, login antigo morto, e chamar de novo não passa da autenticação.
        assertThat(contar("select count(*) from plataforma.refresh_token where sujeito = ?", usuarioId)).isZero();
        api.get("/eu", loginDoAluno, 401);
        api.post("/aluno/conta/excluir", loginDoAluno, pedido(ApiDeTeste.SENHA, "EXCLUIR"), 401);
        api.post("/auth/login", null, Map.of("email", emailDoAluno, "senha", ApiDeTeste.SENHA), 401);
        // O treinador vê o cadastro anonimizado e não o reativa.
        assertThat(api.get("/alunos/" + alunoId, admin, 200).get("anonimizado").asBoolean()).isTrue();
        assertThat(api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", true), 409).get("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");

        // Auditoria: o ator é o próprio aluno, resumo fixo e sem o nome.
        List<Map<String, Object>> linhas = jdbc.queryForList(
                "select usuario_id::text as usuario, resumo from auditoria where acao = 'ALUNO_EXCLUIU_CONTA' and entidade_id = ?", alunoId);
        assertThat(linhas).hasSize(1);
        assertThat(linhas.get(0).get("usuario")).isEqualTo(usuarioId);
        assertThat(linhas.get(0).get("resumo")).isEqualTo("O aluno excluiu a própria conta pelo app.");
        assertThat(contar("select count(*) from auditoria where acao = 'ALUNO_ANONIMIZADO' and entidade_id = ?", alunoId)).isZero();

        // O colega da mesma consultoria não foi tocado.
        assertThat(contar("select count(*) from registro_peso where aluno_id = ?", outroAluno)).isEqualTo(1);
        assertThat(contar("select count(*) from sessao_concluida where aluno_id = ? and comentario = ?", outroAluno,
                COMENTARIO_SESSAO)).isEqualTo(1);
        assertThat(contar("select count(*) from aluno where id = ? and ativo and anonimizado_em is null", outroAluno)).isEqualTo(1);
        api.get("/eu", loginDoOutro, 200);
    }
}
