package br.com.treinos.api.painel;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Planos terminando" do painel com plano agendado (V106): o vigente sai da lista quando há sucessor agendado do mesmo aluno
 * liberado até o dia seguinte ao fim dele (dias de Brasília); liberado depois disso, continua listado (haverá intervalo sem
 * plano). Dados fictícios; cada caso tem o próprio aluno e a afirmação é só sobre ele.
 */
@AutoConfigureMockMvc
class PlanoTerminandoComSucessorAgendadoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    private ApiDeTeste api;
    private JsonNode treinador;
    private LocalDate hoje;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        hoje = LocalDate.now(Fuso.BRASILIA);
    }

    /** Aluno com acesso e um treino vigente cuja pasta termina em {@code fim}; devolve o id do aluno. */
    private UUID alunoComVigenteTerminando(String nome, LocalDate fim) throws Exception {
        UUID aluno = api.criarAluno(treinador, nome);
        api.convidarEEntrar(treinador, aluno);
        publicar(aluno, hoje, fim, null);
        return aluno;
    }

    /** Treino numa pasta nova (período dado) publicado na hora ou agendado. */
    private void publicar(UUID aluno, LocalDate inicio, LocalDate fim, LocalDate liberarEm) throws Exception {
        UUID pasta = UUID.fromString(api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Ciclo", "inicio", inicio.toString(), "fim", fim.toString()), 200).path("id").asString());
        JsonNode plano = api.post("/alunos/" + aluno + "/planos-treino", treinador,
                Map.of("titulo", "Plano de teste", "pastaId", pasta), 200);
        JsonNode salvo = api.put("/planos-treino/" + plano.path("plano").path("id").asString() + "/rascunho", treinador,
                ApiDeTeste.rascunho("Plano de teste", ApiDeTeste.treino().conteudo(), plano.path("plano").path("versao").asLong()), 200);
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("versao", salvo.path("plano").path("versao").asLong());
        corpo.put("confirmarAvisos", true);
        if (liberarEm != null) corpo.put("liberarEm", liberarEm.toString());
        api.post("/planos-treino/" + plano.path("plano").path("id").asString() + "/publicar", treinador, corpo, 200);
    }

    private boolean listado(UUID aluno) throws Exception {
        for (JsonNode p : api.get("/painel", treinador, 200).path("planosTerminando")) {
            if (aluno.toString().equals(p.path("aluno").path("id").asString())) {
                return true;
            }
        }
        return false;
    }

    @Test
    void semSucessorOVigenteQueTerminaContinuaListado() throws Exception {
        UUID aluno = alunoComVigenteTerminando("Aluno Fictício Sem Sucessor", hoje.plusDays(3));
        assertThat(listado(aluno)).isTrue();
    }

    @Test
    void sucessorLiberadoAteODiaSeguinteAoFimTiraOVigenteDaLista() throws Exception {
        LocalDate fim = hoje.plusDays(3);
        UUID aluno = alunoComVigenteTerminando("Aluno Fictício Sucessor No Prazo", fim);
        publicar(aluno, fim.plusDays(1), fim.plusDays(30), fim.plusDays(1));
        assertThat(listado(aluno)).isFalse();

        // Liberado antes do fim também conta como sucessor.
        UUID outro = alunoComVigenteTerminando("Aluno Fictício Sucessor Antes", fim);
        publicar(outro, fim, fim.plusDays(30), hoje.plusDays(1));
        assertThat(listado(outro)).isFalse();
    }

    @Test
    void sucessorLiberadoDepoisDoDiaSeguinteAoFimMantemOVigenteNaLista() throws Exception {
        LocalDate fim = hoje.plusDays(3);
        UUID aluno = alunoComVigenteTerminando("Aluno Fictício Sucessor Tarde", fim);
        publicar(aluno, fim.plusDays(2), fim.plusDays(30), fim.plusDays(2));
        assertThat(listado(aluno)).isTrue();
    }
}
