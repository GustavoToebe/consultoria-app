package br.com.treinos.api.treino;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Grupo;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
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
        Serie ruim = Serie.de(UUID.randomUUID(), "FEEDER", 6, 3, Carga.percentual("PERCENTUAL_WS", 250, null));
        ConteudoTreino comErro = comSeries(List.of(ruim));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", comErro, plano.get("plano").get("versao").asLong()), 200);
        JsonNode validacao = api.post("/planos-treino/" + id + "/validar", treinador, null, 200);
        assertThat(validacao.get("erros").valueStream().map(e -> e.get("caminho").asString()))
                .contains("sessoes[0].exercicios[0].series[0].repsMax",
                        "sessoes[0].exercicios[0].series[0].carga.percentualMin");
        JsonNode invalido = api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 422);
        assertThat(invalido.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(invalido.get("fieldErrors")).isNotEmpty();

        // Só avisos (sem dia de descanso): exige confirmação.
        Serie ws = Serie.de(UUID.randomUUID(), "WORKING", 3, 6, Carga.de("CARGA_TRABALHO"));
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
        Carga carga = Carga.de("CARGA_TRABALHO");
        // Cluster com um bloco de 0 e pausa de 2 s; rest pause com 700 s e 9 pausas; técnica desconhecida; série em
        // "mesma carga da WS" sem série de trabalho antes.
        Serie clusterRuim = Serie.de(UUID.randomUUID(), "WORKING", 6, 6, carga)
                .comTecnica(Tecnica.cluster(List.of(0), 2, null));
        Serie restPauseRuim = Serie.de(UUID.randomUUID(), "WORKING", 6, 8, carga)
                .comTecnica(Tecnica.restPause(700, null, 9));
        Serie desconhecida = Serie.de(UUID.randomUUID(), "WORKING", 3, 6, carga).comTecnica(Tecnica.vazia("PIRAMIDE"));
        Serie semTrabalhoAntes = Serie.de(UUID.randomUUID(), "WORKING", 6, 8, Carga.de("MESMA_CARGA"));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                comSeries(List.of(semTrabalhoAntes, clusterRuim, restPauseRuim, desconhecida)),
                plano.get("plano").get("versao").asLong()), 200);
        String base = "sessoes[0].exercicios[0].series[";
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros").valueStream()
                .map(e -> e.get("caminho").asString())).contains(
                base + "0].carga.modo",
                base + "1].tecnica.blocos", base + "1].tecnica.pausaSegundos",
                base + "2].tecnica.pausaSegundos", base + "2].tecnica.pausas",
                base + "3].tecnica.tipo");

        // Corretas: WS em cluster 2+2+2 com 20 s (6 repetições = soma dos blocos) e, em outra WS, rest pause de 20 s com
        // 2 pausas, as duas na própria série de trabalho. Chegam iguais na leitura.
        Serie cluster = Serie.de(UUID.randomUUID(), "WORKING", 6, 6, carga).comDescanso(120)
                .comTecnica(Tecnica.cluster(List.of(2, 2, 2), 20, null));
        Serie restPause = Serie.de(UUID.randomUUID(), "WORKING", 6, 8, carga)
                .comTecnica(Tecnica.restPause(20, null, 2));
        salvo = api.put("/planos-treino/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano",
                comSeries(List.of(cluster, restPause)), salvo.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros").isEmpty()).isTrue();
        JsonNode series = salvo.get("rascunho").get("sessoes").get(0).get("exercicios").get(0).get("series");
        assertThat(series.get(0).get("tecnica").get("blocos").size()).isEqualTo(3);
        assertThat(series.get(1).get("tipo").asString()).isEqualTo("WORKING");
        assertThat(series.get(1).get("carga").get("modo").asString()).isEqualTo("CARGA_TRABALHO");
        assertThat(series.get(1).get("tecnica").get("pausas").asInt()).isEqualTo(2);
    }

    @Test
    void dropSetCadenciaEGrupoChegamIguaisNaLeituraENaReplica() throws Exception {
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador, Map.of("titulo", "Plano"), 200);
        String id = plano.get("plano").get("id").asString();
        Carga carga = Carga.de("CARGA_TRABALHO");
        Serie drop = Serie.de(UUID.randomUUID(), "WORKING", 6, 8, carga).comTecnica(Tecnica.dropSet(2, 20, null, 0))
                .comEsforco(Esforco.deRir(0)).comAlvoExtra("até a falha");
        Grupo grupo = new Grupo(UUID.randomUUID(), "SUPERSET", 90, null);
        ExercicioPlano primeiro = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null,
                null, true, "kg", List.of(drop), "3-1-1-0", null, grupo.uid());
        ExercicioPlano segundo = new ExercicioPlano(UUID.randomUUID(), null, "Remada curvada", "LIVRE", null, null,
                true, "kg", List.of(Serie.de(UUID.randomUUID(), "WORKING", 6, 8, carga).comDescanso(90)), null, 10,
                grupo.uid());
        ConteudoTreino conteudo = new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, List.of(primeiro, segundo),
                        List.of(grupo)),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", conteudo, plano.get("plano").get("versao").asLong()), 200);
        assertThat(api.post("/planos-treino/" + id + "/validar", treinador, null, 200).get("erros").isEmpty()).isTrue();
        api.post("/planos-treino/" + id + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode copia = api.post("/planos-treino/" + id + "/replicar", treinador, Map.of("titulo", "Próximo"), 200);
        JsonNode sessao = copia.get("rascunho").get("sessoes").get(0);
        JsonNode exercicios = sessao.get("exercicios");
        assertThat(exercicios.get(0).get("cadencia").asString()).isEqualTo("3-1-1-0");
        JsonNode serie = exercicios.get(0).get("series").get(0);
        assertThat(serie.get("tecnica").get("quedas").asInt()).isEqualTo(2);
        assertThat(serie.get("tecnica").get("reducaoPercentual").asInt()).isEqualTo(20);
        assertThat(serie.get("tecnica").get("pausaSegundos").asInt()).isZero();
        assertThat(serie.get("esforco").get("rir").asInt()).isZero();
        assertThat(serie.get("alvoExtra").asString()).isEqualTo("até a falha");
        assertThat(exercicios.get(1).get("isometriaSegundos").asInt()).isEqualTo(10);
        // O grupo vem com uid novo, e os dois exercícios apontam o uid novo.
        JsonNode grupoCopia = sessao.get("grupos").get(0);
        assertThat(grupoCopia.get("tecnica").asString()).isEqualTo("SUPERSET");
        assertThat(grupoCopia.get("descansoAposSegundos").asInt()).isEqualTo(90);
        assertThat(grupoCopia.get("uid").asString()).isNotEqualTo(grupo.uid().toString());
        assertThat(exercicios.get(0).get("grupoUid").asString()).isEqualTo(grupoCopia.get("uid").asString());
        assertThat(exercicios.get(1).get("grupoUid").asString()).isEqualTo(grupoCopia.get("uid").asString());
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
