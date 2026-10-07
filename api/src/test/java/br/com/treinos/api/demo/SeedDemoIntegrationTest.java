package br.com.treinos.api.demo;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** O seed monta exatamente o que o roteiro da seção 18 usa, passando pelas validações da API. */
@AutoConfigureMockMvc
class SeedDemoIntegrationTest extends AbstractIntegrationTest {

    private static final String SENHA = "senha-da-demo-123";

    @Autowired
    private SeedDemo seed;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    @Test
    void seedCriaAsDuasConsultoriasIsoladas() throws Exception {
        assertThatThrownBy(() -> seed.criar("curta")).isInstanceOf(IllegalStateException.class);
        seed.criar(SENHA);
        ApiDeTeste api = new ApiDeTeste(mvc, json);

        JsonNode saraiva = entrar(SeedDemo.SARAIVA);
        assertThat(saraiva.get("marca").get("nome").asString()).isEqualTo("SARAIVA TEAM");
        assertThat(saraiva.get("marca").get("fonteTitulo").asString()).isEqualTo("METAL");
        JsonNode alunos = api.get("/alunos", saraiva, 200);
        assertThat(alunos.get("total").asLong()).isEqualTo(1);
        JsonNode aluno = alunos.get("itens").get(0);
        assertThat(aluno.get("nome").asString()).isEqualTo("Aluno Demonstração");
        assertThat(aluno.get("planoAtivo").get("titulo").asString()).isEqualTo("Plano 16");
        assertThat(aluno.get("temAcesso").asBoolean()).isTrue();
        assertThat(api.get("/alunos/" + aluno.get("id").asString() + "/pesos", saraiva, 200)).hasSize(4);
        assertThat(api.get("/consultoria", saraiva, 200).get("configuracao").get("instrucoesTreino").asString())
                .contains("Feeder Set");

        JsonNode alunoLogado = entrar(SeedDemo.ALUNO);
        JsonNode painel = api.get("/aluno/painel", alunoLogado, 200);
        JsonNode sessoes = painel.get("treino").get("conteudo").get("sessoes");
        assertThat(sessoes).hasSize(8);
        assertThat(sessoes.get(3).get("nome").asString()).isEqualTo("Quinta - Off ativo");
        assertThat(sessoes.get(3).get("cardio").asString()).startsWith("Cardio 50 min");
        assertThat(sessoes.get(7).get("tipo").asString()).isEqualTo("ACESSORIOS");
        JsonNode remada = sessoes.get(0).get("exercicios").get(0);
        assertThat(remada.get("series")).hasSize(7);
        assertThat(remada.get("observacao").asString()).contains("Máquina: até a falha");
        // Última carga de trabalho da remada: a da semana passada (42,5 kg).
        assertThat(painel.get("ultimasCargas").get(remada.get("exercicioId").asString()).get("carga").decimalValue())
                .isEqualByComparingTo("42.5");
        JsonNode dieta = api.get("/aluno/dieta", alunoLogado, 200).get("dieta");
        assertThat(dieta.get("conteudo").get("refeicoes")).hasSize(5);
        assertThat(dieta.get("conteudo").get("suplementacao")).isEmpty();

        JsonNode exemplo = entrar(SeedDemo.EXEMPLO);
        assertThat(exemplo.get("marca").get("temaPadrao").asString()).isEqualTo("CLARO");
        JsonNode alunosExemplo = api.get("/alunos", exemplo, 200);
        assertThat(alunosExemplo.get("total").asLong()).isEqualTo(1);
        assertThat(alunosExemplo.get("itens").get(0).get("nome").asString()).isEqualTo("Aluno Exemplo");
        api.get("/alunos/" + aluno.get("id").asString(), exemplo, 404);
        assertThat(api.get("/aluno/painel", entrar(SeedDemo.ALUNO2), 200).get("treino").get("titulo").asString())
                .isEqualTo("ABC");
    }

    private JsonNode entrar(String email) throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        return api.ler(mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(api.corpoLogin(email, SENHA)))
                .andExpect(status().isOk()).andReturn());
    }
}
