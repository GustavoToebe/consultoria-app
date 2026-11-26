package br.com.treinos.api.inscricoes;

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

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D4 (25/11): o Instagram é campo fixo e opcional da inscrição por link. A API guarda só o usuário (sem @), recusa o inválido
 * com 422 {@code INSCRICAO_INVALIDA} no campo {@code instagram} (mensagem fixa, sem o valor), mostra no detalhe e na
 * exportação do aluno e, ao aceitar, copia para {@code aluno.instagram}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class InscricaoInstagramIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String codigo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        codigo = abrirLink(admin);
    }

    private String abrirLink(JsonNode login) throws Exception {
        JsonNode atual = api.get("/inscricoes/configuracao", login, 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("aberta", true);
        corpo.put("versao", atual.path("versao").isNull() ? null : atual.path("versao").asLong());
        return api.put("/inscricoes/configuracao", login, corpo, 200).path("codigo").asString();
    }

    private Map<String, Object> corpo(String instagram) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", "Pessoa Fictícia");
        corpo.put("whatsapp", "11987654321");
        corpo.put("email", ApiDeTeste.emailUnico("insta"));
        if (instagram != null) corpo.put("instagram", instagram);
        return corpo;
    }

    /** Envia, e devolve o detalhe da única inscrição da consultoria. */
    private JsonNode enviar(String instagram) throws Exception {
        api.post("/publico/inscricoes/" + codigo, null, corpo(instagram), 202);
        JsonNode lista = api.get("/inscricoes", admin, 200);
        assertThat(lista.path("total").asLong()).isEqualTo(1);
        return api.get("/inscricoes/" + lista.path("itens").get(0).path("id").asString(), admin, 200);
    }

    private String aceitar(JsonNode detalhe) throws Exception {
        return api.post("/inscricoes/" + detalhe.path("id").asString() + "/aceitar", admin,
                Map.of("convidar", false, "versao", detalhe.path("versao").asLong(), "semCobranca", true), 200).path("alunoId").asString(); // Fase 3: sem pagamento confirmado, só como cortesia
    }

    private static boolean semValor(JsonNode campo) {
        return campo.isNull() || campo.isMissingNode();
    }

    @Test
    void usuarioArrobaEOLinkDoPerfilViramSoOUsuario() throws Exception {
        JsonNode arroba = enviar("@Fulano.Treino");
        assertThat(arroba.path("instagram").asString()).isEqualTo("Fulano.Treino");
        assertThat(banco.queryForObject("select instagram from inscricao where id = ?::uuid", String.class,
                arroba.path("id").asString())).isEqualTo("Fulano.Treino");

        JsonNode outra = api.novoTreinador();
        codigo = abrirLink(outra);
        api.post("/publico/inscricoes/" + codigo, null, corpo("https://instagram.com/fulano.treino"), 202);
        JsonNode item = api.get("/inscricoes", outra, 200).path("itens").get(0);
        assertThat(api.get("/inscricoes/" + item.path("id").asString(), outra, 200).path("instagram").asString())
                .isEqualTo("fulano.treino");
        // A fila (resumo) não leva o campo.
        assertThat(item.has("instagram")).isFalse();
    }

    @Test
    void semOCampoOuEmBrancoGravaNulo() throws Exception {
        assertThat(semValor(enviar(null).path("instagram"))).isTrue();

        JsonNode outra = api.novoTreinador();
        codigo = abrirLink(outra);
        api.post("/publico/inscricoes/" + codigo, null, corpo("   "), 202);
        String id = api.get("/inscricoes", outra, 200).path("itens").get(0).path("id").asString();
        assertThat(semValor(api.get("/inscricoes/" + id, outra, 200).path("instagram"))).isTrue();
        assertThat(banco.queryForObject("select instagram from inscricao where id = ?::uuid", String.class, id)).isNull();
    }

    @Test
    void invalidoDa422NoCampoComMensagemFixaESemGravarNada() throws Exception {
        for (String ruim : new String[] {"nome com espaço!", "https://instagram.com/p/AbC123", "https://tiktok.com/@fulano", "a".repeat(31)}) {
            JsonNode erro = api.post("/publico/inscricoes/" + codigo, null, corpo(ruim), 422);
            assertThat(erro.path("codigo").asString()).isEqualTo("INSCRICAO_INVALIDA");
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("instagram");
            assertThat(erro.path("fieldErrors").get(0).path("message").asString()).isEqualTo("Informe o usuário ou o link do perfil do Instagram.");
            assertThat(erro.toString()).doesNotContain(ruim);
        }
        // Acima de 200 caracteres a validação do corpo recusa antes (400).
        api.post("/publico/inscricoes/" + codigo, null, corpo("a".repeat(201)), 400);
        assertThat(api.get("/inscricoes", admin, 200).path("total").asLong()).isZero();
    }

    @Test
    void outraConsultoriaNaoVeODetalhe() throws Exception {
        JsonNode detalhe = enviar("@fulano.treino");
        api.get("/inscricoes/" + detalhe.path("id").asString(), api.novoTreinador(), 404);
    }

    @Test
    void aceitarCopiaOInstagramParaOAluno() throws Exception {
        String alunoId = aceitar(enviar("https://www.instagram.com/Fulano.Treino/?hl=pt"));
        JsonNode aluno = api.get("/alunos/" + alunoId, admin, 200);
        assertThat(aluno.path("instagram").asString()).isEqualTo("Fulano.Treino");
        assertThat(semValor(aluno.path("tiktok"))).isTrue();
    }

    @Test
    void aceitarSemInstagramNaoPreencheOAluno() throws Exception {
        String alunoId = aceitar(enviar(null));
        assertThat(semValor(api.get("/alunos/" + alunoId, admin, 200).path("instagram"))).isTrue();
    }

    @Test
    void valorInvalidoJaGravadoNaoTravaOAceite() throws Exception {
        JsonNode detalhe = enviar("@fulano.treino");
        banco.update("update inscricao set instagram = 'valor inválido!' where id = ?::uuid", detalhe.path("id").asString());
        String alunoId = aceitar(detalhe);
        assertThat(semValor(api.get("/alunos/" + alunoId, admin, 200).path("instagram"))).isTrue();
    }

    @Test
    void exportacaoDoAlunoLevaOInstagramDaInscricao() throws Exception {
        String alunoId = aceitar(enviar("@fulano.treino"));
        JsonNode item = api.get("/alunos/" + alunoId + "/exportacao", admin, 200).path("inscricao").path("itens").get(0);
        assertThat(item.path("instagram").asString()).isEqualTo("fulano.treino");
    }

    @Test
    void anonimizarOAlunoApagaAInscricaoComOInstagram() throws Exception {
        JsonNode detalhe = enviar("@fulano.treino");
        String alunoId = aceitar(detalhe);
        api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + alunoId + "/anonimizar", admin, Map.of("nomeConfirmado", "Pessoa Fictícia"), 200);

        assertThat(banco.queryForObject("select count(*) from inscricao where id = ?::uuid", Long.class, detalhe.path("id").asString())).isZero();
        assertThat(banco.queryForObject("select instagram from aluno where id = ?::uuid", String.class, alunoId)).isNull();
    }
}
