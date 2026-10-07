package br.com.treinos.api;

import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.springframework.http.HttpHeaders;
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

    public ApiDeTeste(MockMvc mvc, JsonMapper json) {
        this.mvc = mvc;
        this.json = json;
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

    private JsonNode executar(MockHttpServletRequestBuilder req, JsonNode login, Object corpo, int esperado)
            throws Exception {
        req.header("X-Treinos-Cliente", "nativo");
        if (login != null) {
            req.header(HttpHeaders.AUTHORIZATION, bearer(login));
        }
        if (corpo != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo));
        }
        MvcResult r = mvc.perform(req).andExpect(status().is(esperado)).andReturn();
        String texto = r.getResponse().getContentAsString(StandardCharsets.UTF_8);
        return texto.isBlank() ? json.nullNode() : json.readTree(texto);
    }

    // ---- Alunos e convite ----

    public UUID criarAluno(JsonNode treinador, String nome) throws Exception {
        JsonNode aluno = post("/alunos", treinador, Map.of("nome", nome), 200);
        return UUID.fromString(aluno.get("id").asString());
    }

    /** Gera o convite e aceita como o aluno; devolve o login do aluno (cliente nativo). */
    public JsonNode convidarEEntrar(JsonNode treinador, UUID alunoId) throws Exception {
        String codigo = post("/alunos/" + alunoId + "/convite", treinador, null, 200).get("codigo").asString();
        return post("/publico/convites/" + codigo + "/aceitar", null,
                Map.of("email", emailUnico("aluno"), "senha", SENHA), 200);
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
                new Serie(fs, "FS", 3, 3, null, new Intensidade("PERCENTUAL_WS", new BigDecimal("50"), null, null, null), null),
                new Serie(ws, "WS", 3, 6, null, new Intensidade("CARGA_TRABALHO", null, null, null, null), null),
                new Serie(backOff, "Back off", 6, 8, null, new Intensidade("PERCENTUAL_WS", new BigDecimal("85"), null, null, null), null));
        ExercicioPlano ex = new ExercicioPlano(exercicio, exercicioId, "Remada baixa na polia", "MAQUINA",
                "https://www.youtube.com/watch?v=exemplo", null, true, "kg", series);
        ConteudoTreino c = new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(sessao, "Segunda - Costas", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
        return new TreinoDeTeste(c, sessao, exercicio, exercicioId, fs, ws, backOff);
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
