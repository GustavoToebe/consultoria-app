package br.com.treinos.api.receitas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.treino.ConteudoTreino;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@AutoConfigureMockMvc
class PlanejamentoIntegrationTest extends AbstractIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    ApiDeTeste api;
    JsonNode treinador;
    UUID aluno;

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno fictício de planejamento");
    }

    private JsonNode modelo(String tipo, Object conteudo) throws Exception {
        return api.post("/receitas", treinador, Map.of("tipo", tipo, "nome", "Modelo fictício", "conteudo", conteudo), 200);
    }
    private JsonNode aplicar(JsonNode modelo, UUID aluno) throws Exception {
        return api.post("/receitas/" + modelo.get("id").asString() + "/aplicar", treinador,
                Map.of("alunoId", aluno, "titulo", "Cópia fictícia"), 200);
    }
    private JsonNode plano(JsonNode aplicado) throws Exception {
        return api.get("/planos-treino/" + aplicado.get("planoId").asString(), treinador, 200);
    }

    @Test void crudPastasEModelosTemIsolamentoEConflito() throws Exception {
        var outra = api.novoTreinador();
        var pasta = api.post("/pastas-modelos", treinador, Map.of("nome", "Base"), 200);
        String pastaId = pasta.get("id").asString();
        var r = api.post("/receitas", treinador, Map.of("tipo", "PLANO_TREINO", "nome", "Semana", "conteudo", ApiDeTeste.treino().conteudo(), "pastaId", pastaId), 200);
        String id = r.get("id").asString();
        assertThat(api.get("/pastas-modelos", outra, 200)).isEmpty();
        api.get("/receitas/" + id, outra, 404);
        api.delete("/receitas/" + id, outra, 404);
        api.delete("/pastas-modelos/" + pastaId, outra, 404);
        api.post("/receitas", outra, Map.of("tipo", "PLANO_TREINO", "nome", "Inválido", "conteudo", ApiDeTeste.treino().conteudo(), "pastaId", pastaId), 404);
        var edicao = Map.of("nome", "Semana editada", "conteudo", r.get("conteudo"), "versao", r.get("versao").asLong());
        api.put("/receitas/" + id + "/conteudo", treinador, edicao, 200);
        api.put("/receitas/" + id + "/conteudo", treinador, edicao, 409);
        var copia = api.post("/receitas/" + id + "/duplicar", treinador, null, 200);
        assertThat(copia.get("id")).isNotEqualTo(r.get("id"));
        assertThat(copia.get("pastaId").asString()).isEqualTo(pastaId);
        api.put("/pastas-modelos/" + pastaId, treinador, Map.of("nome", "Renomeada", "versao", pasta.get("versao").asLong()), 200);
        api.put("/pastas-modelos/" + pastaId, treinador, Map.of("nome", "Outra aba", "versao", pasta.get("versao").asLong()), 409);
        api.delete("/pastas-modelos/" + pastaId, treinador, 204);
        assertThat(api.get("/receitas/" + id, treinador, 200).get("pastaId").isNull()).isTrue();
    }

    @Test void aplicarCopiaUidsEMetodologiaSemAlterarAlunosAoEditarOuExcluirModelo() throws Exception {
        var metodologia = modelo("METODOLOGIA", ConfiguracaoConsultoria.padrao());
        var treino = ApiDeTeste.treino().conteudo();
        var conteudo = new ConteudoTreino(treino.objetivo(), treino.orientacoes(), treino.sessoes(),
                new ConteudoTreino.Metodologia(UUID.fromString(metodologia.get("id").asString()), "Método fictício", ConfiguracaoConsultoria.padrao()));
        var modelo = modelo("PLANO_TREINO", conteudo);
        var a = aplicar(modelo, aluno);
        var b = aplicar(modelo, api.criarAluno(treinador, "Outro aluno fictício"));
        var planoA = plano(a); var planoB = plano(b);
        assertThat(planoA.at("/rascunho/sessoes/0/uid")).isNotEqualTo(planoB.at("/rascunho/sessoes/0/uid"));
        assertThat(planoA.at("/rascunho/sessoes/0/exercicios/0/series/0/uid")).isNotEqualTo(modelo.at("/conteudo/sessoes/0/exercicios/0/series/0/uid"));
        String id = a.get("planoId").asString();
        api.post("/planos-treino/" + id + "/publicar", treinador, Map.of("versao", planoA.at("/plano/versao").asLong(), "confirmarAvisos", true), 200);
        api.put("/receitas/" + modelo.get("id").asString() + "/conteudo", treinador,
                Map.of("nome", "Modelo alterado", "conteudo", new ConteudoTreino("Mudou", null, List.of()), "versao", modelo.get("versao").asLong()), 200);
        api.delete("/receitas/" + metodologia.get("id").asString(), treinador, 204);
        api.delete("/receitas/" + modelo.get("id").asString(), treinador, 204);
        assertThat(plano(a).get("rascunho")).isEqualTo(planoA.get("rascunho"));
        assertThat(api.get("/planos-treino/" + id + "/versoes/1", treinador, 200).at("/conteudo/metodologia/nome").asString()).isEqualTo("Método fictício");
        var loginAluno = api.convidarEEntrar(treinador, aluno);
        assertThat(api.get("/aluno/painel", loginAluno, 200).at("/configuracao/tipoTrabalho").asString()).isEqualTo("WS");
    }

    @Test void pastaModeloAplicaTreinoEDietaComoRascunhosIndependentes() throws Exception {
        var dieta = Map.of("refeicoes", List.of(), "orientacoes", List.of(), "suplementacao", List.of());
        var m = modelo("PASTA_PLANO", Map.of("planos", List.of(Map.of("titulo", "Semana fictícia", "treino", ApiDeTeste.treino().conteudo()), Map.of("titulo", "Dieta fictícia", "dieta", dieta))));
        var aplicada = aplicar(m, aluno);
        var treinos = api.get("/alunos/" + aluno + "/planos-treino", treinador, 200);
        var dietas = api.get("/alunos/" + aluno + "/planos-dieta", treinador, 200);
        assertThat(treinos).hasSize(1); assertThat(dietas).hasSize(1);
        assertThat(treinos.get(0).get("pastaId")).isEqualTo(aplicada.get("pastaId"));
        assertThat(dietas.get(0).get("ativo").asBoolean()).isFalse();
        var salvo = api.post("/pastas/" + aplicada.get("pastaId").asString() + "/salvar-como-modelo", treinador, Map.of("nome", "Pacote salvo"), 200);
        assertThat(salvo.at("/conteudo/planos")).hasSize(2);
        api.delete("/pastas/" + aplicada.get("pastaId").asString(), treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/planos-dieta", treinador, 200)).isEmpty();
        assertThat(api.get("/receitas/" + salvo.get("id").asString(), treinador, 200).at("/conteudo/planos")).hasSize(2);
    }

    @Test void pastaModeloComMobilidadeAplicaSalvaEExigeExatamenteUmTipo() throws Exception {
        var mob = Map.of("secoes", List.of(Map.of("titulo", "Alongamentos", "itens", List.of(Map.of("nome", "Gato e vaca")))));
        var m = modelo("PASTA_PLANO", Map.of("planos", List.of(Map.of("titulo", "Mobilidade fictícia", "mobilidade", mob))));
        var aplicada = aplicar(m, aluno);
        var lista = api.get("/alunos/" + aluno + "/planos-mobilidade", treinador, 200);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("pastaId")).isEqualTo(aplicada.get("pastaId"));
        var rascunho = api.get("/planos-mobilidade/" + lista.get(0).get("id").asString(), treinador, 200);
        assertThat(rascunho.at("/rascunho/secoes/0/itens/0/uid").asString()).isNotBlank();
        var salvo = api.post("/pastas/" + aplicada.get("pastaId").asString() + "/salvar-como-modelo", treinador,
                Map.of("nome", "Pacote com mobilidade"), 200);
        assertThat(salvo.at("/conteudo/planos")).hasSize(1);
        assertThat(salvo.at("/conteudo/planos/0/mobilidade/secoes/0/itens/0/nome").asString()).isEqualTo("Gato e vaca");
        // Dois tipos no mesmo plano, ou nenhum, são recusados.
        var treino = ApiDeTeste.treino().conteudo();
        api.post("/receitas", treinador, Map.of("tipo", "PASTA_PLANO", "nome", "Inválido", "conteudo",
                Map.of("planos", List.of(Map.of("titulo", "Dois", "treino", treino, "mobilidade", mob)))), 400);
        api.post("/receitas", treinador, Map.of("tipo", "PASTA_PLANO", "nome", "Inválido", "conteudo",
                Map.of("planos", List.of(Map.of("titulo", "Nenhum")))), 400);
        // Mobilidade sem seção não entra no pacote.
        api.post("/receitas", treinador, Map.of("tipo", "PASTA_PLANO", "nome", "Inválido", "conteudo",
                Map.of("planos", List.of(Map.of("titulo", "Vazia", "mobilidade", Map.of("secoes", List.of()))))), 400);
    }

    @Test void excluirPlanoPreservaPublicacaoEDesativaSemExporAOutros() throws Exception {
        var treino = ApiDeTeste.treino();
        var publicado = api.publicarTreino(treinador, aluno, treino.conteudo());
        String id = publicado.at("/plano/id").asString();
        var loginAluno = api.convidarEEntrar(treinador, aluno);
        var versao = api.get("/planos-treino/" + id + "/versoes/1", treinador, 200);
        var registro = Map.of("id", UUID.randomUUID(), "planoVersaoId", versao.get("id").asString(),
                "sessaoUid", treino.sessaoUid(), "exercicioUid", treino.exercicioUid(), "serieUid", treino.wsUid(),
                "data", java.time.LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA), "concluida", true,
                "alteradoNoAparelhoEm", java.time.Instant.now());
        var lote = api.post("/aluno/execucoes/lote", loginAluno, Map.of("registros", List.of(registro)), 200);
        assertThat(lote.at("/resultados/0/situacao").asString()).isEqualTo("ACEITO");
        api.delete("/planos-treino/" + id, api.novoTreinador(), 404);
        api.delete("/planos-treino/" + id, treinador, 204);
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).isEmpty();
        assertThat(api.get("/planos-treino/" + id + "/versoes/1", treinador, 200).get("conteudo")).isNotNull();
        assertThat(api.get("/alunos/" + aluno + "/execucoes", treinador, 200)).hasSize(1);
        assertThat(api.get("/aluno/execucoes", loginAluno, 200)).hasSize(1);
        var removido = api.get("/planos-treino/" + id, treinador, 200);
        assertThat(removido.at("/plano/ativo").asBoolean()).isFalse();
        api.post("/planos-treino/" + id + "/publicar", treinador, Map.of("versao", removido.at("/plano/versao").asLong(), "confirmarAvisos", true), 400);
    }

    @Test void rejeitaConteudoInvalidoEAlunoNaoPodeGerenciarModelos() throws Exception {
        api.post("/receitas", treinador, Map.of("tipo", "METODOLOGIA", "nome", "Inválido", "conteudo", Map.of()), 400);
        api.post("/receitas", treinador, Map.of("tipo", "SESSAO_TREINO", "nome", "Inválido", "conteudo", ApiDeTeste.treino().conteudo()), 400);
        api.post("/receitas", treinador, Map.of("tipo", "REFEICAO", "nome", "Inválido", "conteudo", Map.of("refeicoes", List.of())), 400);
        api.post("/receitas", treinador, Map.of("tipo", "PASTA_PLANO", "nome", "Inválido", "conteudo", Map.of("planos", List.of(Map.of("titulo", "Sem conteúdo")))), 400);
        var login = api.convidarEEntrar(treinador, aluno);
        api.get("/pastas-modelos", login, 403);
        api.get("/receitas", login, 403);
    }

    @Test void modeloDeMobilidadeGuardaItensComVideoValidadoEAplicaComoRascunho() throws Exception {
        var item = Map.of("nome", "Lunge Stretch", "prescricao", "2 x 20s cada lado", "videoUrl", "https://www.youtube.com/watch?v=tsGPYSQbZx4");
        var conteudo = Map.of("orientacoes", "Podem ser feitos todos os dias.", "secoes", List.of(Map.of("titulo", "Alongamentos", "itens", List.of(item))));
        var criado = modelo("MOBILIDADE", conteudo);
        assertThat(criado.get("conteudo").get("secoes").get(0).get("itens").get(0).get("nome").asString()).isEqualTo("Lunge Stretch");
        assertThat(api.get("/receitas?tipo=MOBILIDADE", treinador, 200)).hasSize(1);
        var aplicada = aplicar(criado, aluno);
        assertThat(aplicada.get("tipo").asString()).isEqualTo("mobilidade");
        var plano = api.get("/planos-mobilidade/" + aplicada.get("planoId").asString(), treinador, 200);
        assertThat(plano.at("/plano/pastaId").asString()).isEqualTo(aplicada.get("pastaId").asString());
        assertThat(plano.at("/rascunho/secoes/0/itens/0/uid").asString()).isNotBlank();
        assertThat(plano.at("/plano/ativo").asBoolean()).isFalse();
        var semVideo = Map.of("secoes", List.of(Map.of("titulo", "Mobilidade", "itens", List.of(Map.of("nome", "Item sem vídeo")))));
        modelo("MOBILIDADE", semVideo);
        var videoRuim = Map.of("secoes", List.of(Map.of("titulo", "X", "itens", List.of(Map.of("nome", "Item", "videoUrl", "https://exemplo.com/v")))));
        api.post("/receitas", treinador, Map.of("tipo", "MOBILIDADE", "nome", "Inválido", "conteudo", videoRuim), 400);
        api.post("/receitas", treinador, Map.of("tipo", "MOBILIDADE", "nome", "Inválido", "conteudo", Map.of("secoes", List.of())), 400);
        api.get("/receitas?tipo=MOBILIDADE", api.novoTreinador(), 200);
    }

    @Test void modeloDeMobilidadeGravaVideoLimpoEVazioComoNulo() throws Exception {
        var itens = List.of(Map.of("nome", "Com espaços", "videoUrl", "  https://youtu.be/tsGPYSQbZx4  "),
                Map.of("nome", "Vazio", "videoUrl", ""));
        var criado = modelo("MOBILIDADE", Map.of("secoes", List.of(Map.of("titulo", "Alongamentos", "itens", itens))));
        var gravados = criado.get("conteudo").get("secoes").get(0).get("itens");
        assertThat(gravados.get(0).get("videoUrl").asString()).isEqualTo("https://youtu.be/tsGPYSQbZx4");
        assertThat(gravados.get(1).get("videoUrl").isNull()).isTrue();
        var lido = api.get("/receitas/" + criado.get("id").asString(), treinador, 200);
        assertThat(lido.get("conteudo").get("secoes").get(0).get("itens").get(0).get("videoUrl").asString())
                .isEqualTo("https://youtu.be/tsGPYSQbZx4");
    }

    @Test void aplicarRejeitaDestinoDeOutroAlunoOuConsultoriaSemCriarPlanos() throws Exception {
        var m = modelo("PLANO_TREINO", ApiDeTeste.treino().conteudo());
        var outroAluno = api.criarAluno(treinador, "Aluno fictício destino");
        var pasta = api.post("/alunos/" + outroAluno + "/pastas", treinador, Map.of("titulo", "Outra pasta"), 200);
        api.post("/receitas/" + m.get("id").asString() + "/aplicar", treinador, Map.of("alunoId", aluno, "pastaId", pasta.get("id").asString(), "titulo", "Inválido"), 404);
        var outro = api.novoTreinador(); var externo = api.criarAluno(outro, "Aluno externo fictício");
        api.post("/receitas/" + m.get("id").asString() + "/aplicar", treinador, Map.of("alunoId", externo, "titulo", "Inválido"), 404);
        assertThat(api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)).isEmpty();
        assertThat(api.get("/alunos/" + aluno + "/pastas", treinador, 200)).isEmpty();
    }
}
