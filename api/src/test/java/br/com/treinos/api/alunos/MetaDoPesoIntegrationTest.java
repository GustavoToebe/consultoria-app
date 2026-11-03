package br.com.treinos.api.alunos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.equipe.CatalogoPermissoes;
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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Meta do peso (V052): padrão da consultoria, meta própria do aluno, a efetiva nas rotas de peso, e a privacidade da
 * meta do aluno (dado sensível: ficha, gravação, exportação, anonimização, "Excluir minha conta" e auditoria sem valor).
 * Só dados fictícios.
 */
@AutoConfigureMockMvc
class MetaDoPesoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    private ApiDeTeste api;
    private JsonNode treinador;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
    }

    // ---- apoio ----

    private JsonNode membro(JsonNode dono, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", dono,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", dono,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    /** PUT da ficha com a versão atual lida pelo administrador; {@code meta} nulo manda o campo nulo (= padrão). */
    private JsonNode gravarFicha(JsonNode quem, UUID aluno, String meta, int status) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Aluno Meta Fictício");
        corpo.put("versao", api.get("/alunos/" + aluno, treinador, 200).get("versao").asLong());
        corpo.put("metaDoPeso", meta);
        return api.put("/alunos/" + aluno, quem, corpo, status);
    }

    private void definirMetaDaConsultoria(String meta) throws Exception {
        JsonNode atual = api.get("/consultoria", treinador, 200);
        api.put("/consultoria/marca", treinador, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#C62828", "fonteTitulo", "PADRAO",
                "temaPadrao", "CLARO", "versao", atual.get("versao").asLong(), "metaDoPeso", meta), 200);
    }

    private UUID alunoComPeso() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Meta Fictício");
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.minusDays(3).toString(), "pesoKg", 80.0), 200);
        api.post("/alunos/" + aluno + "/pesos", treinador, Map.of("data", hoje.toString(), "pesoKg", 79.0), 200);
        return aluno;
    }

    // ---- consultoria ----

    @Test
    void consultoriaNasceReduzirEOAdministradorTroca() throws Exception {
        assertThat(api.get("/consultoria", treinador, 200).get("metaDoPeso").asString()).isEqualTo("REDUZIR");

        definirMetaDaConsultoria("AUMENTAR");
        assertThat(api.get("/consultoria", treinador, 200).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        // Sem o campo no corpo a meta gravada fica (a coluna nunca é nula).
        JsonNode atual = api.get("/consultoria", treinador, 200);
        JsonNode salva = api.put("/consultoria/marca", treinador, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#C62828",
                "fonteTitulo", "PADRAO", "temaPadrao", "CLARO", "versao", atual.get("versao").asLong()), 200);
        assertThat(salva.get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        // Valor fora da lista não passa; só mudança vai para a auditoria, sem o valor.
        JsonNode versao = api.get("/consultoria", treinador, 200);
        api.put("/consultoria/marca", treinador, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#C62828", "fonteTitulo", "PADRAO",
                "temaPadrao", "CLARO", "versao", versao.get("versao").asLong(), "metaDoPeso", "EMAGRECER"), 400);
        List<String> resumos = banco.queryForList("select resumo from auditoria where acao = 'CONSULTORIA_META_DO_PESO_ALTERADA'"
                + " and consultoria_id = (select consultoria_id from usuario where email = ?)", String.class,
                treinador.get("usuario").get("email").asString());
        assertThat(resumos).hasSize(1);
        assertThat(resumos.get(0)).doesNotContain("AUMENTAR").doesNotContain("REDUZIR");
    }

    @Test
    void semMarcaAlterarNaoGravaAMetaDaConsultoria() throws Exception {
        JsonNode sem = membro(treinador, Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_SENSIVEL_ALTERAR"));
        JsonNode atual = api.get("/consultoria", treinador, 200);
        api.put("/consultoria/marca", sem, Map.of("nome", "SARAIVA TEAM", "corPrimaria", "#C62828", "fonteTitulo", "PADRAO",
                "temaPadrao", "CLARO", "versao", atual.get("versao").asLong(), "metaDoPeso", "AUMENTAR"), 403);
        assertThat(api.get("/consultoria", treinador, 200).get("metaDoPeso").asString()).isEqualTo("REDUZIR");
    }

    // ---- aluno: ficha ----

    @Test
    void fichaSoMostraAMetaDoAlunoComSensivelLerESoGravaComSensivelAlterar() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Meta Fictício");
        assertThat(api.get("/alunos/" + aluno, treinador, 200).has("metaDoPeso")).isFalse(); // nulo = padrão, omitido

        gravarFicha(treinador, aluno, "AUMENTAR", 200);
        assertThat(api.get("/alunos/" + aluno, treinador, 200).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        JsonNode soLer = membro(treinador, Set.of("ALUNO_LER"));
        assertThat(api.get("/alunos/" + aluno, soLer, 200).has("metaDoPeso")).isFalse();
        JsonNode comSensivel = membro(treinador, Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER"));
        assertThat(api.get("/alunos/" + aluno, comSensivel, 200).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        // Sem ALUNO_SENSIVEL_ALTERAR a meta do corpo é ignorada (200, sem 403) e a gravada fica.
        JsonNode soAlterar = membro(treinador, Set.of("ALUNO_LER", "ALUNO_ALTERAR"));
        gravarFicha(soAlterar, aluno, "SEM_META", 200);
        gravarFicha(soAlterar, aluno, null, 200);
        assertThat(api.get("/alunos/" + aluno, treinador, 200).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        // Com a permissão o PUT substitui; nulo volta ao padrão da consultoria.
        gravarFicha(treinador, aluno, null, 200);
        assertThat(api.get("/alunos/" + aluno, treinador, 200).has("metaDoPeso")).isFalse();

        // Auditoria: uma linha por mudança real, sem o valor (dado sensível).
        List<String> resumos = banco.queryForList("select resumo from auditoria where acao = 'ALUNO_META_DO_PESO_ALTERADA'"
                + " and entidade_id = ?", String.class, aluno);
        assertThat(resumos).hasSize(2);
        assertThat(String.join(" ", resumos)).doesNotContain("AUMENTAR").doesNotContain("REDUZIR").doesNotContain("SEM_META");
    }

    @Test
    void outraConsultoriaNaoVeNemGravaAMeta() throws Exception {
        UUID aluno = alunoComPeso();
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + aluno + "/pesos", outro, 404);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Invasor");
        corpo.put("versao", 0);
        corpo.put("metaDoPeso", "AUMENTAR");
        api.put("/alunos/" + aluno, outro, corpo, 404);
        assertThat(banco.queryForObject("select meta_do_peso from aluno where id = ?", String.class, aluno)).isNull();
    }

    // ---- a efetiva nas rotas de peso ----

    @Test
    void efetivaVemDoAlunoOuSenaoDaConsultoriaNasDuasRotas() throws Exception {
        UUID aluno = alunoComPeso();
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        // Padrão da consultoria (REDUZIR desde a migration).
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200).get(0).get("metaDoPeso").asString()).isEqualTo("REDUZIR");
        assertThat(api.get("/aluno/pesos", login, 200).get(0).get("metaDoPeso").asString()).isEqualTo("REDUZIR");

        definirMetaDaConsultoria("SEM_META");
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200).get(1).get("metaDoPeso").asString()).isEqualTo("SEM_META");
        assertThat(api.get("/aluno/pesos", login, 200).get(1).get("metaDoPeso").asString()).isEqualTo("SEM_META");

        // A do aluno vale sobre a da consultoria, inclusive na resposta do POST.
        gravarFicha(treinador, aluno, "AUMENTAR", 200);
        assertThat(api.get("/alunos/" + aluno + "/pesos", treinador, 200).get(0).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");
        assertThat(api.get("/aluno/pesos", login, 200).get(0).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");
        JsonNode aposRegistrar = api.post("/alunos/" + aluno + "/pesos", treinador,
                Map.of("data", hoje.minusDays(1).toString(), "pesoKg", 79.5), 200);
        assertThat(aposRegistrar.get(0).get("metaDoPeso").asString()).isEqualTo("AUMENTAR");

        // Volta ao padrão quando a do aluno é limpa.
        gravarFicha(treinador, aluno, null, 200);
        assertThat(api.get("/aluno/pesos", login, 200).get(0).get("metaDoPeso").asString()).isEqualTo("SEM_META");
    }

    @Test
    void semSensivelLerARotaDePesoDaEquipeContinuaFechada() throws Exception {
        UUID aluno = alunoComPeso();
        JsonNode soLer = membro(treinador, Set.of("ALUNO_LER"));
        api.get("/alunos/" + aluno + "/pesos", soLer, 403);
    }

    // ---- privacidade ----

    @Test
    void exportacaoLevaAMeta() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Meta Fictício");
        gravarFicha(treinador, aluno, "AUMENTAR", 200);

        assertThat(api.get("/alunos/" + aluno + "/exportacao", treinador, 200).get("cadastro").get("metaDoPeso").asString())
                .isEqualTo("AUMENTAR");
        // ALUNO_EXPORTAR depende de ALUNO_SENSIVEL_LER, então quem exporta sempre pode ver a meta.
    }

    @Test
    void anonimizacaoZeraAMeta() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Meta Fictício");
        gravarFicha(treinador, aluno, "AUMENTAR", 200);
        assertThat(banco.queryForObject("select meta_do_peso from aluno where id = ?", String.class, aluno)).isEqualTo("AUMENTAR");

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluno Meta Fictício"), 200);
        assertThat(banco.queryForObject("select meta_do_peso from aluno where id = ?", String.class, aluno)).isNull();
    }

    @Test
    void excluirMinhaContaZeraAMeta() throws Exception {
        UUID aluno = api.criarAluno(treinador, "Aluno Meta Fictício");
        gravarFicha(treinador, aluno, "AUMENTAR", 200);
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(banco.queryForObject("select meta_do_peso from aluno where id = ?", String.class, aluno)).isNull();
    }
}
