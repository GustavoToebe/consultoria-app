package br.com.treinos.api.execucao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** {@code GET /aluno/pesos}: o aluno vê só os próprios pesos, nunca os de outro aluno ou de outra consultoria. */
@AutoConfigureMockMvc
class PesosDoAlunoIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    @Test
    void alunoVeSoOsProprioPesosENadaDeOutraConsultoria() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        JsonNode treinador = api.novoTreinador();
        UUID alunoA = api.criarAluno(treinador, "Aluna A Fictícia");
        UUID alunoB = api.criarAluno(treinador, "Aluno B Fictício");
        api.post("/alunos/" + alunoA + "/pesos", treinador, Map.of("data", hoje.minusDays(3).toString(), "pesoKg", 61.5), 200);
        api.post("/alunos/" + alunoA + "/pesos", treinador, Map.of("data", hoje.toString(), "pesoKg", 61.0), 200);
        api.post("/alunos/" + alunoB + "/pesos", treinador, Map.of("data", hoje.toString(), "pesoKg", 99.9), 200);
        JsonNode loginA = api.convidarEEntrar(treinador, alunoA);
        JsonNode loginB = api.convidarEEntrar(treinador, alunoB);

        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoC = api.criarAluno(outroTreinador, "Aluna C Fictícia");
        JsonNode loginC = api.convidarEEntrar(outroTreinador, alunoC);

        JsonNode doA = api.get("/aluno/pesos", loginA, 200);
        assertThat(doA).hasSize(2);
        assertThat(doA.get(0).get("pesoKg").decimalValue()).isEqualByComparingTo("61.0");
        assertThat(doA.get(1).get("pesoKg").decimalValue()).isEqualByComparingTo("61.5");

        JsonNode doB = api.get("/aluno/pesos", loginB, 200);
        assertThat(doB).hasSize(1);
        assertThat(doB.get(0).get("pesoKg").decimalValue()).isEqualByComparingTo("99.9");

        assertThat(api.get("/aluno/pesos", loginC, 200)).isEmpty();
    }

    @Test
    void observacaoDaEquipeNaoChegaAoAlunoMasContinuaNaRotaDaEquipe() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

        JsonNode treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluna Observada Fictícia");
        api.post("/alunos/" + aluno + "/pesos", treinador,
                Map.of("data", hoje.toString(), "pesoKg", 60.0, "observacao", "Anotação fictícia da equipe"), 200);
        JsonNode login = api.convidarEEntrar(treinador, aluno);

        JsonNode daEquipe = api.get("/alunos/" + aluno + "/pesos", treinador, 200);
        assertThat(daEquipe).hasSize(1);
        assertThat(daEquipe.get(0).get("observacao").asString()).isEqualTo("Anotação fictícia da equipe");

        JsonNode doAluno = api.get("/aluno/pesos", login, 200);
        assertThat(doAluno).hasSize(1);
        assertThat(doAluno.get(0).get("pesoKg").decimalValue()).isEqualByComparingTo("60.0");
        assertThat(doAluno.get(0).get("observacao").isNull()).isTrue();
    }

    @Test
    void semTokenEComTokenDeTreinadorNaoPassa() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode treinador = api.novoTreinador();

        api.get("/aluno/pesos", null, 401);
        api.get("/aluno/pesos", treinador, 403);
    }
}
