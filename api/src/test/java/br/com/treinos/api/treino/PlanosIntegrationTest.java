package br.com.treinos.api.treino;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Seção 15.1, item 3: versões imutáveis, lock otimista, validação, plano vigente e replicação. */
@AutoConfigureMockMvc
class PlanosIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício");
    }

    @Test
    void publicarCriaVersoesImutaveis() throws Exception {
        ApiDeTeste.TreinoDeTeste t = ApiDeTeste.treino();
        JsonNode v1 = api.publicarTreino(treinador, aluno, t.conteudo());
        String id = v1.get("plano").get("id").asString();
        assertThat(v1.get("plano").get("versaoPublicada").asInt()).isEqualTo(1);
        assertThat(v1.get("plano").get("ativo").asBoolean()).isTrue();

        // Editar o rascunho não mexe na v1.
        ConteudoTreino editado = new ConteudoTreino("Outro objetivo", null, t.conteudo().sessoes());
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano editado", editado, v1.get("plano").get("versao").asLong()), 200);
        assertThat(salvo.get("plano").get("rascunhoAlteradoDepoisDePublicar").asBoolean()).isTrue();
        assertThat(api.get("/planos-treino/" + id + "/versoes/1", treinador, 200)
                .get("conteudo").get("objetivo").asString()).isEqualTo("Objetivo fictício");

        // Publicar de novo cria a v2 e mantém a v1.
        JsonNode v2 = api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);
        assertThat(v2.get("versoes")).hasSize(2);
        assertThat(api.get("/planos-treino/" + id + "/versoes/2", treinador, 200)
                .get("conteudo").get("objetivo").asString()).isEqualTo("Outro objetivo");
        assertThat(api.get("/planos-treino/" + id + "/versoes/1", treinador, 200)
                .get("conteudo").get("objetivo").asString()).isEqualTo("Objetivo fictício");
    }

    @Test
    void publicarOutroPlanoDesativaOAnteriorDoMesmoAluno() throws Exception {
        String a = api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo()).get("plano").get("id").asString();
        String b = api.publicarTreino(treinador, aluno, ApiDeTeste.treino().conteudo()).get("plano").get("id").asString();
        assertThat(api.get("/planos-treino/" + a, treinador, 200).get("plano").get("ativo").asBoolean()).isFalse();
        assertThat(api.get("/planos-treino/" + b, treinador, 200).get("plano").get("ativo").asBoolean()).isTrue();
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).hasSize(2);
    }

    @Test
    void versaoAntigaDoRascunhoRecebeConflito() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        long versao = plano.get("plano").get("versao").asLong();
        api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Aba 1", ApiDeTeste.treino().conteudo(), versao), 200);
        JsonNode erro = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Aba 2", ApiDeTeste.treino().conteudo(), versao), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
    }

    @Test
    void validacaoBloqueiaErrosEPedeConfirmacaoDosAvisos() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();

        // Erros: série com repsMax < repsMin e percentual fora de 1–200.
        Serie ruim = new Serie(UUID.randomUUID(), "FS", 6, 3, null,
                new ConteudoTreino.Intensidade("PERCENTUAL_WS", new java.math.BigDecimal("250"), null, null, null), null);
        ConteudoTreino comErro = comSeries(List.of(ruim));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", comErro, plano.get("plano").get("versao").asLong()), 200);
        JsonNode validacao = api.post("/planos-treino/" + id + "/validar", treinador, null, 200);
        assertThat(validacao.get("erros").valueStream().map(e -> e.get("caminho").asString()))
                .contains("sessoes[0].exercicios[0].series[0].repsMax",
                        "sessoes[0].exercicios[0].series[0].intensidade.percentual");
        JsonNode invalido = api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(invalido.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(invalido.get("fieldErrors")).isNotEmpty();

        // Só avisos (sem dia de descanso): exige confirmação.
        Serie ws = new Serie(UUID.randomUUID(), "WS", 3, 6, null,
                new ConteudoTreino.Intensidade("CARGA_TRABALHO", null, null, null, null), null);
        ConteudoTreino soAvisos = new ConteudoTreino(null, null, List.of(comSeries(List.of(ws)).sessoes().get(0)));
        salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", soAvisos, salvo.get("plano").get("versao").asLong()), 200);
        long versao = salvo.get("plano").get("versao").asLong();
        JsonNode avisos = api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", versao, "confirmarAvisos", false), 422);
        assertThat(avisos.get("codigo").asString()).isEqualTo("CONFIRMAR_AVISOS");
        api.post("/planos-treino/" + id + "/publicar", treinador, Map.of("versao", versao, "confirmarAvisos", true), 200);
    }

    @Test
    void clusterERestPauseTemCamposPropriosConferidosAoPublicar() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        ConteudoTreino.Intensidade carga = new ConteudoTreino.Intensidade("CARGA_TRABALHO", null, null, null, null);
        Serie clusterRuim = new Serie(UUID.randomUUID(), "Cluster", 6, 6, null, carga, null,
                new ConteudoTreino.Tecnica("CLUSTER", 1, 0, 2, null, null));
        Serie restPauseRuim = new Serie(UUID.randomUUID(), "Rest pause", 6, 8, null, carga, null,
                new ConteudoTreino.Tecnica("REST_PAUSE", null, null, 700, 9, 0));
        Serie desconhecida = new Serie(UUID.randomUUID(), "WS", 3, 6, null, carga, null,
                new ConteudoTreino.Tecnica("PIRAMIDE", null, null, null, null, null));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                comSeries(List.of(clusterRuim, restPauseRuim, desconhecida)), plano.get("plano").get("versao").asLong()), 200);
        String base = "sessoes[0].exercicios[0].series[";
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros").valueStream()
                .map(e -> e.get("caminho").asString())).contains(
                base + "0].tecnica.blocos", base + "0].tecnica.repsPorBloco", base + "0].tecnica.pausaSegundos",
                base + "1].tecnica.pausaSegundos", base + "1].tecnica.retomadas", base + "1].tecnica.repsPorRetomada",
                base + "2].tecnica.tipo");

        // Corretas: 3 blocos de 2 com 20 s; rest pause de 20 s com 2 retomadas até a falha. Chegam iguais na leitura.
        Serie cluster = new Serie(UUID.randomUUID(), "Cluster", 6, 6, null, carga, 120,
                new ConteudoTreino.Tecnica("CLUSTER", 3, 2, 20, null, null));
        Serie restPause = new Serie(UUID.randomUUID(), "Rest pause", 6, 8, null, carga, null,
                new ConteudoTreino.Tecnica("REST_PAUSE", null, null, 20, 2, null));
        salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                comSeries(List.of(cluster, restPause)), salvo.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros").valueStream()
                .map(e -> e.get("caminho").asString())).noneMatch(c -> c.contains("tecnica"));
        JsonNode series = salvo.get("rascunho").get("sessoes").get(0).get("exercicios").get(0).get("series");
        assertThat(series.get(0).get("tecnica").get("blocos").asInt()).isEqualTo(3);
        assertThat(series.get(1).get("tecnica").get("repsPorRetomada").isNull()).isTrue();
    }

    @Test
    void dropSetCadenciaEBiSetChegamIguaisNaLeituraENaReplica() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        ConteudoTreino.Intensidade carga = new ConteudoTreino.Intensidade("CARGA_TRABALHO", null, null, null, null);
        Serie drop = new Serie(UUID.randomUUID(), "WS", 6, 8, null, carga, null,
                new ConteudoTreino.Tecnica("DROP_SET", null, null, null, null, null, 2, 20, null));
        ExercicioPlano primeiro = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null,
                null, true, "kg", List.of(drop), "3-1-1-0", null, null, "SUPERSERIE");
        ExercicioPlano segundo = new ExercicioPlano(UUID.randomUUID(), null, "Remada curvada", "LIVRE", null, null,
                true, "kg", List.of(new Serie(UUID.randomUUID(), "WS", 6, 8, null, carga, 90)), null, 10, true, null);
        ConteudoTreino conteudo = new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of(primeiro, segundo)),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", conteudo, plano.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros")).isEmpty();
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode copia = api.post("/planos-treino/" + id + "/replicar", treinador, Map.of("titulo", "Próximo"), 200);
        JsonNode exercicios = copia.get("rascunho").get("sessoes").get(0).get("exercicios");
        assertThat(exercicios.get(0).get("cadencia").asString()).isEqualTo("3-1-1-0");
        assertThat(exercicios.get(0).get("combinacao").asString()).isEqualTo("SUPERSERIE");
        assertThat(exercicios.get(0).get("series").get(0).get("tecnica").get("quedas").asInt()).isEqualTo(2);
        assertThat(exercicios.get(0).get("series").get(0).get("tecnica").get("reducaoPercentual").asInt()).isEqualTo(20);
        assertThat(exercicios.get(1).get("juntoComAnterior").asBoolean()).isTrue();
        assertThat(exercicios.get(1).get("isometriaSegundos").asInt()).isEqualTo(10);
    }

    @Test
    void replicarGeraUidsNovosAPartirDaUltimaVersao() throws Exception {
        ApiDeTeste.TreinoDeTeste t = ApiDeTeste.treino();
        String id = api.publicarTreino(treinador, aluno, t.conteudo()).get("plano").get("id").asString();
        JsonNode copia = api.post("/planos-treino/" + id + "/replicar", treinador,
                Map.of("titulo", "Próximo ciclo"), 200);
        assertThat(copia.get("plano").get("ativo").asBoolean()).isFalse();
        assertThat(copia.get("plano").get("versaoPublicada").asInt()).isZero();

        Set<String> originais = uids(json.valueToTree(t.conteudo()));
        Set<String> novos = uids(copia.get("rascunho"));
        assertThat(novos).hasSameSizeAs(originais).doesNotContainAnyElementsOf(originais);
        assertThat(copia.get("rascunho").get("sessoes").get(0).get("nome").asString()).isEqualTo("Segunda - Costas");
    }

    @Test
    void planoDaReceitaPadraoNasceComSessoesEUidsNovos() throws Exception {
        JsonNode receitas = api.get("/receitas?tipo=PLANO_TREINO", treinador, 200);
        String semana = receitas.valueStream()
                .filter(r -> r.get("nome").asString().equals("Semana 5 treinos + 2 off ativos"))
                .findFirst().orElseThrow().get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Da receita", "receitaId", semana), 200);
        JsonNode sessoes = plano.get("rascunho").get("sessoes");
        assertThat(sessoes).hasSize(7);
        assertThat(sessoes.get(3).get("tipo").asString()).isEqualTo("DESCANSO_ATIVO");
        assertThat(sessoes.get(0).get("uid").isNull()).isFalse();
    }

    private static ConteudoTreino comSeries(List<Serie> series) {
        ExercicioPlano ex = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null,
                true, "kg", series);
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
    }

    private static Set<String> uids(JsonNode conteudo) {
        Set<String> uids = new HashSet<>();
        for (JsonNode s : conteudo.get("sessoes")) {
            uids.add(s.get("uid").asString());
            for (JsonNode e : s.get("exercicios")) {
                uids.add(e.get("uid").asString());
                for (JsonNode x : e.get("series")) {
                    uids.add(x.get("uid").asString());
                }
            }
        }
        return uids;
    }
}
