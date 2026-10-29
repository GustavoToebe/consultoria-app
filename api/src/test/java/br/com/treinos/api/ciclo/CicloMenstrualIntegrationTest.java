package br.com.treinos.api.ciclo;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

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
        assertThat(semHorario(futuro)).doesNotContain(hoje.plusDays(1).toString());

        JsonNode cruza = api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.minusDays(3).toString(), "fim", hoje.toString()), 409);
        assertThat(cruza.path("codigo").asString()).isEqualTo("CICLO_SOBREPOSTO");
        assertThat(semHorario(cruza)).doesNotContain(hoje.minusDays(3).toString());

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

    @Test
    void titularApagaTudoMesmoDepoisDeOSexoMudar() throws Exception {
        ligarComDados();
        definirSexo("OUTRO");
        apagarTudoEConferir();
    }

    @Test
    void titularApagaTudoMesmoComOSexoRemovido() throws Exception {
        ligarComDados();
        // sexo nulo: só a própria aluna apaga o sexo (PUT /aluno/meus-dados); o PUT do treinador com sexo nulo não altera.
        Map<String, Object> semSexo = new HashMap<>();
        semSexo.put("sexo", null);
        semSexo.put("versao", api.get("/aluno/meus-dados", alunoLogin, 200).path("versao").asLong());
        api.put("/aluno/meus-dados", alunoLogin, semSexo, 200);
        assertThat(banco.queryForObject("select sexo from aluno where id = ?", String.class, aluno)).isNull();
        apagarTudoEConferir();
    }

    @Test
    void dadosApagadosPelaTitularNaoPermitemGravarDepoisSemSerFeminino() throws Exception {
        ligarComDados();
        definirSexo("MASCULINO");
        api.delete("/aluno/ciclo", alunoLogin, 204);
        JsonNode recusa = api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.toString()), 409);
        assertThat(recusa.path("codigo").asString()).isEqualTo("CICLO_INDISPONIVEL");
        JsonNode recusaDia = api.put("/aluno/ciclo/dias/" + hoje, alunoLogin,
                Map.of("id", UUID.randomUUID(), "fluxo", "LEVE"), 409);
        assertThat(recusaDia.path("codigo").asString()).isEqualTo("CICLO_INDISPONIVEL");
    }

    @Test
    void diaComIdDeOutraAlunaDaConsultoriaEhRecusadoSemMexerNaLinhaAlheia() throws Exception {
        ligarComDados();
        UUID idDoDiaDeA = banco.queryForObject("select id from ciclo_dia where aluno_id = ?", UUID.class, aluno);
        UUID registroDeA = banco.queryForObject("select id from ciclo_registro where aluno_id = ?", UUID.class, aluno);
        Map<String, Object> antes = banco.queryForMap(
                "select aluno_id, consultoria_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeA);

        UUID outraAluna = api.criarAluno(treinador, "Aluna Fictícia Ciclo B");
        JsonNode loginB = api.convidarEEntrar(treinador, outraAluna);
        definirSexo(treinador, outraAluna, "FEMININO");
        api.post("/aluno/ciclo/ativar", loginB, Map.of("consentimentoVersao", 1), 200);

        // Referência: o registro de A com a mesma situação já responde 404 "Registro não encontrado.".
        JsonNode referencia = api.post("/aluno/ciclo/registros", loginB,
                Map.of("id", registroDeA, "inicio", hoje.minusDays(1).toString()), 404);

        JsonNode recusa = api.put("/aluno/ciclo/dias/" + hoje.minusDays(1), loginB,
                Map.of("id", idDoDiaDeA, "colica", "FORTE", "observacao", "nota fictícia da aluna B"), 404);
        assertThat(recusa.path("codigo").asString()).isEqualTo(referencia.path("codigo").asString()).isEqualTo("NAO_ENCONTRADO");
        assertThat(recusa.toString()).contains("Registro não encontrado.");

        // Também na mesma data da linha alheia, que B ainda não tem.
        api.put("/aluno/ciclo/dias/" + hoje, loginB,
                Map.of("id", idDoDiaDeA, "colica", "FORTE", "observacao", "nota fictícia da aluna B"), 404);

        Map<String, Object> depois = banco.queryForMap(
                "select aluno_id, consultoria_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeA);
        assertThat(depois).isEqualTo(antes);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, outraAluna)).isZero();
    }

    @Test
    void diaComIdDeOutraConsultoriaNaoAlteraALinhaAlheia() throws Exception {
        ligarComDados();
        UUID idDoDiaDeA = banco.queryForObject("select id from ciclo_dia where aluno_id = ?", UUID.class, aluno);
        Map<String, Object> antes = banco.queryForMap(
                "select aluno_id, consultoria_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeA);

        JsonNode outroTreinador = api.novoTreinador();
        UUID alunaDeFora = api.criarAluno(outroTreinador, "Aluna Fictícia De Fora");
        JsonNode loginDeFora = api.convidarEEntrar(outroTreinador, alunaDeFora);
        definirSexo(outroTreinador, alunaDeFora, "FEMININO");
        api.post("/aluno/ciclo/ativar", loginDeFora, Map.of("consentimentoVersao", 1), 200);

        // O filtro de tenant esconde a linha de A: o 404 não é possível sem consulta sem filtro; basta não gravar nada.
        int status = statusDoPut("/aluno/ciclo/dias/" + hoje, loginDeFora,
                Map.of("id", idDoDiaDeA, "colica", "FORTE", "observacao", "nota fictícia de fora"));
        assertThat(status).isGreaterThanOrEqualTo(400);

        Map<String, Object> depois = banco.queryForMap(
                "select aluno_id, consultoria_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeA);
        assertThat(depois).isEqualTo(antes);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, alunaDeFora)).isZero();
    }

    @Test
    void diaComIdDeOutroDiaDaMesmaAlunaNaoSobrescreveOOutroDia() throws Exception {
        ligarComDados();
        UUID idDoDiaDeHoje = banco.queryForObject("select id from ciclo_dia where aluno_id = ?", UUID.class, aluno);
        Map<String, Object> antes = banco.queryForMap(
                "select aluno_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeHoje);

        JsonNode conflito = api.put("/aluno/ciclo/dias/" + hoje.minusDays(1), alunoLogin,
                Map.of("id", idDoDiaDeHoje, "colica", "FORTE", "observacao", "outro dia fictício"), 409);
        assertThat(conflito.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

        Map<String, Object> depois = banco.queryForMap(
                "select aluno_id, data, fluxo, colica, observacao, alterado_em from ciclo_dia where id = ?", idDoDiaDeHoje);
        assertThat(depois).isEqualTo(antes);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);

        // O mesmo id no mesmo dia continua idempotente e substitui o conteúdo.
        api.put("/aluno/ciclo/dias/" + hoje, alunoLogin,
                Map.of("id", idDoDiaDeHoje, "colica", "LEVE", "observacao", "mesmo dia fictício"), 200);
        assertThat(banco.queryForObject("select colica from ciclo_dia where id = ?", String.class, idDoDiaDeHoje)).isEqualTo("LEVE");
    }

    @Test
    void putDoTreinadorSemSexoNaoApagaOSexoNemDesligaOCiclo() throws Exception {
        ligarComDados();
        JsonNode ficha = api.get("/alunos/" + aluno, treinador, 200);
        api.put("/alunos/" + aluno, treinador, Map.of(
                "nome", ficha.path("nome").asString(),
                "versao", ficha.path("versao").asLong(),
                "diasAtualizacao", 20), 200);

        JsonNode depois = api.get("/alunos/" + aluno, treinador, 200);
        assertThat(depois.path("sexo").asString()).isEqualTo("FEMININO");
        assertThat(depois.path("diasAtualizacao").asInt()).isEqualTo(20);
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNotNull();
        assertThat(api.get("/alunos/" + aluno + "/ciclo", treinador, 200).path("ativo").asBoolean()).isTrue();
        assertThat(eventosDeDesligamento()).isZero();

        // Sexo presente e diferente continua desligando, uma vez.
        definirSexo("MASCULINO");
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNull();
        assertThat(eventosDeDesligamento()).isEqualTo(1);
    }

    private int eventosDeDesligamento() {
        return banco.queryForObject(
                "select count(*) from auditoria where entidade_id = ?::uuid and acao = 'CICLO_ACOMPANHAMENTO_DESATIVADO'",
                Integer.class, aluno);
    }

    /** Aluna feminina com o ciclo ligado, um registro e um dia com sintoma e observação. */
    private void ligarComDados() throws Exception {
        definirSexo("FEMININO");
        api.post("/aluno/ciclo/ativar", alunoLogin, Map.of("consentimentoVersao", 1, "duracaoHabitual", 28), 200);
        api.post("/aluno/ciclo/registros", alunoLogin,
                Map.of("id", UUID.randomUUID(), "inicio", hoje.minusDays(4).toString(), "fim", hoje.minusDays(2).toString()), 200);
        api.put("/aluno/ciclo/dias/" + hoje, alunoLogin,
                Map.of("id", UUID.randomUUID(), "fluxo", "LEVE", "sintomas", List.of("CANSACO"), "observacao", "nota fictícia"), 200);
        assertThat(banco.queryForObject("select count(*) from ciclo_registro where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, aluno)).isEqualTo(1);
    }

    private void apagarTudoEConferir() throws Exception {
        api.delete("/aluno/ciclo", alunoLogin, 204);
        assertThat(banco.queryForObject("select count(*) from ciclo_registro where aluno_id = ?", Integer.class, aluno)).isZero();
        assertThat(banco.queryForObject("select count(*) from ciclo_dia where aluno_id = ?", Integer.class, aluno)).isZero();
        assertThat(banco.queryForObject("select ciclo_ativado_em from aluno where id = ?", String.class, aluno)).isNull();
    }

    private int statusDoPut(String caminho, JsonNode login, Object corpo) throws Exception {
        try {
            return mvc.perform(put(caminho)
                            .header("X-Treinos-Cliente", "nativo")
                            .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(login))
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)))
                    .andReturn().getResponse().getStatus();
        } catch (jakarta.servlet.ServletException e) {
            return 500; // a exceção chegou ao MockMvc sem tradução: também é uma recusa, só não é bonita
        }
    }

    /**
     * O erro sem o {@code timestamp}, que é UTC: entre 21h e meia-noite de Brasília ele já traz a data de amanhã e o
     * {@code doesNotContain} da data enviada pegaria o próprio horário da resposta.
     */
    private static String semHorario(JsonNode erro) {
        ObjectNode copia = (ObjectNode) erro.deepCopy();
        copia.remove("timestamp");
        return copia.toString();
    }

    private void definirSexo(String sexo) throws Exception {
        definirSexo(treinador, aluno, sexo);
    }

    private void definirSexo(JsonNode quemEdita, UUID alvo, String sexo) throws Exception {
        JsonNode ficha = api.get("/alunos/" + alvo, quemEdita, 200);
        api.put("/alunos/" + alvo, quemEdita, Map.of(
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
