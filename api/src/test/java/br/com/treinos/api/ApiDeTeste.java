package br.com.treinos.api;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Atalhos dos testes HTTP: cria treinador pelo cadastro público e entra como cliente nativo. Dados sempre fictícios. */
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
        MvcResult r = mvc.perform(post("/auth/cadastro-treinador")
                        .header("X-Treinos-Cliente", "nativo")
                        .contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk())
                .andReturn();
        return ler(r);
    }

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
