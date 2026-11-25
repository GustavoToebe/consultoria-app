package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * Instagram e TikTok do aluno (V101): guardados como usuário normalizado, 422 por campo com mensagem fixa, ficha só com
 * {@code ALUNO_LER}, "Meus dados" (PUT substitui), exportação LGPD e anonimização. Dado pessoal: nunca em auditoria nem em erro.
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
class RedesDoAlunoIntegrationTest extends AbstractIntegrationTest {

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

    private JsonNode criar(Map<String, Object> extra, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>(Map.of("nome", "Aluno Redes Fictício"));
        corpo.putAll(extra);
        return api.post("/alunos", treinador, corpo, esperado);
    }

    private JsonNode alterar(JsonNode ficha, Map<String, Object> extra, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", ficha.get("nome").asString());
        corpo.put("versao", ficha.get("versao").asLong());
        corpo.putAll(extra);
        return api.put("/alunos/" + ficha.get("id").asString(), treinador, corpo, esperado);
    }

    private static boolean semValor(JsonNode n) {
        return n.isMissingNode() || n.isNull();
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void criarGravaSoOUsuarioNormalizadoEOutrosFormatosValem() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "https://www.instagram.com/Joao.Fit/?hl=pt", "tiktok", " @joao_tt "), 200);
        assertThat(ficha.get("instagram").asString()).isEqualTo("Joao.Fit");
        assertThat(ficha.get("tiktok").asString()).isEqualTo("joao_tt");

        JsonNode outra = criar(Map.of("instagram", "@maria", "tiktok", "https://www.tiktok.com/@maria.tt?lang=pt"), 200);
        assertThat(outra.get("instagram").asString()).isEqualTo("maria");
        assertThat(outra.get("tiktok").asString()).isEqualTo("maria.tt");

        JsonNode sem = criar(Map.of(), 200);
        assertThat(semValor(sem.path("instagram"))).isTrue();
        assertThat(semValor(sem.path("tiktok"))).isTrue();
    }

    @Test
    void ausenteOuNuloMantemEBrancoApagaCadaCampoSozinho() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "@joao", "tiktok", "@joao_tt"), 200);

        JsonNode semCampos = alterar(ficha, Map.of(), 200);
        assertThat(semCampos.get("instagram").asString()).isEqualTo("joao");
        assertThat(semCampos.get("tiktok").asString()).isEqualTo("joao_tt");

        Map<String, Object> nulos = new LinkedHashMap<>();
        nulos.put("instagram", null);
        nulos.put("tiktok", null);
        JsonNode comNulos = alterar(semCampos, nulos, 200);
        assertThat(comNulos.get("instagram").asString()).isEqualTo("joao");

        JsonNode semInsta = alterar(comNulos, Map.of("instagram", "  "), 200);
        assertThat(semValor(semInsta.path("instagram"))).isTrue();
        assertThat(semInsta.get("tiktok").asString()).isEqualTo("joao_tt");

        JsonNode trocou = alterar(semInsta, Map.of("tiktok", "outro_tt"), 200);
        assertThat(trocou.get("tiktok").asString()).isEqualTo("outro_tt");
        assertThat(semValor(trocou.path("instagram"))).isTrue();
    }

    @Test
    void invalidoDa422PorCampoComMensagemFixaESemGravarNada() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "@joao"), 200);
        String ruimInsta = "usuario sigiloso 123";
        String ruimTik = "https://instagram.com/sigiloso.tt";

        JsonNode erro = alterar(ficha, Map.of("instagram", ruimInsta, "tiktok", ruimTik), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("ALUNO_INVALIDO");
        List<String> campos = erro.get("fieldErrors").valueStream().map(e -> e.get("field").asString()).toList();
        assertThat(campos).containsExactlyInAnyOrder("instagram", "tiktok");
        assertThat(erro.toString()).doesNotContain("sigiloso");

        criar(Map.of("instagram", "a".repeat(31)), 422);
        criar(Map.of("tiktok", "a".repeat(25)), 422);
        criar(Map.of("instagram", "http://instagram.com/joao"), 422);
        assertThat(api.get("/alunos/" + ficha.get("id").asString(), treinador, 200).get("instagram").asString()).isEqualTo("joao");
    }

    @Test
    void fichaSoParaQuemLeELogNaoLevaOValorNemAAuditoria() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "@joao_unico", "tiktok", "@joao_tt_unico"), 200);
        String id = ficha.get("id").asString();

        JsonNode comoMembro = api.get("/alunos/" + id, membro(Set.of("ALUNO_LER")), 200);
        assertThat(comoMembro.get("instagram").asString()).isEqualTo("joao_unico");
        api.get("/alunos/" + id, membro(Set.of("TREINO_LER")), 403);
        api.get("/alunos/" + id, api.novoTreinador(), 404);

        assertThat(banco.queryForList("select resumo from auditoria where entidade_id = ?::uuid", id).toString())
                .doesNotContain("joao_unico").doesNotContain("joao_tt_unico");
        // A lista não carrega as redes.
        assertThat(api.get("/alunos", treinador, 200).toString()).doesNotContain("joao_unico");
    }

    @Test
    void meusDadosSubstituiEBrancoOuNuloApaga() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "@joao", "tiktok", "@joao_tt"), 200);
        UUID alunoId = UUID.fromString(ficha.get("id").asString());
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        JsonNode meus = api.get("/aluno/meus-dados", aluno, 200);
        assertThat(meus.get("instagram").asString()).isEqualTo("joao");
        assertThat(meus.get("tiktok").asString()).isEqualTo("joao_tt");

        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("instagram", "https://instagram.com/maria.fit");
        corpo.put("tiktok", "  ");
        corpo.put("versao", meus.get("versao").asLong());
        JsonNode depois = api.put("/aluno/meus-dados", aluno, corpo, 200);
        assertThat(depois.get("instagram").asString()).isEqualTo("maria.fit");
        assertThat(semValor(depois.path("tiktok"))).isTrue();
        assertThat(banco.queryForObject("select count(*) from auditoria where acao = 'ALUNO_DADOS_ALTERADOS_PELO_ALUNO' and entidade_id = ?::uuid",
                Integer.class, alunoId.toString())).isEqualTo(1);

        // Nulo também apaga (PUT substitui, como o telefone); versão velha é 409.
        Map<String, Object> nulos = new LinkedHashMap<>();
        nulos.put("instagram", null);
        nulos.put("tiktok", null);
        nulos.put("versao", depois.get("versao").asLong());
        JsonNode vazio = api.put("/aluno/meus-dados", aluno, nulos, 200);
        assertThat(semValor(vazio.path("instagram"))).isTrue();
        assertThat(api.get("/alunos/" + alunoId, treinador, 200).path("instagram").isNull()).isTrue();
        nulos.put("versao", depois.get("versao").asLong());
        api.put("/aluno/meus-dados", aluno, nulos, 409);

        // Inválido: 422 ALUNO_INVALIDO por campo, sem repetir o valor.
        Map<String, Object> ruim = new LinkedHashMap<>();
        ruim.put("instagram", "https://tiktok.com/@sigiloso");
        ruim.put("tiktok", "tem espaco sigiloso");
        ruim.put("versao", vazio.get("versao").asLong());
        JsonNode erro = api.put("/aluno/meus-dados", aluno, ruim, 422);
        assertThat(erro.get("fieldErrors").valueStream().map(e -> e.get("field").asString()).toList())
                .containsExactlyInAnyOrder("instagram", "tiktok");
        assertThat(erro.toString()).doesNotContain("sigiloso");
    }

    @Test
    void exportacaoLevaEAnonimizacaoZera() throws Exception {
        JsonNode ficha = criar(Map.of("instagram", "@joao_lgpd", "tiktok", "@joao_lgpd_tt"), 200);
        String id = ficha.get("id").asString();

        JsonNode cadastro = api.get("/alunos/" + id + "/exportacao", treinador, 200).get("cadastro");
        assertThat(cadastro.get("instagram").asString()).isEqualTo("joao_lgpd");
        assertThat(cadastro.get("tiktok").asString()).isEqualTo("joao_lgpd_tt");

        api.patch("/alunos/" + id + "/situacao", treinador, Map.of("ativo", false), 200);
        JsonNode anonimo = api.post("/alunos/" + id + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Redes Fictício"), 200);
        assertThat(semValor(anonimo.path("instagram"))).isTrue();
        assertThat(semValor(anonimo.path("tiktok"))).isTrue();
        assertThat(banco.queryForObject("select count(*) from aluno where id = ?::uuid and instagram is null and tiktok is null",
                Integer.class, id)).isEqualTo(1);
    }
}
