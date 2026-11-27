package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.equipe.CatalogoPermissoes;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET /atualizacoes/{id}/prescricao/treino|dieta}: a versão da pasta que o aluno via no envio, não a de hoje. Cada teste
 * cria a própria consultoria, aluno e pasta. Dados fictícios.
 */
@AutoConfigureMockMvc
class PrescricaoDaEpocaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    private ApiDeTeste api;
    private JsonNode treinador;
    private JsonNode loginAluno;
    private UUID aluno;
    private String pasta;
    private LocalDate hoje;

    @BeforeEach void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        aluno = api.criarAluno(treinador, "Aluno Fictício Prescrição");
        loginAluno = api.convidarEEntrar(treinador, aluno);
        hoje = LocalDate.now(Fuso.BRASILIA);
        pasta = api.post("/alunos/" + aluno + "/pastas", treinador,
                Map.of("titulo", "Período fictício", "inicio", hoje.minusDays(27), "fim", hoje), 200).path("id").asString();
    }

    private static ConteudoDieta dieta(String alimento) {
        return new ConteudoDieta("Objetivo fictício", null, "Treinador Teste", List.of(
                new ConteudoDieta.Refeicao(UUID.randomUUID(), "Almoço", "12:00", null, List.of(
                        new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(new ConteudoDieta.Item(UUID.randomUUID(), UUID.randomUUID(),
                                alimento, new BigDecimal("150"), "g", new BigDecimal("191.7"), BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, false)))))),
                List.of(), null, List.of());
    }

    private String criar(String rota, String titulo) throws Exception {
        return api.post("/alunos/" + aluno + "/" + rota, treinador, Map.of("titulo", titulo, "pastaId", pasta), 200)
                .path("plano").path("id").asString();
    }

    /** Salva o conteúdo no rascunho e publica; {@code liberarEm} nulo = liberado na hora. */
    private void publicar(String rota, String id, Object conteudo, LocalDate liberarEm) throws Exception {
        long versao = api.get("/" + rota + "/" + id, treinador, 200).path("plano").path("versao").asLong();
        JsonNode salvo = api.put("/" + rota + "/" + id + "/rascunho", treinador, ApiDeTeste.rascunho("Plano fictício", conteudo, versao), 200);
        Map<String, Object> corpo = new LinkedHashMap<>(Map.of("versao", salvo.path("plano").path("versao").asLong(), "confirmarAvisos", true));
        if (liberarEm != null) {
            corpo.put("liberarEm", liberarEm.toString());
        }
        api.post("/" + rota + "/" + id + "/publicar", treinador, corpo, 200);
    }

    private JsonNode enviar() throws Exception {
        JsonNode atual = api.get("/aluno/atualizacao", loginAluno, 200);
        assertThat(atual.path("pastaId").asString()).isEqualTo(pasta);
        return api.post("/aluno/atualizacao/enviar", loginAluno, Map.of("pastaId", pasta,
                "questionarioVersaoId", atual.path("questionarioVersaoId").asString(),
                "respostas", Map.of("peso", 80.5, "sono", 7, "alim_desempenho", 8, "treino_desempenho", 6)), 200);
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador,
                Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", CatalogoPermissoes.comDependencias(permissoes)), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    @Test void devolveAVersaoQueValiaNoEnvioENaoADeHoje() throws Exception {
        String treino = criar("planos-treino", "Treino fictício");
        publicar("planos-treino", treino, ApiDeTeste.treino().conteudo(), null);
        String dieta = criar("planos-dieta", "Dieta fictícia");
        publicar("planos-dieta", dieta, dieta("Frango da época"), null);
        // publicada ANTES do envio, mas agendada: o aluno ainda via a versão 1
        publicar("planos-dieta", dieta, dieta("Peixe agendado"), hoje.plusDays(4));
        JsonNode enviada = enviar();
        // publicada DEPOIS do envio
        publicar("planos-treino", treino, ApiDeTeste.treino().conteudo(), null);
        assertThat(api.get("/planos-treino/" + treino, treinador, 200).path("plano").path("versaoPublicada").asInt()).isEqualTo(2);

        String id = enviada.path("id").asString();
        JsonNode doTreino = api.get("/atualizacoes/" + id + "/prescricao/treino", treinador, 200);
        // compara com o gravado: a resposta do envio leva o instante da memória (até 100 ns no Windows) e o Postgres arredonda para µs
        String gravada = api.get("/atualizacoes/" + id, treinador, 200).path("enviadaEm").asString();
        assertThat(Instant.parse(doTreino.path("referencia").asString())).isEqualTo(Instant.parse(gravada));
        assertThat(doTreino.path("versao").path("planoId").asString()).isEqualTo(treino);
        assertThat(doTreino.path("versao").path("numero").asInt()).isEqualTo(1);
        assertThat(doTreino.path("versao").path("conteudo").path("sessoes")).isNotEmpty();

        JsonNode daDieta = api.get("/atualizacoes/" + id + "/prescricao/dieta", treinador, 200);
        assertThat(daDieta.path("versao").path("planoId").asString()).isEqualTo(dieta);
        assertThat(daDieta.path("versao").path("numero").asInt()).isEqualTo(1);
        assertThat(daDieta.toString()).contains("Frango da época").doesNotContain("Peixe agendado");
    }

    @Test void planoArquivadoDepoisDoEnvioContinuaSendoAPrescricaoDaEpoca() throws Exception {
        String antigo = criar("planos-treino", "Treino fictício");
        publicar("planos-treino", antigo, ApiDeTeste.treino().conteudo(), null);
        String id = enviar().path("id").asString();
        api.delete("/planos-treino/" + antigo, treinador, 204);
        String novo = criar("planos-treino", "Treino novo fictício");
        publicar("planos-treino", novo, ApiDeTeste.treino().conteudo(), null);

        JsonNode doTreino = api.get("/atualizacoes/" + id + "/prescricao/treino", treinador, 200);
        assertThat(doTreino.path("versao").path("planoId").asString()).isEqualTo(antigo);
        assertThat(doTreino.path("versao").path("numero").asInt()).isEqualTo(1);
    }

    @Test void semPlanoPublicadoNaPastaAVersaoVemNula() throws Exception {
        publicar("planos-treino", criar("planos-treino", "Treino fictício"), ApiDeTeste.treino().conteudo(), null);
        criar("planos-dieta", "Dieta só em rascunho");
        String id = enviar().path("id").asString();

        JsonNode daDieta = api.get("/atualizacoes/" + id + "/prescricao/dieta", treinador, 200);
        assertThat(daDieta.path("versao").isNull()).isTrue();
        assertThat(daDieta.path("referencia").asString()).isNotEmpty();
    }

    @Test void outraConsultoriaDa404ESemPermissaoDoTipoDa403() throws Exception {
        publicar("planos-treino", criar("planos-treino", "Treino fictício"), ApiDeTeste.treino().conteudo(), null);
        publicar("planos-dieta", criar("planos-dieta", "Dieta fictícia"), dieta("Frango fictício"), null);
        String id = enviar().path("id").asString();

        JsonNode outro = api.novoTreinador();
        for (String tipo : List.of("treino", "dieta")) {
            String corpo = api.get("/atualizacoes/" + id + "/prescricao/" + tipo, outro, 404).toString();
            assertThat(corpo).doesNotContain("Frango").doesNotContain("sessoes");
            api.get("/atualizacoes/" + UUID.randomUUID() + "/prescricao/" + tipo, treinador, 404);
            api.get("/atualizacoes/" + id + "/prescricao/" + tipo, loginAluno, 403);
        }

        JsonNode soTreino = membro(Set.of("ATUALIZACAO_LER", "ALUNO_SENSIVEL_LER", "TREINO_LER"));
        api.get("/atualizacoes/" + id + "/prescricao/treino", soTreino, 200);
        api.get("/atualizacoes/" + id + "/prescricao/dieta", soTreino, 403);
        JsonNode semAtualizacao = membro(Set.of("ALUNO_SENSIVEL_LER", "TREINO_LER", "DIETA_LER"));
        api.get("/atualizacoes/" + id + "/prescricao/treino", semAtualizacao, 403);
    }
}
