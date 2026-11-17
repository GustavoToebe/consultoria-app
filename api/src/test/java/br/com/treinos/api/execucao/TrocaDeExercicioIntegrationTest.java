package br.com.treinos.api.execucao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Alternativa;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Trocar exercício "só hoje" (plano {@code docs/planos/trocar-exercicio.md}, opção A: a troca vive na série, sem tabela):
 * alternativas na versão publicada, série aceita só com uma alternativa da versão e a rota do treinador.
 * Exercícios fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class TrocaDeExercicioIntegrationTest extends AbstractIntegrationTest {

    private static final String VIDEO_DA_BIBLIOTECA = "https://www.youtube.com/watch?v=biblioteca";
    private static final String VIDEO_FORJADO = "https://www.youtube.com/watch?v=forjado";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    private UUID principalId;
    private UUID alternativaId;
    private UUID outraAlternativaId;
    private UUID foraDoPlanoId;
    private String nomeDaAlternativa;
    private UUID sessaoUid;
    private UUID exercicioUid;
    private UUID fsUid;
    private UUID wsUid;
    private UUID backOffUid;
    private String versaoId;
    private JsonNode publicada;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        principalId = novoExercicio("Principal fictício", "MAQUINA");
        nomeDaAlternativa = "Alternativa fictícia " + UUID.randomUUID();
        alternativaId = novoExercicio(nomeDaAlternativa, "LIVRE");
        outraAlternativaId = novoExercicio("Outra alternativa fictícia", "LIVRE");
        foraDoPlanoId = novoExercicio("Fora do plano fictício", "LIVRE");
        alunoId = api.criarAluno(treinador, "Aluno Fictício");
        sessaoUid = UUID.randomUUID();
        exercicioUid = UUID.randomUUID();
        fsUid = UUID.randomUUID();
        wsUid = UUID.randomUUID();
        backOffUid = UUID.randomUUID();
        publicada = api.publicarTreino(treinador, alunoId, conteudo(List.of(
                new Alternativa(alternativaId, "Nome forjado pelo cliente", VIDEO_FORJADO),
                new Alternativa(outraAlternativaId, "Outra", null))));
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void versaoPublicadaTrazNomeEVideoDasAlternativasDaBibliotecaENaoDoCliente() throws Exception {
        JsonNode ex = api.get("/aluno/painel", aluno, 200).get("treino").get("conteudo").get("sessoes").get(0)
                .get("exercicios").get(0);
        JsonNode alternativas = ex.get("alternativas");
        assertThat(alternativas).hasSize(2);
        assertThat(alternativas.get(0).get("exercicioId").asString()).isEqualTo(alternativaId.toString());
        assertThat(alternativas.get(0).get("nome").asString()).isEqualTo(nomeDaAlternativa);
        assertThat(alternativas.get(0).get("videoUrl").asString()).isNotEqualTo(VIDEO_FORJADO).contains("biblioteca");
    }

    @Test
    void validacaoRecusaAlternativaForaDaBibliotecaIgualAoPrincipalERepetida() throws Exception {
        UUID aluno2 = api.criarAluno(treinador, "Outro Aluno Fictício");
        JsonNode plano = api.post("/alunos/" + aluno2 + "/planos-treino", treinador, Map.of("titulo", "Plano de teste"), 200);
        String id = plano.get("plano").get("id").asString();
        api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano de teste", conteudo(List.of(
                new Alternativa(UUID.randomUUID(), "Não existe", null),
                new Alternativa(principalId, "Igual ao principal", null),
                new Alternativa(alternativaId, "Boa", null),
                new Alternativa(alternativaId, "Repetida", null))), plano.get("plano").get("versao").asLong()), 200);
        List<String> caminhos = api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros")
                .valueStream().map(e -> e.get("caminho").asString()).toList();
        String base = "sessoes[0].exercicios[0].alternativas[";
        assertThat(caminhos).contains(base + "0].exercicioId", base + "1].exercicioId", base + "3].exercicioId")
                .doesNotContain(base + "2].exercicioId");
    }

    @Test
    void trocaAceitaGravaAAlternativaReenvioNaoDuplicaEDesfazerVoltaAoPrincipal() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        Map<String, Object> r = registro(id, wsUid, "40", 8, quando);
        r.put("exercicioId", alternativaId.toString());

        assertThat(situacoes(enviar(List.of(r)))).containsExactly("ACEITO");
        assertThat(situacoes(enviar(List.of(r)))).containsExactly("IGNORADO_ANTIGO");
        assertThat(contar()).isEqualTo(1);
        Map<String, Object> linha = jdbc.queryForMap(
                "select exercicio_id, serie_trabalho from execucao_serie where id = ?", id);
        assertThat(linha.get("exercicio_id")).isEqualTo(alternativaId);
        assertThat(linha.get("serie_trabalho")).isEqualTo(true);

        // A última carga e o "Anterior" seguem a alternativa, e o principal não herda a carga da troca.
        JsonNode painel = api.get("/aluno/painel", aluno, 200);
        assertThat(painel.get("ultimasCargas").has(alternativaId.toString())).isTrue();
        assertThat(painel.get("ultimasCargas").has(principalId.toString())).isFalse();

        // O histórico do treinador mostra o nome da alternativa.
        JsonNode exercicio = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200).get(0).get("sessoes").get(0)
                .get("exercicios").get(0);
        assertThat(exercicio.get("exercicioId").asString()).isEqualTo(alternativaId.toString());
        assertThat(exercicio.get("nome").asString()).isEqualTo(nomeDaAlternativa);

        // Desfazer a troca: mesmo registro, mais novo, com o exercício do plano.
        Map<String, Object> volta = registro(id, wsUid, "40", 8, quando.plusSeconds(60));
        volta.put("exercicioId", principalId.toString());
        assertThat(situacoes(enviar(List.of(volta)))).containsExactly("ACEITO");
        assertThat(jdbc.queryForObject("select exercicio_id from execucao_serie where id = ?", UUID.class, id))
                .isEqualTo(principalId);
        assertThat(contar()).isEqualTo(1);
    }

    @Test
    void recordeDaSemanaDaSerieTrocadaTrazONomeDaAlternativa() throws Exception {
        Map<String, Object> antes = registro(UUID.randomUUID(), wsUid, "40", 8, Instant.now());
        antes.put("exercicioId", alternativaId.toString());
        antes.put("data", hoje.minusDays(20).toString());
        Map<String, Object> agora = registro(UUID.randomUUID(), wsUid, "50", 8, Instant.now());
        agora.put("exercicioId", alternativaId.toString());
        assertThat(situacoes(enviar(List.of(antes, agora)))).containsExactly("ACEITO", "ACEITO");

        JsonNode r = api.get("/alunos/" + alunoId + "/recordes/semana", treinador, 200).get("series").get(0);
        assertThat(r.get("exercicioId").asString()).isEqualTo(alternativaId.toString());
        assertThat(r.get("exercicioNome").asString()).isEqualTo(nomeDaAlternativa);
    }

    /**
     * Desmarcar série trocada (plano treino-do-aluno-lacunas-cbum, D4): o mesmo registro volta com {@code concluida=false}
     * e o {@code exercicioId} da alternativa; o último {@code alteradoNoAparelhoEm} vence, o atrasado é
     * {@code IGNORADO_ANTIGO} e a troca deixa de aparecer ao treinador (só conta série concluída).
     */
    @Test
    void desmarcarSerieTrocadaEOMesmoRegistroMantemAAlternativaOUltimoVenceEIdempotente() throws Exception {
        UUID id = UUID.randomUUID();
        Instant quando = Instant.now();
        Map<String, Object> marcada = registro(id, wsUid, "40", 8, quando);
        marcada.put("exercicioId", alternativaId.toString());
        assertThat(situacoes(enviar(List.of(marcada)))).containsExactly("ACEITO");

        Map<String, Object> desmarcada = registro(id, wsUid, "40", 8, quando.plusSeconds(60));
        desmarcada.put("exercicioId", alternativaId.toString());
        desmarcada.put("concluida", false);
        assertThat(situacoes(enviar(List.of(desmarcada)))).containsExactly("ACEITO");
        assertLinhaDaSerie(id, false);

        // Reenviar o desmarcar é idempotente, e a marcação atrasada não o desfaz.
        assertThat(situacoes(enviar(List.of(desmarcada)))).containsExactly("IGNORADO_ANTIGO");
        assertThat(situacoes(enviar(List.of(marcada)))).containsExactly("IGNORADO_ANTIGO");
        assertLinhaDaSerie(id, false);

        // Série não concluída não é troca para o treinador.
        assertThat(api.get("/alunos/" + alunoId + "/trocas-de-exercicio", treinador, 200).get("trocas")).isEmpty();

        // Marcar de novo, mais novo, vence e a troca volta a aparecer.
        Map<String, Object> remarcada = registro(id, wsUid, "40", 8, quando.plusSeconds(120));
        remarcada.put("exercicioId", alternativaId.toString());
        assertThat(situacoes(enviar(List.of(remarcada)))).containsExactly("ACEITO");
        assertLinhaDaSerie(id, true);
        assertThat(api.get("/alunos/" + alunoId + "/trocas-de-exercicio", treinador, 200).get("trocas")).hasSize(1);
    }

    private void assertLinhaDaSerie(UUID id, boolean concluida) {
        Map<String, Object> linha = jdbc.queryForMap("select exercicio_id, concluida from execucao_serie where id = ?", id);
        assertThat(linha.get("concluida")).isEqualTo(concluida);
        assertThat(linha.get("exercicio_id")).isEqualTo(alternativaId);
        assertThat(contar()).isEqualTo(1);
    }

    @Test
    void serieComExercicioQueNaoEAlternativaDaVersaoERecusada() throws Exception {
        // Aleatório, da biblioteca mas fora das alternativas do plano: nenhum vira o exercício da série.
        for (UUID intruso : List.of(UUID.randomUUID(), foraDoPlanoId)) {
            UUID id = UUID.randomUUID();
            Map<String, Object> r = registro(id, wsUid, "40", 8, Instant.now());
            r.put("exercicioId", intruso.toString());
            JsonNode resposta = enviar(List.of(r));
            assertThat(situacoes(resposta)).containsExactly("RECUSADO");
            assertThat(resposta.get("resultados").get(0).get("motivo").asString()).isNotBlank();
            assertThat(jdbc.queryForObject("select count(*) from execucao_serie where id = ?", Integer.class, id)).isZero();
        }
        assertThat(contar()).isZero();
    }

    @Test
    void alternativaDeUmaVersaoNaoValeNaVersaoSeguinteSemEla() throws Exception {
        // Republica sem alternativas: o registro novo da versão nova com a antiga alternativa é recusado, e o da antiga segue valendo.
        String planoId = publicada.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano de teste", conteudo(List.of()), publicada.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + planoId + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        String novaVersao = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
        assertThat(novaVersao).isNotEqualTo(versaoId);

        Map<String, Object> naNova = registro(UUID.randomUUID(), wsUid, "40", 8, Instant.now());
        naNova.put("planoVersaoId", novaVersao);
        naNova.put("exercicioId", alternativaId.toString());
        assertThat(situacoes(enviar(List.of(naNova)))).containsExactly("RECUSADO");

        Map<String, Object> naAntiga = registro(UUID.randomUUID(), wsUid, "40", 8, Instant.now());
        naAntiga.put("exercicioId", alternativaId.toString());
        assertThat(situacoes(enviar(List.of(naAntiga)))).containsExactly("ACEITO");
    }

    @Test
    void treinadorVeATrocaNaJanelaELeDaSerie() throws Exception {
        String url = "/alunos/" + alunoId + "/trocas-de-exercicio";
        assertThat(api.get(url, treinador, 200).get("trocas")).isEmpty();

        // Duas séries do exercício trocado e uma sem troca (ou do mesmo exercício): conta só a troca.
        Map<String, Object> fs = registro(UUID.randomUUID(), fsUid, "20", 3, Instant.now());
        fs.put("exercicioId", alternativaId.toString());
        Map<String, Object> ws = registro(UUID.randomUUID(), wsUid, "40", 8, Instant.now());
        ws.put("exercicioId", alternativaId.toString());
        Map<String, Object> backOff = registro(UUID.randomUUID(), backOffUid, "30", 6, Instant.now());
        assertThat(situacoes(enviar(List.of(fs, ws, backOff)))).containsOnly("ACEITO");

        JsonNode resposta = api.get(url, treinador, 200);
        assertThat(resposta.get("ate").asString()).isEqualTo(hoje.toString());
        assertThat(resposta.get("de").asString()).isEqualTo(hoje.minusDays(6).toString());
        assertThat(resposta.get("trocas")).hasSize(1);
        JsonNode troca = resposta.get("trocas").get(0);
        assertThat(troca.get("data").asString()).isEqualTo(hoje.toString());
        assertThat(troca.get("planoVersaoId").asString()).isEqualTo(versaoId);
        assertThat(troca.get("sessaoUid").asString()).isEqualTo(sessaoUid.toString());
        assertThat(troca.get("exercicioUid").asString()).isEqualTo(exercicioUid.toString());
        assertThat(troca.get("principal").get("exercicioId").asString()).isEqualTo(principalId.toString());
        assertThat(troca.get("alternativa").get("exercicioId").asString()).isEqualTo(alternativaId.toString());
        assertThat(troca.get("alternativa").get("nome").asString()).isEqualTo(nomeDaAlternativa);
        assertThat(troca.get("series").asInt()).isEqualTo(2);
        // Só nomes: nada de carga, repetição ou observação.
        assertThat(resposta.toString()).doesNotContain("carga").doesNotContain("repeticoes").doesNotContain("observacao");

        // Janela explícita fora do dia da troca não a traz.
        assertThat(api.get(url + "?de=" + hoje.minusDays(10) + "&ate=" + hoje.minusDays(5), treinador, 200).get("trocas"))
                .isEmpty();
    }

    @Test
    void janelaInvalidaDa400() throws Exception {
        String url = "/alunos/" + alunoId + "/trocas-de-exercicio";
        api.get(url + "?de=" + hoje + "&ate=" + hoje.minusDays(1), treinador, 400);
        api.get(url + "?de=" + hoje.minusDays(31) + "&ate=" + hoje, treinador, 400);
        assertThat(api.get(url + "?de=" + hoje.minusDays(30) + "&ate=" + hoje, treinador, 200).get("trocas")).isEmpty();
    }

    @Test
    void rotaExigeRegistroLerEAlunoDeOutraConsultoriaDa404() throws Exception {
        String url = "/alunos/" + alunoId + "/trocas-de-exercicio";
        api.get(url, membro(Set.of("ALUNO_LER")), 403);
        assertThat(api.get(url, membro(Set.of("REGISTRO_LER", "ALUNO_LER")), 200).get("trocas")).isEmpty();
        api.get(url, api.novoTreinador(), 404);
        // O próprio aluno não usa a rota do treinador.
        api.get(url, aluno, 403);
    }

    // ---- Apoio ----

    private ConteudoTreino conteudo(List<Alternativa> alternativas) {
        List<Serie> series = List.of(
                Serie.de(fsUid, "FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 50, null)),
                Serie.de(wsUid, "WORKING", 3, 6, Carga.de("CARGA_TRABALHO")),
                Serie.de(backOffUid, "BACK_OFF", 6, 8, Carga.percentual("PERCENTUAL_WS", 85, null)));
        ExercicioPlano ex = new ExercicioPlano(exercicioUid, principalId, "Principal fictício", "MAQUINA", null, null,
                true, "kg", series).comAlternativas(alternativas);
        return new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(sessaoUid, "Segunda - Costas", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
    }

    private UUID novoExercicio(String nome, String modalidade) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("modalidade", modalidade);
        corpo.put("videoUrl", VIDEO_DA_BIBLIOTECA);
        return UUID.fromString(api.post("/exercicios", treinador, corpo, 200).get("id").asString());
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private Map<String, Object> registro(UUID id, UUID serieUid, String carga, Integer reps, Instant quando) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", sessaoUid.toString());
        r.put("exercicioUid", exercicioUid.toString());
        r.put("serieUid", serieUid.toString());
        r.put("data", hoje.toString());
        r.put("carga", carga);
        r.put("repeticoes", reps);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", quando.toString());
        return r;
    }

    private JsonNode enviar(List<Map<String, Object>> registros) throws Exception {
        return api.post("/aluno/execucoes/lote", aluno, Map.of("registros", registros), 200);
    }

    private static List<String> situacoes(JsonNode resposta) {
        return resposta.get("resultados").valueStream().map(r -> r.get("situacao").asString()).toList();
    }

    private int contar() {
        Integer n = jdbc.queryForObject("select count(*) from execucao_serie where aluno_id = ?", Integer.class, alunoId);
        return n == null ? 0 : n;
    }
}
