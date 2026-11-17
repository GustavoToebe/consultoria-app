package br.com.treinos.api;

import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Atalhos dos testes HTTP. Dados sempre fictícios. Requisições como cliente nativo (Bearer, sem cookie). */
public final class ApiDeTeste {

    public static final String SENHA = "senha-de-teste-123";

    private final MockMvc mvc;
    private final JsonMapper json;
    private final boolean bibliotecaAutomatica;

    public ApiDeTeste(MockMvc mvc, JsonMapper json) {
        this(mvc, json, true);
    }

    private ApiDeTeste(MockMvc mvc, JsonMapper json, boolean bibliotecaAutomatica) {
        this.mvc = mvc;
        this.json = json;
        this.bibliotecaAutomatica = bibliotecaAutomatica;
    }

    /**
     * Como este, mas sem criar na biblioteca o exercício principal que o plano enviado cita: para os testes que
     * precisam de um {@code exercicioId} que a consultoria não tem (a publicação o recusa).
     */
    public ApiDeTeste semBibliotecaAutomatica() {
        return new ApiDeTeste(mvc, json, false);
    }

    public static String emailUnico(String prefixo) {
        return prefixo + "-" + UUID.randomUUID() + "@teste.local";
    }

    /** Cadastra um treinador novo (consultoria nova) como cliente nativo e devolve a resposta de login. */
    public JsonNode cadastrarTreinador(String email) throws Exception {
        String corpo = json.writeValueAsString(new Cadastro("Consultoria " + email, "Treinador Teste", email, SENHA));
        MvcResult r = mvc.perform(MockMvcRequestBuilders.post("/auth/cadastro-treinador")
                        .header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk())
                .andReturn();
        return ler(r);
    }

    public JsonNode novoTreinador() throws Exception {
        return cadastrarTreinador(emailUnico("treinador"));
    }

    // ---- HTTP genérico ----

