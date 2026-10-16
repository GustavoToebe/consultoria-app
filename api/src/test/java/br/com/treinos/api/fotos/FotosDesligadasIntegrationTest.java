package br.com.treinos.api.fotos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.Color;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Modo padrão de produção: fotos desligadas. A pergunta FOTOS segue sem envio e nada tenta falar com o bucket. */
@AutoConfigureMockMvc
class FotosDesligadasIntegrationTest extends AbstractIntegrationTest {

    @DynamicPropertySource
    static void desligarAsFotos(DynamicPropertyRegistry registry) {
        registry.add("treinos.fotos.habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private ObjectProvider<ArmazenamentoDeFotos> armazenamento;
    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        UUID aluno = api.criarAluno(treinador, "Aluno Fictício Sem Fotos");
        loginAluno = api.convidarEEntrar(treinador, aluno);
        LocalDate fim = LocalDate.now(Fuso.BRASILIA);
        String pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", fim.minusDays(27), "fim", fim), 200).path("id").asString();
        JsonNode criado = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Treino fictício", "pastaId", pasta), 200);
        String id = criado.path("plano").path("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Treino fictício", ApiDeTeste.treino().conteudo(), criado.path("plano").path("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true), 200);
    }

    @Test
    void semConfiguracaoNaoHaBucketEAConfiguracaoDizQueEstaDesligado() throws Exception {
        assertThat(armazenamento.getIfAvailable()).isNull();
        JsonNode configuracao = api.get("/aluno/fotos/configuracao", loginAluno, 200);
        assertThat(configuracao.path("habilitado").asBoolean()).isFalse();
        assertThat(configuracao.path("maximoPorPergunta").asInt()).isEqualTo(6);
    }

    @Test
    void enviarFotoDa503ELerTambem() throws Exception {
        String pasta = api.get("/aluno/atualizacao", loginAluno, 200).path("pastaId").asString();
        var resposta = mvc.perform(multipart("/aluno/fotos")
                        .file(new MockMultipartFile("arquivo", "x.jpg", "image/jpeg", FotosDeTeste.jpeg(Color.RED)))
                        .param("pastaId", pasta)
                        .header("X-Treinos-Cliente", "nativo")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginAluno)))
                .andExpect(status().isServiceUnavailable()).andReturn();
        assertThat(api.ler(resposta).path("codigo").asString()).isEqualTo("FOTOS_INDISPONIVEIS");
        api.get("/aluno/fotos/" + UUID.randomUUID(), loginAluno, 404);
    }

    @Test
    void aPerguntaFotosContinuaSemEnvioEORestoDaAtualizacaoFunciona() throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        Map<String, Object> respostas = new LinkedHashMap<>(Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6));
        respostas.put("fotos", List.of(UUID.randomUUID().toString()));
        JsonNode enviada = api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", atual.path("pastaId").asString(),
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(), "respostas", respostas), 200);
        assertThat(enviada.path("fase").asString()).isEqualTo("ENVIADA");
        assertThat(enviada.path("respostas").has("fotos")).isFalse();
    }
}
