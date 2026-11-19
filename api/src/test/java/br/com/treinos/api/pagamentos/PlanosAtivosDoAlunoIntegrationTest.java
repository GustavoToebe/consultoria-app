package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Planos ativos do aluno (passo 1 de {@code docs/planos/planos-ativos-do-aluno.md}, V091): o plano comercial diz se inclui treino
 * e/ou dieta; a ficha ({@code GET /alunos/{id}}) traz {@code planosAtivos} só da contratação ATIVA, e nulo nos outros casos. O
 * financeiro desligado fica em {@link PlanosAtivosFinanceiroDesligadoIntegrationTest}. Uma consultoria por teste; dados fictícios.
 */
@AutoConfigureMockMvc
class PlanosAtivosDoAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private Map<String, Object> corpoDoPlano(Boolean treino, Boolean dieta) {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", 15_000);
        plano.put("periodicidade", "MENSAL");
        if (treino != null) plano.put("incluiTreino", treino);
        if (dieta != null) plano.put("incluiDieta", dieta);
        return plano;
    }

    private JsonNode plano(Boolean treino, Boolean dieta) throws Exception {
        return api.post("/financeiro/planos", admin, corpoDoPlano(treino, dieta), 200);
    }

    private JsonNode contratar(UUID aluno, JsonNode plano) throws Exception {
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", plano.get("id").asString());
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        return api.post("/alunos/" + aluno + "/contratacoes", admin, contratacao, 200);
    }

    private JsonNode planosAtivos(UUID aluno) throws Exception {
        JsonNode ficha = api.get("/alunos/" + aluno, admin, 200);
        assertThat(ficha.has("planosAtivos")).as("a chave vem sempre, nula ou não").isTrue();
        return ficha.get("planosAtivos");
    }

    private void confere(UUID aluno, boolean treino, boolean dieta) throws Exception {
        JsonNode p = planosAtivos(aluno);
        assertThat(p.get("incluiTreino").asBoolean()).isEqualTo(treino);
        assertThat(p.get("incluiDieta").asBoolean()).isEqualTo(dieta);
        // D4: só os dois booleanos, nunca valor nem nome do plano.
        assertThat(p.propertyNames()).containsExactlyInAnyOrder("incluiTreino", "incluiDieta");
    }

    @Test
    void contratacaoAtivaDevolveOQueOPlanoIncluiTreinoDietaOuOsDois() throws Exception {
        UUID soTreino = api.criarAluno(admin, "Aluno Fictício Só Treino");
        contratar(soTreino, plano(true, false));
        confere(soTreino, true, false);

        UUID soDieta = api.criarAluno(admin, "Aluno Fictício Só Dieta");
        contratar(soDieta, plano(false, true));
        confere(soDieta, false, true);

        UUID osDois = api.criarAluno(admin, "Aluno Fictício Os Dois");
        contratar(osDois, plano(true, true));
        confere(osDois, true, true);
    }

    @Test
    void semContratacaoPausadaOuEncerradaOCampoENulo() throws Exception {
        UUID sem = api.criarAluno(admin, "Aluno Fictício Sem Contratação");
        assertThat(planosAtivos(sem).isNull()).isTrue();

        UUID pausado = api.criarAluno(admin, "Aluno Fictício Pausado");
        JsonNode c = contratar(pausado, plano(true, false));
        confere(pausado, true, false);
        JsonNode pausada = api.post("/contratacoes/" + c.get("id").asString() + "/pausar", admin,
                Map.of("versao", c.get("versao").asLong()), 200);
        assertThat(planosAtivos(pausado).isNull()).as("pausada").isTrue();
        // Retomar volta a mostrar.
        api.post("/contratacoes/" + c.get("id").asString() + "/retomar", admin,
                Map.of("versao", pausada.get("versao").asLong()), 200);
        confere(pausado, true, false);

        UUID encerrado = api.criarAluno(admin, "Aluno Fictício Encerrado");
        JsonNode e = contratar(encerrado, plano(false, true));
        api.post("/contratacoes/" + e.get("id").asString() + "/encerrar", admin, Map.of("versao", e.get("versao").asLong()), 200);
        assertThat(planosAtivos(encerrado).isNull()).as("encerrada").isTrue();
    }

    @Test
    void editarOPlanoMudaOQueAFichaMostra() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Plano Editado");
        JsonNode plano = plano(true, true);
        contratar(aluno, plano);
        Map<String, Object> corpo = corpoDoPlano(false, true);
        corpo.put("versao", plano.get("versao").asLong());
        JsonNode editado = api.put("/financeiro/planos/" + plano.get("id").asString(), admin, corpo, 200);
        assertThat(editado.get("incluiTreino").asBoolean()).isFalse();
        assertThat(editado.get("incluiDieta").asBoolean()).isTrue();
        confere(aluno, false, true);
    }

    @Test
    void alunoDeOutraConsultoriaDa404() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício Da Outra Consultoria");
        contratar(aluno, plano(true, false));
        JsonNode outro = api.novoTreinador();
        api.get("/alunos/" + aluno, outro, 404);
    }

    @Test
    void osDoisFalsosDao422NoCampoAoCriarEAoEditarComMensagemFixa() throws Exception {
        JsonNode erro = api.post("/financeiro/planos", admin, corpoDoPlano(false, false), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("incluiTreino");
        assertThat(erro.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Marque pelo menos um: treino ou dieta.");

        JsonNode plano = plano(true, true);
        Map<String, Object> corpo = corpoDoPlano(false, false);
        corpo.put("versao", plano.get("versao").asLong());
        JsonNode erroAoEditar = api.put("/financeiro/planos/" + plano.get("id").asString(), admin, corpo, 422);
        assertThat(erroAoEditar.get("fieldErrors").get(0).get("field").asString()).isEqualTo("incluiTreino");
        // Nada mudou: o plano segue como estava.
        boolean achou = false;
        for (JsonNode p : api.get("/financeiro/planos", admin, 200)) {
            if (p.get("id").asString().equals(plano.get("id").asString())) {
                achou = true;
                assertThat(p.get("incluiTreino").asBoolean()).isTrue();
                assertThat(p.get("incluiDieta").asBoolean()).isTrue();
            }
        }
        assertThat(achou).isTrue();
    }

    @Test
    void corpoSemOsCamposIncluiTudoEUmDosDoisAusenteContaComoLigado() throws Exception {
        JsonNode semNada = plano(null, null);
        assertThat(semNada.get("incluiTreino").asBoolean()).isTrue();
        assertThat(semNada.get("incluiDieta").asBoolean()).isTrue();
        // Um desligado e o outro ausente: o ausente vale true, então passa.
        JsonNode soDietaAusente = plano(false, null);
        assertThat(soDietaAusente.get("incluiTreino").asBoolean()).isFalse();
        assertThat(soDietaAusente.get("incluiDieta").asBoolean()).isTrue();
        // Editar sem os campos também volta a "tudo incluído" (ausente = true).
        Map<String, Object> corpo = corpoDoPlano(null, null);
        corpo.put("versao", soDietaAusente.get("versao").asLong());
        JsonNode editado = api.put("/financeiro/planos/" + soDietaAusente.get("id").asString(), admin, corpo, 200);
        assertThat(editado.get("incluiTreino").asBoolean()).isTrue();
        assertThat(editado.get("incluiDieta").asBoolean()).isTrue();
    }
}
