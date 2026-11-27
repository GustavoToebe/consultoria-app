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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cardio e HIIT, passo P1 ({@code docs/planos/cardio-e-hiit.md}): tipo e medidas do cardio na biblioteca (D12, D13), o
 * tipo virando equipamento na publicação sem chave nova (D14), o bloco intervalado sobrevivendo a copiar, replicar e
 * virar modelo, o contínuo saindo sem chave nova e o 422 com o campo e o texto fixo.
 */
@AutoConfigureMockMvc
class CardioIntegrationTest extends AbstractIntegrationTest {

    private static final String SERIE = "sessoes[0].exercicios[0].series[0].cardio.";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício do Cardio");
    }

    // ---- Biblioteca ----

    @Test
    void criarEditarETrocarAModalidadeDoCardio() throws Exception {
        JsonNode criado = api.post("/exercicios", treinador, exercicio("Esteira fictícia", "CARDIO", "ESTEIRA", null), 200);
        assertThat(criado.get("tipoDeCardio").asString()).isEqualTo("ESTEIRA");
        assertThat(textos(criado.get("medidasDeCardio"))).containsExactly("DISTANCIA", "RITMO");
        // Grupo e equipamento do corpo são ignorados no cardio (D13).
        assertThat(criado.get("grupoMuscular").isNull()).isTrue();
        assertThat(criado.get("equipamento").isNull()).isTrue();
        String id = criado.get("id").asString();

        JsonNode editado = api.put("/exercicios/" + id, treinador,
                exercicio("Esteira fictícia", "CARDIO", "BIKE", List.of("RITMO")), 200);
        assertThat(editado.get("tipoDeCardio").asString()).isEqualTo("BIKE");
        assertThat(textos(editado.get("medidasDeCardio"))).containsExactly("RITMO");
        // Medidas ausentes na edição mantêm as gravadas.
        editado = api.put("/exercicios/" + id, treinador, exercicio("Esteira fictícia", "CARDIO", "BIKE", null), 200);
        assertThat(textos(editado.get("medidasDeCardio"))).containsExactly("RITMO");
        JsonNode lista = api.get("/exercicios", treinador, 200);
        assertThat(lista.valueStream().filter(e -> id.equals(e.get("id").asString())).findFirst().orElseThrow()
                .get("tipoDeCardio").asString()).isEqualTo("BIKE");

        // Trocar a modalidade zera o tipo, mesmo com o app mandando o tipo velho (o CHECK da V113 recusaria).
        JsonNode livre = api.put("/exercicios/" + id, treinador,
                exercicio("Esteira fictícia", "LIVRE", "ESTEIRA", List.of("DISTANCIA")), 200);
        assertThat(livre.get("tipoDeCardio").isNull()).isTrue();
        assertThat(livre.get("medidasDeCardio")).isEmpty();
        assertThat(livre.get("grupoMuscular").asString()).isEqualTo("Grupo inventado");
        // De volta ao cardio sem medidas: o padrão (as duas), e o tipo opcional.
        JsonNode deVolta = api.put("/exercicios/" + id, treinador, exercicio("Esteira fictícia", "CARDIO", null, null), 200);
        assertThat(deVolta.get("tipoDeCardio").isNull()).isTrue();
        assertThat(textos(deVolta.get("medidasDeCardio"))).containsExactly("DISTANCIA", "RITMO");

        // Fora do cardio o tipo é ignorado já na criação.
        JsonNode supino = api.post("/exercicios", treinador, exercicio("Supino fictício", "LIVRE", "REMO", List.of()), 200);
        assertThat(supino.get("tipoDeCardio").isNull()).isTrue();
        // Tipo desconhecido é 400 na leitura do corpo, como os outros enums.
        api.post("/exercicios", treinador, exercicio("Cardio inválido", "CARDIO", "PATINS", null), 400);
    }

    // ---- Publicação: o tipo vira equipamento (D14) ----

    @Test
    void publicarUsaORotuloDoTipoComoEquipamentoSemChaveNova() throws Exception {
        UUID esteira = criarCardio("Esteira " + UUID.randomUUID(), "ESTEIRA");
        UUID natacao = criarCardio("Natação " + UUID.randomUUID(), "OUTRO");
        UUID legado = UUID.randomUUID();
        // Cardio antigo, sem tipo, com o equipamento gravado (como o catálogo traz): continua valendo.
        jdbc.update("insert into exercicio (id, consultoria_id, nome, modalidade, equipamento) select ?, consultoria_id, ?, "
                + "'CARDIO', 'Esteira' from usuario where id = ?::uuid", legado, "Esteira antiga " + legado,
                treinador.path("usuario").path("id").asString());

        ConteudoTreino conteudo = treino(List.of(
                cardio(esteira, "Esteira", continuo()),
                cardio(natacao, "Natação", continuo()),
                cardio(legado, "Esteira antiga", continuo())));
        String id = api.publicarTreino(treinador, aluno, conteudo).get("plano").get("id").asString();
        JsonNode exercicios = api.get("/planos-treino/" + id + "/versoes/1", treinador, 200)
                .get("conteudo").get("sessoes").get(0).get("exercicios");
        assertThat(exercicios.get(0).get("equipamento").asString()).isEqualTo("Esteira");
        assertThat(exercicios.get(1).has("equipamento")).isFalse();
        assertThat(exercicios.get(2).get("equipamento").asString()).isEqualTo("Esteira");
        for (JsonNode e : exercicios) {
            assertThat(e.propertyNames()).doesNotContain("tipoDeCardio", "medidasDeCardio");
            // O contínuo sai com as mesmas chaves de antes (o APK instalado confere de forma estrita).
            assertThat(e.get("series").get(0).get("cardio").propertyNames())
                    .containsExactlyInAnyOrder("duracaoMin", "distanciaKm", "ritmo", "zona", "intervalos");
        }
    }

    // ---- Validação ----

    @Test
    void intervaladoInvalidoDa422NoCampoComTextoFixo() throws Exception {
        UUID bike = criarCardio("Bike " + UUID.randomUUID(), "BIKE");
        Cardio semEstimulo = new Cardio(null, null, null, null, new Cardio.Intervalos(null, 30, 10),
                ModoDeCardio.INTERVALADO, ProtocoloDeCardio.CURTO, 300, 300, null, null);
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                treino(List.of(cardio(bike, "Bike", semEstimulo))), plano.get("plano").get("versao").asLong()), 200);
        JsonNode erro = api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors")).hasSize(1);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(SERIE + "intervalos.trabalhoSeg");
        assertThat(erro.get("fieldErrors").get(0).get("message").asString()).isEqualTo("Estímulo de 1 s a 60 min.");
    }

    /** A suíte liga {@code TREINOS_CARDIO_INTERVALADO_HABILITADO}; o modo desligado é o {@code CardioIntervaladoDesligadoIntegrationTest}. */
    @Test
    void euDizQueOIntervaladoEstaLiberado() throws Exception {
        JsonNode login = api.convidarEEntrar(treinador, aluno);
        assertThat(api.get("/eu", treinador, 200).get("cardioIntervaladoHabilitado").asBoolean()).isTrue();
        assertThat(api.get("/eu", login, 200).get("cardioIntervaladoHabilitado").asBoolean()).isTrue();
    }

    // ---- Aceite comum: o bloco intervalado não se perde ----

    @Test
    void protocoloSobreviveACopiarReplicarEVirarModelo() throws Exception {
        UUID bike = criarCardio("Bike do ciclo " + UUID.randomUUID(), "BIKE");
        ConteudoTreino conteudo = treino(List.of(cardio(bike, "Bike", continuo(), sit())));
        String pastaId = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Ciclo 1", "inicio", "2026-10-05", "fim", "2026-10-20"), 200).get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano", "pastaId", pastaId), 200);
        String planoId = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", conteudo, plano.get("plano").get("versao").asLong()), 200);
        confereSit(salvo.get("rascunho"));
        api.post("/planos-treino/" + planoId + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        confereSit(api.get("/planos-treino/" + planoId + "/versoes/1", treinador, 200).get("conteudo"));

        UUID outro = api.criarAluno(treinador, "Outro Aluno Fictício");
        String copiaId = api.post("/planos-treino/" + planoId + "/copiar-para-aluno", treinador,
                Map.of("alunoId", outro, "titulo", "Cópia", "inicio", "2026-11-02", "fim", "2026-11-29"), 200)
                .get("planoId").asString();
        confereSit(api.get("/planos-treino/" + copiaId, treinador, 200).get("rascunho"));

        String novaPasta = api.post("/pastas/" + pastaId + "/replicar", treinador,
                Map.of("titulo", "Ciclo 2", "inicio", "2026-10-21", "fim", "2026-11-05"), 200).get("id").asString();
        boolean achou = false;
        for (JsonNode t : api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)) {
            if (novaPasta.equals(t.path("pastaId").asString(null))) {
                confereSit(api.get("/planos-treino/" + t.get("id").asString(), treinador, 200).get("rascunho"));
                achou = true;
            }
        }
        assertThat(achou).as("a pasta replicada trouxe o treino").isTrue();

        String modelo = api.post("/receitas", treinador,
                Map.of("tipo", "PLANO_TREINO", "nome", "Modelo do cardio " + UUID.randomUUID(), "conteudo", conteudo), 200)
                .get("id").asString();
        String aplicado = api.post("/receitas/" + modelo + "/aplicar", treinador,
                Map.of("alunoId", outro, "titulo", "Do modelo"), 200).get("planoId").asString();
        confereSit(api.get("/planos-treino/" + aplicado, treinador, 200).get("rascunho"));
    }

    // ---- Apoio ----

    private static void confereSit(JsonNode conteudo) {
        JsonNode series = conteudo.get("sessoes").get(0).get("exercicios").get(0).get("series");
        JsonNode bloco = series.get(1).get("cardio");
        assertThat(bloco.get("modo").asString()).isEqualTo("INTERVALADO");
        assertThat(bloco.get("protocolo").asString()).isEqualTo("SIT");
        assertThat(bloco.get("aquecimentoSeg").asInt()).isEqualTo(240);
        assertThat(bloco.get("desaquecimentoSeg").asInt()).isEqualTo(180);
        assertThat(bloco.get("recuperacaoTipo").asString()).isEqualTo("PASSIVA");
        assertThat(bloco.get("esforcoMaximo").asBoolean()).isTrue();
        assertThat(bloco.get("intervalos").get("voltas").asInt()).isEqualTo(6);
        assertThat(series.get(0).get("cardio").has("modo")).isFalse();
    }

    private UUID criarCardio(String nome, String tipo) throws Exception {
        return UUID.fromString(api.post("/exercicios", treinador, exercicio(nome, "CARDIO", tipo, null), 200)
                .get("id").asString());
    }

    private static Map<String, Object> exercicio(String nome, String modalidade, String tipo, List<String> medidas) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("modalidade", modalidade);
        corpo.put("grupoMuscular", "Grupo inventado");
        corpo.put("equipamento", "Equipamento inventado");
        corpo.put("tipoDeCardio", tipo);
        corpo.put("medidasDeCardio", medidas);
        return corpo;
    }

    private static List<String> textos(JsonNode lista) {
        return lista.valueStream().map(JsonNode::asString).toList();
    }

    private static Cardio continuo() {
        return new Cardio(10, null, null, 2, null);
    }

    private static Cardio sit() {
        return new Cardio(null, null, null, null, new Cardio.Intervalos(30, 180, 6), ModoDeCardio.INTERVALADO,
                ProtocoloDeCardio.SIT, 240, 180, TipoDeRecuperacao.PASSIVA, true);
    }

    private static ExercicioPlano cardio(UUID exercicioId, String nome, Cardio... blocos) {
        List<Serie> series = java.util.Arrays.stream(blocos)
                .map(b -> Serie.de(UUID.randomUUID(), null, null, null, null).comCardio(b)).toList();
        return new ExercicioPlano(UUID.randomUUID(), exercicioId, nome, "CARDIO", null, null, null, "nenhuma", series);
    }

    private static ConteudoTreino treino(List<ExercicioPlano> exercicios) {
        return new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(UUID.randomUUID(), "Segunda - Cardio", 1, "TREINO", null, null, null, exercicios),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
    }
}
