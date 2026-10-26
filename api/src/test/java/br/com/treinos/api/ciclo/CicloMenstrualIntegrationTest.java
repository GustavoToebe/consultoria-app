package br.com.treinos.api.ciclo;

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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Ciclo menstrual e sexo. Datas e sintomas são fictícios e não aparecem nas mensagens de erro. */
@AutoConfigureMockMvc
class CicloMenstrualIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode alunoLogin;
    private UUID aluno;
    private LocalDate hoje;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluna Fictícia Ciclo");
        alunoLogin = api.convidarEEntrar(treinador, aluno);
        hoje = LocalDate.now(Fuso.BRASILIA);
    }

    @Test
    void sexoDiferenteDeFemininoRecusaTudo() throws Exception {
        definirSexo("MASCULINO");
        assertThat(api.get("/aluno/ciclo", alunoLogin, 200).path("disponivel").asBoolean()).isFalse();
        JsonNode recusa = api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("CICLO_INDISPONIVEL");
        api.post("/aluno/ciclo/registros", alunoLogin, Map.of("id", UUID.randomUUID(), "inicio", hoje.toString()), 409);
    }

    @Test
    void ligarValidarIdempotenciaSobreposicaoEApagar() throws Exception {
        definirSexo("FEMININO");
        JsonNode versaoErrada = api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 99), 409);
        assertThat(versaoErrada.path("codigo").asString()).isEqualTo("CICLO_CONSENTIMENTO_DESATUALIZADO");
        JsonNode desligado = api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.toString()), 409);
        assertThat(desligado.path("codigo").asString()).isEqualTo("CICLO_DESLIGADO");

        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1, "duracaoHabitual", 28), 200);
        UUID id = UUID.randomUUID();
        Map<String, Object> corpo = Map.of("id", id, "inicio", hoje.minusDays(4).toString(), "fim", hoje.minusDays(1).toString());
        api.post("/aluno/ciclo/registros", alunoLogin, corpo, 200);
        api.post("/aluno/ciclo/registros", alunoLogin, corpo, 200);
        assertThat(banco.queryForObject("select count(*) from ciclo_registro where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);

        JsonNode futuro = api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.plusDays(1).toString()), 422);
        assertThat(futuro.path("codigo").asString()).isEqualTo("CICLO_INVALIDO");
        assertThat(futuro.toString()).doesNotContain(hoje.plusDays(1).toString());

        JsonNode cruza = api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.minusDays(3).toString(), "fim", hoje.toString()), 409);
        assertThat(cruza.path("codigo").asString()).isEqualTo("CICLO_SOBREPOSTO");
        assertThat(cruza.toString()).doesNotContain(hoje.minusDays(3).toString());

        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + aluno + "/ciclo", outro, 404);

        JsonNode soLer = membro(Set.of("ALUNO_LER"));
        api.get("/alunos/" + aluno + "/ciclo", soLer, 403);

        JsonNode visivel = api.get("/alunos/" + aluno + "/ciclo", treinador, 200);
        assertThat(visivel.path("ativo").asBoolean()).isTrue();
        assertThat(visivel.path("registros")).hasSize(1);

        definirSexo("OUTRO");
        JsonNode oculto = api.get("/alunos/" + aluno + "/ciclo", treinador, 200);
        assertThat(oculto.path("ativo").asBoolean()).isFalse();
        assertThat(oculto.path("registros")).isEmpty();

        definirSexo("FEMININO");
        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1), 200);
        api.delete("/aluno/ciclo", alunoLogin, 204);
        assertThat(banco.queryForObject("select count(*) from ciclo_registro where aluno_id = ?", Integer.class, aluno)).isZero();
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNull();

        String resumo = banco.queryForObject(
                "select string_agg(resumo, ' ') from auditoria where entidade_id = ?::uuid and acao like 'CICLO_%'",
                String.class, aluno);
        assertThat(resumo).doesNotContain(hoje.toString());
    }

    @Test
    void sintomasSubstituemESomemComOApagarTudo() throws Exception {
        definirSexo("FEMININO");
        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1), 200);
        Map<String, Object> dia = Map.of("id", UUID.randomUUID(), "fluxo", "LEVE", "sintomas", List.of("CANSACO"), "observacao", "nota fictícia");
        api.put("/aluno/ciclo/dias/" + hoje, alunoLogin, dia, 200);
        api.put("/aluno/ciclo/dias/" + hoje, alunoLogin, dia, 200);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);
        api.put("/aluno/ciclo/dias/" + hoje, alunoLogin,
                Map.of("id", UUID.randomUUID(), "colica", "FORTE", "sintomas", List.of("INCHACO", "CANSACO")), 200);
        assertThat(banco.queryForObject("select colica from ciclo_dia where aluno_id = ?", String.class, aluno)).isEqualTo("FORTE");

        JsonNode vazio = api.put("/aluno/ciclo/dias/" + hoje, alunoLogin, Map.of("id", UUID.randomUUID()), 422);
        assertThat(vazio.path("codigo").asString()).isEqualTo("CICLO_INVALIDO");
        JsonNode repetido = api.put("/aluno/ciclo/dias/" + hoje, alunoLogin,
                Map.of("id", UUID.randomUUID(), "sintomas", List.of("ACNE", "ACNE")), 422);
        assertThat(repetido.toString()).doesNotContain("ACNE");
        api.put("/aluno/ciclo/dias/" + hoje.plusDays(1), alunoLogin,
                Map.of("id", UUID.randomUUID(), "fluxo", "LEVE"), 422);

        assertThat(api.get("/alunos/" + aluno + "/ciclo", treinador, 200).path("dias")).hasSize(1);
        api.post("/aluno/ciclo/desativar", alunoLogin, Map.of(), 200);
        assertThat(api.get("/alunos/" + aluno + "/ciclo", treinador, 200).path("dias")).isEmpty();
        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1), 200);
        api.delete("/aluno/ciclo", alunoLogin, 204);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, aluno)).isZero();
    }

    @Test
    void exportacaoLevaEAnonimizarApaga() throws Exception {
        definirSexo("FEMININO");
        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1, "duracaoHabitual", 30), 200);
        api.post("/aluno/ciclo/registros", alunoLogin, Map.of("id", UUID.randomUUID(), "inicio", hoje.minusDays(2).toString()), 200);
        JsonNode exportado = api.get("/alunos/" + aluno + "/exportacao", treinador, 200);
        assertThat(exportado.path("cicloMenstrual").path("ativo").asBoolean()).isTrue();
        assertThat(exportado.path("cicloMenstrual").path("registros")).hasSize(1);
        assertThat(exportado.path("cadastro").path("sexo").asString()).isEqualTo("FEMININO");

        api.patch("/alunos/" + aluno + "/situacao", treinador, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", treinador, Map.of("nomeConfirmado", "Aluna Fictícia Ciclo"), 200);
        assertThat(banco.queryForObject("select count(*) from ciclo_registro where aluno_id = ?", Integer.class, aluno)).isZero();
        assertThat(banco.queryForObject("select sexo from aluno where id = ?", String.class, aluno)).isNull();
    }

    private void definirSexo(String sexo) throws Exception {
        JsonNode ficha = api.get("/alunos/" + aluno, treinador, 200);
        api.put("/alunos/" + aluno, treinador, Map.of(
                "nome", ficha.path("nome").asString(),
                "versao", ficha.path("versao").asLong(),
                "sexo", sexo), 200);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }
}
