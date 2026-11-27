package br.com.treinos.api.treino;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino.Cardio;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.ModoDeCardio;
import br.com.treinos.api.treino.ConteudoTreino.ProtocoloDeCardio;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.TipoDeRecuperacao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo padrão de produção ({@code TREINOS_CARDIO_INTERVALADO_HABILITADO=false}; docs/planos/cardio-e-hiit.md, D16): o app do
 * aluno das lojas recusa o pacote com as chaves novas do cardio, então salvar o rascunho e publicar com elas dão 422 no caminho
 * do bloco, com texto fixo. O contínuo e o intervalado antigo (sem {@code modo}) seguem como antes, e o que já está gravado
 * continua legível. A suíte liga a chave; só esta classe a desliga.
 */
@AutoConfigureMockMvc
class CardioIntervaladoDesligadoIntegrationTest extends AbstractIntegrationTest {

    private static final String TEXTO = "O cardio intervalado ainda não está liberado nesta consultoria.";

    @DynamicPropertySource
    static void desligarOIntervalado(DynamicPropertyRegistry registry) {
        registry.add("treinos.cardio.intervalado-habilitado", () -> "false");
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;
    private UUID bike;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício do Cardio Desligado");
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Bike " + UUID.randomUUID());
        corpo.put("modalidade", "CARDIO");
        corpo.put("tipoDeCardio", "BIKE");
        bike = UUID.fromString(api.post("/exercicios", treinador, corpo, 200).get("id").asString());
    }

    @Test
    void euDizQueOIntervaladoEstaDesligado() throws Exception {
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        assertThat(api.get("/eu", treinador, 200).get("cardioIntervaladoHabilitado").asBoolean()).isFalse();
        assertThat(api.get("/eu", login, 200).get("cardioIntervaladoHabilitado").asBoolean()).isFalse();
    }

    @Test
    void salvarIntervaladoNovoDa422NoCaminhoDoBloco() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode erro = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                treino(continuo(), sit()), plano.get("plano").get("versao").asLong()), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("message").asString()).isEqualTo(TEXTO);
        assertThat(erro.get("fieldErrors")).hasSize(1);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("sessoes[0].exercicios[0].series[1].cardio");
        assertThat(erro.get("fieldErrors").get(0).get("message").asString()).isEqualTo(TEXTO);

        // Qualquer chave nova sozinha também (o app antigo recusa a chave, não o valor), inclusive "modo": "CONTINUO".
        Cardio continuoComModo = new Cardio(10, null, null, 2, null, ModoDeCardio.CONTINUO, null, null, null, null, null);
        api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                treino(continuoComModo), plano.get("plano").get("versao").asLong()), 422);
    }

    @Test
    void continuoEIntervaladoAntigoSalvamEPublicam() throws Exception {
        Cardio antigo = new Cardio(null, null, null, 3, new Cardio.Intervalos(30, 60, 8));
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                treino(continuo(), antigo), plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        JsonNode series = api.get("/planos-treino/" + id + "/versoes/1", treinador, 200).get("conteudo")
                .get("sessoes").get(0).get("exercicios").get(0).get("series");
        assertThat(series.get(0).get("cardio").has("modo")).isFalse();
        assertThat(series.get(1).get("cardio").has("modo")).isFalse();
        assertThat(series.get(1).get("cardio").get("intervalos").get("voltas").asInt()).isEqualTo(8);
    }

    /** Um rascunho que já tem o intervalado novo (aqui, de um modelo) continua legível; só publicar é recusado. */
    @Test
    void rascunhoQueJaTemOIntervaladoELegivelMasNaoPublica() throws Exception {
        String modelo = api.post("/receitas", treinador, Map.of("tipo", "PLANO_TREINO", "nome", "Modelo " + UUID.randomUUID(),
                "conteudo", treino(continuo(), sit())), 200).get("id").asString();
        String planoId = api.post("/receitas/" + modelo + "/aplicar", treinador,
                Map.of("alunoId", aluno, "titulo", "Do modelo"), 200).get("planoId").asString();
        JsonNode detalhe = api.get("/planos-treino/" + planoId, treinador, 200);
        JsonNode bloco = detalhe.get("rascunho").get("sessoes").get(0).get("exercicios").get(0).get("series").get(1).get("cardio");
        assertThat(bloco.get("modo").asString()).isEqualTo("INTERVALADO");

        JsonNode erro = api.post("/planos-treino/" + planoId + "/publicar", treinador,
                Map.of("versao", detalhe.get("plano").get("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors")).anySatisfy(f -> {
            assertThat(f.get("field").asString()).isEqualTo("sessoes[0].exercicios[0].series[1].cardio");
            assertThat(f.get("message").asString()).isEqualTo(TEXTO);
        });
    }

    private static Cardio continuo() {
        return new Cardio(10, null, null, 2, null);
    }

    private static Cardio sit() {
        return new Cardio(null, null, null, null, new Cardio.Intervalos(30, 180, 6), ModoDeCardio.INTERVALADO,
                ProtocoloDeCardio.SIT, 240, 180, TipoDeRecuperacao.PASSIVA, true);
    }

    private ConteudoTreino treino(Cardio... blocos) {
        List<Serie> series = Arrays.stream(blocos)
                .map(b -> Serie.de(UUID.randomUUID(), null, null, null, null).comCardio(b)).toList();
        ExercicioPlano x = new ExercicioPlano(UUID.randomUUID(), bike, "Bike", "CARDIO", null, null, null, "nenhuma", series);
        return new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(UUID.randomUUID(), "Segunda - Cardio", 1, "TREINO", null, null, null, List.of(x)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
    }
}
