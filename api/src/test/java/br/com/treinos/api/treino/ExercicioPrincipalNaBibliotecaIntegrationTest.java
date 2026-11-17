package br.com.treinos.api.treino;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pendência 213: publicar exige que o {@code exercicioId} do exercício principal exista na biblioteca da própria
 * consultoria (nulo = exercício livre; arquivado só avisa; id de outra consultoria conta como inexistente).
 */
@AutoConfigureMockMvc
class ExercicioPrincipalNaBibliotecaIntegrationTest extends AbstractIntegrationTest {

    private static final String CAMPO = "sessoes[0].exercicios[0].exercicioId";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;

    /** Sem a criação automática do ApiDeTeste: aqui o id é exatamente o que o teste escolhe. */
    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json).semBibliotecaAutomatica();
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício");
    }

    private static ConteudoTreino treinoCom(UUID exercicioId) {
        List<Serie> series = List.of(Serie.de(UUID.randomUUID(), "WORKING", 3, 6, Carga.de("CARGA_TRABALHO")));
        ExercicioPlano ex = new ExercicioPlano(UUID.randomUUID(), exercicioId, "Remada baixa na polia", "MAQUINA",
                null, null, true, "kg", series);
        return new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(UUID.randomUUID(), "Segunda - Costas", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
    }

    /** Cria o plano do aluno e salva o conteúdo no rascunho; devolve {id do plano, versão do rascunho}. */
    private String[] rascunho(UUID doAluno, ConteudoTreino conteudo) throws Exception {
        JsonNode plano = api.post("/alunos/" + doAluno + "/planos-treino", treinador, Map.of("titulo", "Plano de teste"), 200);
        String id = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + id + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano de teste", conteudo, plano.get("plano").get("versao").asLong()), 200);
        return new String[]{id, salvo.get("plano").get("versao").asString()};
    }

    private JsonNode publicar(String[] p, boolean confirmarAvisos, int esperado) throws Exception {
        return api.post("/planos-treino/" + p[0] + "/publicar", treinador,
                Map.of("versao", Long.parseLong(p[1]), "confirmarAvisos", confirmarAvisos), esperado);
    }

    @Test
    void principalDaBibliotecaPublica() throws Exception {
        UUID id = api.criarExercicio(treinador, "Remada na biblioteca");
        JsonNode publicado = publicar(rascunho(aluno, treinoCom(id)), true, 200);
        assertThat(publicado.get("plano").get("versaoPublicada").asInt()).isEqualTo(1);
    }

    @Test
    void exercicioLivreSemIdPublica() throws Exception {
        publicar(rascunho(aluno, treinoCom(null)), true, 200);
    }

    @Test
    void idInexistenteDa422SemRepetirOId() throws Exception {
        UUID inexistente = UUID.randomUUID();
        JsonNode erro = publicar(rascunho(aluno, treinoCom(inexistente)), true, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(CAMPO);
        assertThat(erro.toString()).doesNotContain(inexistente.toString());
    }

    @Test
    void idDeOutraConsultoriaContaComoInexistenteSemRepetirOId() throws Exception {
        JsonNode outro = api.novoTreinador();
        UUID alheio = api.criarExercicio(outro, "Remada da outra consultoria");
        JsonNode erro = publicar(rascunho(aluno, treinoCom(alheio)), true, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(CAMPO);
        assertThat(erro.toString()).doesNotContain(alheio.toString());
    }

    @Test
    void exercicioArquivadoSoAvisaEPublicaAoConfirmar() throws Exception {
        UUID id = api.criarExercicio(treinador, "Remada que será arquivada");
        api.delete("/exercicios/" + id, treinador, 204);
        String[] plano = rascunho(aluno, treinoCom(id));
        JsonNode aviso = publicar(plano, false, 422);
        assertThat(aviso.get("codigo").asString()).isEqualTo("CONFIRMAR_AVISOS");
        assertThat(aviso.get("fieldErrors").get(0).get("field").asString()).isEqualTo(CAMPO);
        assertThat(aviso.toString()).doesNotContain(id.toString());
        publicar(plano, true, 200);
    }

    @Test
    void exercicioDeModeloAplicadoAoAlunoCopiadoEReplicadoPublica() throws Exception {
        UUID id = api.criarExercicio(treinador, "Remada do modelo");
        JsonNode modelo = api.post("/receitas", treinador,
                Map.of("tipo", "PLANO_TREINO", "nome", "Modelo fictício", "conteudo", treinoCom(id)), 200);
        JsonNode aplicado = api.post("/receitas/" + modelo.get("id").asString() + "/aplicar", treinador,
                Map.of("alunoId", aluno, "titulo", "Cópia fictícia"), 200);
        String planoId = aplicado.get("planoId").asString();
        long versao = api.get("/planos-treino/" + planoId, treinador, 200).get("plano").get("versao").asLong();
        api.post("/planos-treino/" + planoId + "/publicar", treinador, Map.of("versao", versao, "confirmarAvisos", true), 200);

        // Copiar para outro aluno (mesma consultoria): o destino é rascunho e também publica.
        UUID destino = api.criarAluno(treinador, "Outro Aluno Fictício");
        JsonNode copia = api.post("/planos-treino/" + planoId + "/copiar-para-aluno", treinador,
                Map.of("alunoId", destino, "titulo", "Cópia para outro", "inicio", "2026-11-02", "fim", "2026-11-29"), 200);
        String copiaId = copia.get("planoId").asString();
        long versaoCopia = api.get("/planos-treino/" + copiaId, treinador, 200).get("plano").get("versao").asLong();
        api.post("/planos-treino/" + copiaId + "/publicar", treinador,
                Map.of("versao", versaoCopia, "confirmarAvisos", true), 200);
    }

    @Test
    void replicarAPastaGeraRascunhoQuePublica() throws Exception {
        UUID id = api.criarExercicio(treinador, "Remada da pasta");
        JsonNode pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Ciclo 1", "inicio", "2026-10-05", "fim", "2026-10-20"), 200);
        String pastaId = pasta.get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano", "pastaId", pastaId), 200);
        String planoId = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", treinoCom(id), plano.get("plano").get("versao").asLong()), 200);
        api.post("/planos-treino/" + planoId + "/publicar", treinador,
                Map.of("versao", salvo.get("plano").get("versao").asLong(), "confirmarAvisos", true), 200);

        JsonNode nova = api.post("/pastas/" + pastaId + "/replicar", treinador,
                Map.of("titulo", "Ciclo 2", "inicio", "2026-10-21", "fim", "2026-11-05"), 200);
        for (JsonNode t : api.get("/alunos/" + aluno + "/planos-treino", treinador, 200)) {
            if (nova.get("id").asString().equals(t.path("pastaId").asString(null))) {
                long versao = api.get("/planos-treino/" + t.get("id").asString(), treinador, 200).get("plano").get("versao").asLong();
                api.post("/planos-treino/" + t.get("id").asString() + "/publicar", treinador,
                        Map.of("versao", versao, "confirmarAvisos", true), 200);
                return;
            }
        }
        throw new AssertionError("A pasta replicada não trouxe o treino.");
    }

    @Test
    void publicarTudoDaPastaTambemRecusaIdForaDaBiblioteca() throws Exception {
        UUID inexistente = UUID.randomUUID();
        String pastaId = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Ciclo", "inicio", "2026-10-05", "fim", "2026-10-20"), 200).get("id").asString();
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano", "pastaId", pastaId), 200);
        String planoId = plano.get("plano").get("id").asString();
        JsonNode salvo = api.put("/planos-treino/" + planoId + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano", treinoCom(inexistente), plano.get("plano").get("versao").asLong()), 200);
        JsonNode erro = api.post("/pastas/" + pastaId + "/publicar", treinador, Map.of("confirmarAvisos", true,
                "versoes", Map.of(planoId, salvo.get("plano").get("versao").asLong())), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("treino." + CAMPO);
        assertThat(erro.toString()).doesNotContain(inexistente.toString());
    }
}
