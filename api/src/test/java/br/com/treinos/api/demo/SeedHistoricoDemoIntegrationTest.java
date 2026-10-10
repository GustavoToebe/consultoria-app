package br.com.treinos.api.demo;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.receitas.Receita;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O histórico da demonstração passa pelas validações da API. Os modelos do guia são recriados aqui em versão mínima
 * (mesmos nomes, conteúdo pequeno); o conteúdo real vem do {@code scripts/demo/popular-modelos.mjs}.
 */
@AutoConfigureMockMvc
class SeedHistoricoDemoIntegrationTest extends AbstractIntegrationTest {

    private static final String SENHA_ALUNOS = "senha-dos-alunos-123";

    @Autowired
    private SeedHistoricoDemo seed;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    @Test
    void semOsModelosDoGuiaFalhaListandoOQueFalta() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        String email = ApiDeTeste.emailUnico("sem-modelos");
        JsonNode treinador = api.cadastrarTreinador(email);

        assertThatThrownBy(() -> seed.criar(email, SENHA_ALUNOS))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("popular-modelos.mjs")
                .hasMessageContaining("Full Body (5 treinos)");
        assertThat(api.get("/alunos", treinador, 200).get("total").asLong()).isZero();
    }

    @Test
    void criaDezAlunosComCincoPastasCadaUmEIsolaDeOutraConsultoria() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        String email = ApiDeTeste.emailUnico("treinador-historico");
        JsonNode treinador = api.cadastrarTreinador(email);
        criarModelosMinimos(api, treinador);

        SeedHistoricoDemo.Resultado r = seed.criar(email, SENHA_ALUNOS);

        assertThat(r.alunos()).isEqualTo(10);
        assertThat(r.pastas()).isEqualTo(50);
        assertThat(r.execucoes()).isGreaterThan(200);
        JsonNode alunos = api.get("/alunos?tamanho=50", treinador, 200);
        assertThat(alunos.get("total").asLong()).isEqualTo(10);

        int comMobilidade = 0;
        int comLesao = 0;
        for (JsonNode a : alunos.get("itens")) {
            String id = a.get("id").asString();
            assertThat(a.get("temAcesso").asBoolean()).isTrue();
            assertThat(a.get("planoAtivo").get("titulo").asString()).startsWith("Treino ");
            JsonNode pastas = api.get("/alunos/" + id + "/pastas", treinador, 200);
            assertThat(pastas).hasSize(5);
            confereTodosOsPlanosNoPeriodoDaPasta(api, treinador, id, pastas);
            long concluidas = pastas.valueStream().filter(p -> !p.path("concluidaEm").isNull()).count();
            assertThat(concluidas).isEqualTo(4);
            assertThat(api.get("/alunos/" + id + "/pesos", treinador, 200).size()).isGreaterThan(20);
            assertThat(api.get("/alunos/" + id + "/atualizacoes", treinador, 200).size()).isGreaterThanOrEqualTo(4);
            if (api.get("/alunos/" + id + "/planos-mobilidade", treinador, 200).size() > 0) {
                comMobilidade++;
            }
            if (api.get("/alunos/" + id + "/lesoes", treinador, 200).size() > 0) {
                comLesao++;
            }
        }
        assertThat(comMobilidade).isEqualTo(4);
        assertThat(comLesao).isEqualTo(3);

        // Pasta atual de cada situação, vista pelo treinador.
        assertThat(api.get("/atualizacoes?situacao=PARA_REVISAR", treinador, 200)).hasSize(1);
        assertThat(api.get("/atualizacoes?situacao=ATRASADAS", treinador, 200)).hasSize(1);
        assertThat(api.get("/atualizacoes?situacao=PROXIMAS", treinador, 200)).hasSize(3);

        // O aluno de demonstração entra com a senha dada e vê o plano da pasta atual.
        JsonNode login = entrar("aluno01@demo.local");
        JsonNode painel = api.get("/aluno/painel", login, 200);
        assertThat(painel.get("treino").get("conteudo").get("sessoes")).isNotEmpty();
        assertThat(api.get("/aluno/pesos", login, 200).size()).isGreaterThan(20);

        // Rodar de novo não duplica.
        assertThat(seed.criar(email, SENHA_ALUNOS)).isNull();
        assertThat(api.get("/alunos?tamanho=50", treinador, 200).get("total").asLong()).isEqualTo(10);

        // Outra consultoria não vê nada disso.
        JsonNode outro = api.novoTreinador();
        assertThat(api.get("/alunos", outro, 200).get("total").asLong()).isZero();
        String idDeOutra = alunos.get("itens").get(0).get("id").asString();
        api.get("/alunos/" + idDeOutra, outro, 404);
    }

    /** Treino, dieta e mobilidade de uma pasta têm o mesmo período dela (a dieta já saiu "Sem período" na demonstração). */
    private static void confereTodosOsPlanosNoPeriodoDaPasta(ApiDeTeste api, JsonNode treinador, String alunoId,
                                                             JsonNode pastas) throws Exception {
        for (String rota : List.of("planos-treino", "planos-dieta", "planos-mobilidade")) {
            for (JsonNode plano : api.get("/alunos/" + alunoId + "/" + rota, treinador, 200)) {
                JsonNode pasta = pastas.valueStream()
                        .filter(p -> p.get("id").asString().equals(plano.path("pastaId").asString()))
                        .findFirst().orElseThrow(() -> new AssertionError(rota + " sem pasta: " + plano.get("titulo")));
                assertThat(plano.get("inicio").asString()).as("%s %s: início", rota, plano.get("titulo"))
                        .isEqualTo(pasta.get("inicio").asString());
                assertThat(plano.get("fim").asString()).as("%s %s: fim", rota, plano.get("titulo"))
                        .isEqualTo(pasta.get("fim").asString());
            }
        }
    }

    private JsonNode entrar(String email) throws Exception {
        String corpo = json.writeValueAsString(Map.of("email", email, "senha", SENHA_ALUNOS));
        String resposta = mvc.perform(post("/auth/login").header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(resposta);
    }

    // ---- Modelos mínimos com os nomes do guia ----

    private void criarModelosMinimos(ApiDeTeste api, JsonNode treinador) throws Exception {
        List<Object[]> modelos = new ArrayList<>();
        for (String nome : SeedHistoricoDemo.MODELOS_NECESSARIOS.get(Receita.Tipo.PLANO_TREINO)) {
            modelos.add(new Object[]{"PLANO_TREINO", nome, ApiDeTeste.treino().conteudo()});
        }
        for (String nome : SeedHistoricoDemo.MODELOS_NECESSARIOS.get(Receita.Tipo.PLANO_DIETA)) {
            modelos.add(new Object[]{"PLANO_DIETA", nome, dieta()});
        }
        for (String nome : SeedHistoricoDemo.MODELOS_NECESSARIOS.get(Receita.Tipo.METODOLOGIA)) {
            modelos.add(new Object[]{"METODOLOGIA", nome, ConfiguracaoConsultoria.padrao()});
        }
        for (String nome : SeedHistoricoDemo.MODELOS_NECESSARIOS.get(Receita.Tipo.MOBILIDADE)) {
            modelos.add(new Object[]{"MOBILIDADE", nome, mobilidade()});
        }
        for (Object[] m : modelos) {
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("tipo", m[0]);
            corpo.put("nome", m[1]);
            corpo.put("descricao", "Modelo mínimo do teste.");
            corpo.put("conteudo", m[2]);
            api.post("/receitas", treinador, corpo, 200);
        }
    }

    private static ConteudoDieta dieta() {
        Item arroz = new Item(UUID.randomUUID(), null, "Arroz branco cozido", new BigDecimal("100"), "g",
                new BigDecimal("128"), new BigDecimal("2.5"), new BigDecimal("28"), new BigDecimal("0.2"), false);
        return new ConteudoDieta("Objetivo fictício", null, null, List.of(new Refeicao(UUID.randomUUID(), "Almoço", null,
                null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(arroz))))), List.of(), null, List.of());
    }

    private static ConteudoMobilidade mobilidade() {
        return new ConteudoMobilidade(null, List.of(new ConteudoMobilidade.Secao(UUID.randomUUID(), "Sequência",
                List.of(new ConteudoMobilidade.Item(UUID.randomUUID(), "Gato-vaca", "2x10", null)))));
    }
}