    public JsonNode get(String caminho, JsonNode login, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.get(caminho), login, null,
                esperado);
    }

    public JsonNode post(String caminho, JsonNode login, Object corpo, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.post(caminho), login, corpo,
                esperado);
    }

    public JsonNode put(String caminho, JsonNode login, Object corpo, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.put(caminho), login, corpo,
                esperado);
    }

    public JsonNode patch(String caminho, JsonNode login, Object corpo, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.patch(caminho), login, corpo,
                esperado);
    }

    public JsonNode delete(String caminho, JsonNode login, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.delete(caminho), login, null, esperado);
    }

    /** DELETE com corpo (o token de push vai no corpo, nunca no caminho). */
    public JsonNode delete(String caminho, JsonNode login, Object corpo, int esperado) throws Exception {
        return executar(MockMvcRequestBuilders.delete(caminho), login, corpo, esperado);
    }

    private JsonNode executar(MockHttpServletRequestBuilder req, JsonNode login, Object corpo, int esperado)
            throws Exception {
        req.header("X-Treinos-Cliente", "nativo");
        if (login != null) {
            req.header(HttpHeaders.AUTHORIZATION, bearer(login));
        }
        if (corpo != null) {
            String texto = json.writeValueAsString(corpo);
            if (bibliotecaAutomatica && login != null && texto.contains("\"sessoes\"")) {
                garantirNaBiblioteca(login, json.readTree(texto));
            }
            req.contentType(MediaType.APPLICATION_JSON).content(texto);
        }
        MvcResult r = mvc.perform(req).andExpect(status().is(esperado)).andReturn();
        String texto = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    // ---- Biblioteca de exercícios ----

    /**
     * A publicação confere o {@code exercicioId} do exercício principal contra a biblioteca da consultoria. Os testes
     * montam o treino antes de existir consultoria ({@link #treino()}, ids sorteados): ao enviar um corpo que traz
     * {@code sessoes[].exercicios[].exercicioId}, cada id vira um exercício da biblioteca da consultoria do login, com
     * esse mesmo id (o que o teste lê depois continua valendo). Só o principal: as alternativas o teste cria.
     */
    // shortcut: mascara id principal inexistente (todo teste publica); o teste de id inválido usa semBibliotecaAutomatica(), troque se os testes passarem a criar o exercício antes.
    private void garantirNaBiblioteca(JsonNode login, JsonNode corpo) {
        if (corpo.isArray()) {
            corpo.forEach(filho -> garantirNaBiblioteca(login, filho));
            return;
        }
        if (!corpo.isObject()) {
            return;
        }
        for (JsonNode sessao : corpo.path("sessoes")) {
            for (JsonNode exercicio : sessao.path("exercicios")) {
                String id = exercicio.path("exercicioId").asString(null);
                if (id != null) {
                    String nome = exercicio.path("nome").asString("Exercício de teste").strip();
                    String unico = (nome.length() > 80 ? nome.substring(0, 80) : nome) + " (" + id + ")";
                    BANCO.get().update("insert into exercicio (id, consultoria_id, nome, grupo_muscular) "
                            + "select ?::uuid, consultoria_id, ?, null from usuario where id = ?::uuid "
                            + "on conflict (id) do nothing", id, unico, login.path("usuario").path("id").asString());
                }
            }
        }
        corpo.forEach(filho -> garantirNaBiblioteca(login, filho));
    }

    /** Conexão própria ao Postgres da suíte (insere com o id escolhido, que a API não aceita no corpo). */
    private static final java.util.function.Supplier<JdbcTemplate> BANCO = new java.util.function.Supplier<>() {
        private JdbcTemplate jdbc;

        @Override
        public synchronized JdbcTemplate get() {
            if (jdbc == null) {
                jdbc = new JdbcTemplate(new DriverManagerDataSource(AbstractIntegrationTest.POSTGRES.getJdbcUrl(),
                        AbstractIntegrationTest.POSTGRES.getUsername(), AbstractIntegrationTest.POSTGRES.getPassword()));
            }
            return jdbc;
        }
    };

    /** Cria um exercício na biblioteca da consultoria do treinador (pela API) e devolve o id. */
    public UUID criarExercicio(JsonNode treinador, String nome) throws Exception {
        JsonNode e = post("/exercicios", treinador, Map.of("nome", nome, "modalidade", "MAQUINA"), 200);
        return UUID.fromString(e.get("id").asString());
    }

    // ---- Alunos e convite ----

    public UUID criarAluno(JsonNode treinador, String nome) throws Exception {
        JsonNode aluno = post("/alunos", treinador, Map.of("nome", nome), 200);
        return UUID.fromString(aluno.get("id").asString());
    }

    /** Gera o convite e aceita como o aluno; devolve o login do aluno (cliente nativo). */
    public JsonNode convidarEEntrar(JsonNode treinador, UUID alunoId) throws Exception {
        String codigo = post("/alunos/" + alunoId + "/convite", treinador, null, 200).get("codigo").asString();
        return post("/publico/convites/aceitar", null,
                Map.of("codigo", codigo, "email", emailUnico("aluno"), "senha", SENHA), 200);
    }

    // ---- Planos ----

    /** Treino válido com uids conhecidos: uma sessão de treino (segunda) e um descanso (domingo). */
    public record TreinoDeTeste(ConteudoTreino conteudo, UUID sessaoUid, UUID exercicioUid, UUID exercicioId,
                                UUID fsUid, UUID wsUid, UUID backOffUid) {
    }

    public static TreinoDeTeste treino() {
        UUID sessao = UUID.randomUUID();
        UUID exercicio = UUID.randomUUID();
        UUID exercicioId = UUID.randomUUID();
        UUID fs = UUID.randomUUID();
        UUID ws = UUID.randomUUID();
        UUID backOff = UUID.randomUUID();
        List<Serie> series = List.of(
                Serie.de(fs, "FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 50, null)),
                Serie.de(ws, "WORKING", 3, 6, Carga.de("CARGA_TRABALHO")),
                Serie.de(backOff, "BACK_OFF", 6, 8, Carga.percentual("PERCENTUAL_WS", 85, null)));
        ExercicioPlano ex = new ExercicioPlano(exercicio, exercicioId, "Remada baixa na polia", "MAQUINA",
                "https://www.youtube.com/watch?v=exemplo", null, true, "kg", series);
        ConteudoTreino c = new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(sessao, "Segunda - Costas", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
        return new TreinoDeTeste(c, sessao, exercicio, exercicioId, fs, ws, backOff);
    }

    /** Mobilidade válida com uids conhecidos: uma seção com dois itens. */
    public record MobilidadeDeTeste(Map<String, Object> conteudo, UUID secaoUid, UUID itemUid, UUID outroItemUid) {
    }

    public static MobilidadeDeTeste mobilidade() {
        UUID secao = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        UUID outro = UUID.randomUUID();
        Map<String, Object> primeiro = Map.of("uid", item, "nome", "Lunge Stretch", "prescricao", "2 x 20s");
        Map<String, Object> segundo = Map.of("uid", outro, "nome", "Gato e vaca", "prescricao", "10 repetições");
        Map<String, Object> conteudo = Map.of("orientacoes", "Todos os dias.",
                "secoes", List.of(Map.of("uid", secao, "titulo", "Alongamentos", "itens", List.of(primeiro, segundo))));
        return new MobilidadeDeTeste(conteudo, secao, item, outro);
    }

    /** Cria o plano de mobilidade, salva o conteúdo no rascunho e publica. Devolve o detalhe publicado. */
    public JsonNode publicarMobilidade(JsonNode treinador, UUID alunoId, Map<String, Object> conteudo) throws Exception {
        JsonNode plano = post("/alunos/" + alunoId + "/planos-mobilidade", treinador, Map.of("titulo", "Mobilidade de teste"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = put("/planos-mobilidade/" + id + "/rascunho", treinador,
                rascunho("Mobilidade de teste", conteudo, plano.get("plano").get("versao").asLong()), 200);
        return post("/planos-mobilidade/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
    }

    /** Cria o plano, salva o conteúdo no rascunho e publica. Devolve o detalhe publicado. */
    public JsonNode publicarTreino(JsonNode treinador, UUID alunoId, ConteudoTreino conteudo) throws Exception {
        JsonNode plano = post("/alunos/" + alunoId + "/planos-treino", treinador, Map.of("titulo", "Plano de teste"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = put("/planos-treino/" + id + "/rascunho", treinador,
                rascunho("Plano de teste", conteudo, plano.get("plano").get("versao").asLong()), 200);
        return post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
    }

    public static Map<String, Object> rascunho(String titulo, Object conteudo, long versao) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("titulo", titulo);
        corpo.put("conteudo", conteudo);
        corpo.put("versao", versao);
        return corpo;
    }

    // ---- Utilidades ----

    public JsonNode ler(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    public String corpoLogin(String email, String senha) {
        return json.writeValueAsString(new Login(email, senha));
    }

    public String paraJson(Object valor) {
        return json.writeValueAsString(valor);
    }

    public static String bearer(JsonNode login) {
        return "Bearer " + login.get("accessToken").asString();
    }

    private record Cadastro(String nomeConsultoria, String nome, String email, String senha) {
    }

    private record Login(String email, String senha) {
    }
}
