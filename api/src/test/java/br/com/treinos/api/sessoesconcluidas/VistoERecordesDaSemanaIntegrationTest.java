package br.com.treinos.api.sessoesconcluidas;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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
 * "Visto" do treinador e "Recordes da semana" (Engajamento 0.5). A suíte liga {@code TREINOS_RETORNO_HABILITADO}; o 503
 * com a chave desligada está em {@code RetornoDesligadoIntegrationTest}. Só dados fictícios.
 */
@AutoConfigureMockMvc
class VistoERecordesDaSemanaIntegrationTest extends AbstractIntegrationTest {

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
    private ApiDeTeste.TreinoDeTeste treino;
    private String versaoId;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        alunoId = api.criarAluno(treinador, "Aluno Fictício Visto");
        treino = ApiDeTeste.treino();
        api.publicarTreino(treinador, alunoId, treino.conteudo());
        aluno = api.convidarEEntrar(treinador, alunoId);
        versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
    }

    @Test
    void vistoEIdempotenteOAlunoVeEDesfazerApaga() throws Exception {
        UUID id = concluir(true);
        String url = "/alunos/" + alunoId + "/sessoes-concluidas/" + id + "/visto";
        String primeiro = api.put(url, treinador, Map.of(), 200).get("vistoEm").asString();
        // De novo: não duplica e devolve o mesmo instante.
        assertThat(api.put(url, treinador, Map.of(), 200).get("vistoEm").asString()).isEqualTo(primeiro);
        assertThat(jdbc.queryForObject("select count(*) from sessao_concluida_visto where aluno_id = ?", Integer.class, alunoId)).isEqualTo(1);

        assertThat(api.get("/aluno/sessoes-concluidas", aluno, 200).get("sessoes").get(0).get("vistoEm").isNull()).isFalse();
        assertThat(api.get("/alunos/" + alunoId + "/sessoes-concluidas", treinador, 200).get("sessoes").get(0).get("vistoEm").isNull()).isFalse();

        api.delete(url, treinador, 204);
        api.delete(url, treinador, 204);
        assertThat(api.get("/aluno/sessoes-concluidas", aluno, 200).get("sessoes").get(0).get("vistoEm").isNull()).isTrue();
    }

    @Test
    void reabertoDa409OutroAlunoEOutraConsultoriaDao404() throws Exception {
        UUID reaberto = concluir(false);
        assertThat(api.put("/alunos/" + alunoId + "/sessoes-concluidas/" + reaberto + "/visto", treinador, Map.of(), 409)
                .get("codigo").asString()).isEqualTo("TREINO_NAO_CONCLUIDO");

        UUID id = concluirEm(hoje.minusDays(1));
        UUID outroAluno = api.criarAluno(treinador, "Outro Aluno Fictício Visto");
        api.put("/alunos/" + outroAluno + "/sessoes-concluidas/" + id + "/visto", treinador, Map.of(), 404);
        api.put("/alunos/" + alunoId + "/sessoes-concluidas/" + UUID.randomUUID() + "/visto", treinador, Map.of(), 404);
        JsonNode deOutraConsultoria = api.novoTreinador();
        api.put("/alunos/" + alunoId + "/sessoes-concluidas/" + id + "/visto", deOutraConsultoria, Map.of(), 404);
    }

    @Test
    void soQuemTemRegistroReagirMarcaEOTreinadorPadraoTem() throws Exception {
        UUID id = concluir(true);
        String url = "/alunos/" + alunoId + "/sessoes-concluidas/" + id + "/visto";
        api.put(url, membro(Set.of("ALUNO_LER", "REGISTRO_LER")), Map.of(), 403);
        api.put(url, membro(Set.of("ALUNO_LER", "REGISTRO_LER", "REGISTRO_REAGIR")), Map.of(), 200);
        Integer noTreinadorPadrao = jdbc.queryForObject("""
                select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id
                where p.nome = 'Treinador' and pp.codigo = 'REGISTRO_REAGIR'
                  and p.consultoria_id = (select consultoria_id from aluno where id = ?)""", Integer.class, alunoId);
        assertThat(noTreinadorPadrao).isEqualTo(1);
        Integer naNutricionista = jdbc.queryForObject("""
                select count(*) from perfil_permissao pp join perfil p on p.id = pp.perfil_id
                where p.nome = 'Nutricionista' and pp.codigo = 'REGISTRO_REAGIR'
                  and p.consultoria_id = (select consultoria_id from aluno where id = ?)""", Integer.class, alunoId);
        assertThat(naNutricionista).isZero();
    }

    @Test
    void recordesDaSemanaComparamComOQueVeioAntesDoPeriodo() throws Exception {
        enviarSeries(List.of(
                serie(treino.wsUid(), hoje.minusDays(20), "60", 10),
                serie(treino.wsUid(), hoje.minusDays(2), "65", 10),
                serie(treino.backOffUid(), hoje.minusDays(2), "50", 8),
                serie(treino.wsUid(), hoje, "65", 10)));

        JsonNode daConsultoria = api.get("/recordes/semana", treinador, 200);
        assertThat(daConsultoria.get("de").asString()).isEqualTo(hoje.minusDays(6).toString());
        assertThat(daConsultoria.get("total").asInt()).isEqualTo(1);
        JsonNode r = daConsultoria.get("series").get(0);
        assertThat(r.get("alunoId").asString()).isEqualTo(alunoId.toString());
        assertThat(r.get("alunoNome").asString()).isEqualTo("Aluno Fictício Visto");
        assertThat(r.get("data").asString()).isEqualTo(hoje.minusDays(2).toString());
        assertThat(r.get("exercicioNome").asString()).isEqualTo("Remada baixa na polia");
        assertThat(r.get("recordes").valueStream().map(x -> x.get("tipo").asString())).containsExactly("MAIOR_CARGA", "MAIOR_VOLUME");

        assertThat(api.get("/alunos/" + alunoId + "/recordes/semana", treinador, 200).get("total").asInt()).isEqualTo(1);
        // "Meus alunos": quem cria o aluno vira o responsável, então o treinador o vê; outro membro, não.
        assertThat(api.get("/recordes/semana?meus=true", treinador, 200).get("total").asInt()).isEqualTo(1);
        JsonNode outroMembro = membro(Set.of("ALUNO_LER", "REGISTRO_LER"));
        assertThat(api.get("/recordes/semana", outroMembro, 200).get("total").asInt()).isEqualTo(1);
        assertThat(api.get("/recordes/semana?meus=true", outroMembro, 200).get("total").asInt()).isZero();
        // Outra consultoria não vê nada nem a ficha.
        JsonNode outra = api.novoTreinador();
        assertThat(api.get("/recordes/semana", outra, 200).get("total").asInt()).isZero();
        api.get("/alunos/" + alunoId + "/recordes/semana", outra, 404);
        api.get("/recordes/semana", membro(Set.of("ALUNO_LER")), 403);
    }

    private UUID concluir(boolean concluida) throws Exception {
        return concluirEm(hoje, concluida);
    }

    private UUID concluirEm(LocalDate data) throws Exception {
        return concluirEm(data, true);
    }

    private UUID concluirEm(LocalDate data, boolean concluida) throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", id.toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("data", data.toString());
        r.put("concluida", concluida);
        r.put("resultado", concluida ? "COMPLETA" : null);
        r.put("duracaoSegundos", null);
        r.put("comentario", null);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        JsonNode resposta = api.post("/aluno/sessoes-concluidas", aluno, Map.of("registros", List.of(r)), 200);
        assertThat(resposta.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");
        return id;
    }

    private Map<String, Object> serie(UUID serieUid, LocalDate data, String carga, int reps) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", UUID.randomUUID().toString());
        r.put("planoVersaoId", versaoId);
        r.put("sessaoUid", treino.sessaoUid().toString());
        r.put("exercicioUid", treino.exercicioUid().toString());
        r.put("serieUid", serieUid.toString());
        r.put("data", data.toString());
        r.put("carga", carga);
        r.put("repeticoes", reps);
        r.put("concluida", true);
        r.put("alteradoNoAparelhoEm", Instant.now().toString());
        return r;
    }

    private void enviarSeries(List<Map<String, Object>> registros) throws Exception {
        JsonNode resposta = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", registros), 200);
        assertThat(resposta.get("resultados").valueStream().map(x -> x.get("situacao").asString())).containsOnly("ACEITO");
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
