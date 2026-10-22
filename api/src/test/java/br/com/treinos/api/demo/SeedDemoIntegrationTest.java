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

/** O seed monta exatamente o que o roteiro da demonstração usa, passando pelas validações da API. */
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

        // Treino e dieta da pasta "Plano 16" têm o período dela (a dieta já saiu "Sem período").
        String alunoId = aluno.get("id").asString();
        JsonNode pasta = api.get("/alunos/" + alunoId + "/pastas", saraiva, 200).get(0);
        for (String rota : new String[]{"planos-treino", "planos-dieta"}) {
            JsonNode planos = api.get("/alunos/" + alunoId + "/" + rota, saraiva, 200);
            assertThat(planos).isNotEmpty();
            for (JsonNode plano : planos) {
                assertThat(plano.get("inicio").asString()).as(rota + " início").isEqualTo(pasta.get("inicio").asString());
                assertThat(plano.get("fim").asString()).as(rota + " fim").isEqualTo(pasta.get("fim").asString());
            }
        }

        JsonNode alunoLogado = entrar(SeedDemo.ALUNO);
        JsonNode painel = api.get("/aluno/painel", alunoLogado, 200);
        // As instruções do Plano 16 chegam ao aluno pela metodologia do plano (a padrão do Saraiva).
        assertThat(painel.at("/configuracao/instrucoesTreino").asString()).contains("Anote a carga");
        assertThat(painel.at("/treino/conteudo/metodologia/configuracao/instrucoesTreino").asString()).contains("Anote a carga");
        JsonNode sessoes = painel.get("treino").get("conteudo").get("sessoes");
        assertThat(sessoes).hasSize(8);
        assertThat(sessoes.get(3).get("nome").asString()).isEqualTo("Quinta - Off ativo");
        assertThat(sessoes.get(3).get("cardio").asString()).startsWith("Cardio 50 min");
        assertThat(sessoes.get(7).get("tipo").asString()).isEqualTo("ACESSORIOS");
        JsonNode remada = sessoes.get(0).get("exercicios").get(0);
        assertThat(remada.get("series")).hasSize(7);
        assertThat(remada.at("/series/4/intensidade/rir").asInt()).isZero();
        // Última carga de trabalho da remada: a da semana passada (42,5 kg).
        assertThat(painel.get("ultimasCargas").get(remada.get("exercicioId").asString()).get("carga").decimalValue())
                .isEqualByComparingTo("42.5");
        JsonNode pastas = api.get("/alunos/" + alunoId + "/pastas", saraiva, 200);
        JsonNode exemplos = java.util.stream.StreamSupport.stream(pastas.spliterator(), false)
                .filter(p -> p.get("titulo").asString().equals("Exemplos do PDF (22/10)")).findFirst().orElseThrow();
        JsonNode pacoteExemplos = api.get("/aluno/pastas/" + exemplos.get("id").asString(), alunoLogado, 200);
        JsonNode linhas = pacoteExemplos.at("/treino/conteudo/sessoes/0/exercicios");
        assertThat(linhas).hasSize(11);
        assertThat(linhas.get(7).at("/series/0/tecnica/pausas").asInt()).isEqualTo(2);
        assertThat(linhas.get(8).at("/series/1/tecnica/blocos")).hasSize(2);
        assertThat(linhas.get(8).at("/series/1/repsMin").asInt()).isEqualTo(6);
        assertThat(linhas.get(9).at("/series/1/tecnica/pausaRespiracoes").asInt()).isEqualTo(5);
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
