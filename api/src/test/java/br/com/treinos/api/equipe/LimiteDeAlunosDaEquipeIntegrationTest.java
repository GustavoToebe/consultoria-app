package br.com.treinos.api.equipe;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste;
import br.com.treinos.api.LimiteDoTreinadorDeTeste.Membro;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A rota do limite de alunos do membro (D13, D14): {@code PUT /usuarios/{id}/limite-de-alunos {limite}}, só do
 * Administrador, inteiro de 0 a 999, {@code null} apaga, com auditoria de resumo fixo; o {@code PUT /usuarios/{id}} não
 * muda. O valor gravado é conferido pelas linhas de Números (campo {@code limiteDeAlunos} da linha do membro). Só dados
 * fictícios.
 */
@AutoConfigureMockMvc
class LimiteDeAlunosDaEquipeIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private LimiteDoTreinadorDeTeste lim;
    private Membro membro;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        lim = new LimiteDoTreinadorDeTeste(api, admin, banco);
        membro = lim.membro();
    }

    private String rota(Membro quem) {
        return "/usuarios/" + quem.id() + "/limite-de-alunos";
    }

    private static Map<String, Object> corpo(Integer limite) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("limite", limite);
        return corpo;
    }

    /** O limite do membro como Números o mostra (nulo = sem limite); falha se o membro não tem linha. */
    private JsonNode limiteNosNumeros(JsonNode quem, Membro de) throws Exception {
        for (JsonNode linha : api.get("/numeros", quem, 200).path("equipe")) {
            if (de.id().equals(linha.path("usuarioId").asString())) {
                return linha.path("limiteDeAlunos");
            }
        }
        throw new AssertionError("O membro não aparece na tabela da equipe em Números.");
    }

    private List<String> auditoriasDoLimite(Membro de) {
        return banco.queryForList("select resumo from auditoria where entidade_id = ?::uuid and acao like '%LIMITE%' "
                + "order by criado_em", String.class, de.id());
    }

    @Test
    void administradorGravaDeZeroANoveNoveNoveENulApaga() throws Exception {
        assertThat(limiteNosNumeros(admin, membro).isNull()).isTrue();
        for (int valor : new int[] {0, 1, 50, 999}) {
            api.put(rota(membro), admin, corpo(valor), 204);
            assertThat(limiteNosNumeros(admin, membro).asInt()).as("limite gravado").isEqualTo(valor);
        }
        api.put(rota(membro), admin, corpo(null), 204);
        assertThat(limiteNosNumeros(admin, membro).isNull()).isTrue();
        // O Administrador também pode ter limite (ele é um treinador da equipe).
        Membro oAdmin = new Membro(admin, lim.idDoAdmin(), "Administrador", "admin");
        api.put(rota(oAdmin), admin, corpo(5), 204);
        assertThat(limiteNosNumeros(admin, oAdmin).asInt()).isEqualTo(5);
    }

    @Test
    void foraDeZeroANoveNoveNoveE422NoCampoSemRepetirOValor() throws Exception {
        api.put(rota(membro), admin, corpo(7), 204);
        for (int invalido : new int[] {-7351, 4217}) {
            JsonNode erro = api.put(rota(membro), admin, corpo(invalido), 422);
            assertThat(erro.path("fieldErrors").get(0).path("field").asString()).isEqualTo("limite");
            String texto = erro.path("message").asString() + " " + erro.path("fieldErrors");
            assertThat(texto).doesNotContain(String.valueOf(invalido)).doesNotContain(String.valueOf(Math.abs(invalido)));
        }
        assertThat(limiteNosNumeros(admin, membro).asInt()).as("o valor anterior fica").isEqualTo(7);
    }

    @Test
    void soOAdministradorGrava() throws Exception {
        // Assistente: não tem nem a permissão da rota.
        String assistente = null;
        for (JsonNode p : api.get("/perfis", admin, 200)) {
            if ("Assistente".equals(p.path("nome").asString())) {
                assistente = p.path("id").asString();
            }
        }
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Assistente Fictício",
                "email", ApiDeTeste.emailUnico("assistente-limite"), "perfilId", assistente), 200);
        JsonNode assistenteLogin = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        api.put(rota(membro), assistenteLogin, corpo(3), 403);

        // Gestor: pode alterar usuários (USUARIO_ALTERAR) mas não é Administrador; ainda assim é 403.
        Membro gestor = lim.membro(Set.of("EQUIPE_LER", "USUARIO_ALTERAR", "PAINEL_VER"));
        api.put(rota(membro), gestor.login(), corpo(3), 403);
        api.put(rota(gestor), gestor.login(), corpo(3), 403);

        // O próprio membro não muda o seu limite.
        api.put(rota(membro), membro.login(), corpo(null), 403);
        // Sem login.
        api.put(rota(membro), null, corpo(3), 401);

        assertThat(limiteNosNumeros(admin, membro).isNull()).isTrue();
        assertThat(auditoriasDoLimite(membro)).isEmpty();
    }

    @Test
    void membroDeOutraConsultoriaOuInexistenteDa404() throws Exception {
        api.put(rota(membro), admin, corpo(3), 204);
        JsonNode estranho = api.novoTreinador();
        api.put(rota(membro), estranho, corpo(null), 404);
        api.put("/usuarios/" + UUID.randomUUID() + "/limite-de-alunos", admin, corpo(3), 404);
        assertThat(limiteNosNumeros(admin, membro).asInt()).isEqualTo(3);
    }

    @Test
    void auditaComResumoFixoSemOValorNemONome() throws Exception {
        api.put(rota(membro), admin, corpo(41), 204);
        api.put(rota(membro), admin, corpo(null), 204);
        List<String> resumos = auditoriasDoLimite(membro);
        assertThat(resumos).hasSize(2);
        for (String resumo : resumos) {
            assertThat(resumo).isNotBlank().doesNotContain("41").doesNotContain(membro.nome()).doesNotContain(membro.email());
        }
        assertThat(resumos.get(0)).isEqualTo(resumos.get(1)); // resumo fixo: apagar e gravar dizem a mesma coisa
    }

    /** D13: o PUT /usuarios/{id} segue igual e o seu corpo não toca no limite (nem com o campo, nem com null). */
    @Test
    void putDeUsuarioNaoMudaOLimite() throws Exception {
        api.put(rota(membro), admin, corpo(12), 204);
        String perfil = null;
        for (JsonNode u : api.get("/usuarios", admin, 200)) {
            if (membro.id().equals(u.path("id").asString())) {
                perfil = u.path("perfilId").asString();
            }
        }
        assertThat(perfil).isNotBlank();
        api.put("/usuarios/" + membro.id(), admin, Map.of("nome", "Renomeado Fictício", "perfilId", perfil, "ativo", true), 200);
        assertThat(limiteNosNumeros(admin, membro).asInt()).isEqualTo(12);

        Map<String, Object> comLimite = new HashMap<>();
        comLimite.put("nome", "Renomeado Outra Vez");
        comLimite.put("perfilId", perfil);
        comLimite.put("ativo", true);
        comLimite.put("limiteDeAlunos", null);
        comLimite.put("limite", 99);
        api.put("/usuarios/" + membro.id(), admin, comLimite, 200);
        assertThat(limiteNosNumeros(admin, membro).asInt()).isEqualTo(12);
    }
}
