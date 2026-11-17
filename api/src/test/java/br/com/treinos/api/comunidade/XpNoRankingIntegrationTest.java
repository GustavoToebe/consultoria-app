package br.com.treinos.api.comunidade;

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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * XP e nível pela API (plano {@code xp-e-niveis}, passo 2): o próprio aluno recebe o XP no ranking, o colega só o nível, reabrir
 * tira o XP, dois treinos no mesmo dia contam um, e nada vaza entre consultorias. Só dados fictícios. A chave
 * {@code TREINOS_RETORNO_HABILITADO} está ligada na suíte (o caso desligado é do {@code XpServiceTest}).
 */
@AutoConfigureMockMvc
class XpNoRankingIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID alunoA;
    private UUID alunoB;
    private JsonNode loginA;
    private JsonNode loginB;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    /** O treino publicado de um aluno: o plano de teste tem uma sessão TREINO de dia fixo (segunda) e um descanso. */
    private record Plano(ApiDeTeste.TreinoDeTeste treino, String versao) {
    }

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        alunoA = api.criarAluno(admin, "Ana Fictícia Niveis");
        alunoB = api.criarAluno(admin, "Beto Fictício Niveis");
        loginA = api.convidarEEntrar(admin, alunoA);
        loginB = api.convidarEEntrar(admin, alunoB);
    }

    private Plano publicar(JsonNode login, UUID aluno) throws Exception {
        var treino = ApiDeTeste.treino();
        api.publicarTreino(admin, aluno, treino.conteudo());
        jdbc.update("update exercicio set nome = 'Remada baixa na polia', grupo_muscular = 'Costas' where id = ?", treino.exercicioId());
        return new Plano(treino, api.get("/aluno/painel", login, 200).get("treino").get("versaoId").asString());
    }

    /** Conclui (ou reabre, com {@code resultado} nulo) a sessão do plano num dia; {@code quando} decide qual registro vence. */
    private void concluir(JsonNode login, Plano p, UUID id, LocalDate data, String resultado, Instant quando) throws Exception {
        Map<String, Object> sessao = new LinkedHashMap<>();
        sessao.put("id", id.toString());
        sessao.put("planoVersaoId", p.versao());
        sessao.put("sessaoUid", p.treino().sessaoUid().toString());
        sessao.put("data", data.toString());
        sessao.put("concluida", resultado != null);
        if (resultado != null) {
            sessao.put("resultado", resultado);
        }
        sessao.put("alteradoNoAparelhoEm", quando.toString());
        api.post("/aluno/sessoes-concluidas", login, Map.of("registros", List.of(sessao)), 200);
    }

    /** Uma segunda sessão concluída no mesmo dia, gravada direto (o plano de teste só tem uma sessão de treino). */
    private void sessaoDireta(UUID aluno, Plano p, LocalDate data, String resultado) {
        jdbc.update("insert into sessao_concluida(id,consultoria_id,aluno_id,plano_versao_id,sessao_uid,data,concluida,resultado,"
                + "alterado_no_aparelho_em) select ?, consultoria_id, id, ?::uuid, ?, ?, true, ?::varchar, now() from aluno where id = ?",
                UUID.randomUUID(), p.versao(), UUID.randomUUID(), data, resultado, aluno);
    }

    private void serie(JsonNode login, Plano p, LocalDate data, String carga) throws Exception {
        Map<String, Object> serie = new LinkedHashMap<>();
        serie.put("id", UUID.randomUUID().toString());
        serie.put("planoVersaoId", p.versao());
        serie.put("sessaoUid", p.treino().sessaoUid().toString());
        serie.put("exercicioUid", p.treino().exercicioUid().toString());
        serie.put("serieUid", p.treino().wsUid().toString());
        serie.put("data", data.toString());
        serie.put("carga", carga);
        serie.put("repeticoes", 5);
        serie.put("concluida", true);
        serie.put("alteradoNoAparelhoEm", Instant.now().toString());
        api.post("/aluno/execucoes/lote", login, Map.of("registros", List.of(serie)), 200);
    }

    private JsonNode ranking(JsonNode login) throws Exception {
        return api.get("/aluno/comunidade/ranking", login, 200);
    }

    private static List<String> campos(JsonNode no) {
        List<String> lista = new ArrayList<>();
        no.propertyNames().forEach(lista::add);
        return lista;
    }

    private UUID usuarioDoAluno(UUID alunoId) {
        return jdbc.queryForObject("select usuario_id from aluno where id = ?", UUID.class, alunoId);
    }

    @Test
    void rankingGanhaOXpDoProprioAlunoEMantemOsCamposDeAntes() throws Exception {
        JsonNode vazio = ranking(loginA);

        assertThat(campos(vazio)).containsExactlyInAnyOrder("posicao", "treinosConcluidos", "pontuacao", "participantes", "nivel", "xp",
                "xpNoNivel", "faltam");
        assertThat(vazio.get("posicao").asInt()).isEqualTo(1);
        assertThat(vazio.get("pontuacao").asInt()).isZero();
        assertThat(vazio.get("participantes").asInt()).isEqualTo(2);
        assertThat(vazio.get("nivel").asInt()).isEqualTo(1);
        assertThat(vazio.get("xp").asInt()).isZero();
        assertThat(vazio.get("xpNoNivel").asInt()).isZero();
        assertThat(vazio.get("faltam").asInt()).isEqualTo(100);
    }

    @Test
    void treinoCompletoSemanaCompletaEConquistaSomamEReabrirTira() throws Exception {
        Plano p = publicar(loginA, alunoA);
        UUID id = UUID.randomUUID();
        Instant concluiu = Instant.now().minusSeconds(300);

        concluir(loginA, p, id, hoje, "COMPLETA", concluiu);
        JsonNode completo = ranking(loginA);
        // 10 (treino completo) + 20 (o único treino com dia fixo da semana feito) + 50 (PRIMEIRO_TREINO).
        assertThat(completo.get("xp").asInt()).isEqualTo(80);
        assertThat(completo.get("xpNoNivel").asInt()).isEqualTo(80);
        assertThat(completo.get("faltam").asInt()).isEqualTo(20);
        assertThat(completo.get("treinosConcluidos").asInt()).isEqualTo(1);

        // Reabrir tira o treino e a semana; a conquista já gravada continua.
        concluir(loginA, p, id, hoje, null, concluiu.plusSeconds(60));
        JsonNode reaberto = ranking(loginA);
        assertThat(reaberto.get("treinosConcluidos").asInt()).isZero();
        assertThat(reaberto.get("xp").asInt()).isEqualTo(50);

        // Concluir de novo, agora em parte: vale 5 em vez de 10 e a semana volta.
        concluir(loginA, p, id, hoje, "PARCIAL", concluiu.plusSeconds(120));
        JsonNode parcial = ranking(loginA);
        assertThat(parcial.get("xp").asInt()).isEqualTo(75);
        assertThat(parcial.get("nivel").asInt()).isEqualTo(1);
    }

    @Test
    void doisTreinosNoMesmoDiaContamUmSo() throws Exception {
        Plano p = publicar(loginA, alunoA);
        concluir(loginA, p, UUID.randomUUID(), hoje, "COMPLETA", Instant.now().minusSeconds(60));
        sessaoDireta(alunoA, p, hoje, "COMPLETA");

        JsonNode r = ranking(loginA);

        assertThat(r.get("treinosConcluidos").asInt()).isEqualTo(2);
        assertThat(r.get("xp").asInt()).as("o dia vale um treino só: 10 + 20 + 50").isEqualTo(80);
    }

    @Test
    void recordeDeCargaVale15UmaVezPorExercicioPorDiaEOPrimeiroDiaNaoConta() throws Exception {
        Plano p = publicar(loginA, alunoA);
        serie(loginA, p, hoje.minusDays(3), "60");
        serie(loginA, p, hoje.minusDays(2), "70");

        assertThat(ranking(loginA).get("xp").asInt()).isEqualTo(RegrasXp.XP_RECORDE);
    }

    @Test
    void colegaVeSoONivelDoXpEOProprioAlunoVeOXpNoRanking() throws Exception {
        Plano p = publicar(loginB, alunoB);
        serie(loginB, p, hoje.minusDays(3), "60");
        serie(loginB, p, hoje.minusDays(2), "70");                                          // recorde: +15
        concluir(loginB, p, UUID.randomUUID(), hoje, "COMPLETA", Instant.now().minusSeconds(60)); // +10 e semana +20
        sessaoDireta(alunoB, p, hoje.minusDays(1), "PARCIAL");                              // +5
        assertThat(api.get("/aluno/comunidade/conquistas", loginB, 200)).isNotEmpty();      // PRIMEIRO_TREINO: +50
        jdbc.update("update aluno set perfil_reservado = false where id = ?", alunoB);

        JsonNode perfil = api.get("/aluno/comunidade/perfis/" + usuarioDoAluno(alunoB), loginA, 200);
        // 100 XP = nível 2; os 2 treinos concluídos dariam nível 1 na regra de antes (treinos / 10).
        assertThat(perfil.get("treinosConcluidos").asInt()).isEqualTo(2);
        assertThat(perfil.get("nivel").asInt()).isEqualTo(2);
        assertThat(campos(perfil)).doesNotContain("xp", "xpNoNivel", "faltam");

        JsonNode lista = api.get("/aluno/comunidade/perfis", loginA, 200);
        assertThat(lista.get("itens")).hasSize(1);
        assertThat(lista.get("itens").get(0).get("nivel").asInt()).isEqualTo(2);
        assertThat(campos(lista.get("itens").get(0))).containsExactlyInAnyOrder("autorId", "nome", "apelido", "nivel", "temFoto");

        JsonNode dele = ranking(loginB);
        assertThat(dele.get("xp").asInt()).isEqualTo(100);
        assertThat(dele.get("nivel").asInt()).isEqualTo(2);
        assertThat(dele.get("xpNoNivel").asInt()).isZero();
        assertThat(dele.get("faltam").asInt()).isEqualTo(100);
        assertThat(ranking(loginA).get("xp").asInt()).as("o XP de um aluno não aparece para o outro").isZero();
    }

    @Test
    void outraConsultoriaNaoMudaOXpNemAbrePerfil() throws Exception {
        JsonNode outroTreinador = api.novoTreinador();
        UUID deFora = api.criarAluno(outroTreinador, "Aluno de outra consultoria");
        JsonNode loginDeFora = api.convidarEEntrar(outroTreinador, deFora);
        var treino = ApiDeTeste.treino();
        api.publicarTreino(outroTreinador, deFora, treino.conteudo());
        Plano p = new Plano(treino, api.get("/aluno/painel", loginDeFora, 200).get("treino").get("versaoId").asString());
        concluir(loginDeFora, p, UUID.randomUUID(), hoje, "COMPLETA", Instant.now().minusSeconds(60));
        jdbc.update("update aluno set perfil_reservado = false where id = ?", deFora);

        assertThat(ranking(loginA).get("xp").asInt()).isZero();
        assertThat(ranking(loginA).get("participantes").asInt()).isEqualTo(2);
        api.get("/aluno/comunidade/perfis/" + usuarioDoAluno(deFora), loginA, 404);
        assertThat(ranking(loginDeFora).get("xp").asInt()).isEqualTo(80);
    }
}
