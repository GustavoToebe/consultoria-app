package br.com.treinos.api.auth;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Modo de produção: cadastro público de treinador fechado ({@code treinos.cadastro.aberto=false}, o padrão). A rota
 * responde 404 para qualquer e-mail, sem dizer se ele já tem conta, e a configuração pública avisa o app para esconder o
 * link.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "treinos.cadastro.aberto=false")
class CadastroFechadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void cadastroFechadoResponde404SemCriarContaNemRevelarOEmail() throws Exception {
        String email = ApiDeTeste.emailUnico("fechado");
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/auth/cadastro-treinador").contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("nomeConsultoria", "Consultoria Fictícia", "nome", "Pessoa Fictícia",
                                    "email", email, "senha", ApiDeTeste.SENHA))))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
        }
        // a conta não nasceu: o login com o mesmo e-mail falha como qualquer e-mail desconhecido
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "senha", ApiDeTeste.SENHA))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void configuracaoPublicaDizQueOCadastroEstaFechado() throws Exception {
        mvc.perform(get("/publico/configuracao"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cadastroAberto").value(false));
    }
}
