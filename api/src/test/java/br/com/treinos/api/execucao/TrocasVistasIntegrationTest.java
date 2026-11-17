package br.com.treinos.api.execucao;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Alternativa;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Visto" do treinador nas trocas de exercício (V080, plano {@code docs/planos/alertas-de-troca.md}, passo 1): o campo
 * {@code vistoEm} da lista do aluno, as pendências do escopo e o PUT/DELETE do visto. Exercícios fictícios; cada teste
 * cria a própria consultoria, então a lista de pendências só tem o que o teste criou.
 */
@AutoConfigureMockMvc
class TrocasVistasIntegrationTest extends AbstractIntegrationTest {

    private static final String PENDENTES = "/trocas-de-exercicio/pendentes";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JsonMapper json;
    @Autowired
    private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID alunoId;
    private JsonNode aluno;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    private UUID principalId;
    private UUID alternativaId;
    private UUID sessaoUid;
    private UUID exercicioUid;
    private UUID wsUid;
    private String versaoId;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        principalId = novoExercicio("Principal fictício");
        alternativaId = novoExercicio("Alternativa fictícia " + UUID.randomUUID());
        alunoId = api.criarAluno(treinador, "Aluno Fictício Troca " + UUID.randomUUID());
        sessaoUid = UUID.randomUUID();
        exercicioUid = UUID.randomUUID();
        wsUid = UUID.randomUUID();
        api.publicarTreino(treinador, alunoId, conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void marcarVistoEIdempotenteDesfazerVoltaEAPendenciaSomaEReaparece() throws Exception {
        trocar(hoje);
        assertThat(api.get(PENDENTES, treinador, 200).get("trocas")).hasSize(1);
        assertThat(vistoEmDaLista(hoje)).isNull();

        String url = urlDoVisto(alunoId);
        String primeiro = api.put(url, treinador, chave(hoje, alternativaId), 200).get("vistoEm").asString();
        // De novo: não duplica e devolve o mesmo instante.
        assertThat(api.put(url, treinador, chave(hoje, alternativaId), 200).get("vistoEm").asString()).isEqualTo(primeiro);
        assertThat(jdbc.queryForObject("select count(*) from troca_exercicio_visto where aluno_id = ?", Integer.class, alunoId))
                .isEqualTo(1);

        assertThat(vistoEmDaLista(hoje)).isNotNull();
        JsonNode pendentes = api.get(PENDENTES, treinador, 200);
        assertThat(pendentes.get("total").asInt()).isZero();
        assertThat(pendentes.get("trocas")).isEmpty();

        api.delete(url, treinador, chave(hoje, alternativaId), 204);
        api.delete(url, treinador, chave(hoje, alternativaId), 204);
        assertThat(jdbc.queryForObject("select count(*) from troca_exercicio_visto where aluno_id = ?", Integer.class, alunoId))
                .isZero();
        assertThat(vistoEmDaLista(hoje)).isNull();
        assertThat(api.get(PENDENTES, treinador, 200).get("trocas")).hasSize(1);
    }

    @Test
    void pendenciaTrazSoNomesDoAlunoEDosExerciciosEAJanelaEDeSeteDias() throws Exception {
        trocar(hoje);
        trocar(hoje.minusDays(6));
        trocar(hoje.minusDays(8));

        JsonNode resposta = api.get(PENDENTES, treinador, 200);
        assertThat(resposta.get("de").asString()).isEqualTo(hoje.minusDays(6).toString());
        assertThat(resposta.get("ate").asString()).isEqualTo(hoje.toString());
        assertThat(resposta.get("total").asInt()).isEqualTo(2);
        // Do mais recente ao mais antigo; a de 8 dias fica fora da pendência.
        assertThat(resposta.get("trocas").valueStream().map(t -> t.get("troca").get("data").asString()))
                .containsExactly(hoje.toString(), hoje.minusDays(6).toString());
        JsonNode primeira = resposta.get("trocas").get(0);
        assertThat(primeira.get("alunoId").asString()).isEqualTo(alunoId.toString());
        assertThat(primeira.get("alunoNome").asString()).startsWith("Aluno Fictício Troca");
        assertThat(primeira.get("troca").get("principal").get("exercicioId").asString()).isEqualTo(principalId.toString());
        assertThat(primeira.get("troca").get("alternativa").get("exercicioId").asString()).isEqualTo(alternativaId.toString());
        assertThat(resposta.toString()).doesNotContain("carga").doesNotContain("repeticoes").doesNotContain("observacao");

        // A de 8 dias ainda aparece na lista do aluno com período explícito e aceita o visto (até 31 dias).
        assertThat(api.get("/alunos/" + alunoId + "/trocas-de-exercicio?de=" + hoje.minusDays(10) + "&ate=" + hoje, treinador, 200)
                .get("trocas")).hasSize(3);
        api.put(urlDoVisto(alunoId), treinador, chave(hoje.minusDays(8), alternativaId), 200);
    }

    @Test
    void meusFiltraPeloResponsavelEAlunoInativoNaoApareceNasPendencias() throws Exception {
        trocar(hoje);
        JsonNode outroMembro = membro(Set.of("ALUNO_LER", "REGISTRO_LER"));
        // Quem criou o aluno é o responsável: "Meus alunos" o traz; outro membro vê a consultoria toda, mas não os "meus".
        assertThat(api.get(PENDENTES + "?meus=true", treinador, 200).get("total").asInt()).isEqualTo(1);
        assertThat(api.get(PENDENTES, outroMembro, 200).get("total").asInt()).isEqualTo(1);
        assertThat(api.get(PENDENTES + "?meus=true", outroMembro, 200).get("total").asInt()).isZero();

        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        assertThat(api.get(PENDENTES, treinador, 200).get("total").asInt()).isZero();
        // A ficha ainda lê a troca do aluno inativo.
        assertThat(api.get("/alunos/" + alunoId + "/trocas-de-exercicio", treinador, 200).get("trocas")).hasSize(1);
    }

    @Test
    void trocaInexistenteForaDaJanelaOuDeOutraConsultoriaDa404() throws Exception {
        trocar(hoje);
        String url = urlDoVisto(alunoId);
        // Alternativa que não foi usada, dia sem troca, futuro, fora dos 31 dias e série sem troca (do principal).
        api.put(url, treinador, chave(hoje, principalId), 404);
        api.put(url, treinador, chave(hoje, UUID.randomUUID()), 404);
        api.put(url, treinador, chave(hoje.minusDays(1), alternativaId), 404);
        api.put(url, treinador, chave(hoje.plusDays(1), alternativaId), 404);
        api.put(url, treinador, chave(hoje.minusDays(40), alternativaId), 404);
        api.delete(url, treinador, chave(hoje.minusDays(1), alternativaId), 404);
        api.put(urlDoVisto(UUID.randomUUID()), treinador, chave(hoje, alternativaId), 404);
        assertThat(jdbc.queryForObject("select count(*) from troca_exercicio_visto where aluno_id = ?", Integer.class, alunoId))
                .isZero();

        JsonNode outra = api.novoTreinador();
        api.put(url, outra, chave(hoje, alternativaId), 404);
        api.delete(url, outra, chave(hoje, alternativaId), 404);
        assertThat(api.get(PENDENTES, outra, 200).get("trocas")).isEmpty();
        api.get("/alunos/" + alunoId + "/trocas-de-exercicio", outra, 404);
    }

    @Test
    void vistoPedeRegistroReagirEAsPendenciasPedemRegistroLer() throws Exception {
        trocar(hoje);
        String url = urlDoVisto(alunoId);
        JsonNode soLer = membro(Set.of("ALUNO_LER", "REGISTRO_LER"));
        api.put(url, soLer, chave(hoje, alternativaId), 403);
        api.delete(url, soLer, chave(hoje, alternativaId), 403);
        api.put(url, membro(Set.of("ALUNO_LER", "REGISTRO_LER", "REGISTRO_REAGIR")), chave(hoje, alternativaId), 200);
        api.get(PENDENTES, membro(Set.of("ALUNO_LER")), 403);
        // O aluno não usa as rotas do treinador.
        api.get(PENDENTES, aluno, 403);
        api.put(url, aluno, chave(hoje, alternativaId), 403);
    }

    @Test
    void corpoIncompletoDa400ESemEfeito() throws Exception {
        trocar(hoje);
        Map<String, Object> semAlternativa = chave(hoje, alternativaId);
        semAlternativa.remove("alternativaId");
        api.put(urlDoVisto(alunoId), treinador, semAlternativa, 400);
        assertThat(jdbc.queryForObject("select count(*) from troca_exercicio_visto where aluno_id = ?", Integer.class, alunoId))
                .isZero();
    }

    // ---- Apoio ----

    private ConteudoTreino conteudo() {
        ExercicioPlano ex = new ExercicioPlano(exercicioUid, principalId, "Principal fictício", "MAQUINA", null, null,
                true, "kg", List.of(Serie.de(wsUid, "WORKING", 3, 6, Carga.de("CARGA_TRABALHO"))))
                .comAlternativas(List.of(new Alternativa(alternativaId, "Alternativa", null)));
        return new ConteudoTreino("Objetivo fictício", null, List.of(
                new Sessao(sessaoUid, "Segunda - Costas", 1, "TREINO", null, null, null, List.of(ex)),
                new Sessao(UUID.randomUUID(), "Domingo - Off", 7, "DESCANSO", null, null, null, List.of())));
    }

    /** O aluno conclui uma série do exercício na alternativa, naquele dia. */
    private void trocar(LocalDate data) throws Exception {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", sessaoUid.toString());
        r.put("exercicioUid", exercicioUid.toString());
        r.put("serieUid", wsUid.toString());
        r.put("data", data.toString());
        r.put("carga", "40");
        r.put("repeticoes", 8);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        r.put("exercicioId", alternativaId.toString());
        JsonNode resposta = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", List.of(r)), 200);
        assertThat(resposta.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");
    }

    private Map<String, Object> chave(LocalDate data, UUID alternativa) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("data", data.toString());
        c.put("planoVersaoId", versaoId);
        c.put("exercicioUid", exercicioUid.toString());
        c.put("alternativaId", alternativa.toString());
        return c;
    }

    private static String urlDoVisto(UUID aluno) {
        return "/alunos/" + aluno + "/trocas-de-exercicio/visto";
    }

    /** O {@code vistoEm} da troca do dia na lista do aluno (período que cobre o dia); nulo = não visto. */
    private String vistoEmDaLista(LocalDate data) throws Exception {
        JsonNode trocas = api.get("/alunos/" + alunoId + "/trocas-de-exercicio?de=" + data + "&ate=" + data, treinador, 200)
                .get("trocas");
        assertThat(trocas).hasSize(1);
        JsonNode v = trocas.get(0).get("vistoEm");
        return v == null || v.isNull() ? null : v.asString();
    }

    private UUID novoExercicio(String nome) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome);
        corpo.put("modalidade", "LIVRE");
        corpo.put("videoUrl", "https://www.youtube.com/watch?v=biblioteca");
        return UUID.fromString(api.post("/exercicios", treinador, corpo, 200).get("id").asString());
    }

    private JsonNode membro(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", treinador, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", treinador,
                Map.of("nome", "Membro fictício", "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }
}
