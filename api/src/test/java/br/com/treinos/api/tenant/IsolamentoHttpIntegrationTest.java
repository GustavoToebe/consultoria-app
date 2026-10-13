package br.com.treinos.api.tenant;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Seção 15.1, item 2: o treinador A não lista, lê, edita nem publica nada da consultoria B (sempre 404, para não
 * revelar que existe); o aluno só vê o que é dele; aluno em rota de treinador recebe 403.
 */
@AutoConfigureMockMvc
class IsolamentoHttpIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinadorA;
    private JsonNode treinadorB;
    private UUID alunoB;
    private String planoB;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinadorA = api.novoTreinador();
        treinadorB = api.novoTreinador();
        alunoB = api.criarAluno(treinadorB, "Aluno Fictício B");
        planoB = api.publicarTreino(treinadorB, alunoB, ApiDeTeste.treino().conteudo()).get("plano").get("id").asString();
    }

    @Test
    void treinadorANaoEnxergaNadaDaConsultoriaB() throws Exception {
        JsonNode lista = api.get("/alunos?situacao=TODOS", treinadorA, 200);
        assertThat(lista.get("itens").valueStream().map(i -> i.get("id").asString()))
                .doesNotContain(alunoB.toString());

        api.get("/alunos/" + alunoB, treinadorA, 404);
        api.put("/alunos/" + alunoB, treinadorA, Map.of("nome", "Invasor", "versao", 0), 404);
        api.patch("/alunos/" + alunoB + "/situacao", treinadorA, Map.of("ativo", false), 404);
        api.post("/alunos/" + alunoB + "/convite", treinadorA, null, 404);
        api.get("/alunos/" + alunoB + "/planos-treino", treinadorA, 404);
        api.post("/alunos/" + alunoB + "/planos-treino", treinadorA, Map.of("titulo", "Invasão"), 404);
        api.get("/alunos/" + alunoB + "/execucoes", treinadorA, 404);
        api.get("/alunos/" + alunoB + "/pesos", treinadorA, 404);

        api.get("/planos-treino/" + planoB, treinadorA, 404);
        api.get("/planos-treino/" + planoB + "/versoes/1", treinadorA, 404);
        api.put("/planos-treino/" + planoB + "/rascunho", treinadorA,
                ApiDeTeste.rascunho("Invasão", ApiDeTeste.treino().conteudo(), 0), 404);
        api.post("/planos-treino/" + planoB + "/publicar", treinadorA, Map.of("versao", 1, "confirmarAvisos", true), 404);
        api.post("/planos-treino/" + planoB + "/replicar", treinadorA, Map.of("titulo", "Cópia"), 404);
        // Copiar plano de outra consultoria para um aluno meu também não acha o plano de origem.
        UUID meuAluno = api.criarAluno(treinadorA, "Aluno Fictício A");
        api.post("/alunos/" + meuAluno + "/planos-treino", treinadorA,
                Map.of("titulo", "Cópia", "copiarDoPlanoId", planoB), 404);

        // B continua intacto.
        assertThat(api.get("/alunos/" + alunoB, treinadorB, 200).get("nome").asString()).isEqualTo("Aluno Fictício B");
    }

    @Test
    void receitasEBibliotecaSaoDeCadaConsultoria() throws Exception {
        JsonNode receitaB = api.post("/receitas", treinadorB, Map.of("tipo", "SERIES", "nome", "Receita só do B",
                "conteudo", Map.of("series", java.util.List.of(Map.of("tipo", "WS", "repsMin", 3, "repsMax", 6)))), 200);
        api.put("/receitas/" + receitaB.get("id").asString(), treinadorA, Map.of("tipo", "SERIES", "nome", "x",
                "conteudo", Map.of("series", java.util.List.of(Map.of("tipo", "WS")))), 404);
        assertThat(api.get("/receitas", treinadorA, 200).valueStream().map(r -> r.get("nome").asString()))
                .doesNotContain("Receita só do B");

        JsonNode exercicioB = api.post("/exercicios", treinadorB,
                Map.of("nome", "Exercício exclusivo do B", "modalidade", "LIVRE"), 200);
        api.put("/exercicios/" + exercicioB.get("id").asString(), treinadorA,
                Map.of("nome", "x", "modalidade", "LIVRE"), 404);
        assertThat(api.get("/exercicios", treinadorA, 200).valueStream().map(e -> e.get("nome").asString()))
                .doesNotContain("Exercício exclusivo do B");
    }

    @Test
    void questionariosDeAtualizacaoSaoDeCadaConsultoria() throws Exception {
        JsonNode qB = api.post("/questionarios", treinadorB, Map.of("nome", "Só do B", "origem", "FABRICA"), 200);
        String idB = qB.get("id").asString();
        api.post("/questionarios/" + idB + "/publicar", treinadorB,
                Map.of("versao", qB.get("versao").asLong(), "confirmarAvisos", true), 200);
        String pastaB = api.post("/alunos/" + alunoB + "/pastas", treinadorB,
                Map.of("titulo", "Pasta do B", "inicio", "2030-01-01", "fim", "2030-01-28"), 200).get("id").asString();

        api.get("/questionarios/" + idB, treinadorA, 404);
        api.put("/questionarios/" + idB, treinadorA, Map.of("nome", "x", "versao", 0,
                "conteudo", Map.of("secoes", java.util.List.of())), 404);
        api.post("/questionarios/" + idB + "/validar", treinadorA, null, 404);
        api.post("/questionarios/" + idB + "/publicar", treinadorA, Map.of("versao", 1, "confirmarAvisos", true), 404);
        api.post("/questionarios/" + idB + "/duplicar", treinadorA, null, 404);
        api.post("/questionarios/" + idB + "/padrao", treinadorA, null, 404);
        api.post("/questionarios/" + idB + "/arquivar", treinadorA, null, 404);
        api.post("/questionarios/" + idB + "/desarquivar", treinadorA, null, 404);
        api.delete("/questionarios/" + idB, treinadorA, 404);
        assertThat(api.get("/questionarios", treinadorA, 200).valueStream().map(q -> q.get("nome").asString()))
                .doesNotContain("Só do B");
        assertThat(api.get("/questionarios/opcoes", treinadorA, 200).valueStream().map(q -> q.get("id").asString()))
                .doesNotContain(idB);

        // Escolha cruzada: questionário de uma consultoria em aluno/pasta de outra, nos dois sentidos.
        UUID alunoA = api.criarAluno(treinadorA, "Aluno Fictício A");
        String pastaA = api.post("/alunos/" + alunoA + "/pastas", treinadorA,
                Map.of("titulo", "Pasta do A", "inicio", "2030-01-01", "fim", "2030-01-28"), 200).get("id").asString();
        JsonNode qA = api.post("/questionarios", treinadorA, Map.of("nome", "Só do A", "origem", "FABRICA"), 200);
        String idA = qA.get("id").asString();
        api.post("/questionarios/" + idA + "/publicar", treinadorA,
                Map.of("versao", qA.get("versao").asLong(), "confirmarAvisos", true), 200);
        api.put("/alunos/" + alunoA + "/questionario", treinadorA, Map.of("questionarioId", idB), 404);
        api.put("/pastas/" + pastaA + "/questionario", treinadorA, Map.of("questionarioId", idB), 404);
        api.put("/alunos/" + alunoB + "/questionario", treinadorA, Map.of("questionarioId", idA), 404);
        api.put("/pastas/" + pastaB + "/questionario", treinadorA, Map.of("questionarioId", idA), 404);
        api.put("/alunos/" + alunoB + "/questionario", treinadorA, new java.util.HashMap<String, Object>(), 404);
        api.put("/pastas/" + pastaB + "/questionario", treinadorA, new java.util.HashMap<String, Object>(), 404);

        // B continua intacto: nada foi escolhido nem alterado.
        assertThat(api.get("/alunos/" + alunoB, treinadorB, 200).get("questionarioId").isNull()).isTrue();
        assertThat(api.get("/questionarios/" + idB, treinadorB, 200).get("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(api.get("/alunos/" + alunoA, treinadorA, 200).get("questionarioId").isNull()).isTrue();
    }

    @Test
    void alunoNaoUsaRotaDeTreinadorESoVeOProprioPlano() throws Exception {
        JsonNode alunoLogadoB = api.convidarEEntrar(treinadorB, alunoB);
        api.get("/alunos", alunoLogadoB, 403);
        api.get("/planos-treino/" + planoB, alunoLogadoB, 403);
        api.get("/painel", alunoLogadoB, 403);
        api.get("/consultoria", alunoLogadoB, 403);

        // Aluno de outra consultoria, com plano próprio: o painel dele só mostra o plano dele.
        UUID alunoA = api.criarAluno(treinadorA, "Aluno Fictício A");
        api.publicarTreino(treinadorA, alunoA, ApiDeTeste.treino().conteudo());
        JsonNode alunoLogadoA = api.convidarEEntrar(treinadorA, alunoA);
        JsonNode painelA = api.get("/aluno/painel", alunoLogadoA, 200);
        assertThat(painelA.get("treino").get("planoId").asString()).isNotEqualTo(planoB);
        assertThat(painelA.get("marca").get("id").asString())
                .isEqualTo(treinadorA.get("marca").get("id").asString());

        // Treinador não usa rota de aluno.
        api.get("/aluno/painel", treinadorA, 403);
    }
}
