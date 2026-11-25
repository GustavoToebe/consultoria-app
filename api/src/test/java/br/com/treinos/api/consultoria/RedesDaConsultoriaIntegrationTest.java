package br.com.treinos.api.consultoria;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Redes sociais da consultoria (V101): {@code PUT /consultoria/marca} normaliza para link https (nulo mantém, em branco apaga,
 * 422 {@code MARCA_INVALIDA} por campo sem repetir o valor), {@code GET /consultoria} devolve as cinco chaves e o {@code GET /eu}
 * do aluno só as preenchidas. Só dados fictícios.
 */
@AutoConfigureMockMvc
class RedesDaConsultoriaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode treinador;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    private Map<String, Object> marca(JsonNode quem, Map<String, Object> redes) throws Exception {
        JsonNode atual = api.get("/consultoria", quem, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", atual.get("marca").get("nome").asString());
        corpo.put("corPrimaria", atual.get("marca").get("corPrimaria").asString());
        corpo.put("fonteTitulo", "PADRAO");
        corpo.put("temaPadrao", "CLARO");
        corpo.put("versao", atual.get("versao").asLong());
        if (redes != null) corpo.put("redesSociais", redes);
        return corpo;
    }

    private JsonNode gravar(JsonNode quem, Map<String, Object> redes, int esperado) throws Exception {
        return api.put("/consultoria/marca", quem, marca(quem, redes), esperado);
    }

    private static String redeDe(JsonNode consultoria, String chave) {
        JsonNode v = consultoria.get("redesSociais").get(chave);
        return v.isNull() ? null : v.asString();
    }

    @Test
    void semRedesVemAsCincoChavesNulas() throws Exception {
        JsonNode redes = api.get("/consultoria", treinador, 200).get("redesSociais");
        for (String chave : List.of("instagram", "tiktok", "youtube", "x", "site")) {
            assertThat(redes.has(chave)).as(chave).isTrue();
            assertThat(redes.get(chave).isNull()).as(chave).isTrue();
        }
    }

    @Test
    void gravaOLinkHttpsCanonicoDeCadaRedeEMantemQuandoAusenteOuNulo() throws Exception {
        Map<String, Object> entrada = new LinkedHashMap<>();
        entrada.put("instagram", "@marca.fit");
        entrada.put("tiktok", " https://www.tiktok.com/@marca?lang=pt ");
        entrada.put("youtube", "@canal-fit");
        entrada.put("x", "https://twitter.com/marca_x");
        entrada.put("site", "meusite.com.br");
        JsonNode salva = gravar(treinador, entrada, 200);
        assertThat(redeDe(salva, "instagram")).isEqualTo("https://instagram.com/marca.fit");
        assertThat(redeDe(salva, "tiktok")).isEqualTo("https://tiktok.com/@marca");
        assertThat(redeDe(salva, "youtube")).isEqualTo("https://youtube.com/@canal-fit");
        assertThat(redeDe(salva, "x")).isEqualTo("https://x.com/marca_x");
        assertThat(redeDe(salva, "site")).isEqualTo("https://meusite.com.br");
        assertThat(redeDe(api.get("/consultoria", treinador, 200), "tiktok")).isEqualTo("https://tiktok.com/@marca");

        // Sem o objeto, ou com campo nulo: mantém o gravado.
        assertThat(redeDe(gravar(treinador, null, 200), "instagram")).isEqualTo("https://instagram.com/marca.fit");
        Map<String, Object> nulos = new LinkedHashMap<>();
        nulos.put("instagram", null);
        nulos.put("x", null);
        JsonNode comNulos = gravar(treinador, nulos, 200);
        assertThat(redeDe(comNulos, "instagram")).isEqualTo("https://instagram.com/marca.fit");
        assertThat(redeDe(comNulos, "x")).isEqualTo("https://x.com/marca_x");

        // Em branco apaga só aquela; os outros ficam.
        JsonNode semSite = gravar(treinador, Map.of("site", "  ", "youtube", "https://youtu.be/abc123"), 200);
        assertThat(redeDe(semSite, "site")).isNull();
        assertThat(redeDe(semSite, "youtube")).isEqualTo("https://youtu.be/abc123");
        assertThat(redeDe(semSite, "tiktok")).isEqualTo("https://tiktok.com/@marca");
    }

    @Test
    void invalidasDao422PorCampoSemRepetirOValorENadaEGravado() throws Exception {
        gravar(treinador, Map.of("instagram", "@gravada"), 200);
        String ruimInsta = "https://tiktok.com/@sigiloso";
        String ruimSite = "http://sigiloso.example.com";
        JsonNode erro = gravar(treinador, Map.of("instagram", ruimInsta, "site", ruimSite, "tiktok", "@valida"), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("MARCA_INVALIDA");
        List<String> campos = erro.get("fieldErrors").valueStream().map(e -> e.get("field").asString()).toList();
        assertThat(campos).containsExactlyInAnyOrder("redesSociais.instagram", "redesSociais.site");
        assertThat(erro.toString()).doesNotContain("sigiloso");

        JsonNode depois = api.get("/consultoria", treinador, 200);
        assertThat(redeDe(depois, "instagram")).isEqualTo("https://instagram.com/gravada");
        assertThat(redeDe(depois, "tiktok")).as("o campo válido do mesmo pedido não é gravado").isNull();
    }

    @Test
    void soAdministradorComMarcaAlterarGravaEOutraConsultoriaNaoVe() throws Exception {
        gravar(treinador, Map.of("instagram", "@marca.a"), 200);

        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", CatalogoPermissoes.comDependencias(Set.of("TREINO_LER", "MARCA_ALTERAR"))), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        JsonNode membro = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        gravar(membro, Map.of("instagram", "@invasor"), 403);
        assertThat(redeDe(api.get("/consultoria", membro, 200), "instagram")).isEqualTo("https://instagram.com/marca.a");

        JsonNode outro = api.novoTreinador();
        assertThat(redeDe(api.get("/consultoria", outro, 200), "instagram")).isNull();
        gravar(outro, Map.of("instagram", "@marca.b"), 200);
        assertThat(redeDe(api.get("/consultoria", treinador, 200), "instagram")).isEqualTo("https://instagram.com/marca.a");
    }

    @Test
    void euDoAlunoTrazSoAsPreenchidasESomeSemNenhuma() throws Exception {
        JsonNode aluno = api.convidarEEntrar(treinador, api.criarAluno(treinador, "Aluno Redes Fictício"));
        assertThat(api.get("/eu", aluno, 200).has("redesSociaisDaConsultoria")).as("sem redes, o campo some").isFalse();

        gravar(treinador, Map.of("instagram", "@marca.fit", "site", "https://meusite.com.br"), 200);
        JsonNode redes = api.get("/eu", aluno, 200).get("redesSociaisDaConsultoria");
        assertThat(redes.size()).isEqualTo(2);
        assertThat(redes.get("instagram").asString()).isEqualTo("https://instagram.com/marca.fit");
        assertThat(redes.get("site").asString()).isEqualTo("https://meusite.com.br");
        assertThat(redes.has("tiktok")).isFalse();

        // O treinador lê as redes em GET /consultoria e não recebe o campo do aluno no /eu; a marca pública não as leva.
        assertThat(api.get("/eu", treinador, 200).has("redesSociaisDaConsultoria")).isFalse();
        assertThat(api.get("/eu", aluno, 200).get("marca").toString()).doesNotContain("instagram.com");

        gravar(treinador, Map.of("instagram", "", "site", ""), 200);
        assertThat(api.get("/eu", aluno, 200).has("redesSociaisDaConsultoria")).isFalse();
    }
}
