package br.com.treinos.api.alunos;

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

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V070: data de nascimento na ficha. Ausente não mexe, em branco apaga (como o telefone), formato ou faixa inválidos dão 422
 * {@code ALUNO_INVALIDO} no campo sem repetir o valor, a exportação a leva e a anonimização e "Excluir minha conta" a apagam.
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
class AlunoDataDeNascimentoIntegrationTest extends AbstractIntegrationTest {

    private static final String NASCIMENTO = "1987-03-14";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private JsonNode criar(String dataNascimento, int status) throws Exception {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", "Aluno Fictício " + UUID.randomUUID().toString().substring(0, 8));
        if (dataNascimento != null) {
            c.put("dataNascimento", dataNascimento);
        }
        return api.post("/alunos", treinador, c, status);
    }

    /** PUT só com o nome (e a data, se vier) e a versão atual: o resto do cadastro não vai no corpo. */
    private JsonNode alterar(String id, String dataNascimento, int status) throws Exception {
        JsonNode ficha = api.get("/alunos/" + id, treinador, 200);
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("nome", ficha.path("nome").asString());
        c.put("versao", ficha.path("versao").asLong());
        if (dataNascimento != null) {
            c.put("dataNascimento", dataNascimento);
        }
        return api.put("/alunos/" + id, treinador, c, status);
    }

    private String coluna(String id) {
        return banco.queryForObject("select data_nascimento::text from aluno where id = ?::uuid", String.class, id);
    }

    @Test
    void criarGravaAusenteNaoMexeEmBrancoApaga() throws Exception {
        JsonNode sem = criar(null, 200);
        assertThat(sem.path("dataNascimento").isMissingNode() || sem.path("dataNascimento").isNull()).isTrue();

        JsonNode criado = criar(NASCIMENTO, 200);
        String id = criado.path("id").asString();
        assertThat(criado.path("dataNascimento").asString()).isEqualTo(NASCIMENTO);

        // Ausente não mexe.
        assertThat(alterar(id, null, 200).path("dataNascimento").asString()).isEqualTo(NASCIMENTO);
        assertThat(coluna(id)).isEqualTo(NASCIMENTO);
        // Troca por outra data válida (29/02 de ano bissexto também vale).
        assertThat(alterar(id, "2000-02-29", 200).path("dataNascimento").asString()).isEqualTo("2000-02-29");
        // Em branco apaga.
        JsonNode apagada = alterar(id, "  ", 200);
        assertThat(apagada.path("dataNascimento").isMissingNode() || apagada.path("dataNascimento").isNull()).isTrue();
        assertThat(coluna(id)).isNull();
    }

    @Test
    void formatoEFaixaInvalidosDao422NoCampoSemRepetirOValor() throws Exception {
        String id = criar(NASCIMENTO, 200).path("id").asString();
        String amanha = LocalDate.now(Fuso.BRASILIA).plusDays(1).toString();
        for (String ruim : new String[] {"14/03/1987", "1987-13-40", "ontem", "1899-12-31", amanha}) {
            JsonNode erro = alterar(id, ruim, 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("dataNascimento");
            assertThat(erro.toString()).doesNotContain(ruim);
        }
        // No cadastro novo também, e nada é criado.
        JsonNode erro = criar("1899-12-31", 422);
        assertThat(erro.path("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        // A recusa não mexeu no que estava gravado.
        assertThat(coluna(id)).isEqualTo(NASCIMENTO);
    }

    @Test
    void exportacaoLevaAAnonimizacaoApagaENuncaVaiParaAAuditoria() throws Exception {
        String id = criar(NASCIMENTO, 200).path("id").asString();
        assertThat(api.get("/alunos/" + id + "/exportacao", treinador, 200).path("cadastro").path("dataNascimento").asString())
                .isEqualTo(NASCIMENTO);
        assertThat(banco.queryForObject("select count(*) from auditoria a where a.entidade_id = ?::uuid and a::text like ?",
                Integer.class, id, "%" + NASCIMENTO + "%")).isZero();

        String nome = api.get("/alunos/" + id, treinador, 200).path("nome").asString();
        api.patch("/alunos/" + id + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + id + "/anonimizar", treinador, Map.of("nomeConfirmado", nome), 200);
        assertThat(coluna(id)).isNull();
    }

    @Test
    void excluirMinhaContaApagaADataEAsPreferenciasDoPerfil() throws Exception {
        String id = criar(NASCIMENTO, 200).path("id").asString();
        JsonNode login = api.convidarEEntrar(treinador, UUID.fromString(id));
        api.put("/aluno/comunidade/perfil", login, Map.of("perfilReservado", false, "cor", "ROXO", "moldura", "DUPLA"), 200);
        assertThat(banco.queryForObject("select perfil_cor from aluno where id = ?::uuid", String.class, id)).isEqualTo("ROXO");

        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(coluna(id)).isNull();
        assertThat(banco.queryForMap("select perfil_reservado, perfil_cor, perfil_moldura, perfil_destaques from aluno where id = ?::uuid", id)
                .values()).containsOnlyNulls();
    }
}
