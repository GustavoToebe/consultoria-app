package br.com.treinos.api.biblioteca;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.UnirGruposRequest;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unir grupos musculares da biblioteca (prévia e união): conta e altera ativos e arquivados, é idempotente (sem alteração
 * não audita), aceita destino novo, não toca outra consultoria nem exercício sem grupo (cardio incluído), pede
 * {@code BIBLIOTECA_ALTERAR}, valida com 422 por campo sem repetir o valor, responde 409 no lock otimista, audita com
 * resumo fixo e o histórico passa a mostrar o nome novo. Só nomes fictícios, únicos por teste.
 */
@AutoConfigureMockMvc
class GruposMuscularesIntegrationTest extends AbstractIntegrationTest {

    private static final String PREVIA = "/exercicios/grupos-musculares/unir/previa";
    private static final String UNIR = "/exercicios/grupos-musculares/unir";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoria;
    private String sufixo;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoria = consultoriaDe(treinador);
        sufixo = UUID.randomUUID().toString().substring(0, 8);
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private String g(String nome) {
        return nome + " " + sufixo;
    }

    private UUID exercicio(JsonNode login, String nome, String grupo) throws Exception {
        return exercicio(login, nome, grupo, "LIVRE");
    }

    private UUID exercicio(JsonNode login, String nome, String grupo, String modalidade) throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("nome", nome + " " + sufixo);
        corpo.put("modalidade", modalidade);
        corpo.put("grupoMuscular", grupo);
        JsonNode e = api.post("/exercicios", login, corpo, 200);
        return UUID.fromString(e.get("id").asString());
    }

    private String grupoDe(UUID id) {
        return banco.queryForObject("select grupo_muscular from exercicio where id = ?", String.class, id);
    }

    private long versaoDe(UUID id) {
        return banco.queryForObject("select versao from exercicio where id = ?", Long.class, id);
    }

    private long eventosDeUniao() {
        return banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = 'GRUPOS_MUSCULARES_UNIDOS'",
                Long.class, consultoria);
    }

    private static Map<String, Object> corpo(List<String> origem, String destino) {
        Map<String, Object> m = new HashMap<>();
        m.put("origem", origem);
        m.put("destino", destino);
        return m;
    }

    private int alterados(String caminho, List<String> origem, String destino) throws Exception {
        return api.post(caminho, treinador, corpo(origem, destino), 200).path("exerciciosAlterados").asInt();
    }

    @Test
    void previaContaAtivosEArquivadosEUnirAlteraUmaVezSo() throws Exception {
        UUID a = exercicio(treinador, "Elevação A", g("Panturrilha"));
        UUID b = exercicio(treinador, "Elevação B", g("Panturrilhas"));
        UUID arquivado = exercicio(treinador, "Elevação C", g("Panturrilhas"));
        api.delete("/exercicios/" + arquivado, treinador, 204);
        UUID outro = exercicio(treinador, "Supino", g("Peito"));
        long versaoDeB = versaoDe(b);
        List<String> origem = List.of(g("Panturrilha"), "  " + g("Panturrilhas") + " ", g("Inexistente"));

        // O destino é um dos nomes da origem: os que já o têm não contam.
        assertThat(alterados(PREVIA, origem, g("Panturrilha"))).isEqualTo(2);
        assertThat(grupoDe(b)).isEqualTo(g("Panturrilhas"));

        assertThat(alterados(UNIR, origem, " " + g("Panturrilha") + " ")).isEqualTo(2);
        assertThat(grupoDe(a)).isEqualTo(g("Panturrilha"));
        assertThat(grupoDe(b)).isEqualTo(g("Panturrilha"));
        assertThat(grupoDe(arquivado)).isEqualTo(g("Panturrilha"));
        assertThat(grupoDe(outro)).isEqualTo(g("Peito"));
        assertThat(versaoDe(b)).isGreaterThan(versaoDeB);
        assertThat(banco.queryForObject("select ativo from exercicio where id = ?", Boolean.class, arquivado)).isFalse();
        assertThat(eventosDeUniao()).isEqualTo(1);

        // Idempotente: repetir não altera nem audita; origem só com o destino também dá 0.
        long versaoUnida = versaoDe(b);
        assertThat(alterados(PREVIA, origem, g("Panturrilha"))).isZero();
        assertThat(alterados(UNIR, origem, g("Panturrilha"))).isZero();
        assertThat(alterados(UNIR, List.of(g("Panturrilha")), g("Panturrilha"))).isZero();
        assertThat(versaoDe(b)).isEqualTo(versaoUnida);
        assertThat(eventosDeUniao()).isEqualTo(1);
        // A lista da Biblioteca já mostra só o nome unido.
        JsonNode grupos = api.get("/exercicios/pagina?tamanho=200", treinador, 200).path("grupos");
        List<String> nomes = new ArrayList<>();
        grupos.forEach(n -> nomes.add(n.asString()));
        assertThat(nomes).contains(g("Panturrilha")).doesNotContain(g("Panturrilhas"));
    }

    @Test
    void destinoNovoEOutraConsultoriaNaoEAfetada() throws Exception {
        UUID a = exercicio(treinador, "Remada", g("Costas"));
        UUID b = exercicio(treinador, "Puxada", g("Dorsal"));
        JsonNode outroTreinador = api.novoTreinador();
        UUID daOutra = exercicio(outroTreinador, "Remada", g("Costas"));
        long versaoDaOutra = versaoDe(daOutra);

        // A prévia também não conta o exercício da outra consultoria com o mesmo nome de grupo.
        assertThat(alterados(PREVIA, List.of(g("Costas"), g("Dorsal")), g("Dorso"))).isEqualTo(2);
        assertThat(alterados(UNIR, List.of(g("Costas"), g("Dorsal")), g("Dorso"))).isEqualTo(2);
        assertThat(grupoDe(a)).isEqualTo(g("Dorso"));
        assertThat(grupoDe(b)).isEqualTo(g("Dorso"));
        assertThat(grupoDe(daOutra)).isEqualTo(g("Costas"));
        assertThat(versaoDe(daOutra)).isEqualTo(versaoDaOutra);
        assertThat(consultoriaDe(outroTreinador)).isNotEqualTo(consultoria);
    }

    @Test
    void cardioESemGrupoNuncaSaoContadosNemAlterados() throws Exception {
        UUID comGrupo = exercicio(treinador, "Desenvolvimento", g("Ombro"));
        // O cardio grava o grupo nulo mesmo que o corpo traga um.
        UUID cardio = exercicio(treinador, "Esteira", g("Ombro"), "CARDIO");
        UUID semGrupo = exercicio(treinador, "Prancha", null);
        assertThat(grupoDe(cardio)).isNull();
        assertThat(grupoDe(semGrupo)).isNull();
        long versaoDoCardio = versaoDe(cardio);
        long versaoSemGrupo = versaoDe(semGrupo);

        assertThat(alterados(PREVIA, List.of(g("Ombro")), g("Deltoide"))).isEqualTo(1);
        assertThat(alterados(UNIR, List.of(g("Ombro")), g("Deltoide"))).isEqualTo(1);
        assertThat(grupoDe(comGrupo)).isEqualTo(g("Deltoide"));
        assertThat(grupoDe(cardio)).isNull();
        assertThat(grupoDe(semGrupo)).isNull();
        assertThat(versaoDe(cardio)).isEqualTo(versaoDoCardio);
        assertThat(versaoDe(semGrupo)).isEqualTo(versaoSemGrupo);
    }

    @Test
    void semBibliotecaAlterarDa403ENadaMuda() throws Exception {
        UUID a = exercicio(treinador, "Agachamento", g("Quadríceps"));
        UUID perfil = UUID.randomUUID();
        banco.update("insert into perfil(id, consultoria_id, nome) values (?, ?, ?)", perfil, consultoria, "Perfil fictício " + perfil);
        banco.update("insert into perfil_permissao(perfil_id, codigo) values (?, ?)", perfil, "BIBLIOTECA_LER");
        banco.update("update usuario set perfil_id = ? where id = ?::uuid", perfil, treinador.path("usuario").path("id").asString());

        api.post(PREVIA, treinador, corpo(List.of(g("Quadríceps")), g("Coxa")), 403);
        api.post(UNIR, treinador, corpo(List.of(g("Quadríceps")), g("Coxa")), 403);
        assertThat(grupoDe(a)).isEqualTo(g("Quadríceps"));
    }

    @Test
    void semAutenticacaoDa401NasDuasRotas() throws Exception {
        UUID a = exercicio(treinador, "Leg press", g("Coxa"));
        api.post(PREVIA, null, corpo(List.of(g("Coxa")), g("Perna")), 401);
        api.post(UNIR, null, corpo(List.of(g("Coxa")), g("Perna")), 401);
        assertThat(grupoDe(a)).isEqualTo(g("Coxa"));
    }

    @Test
    void validacaoDa422PorCampoSemRepetirOValor() throws Exception {
        // Marcador único em todo valor enviado: nenhum erro pode devolvê-lo.
        String marcador = "Marcador" + sufixo;
        String longo = marcador + "X".repeat(61 - marcador.length());
        List<String> cinquentaEUm = Collections.nCopies(51, marcador);
        Object[][] casos = {
            {corpo(null, marcador), "origem"},
            {corpo(List.of(), marcador), "origem"},
            {corpo(cinquentaEUm, marcador), "origem"},
            {corpo(Arrays.asList(marcador, "   "), marcador), "origem[1]"},
            {corpo(Arrays.asList(marcador, null), marcador), "origem[1]"},
            {corpo(Arrays.asList(marcador, longo), marcador), "origem[1]"},
            {corpo(List.of(marcador), null), "destino"},
            {corpo(List.of(marcador), "  "), "destino"},
            {corpo(List.of(marcador), longo), "destino"},
        };
        for (String caminho : List.of(PREVIA, UNIR)) {
            for (Object[] c : casos) {
                JsonNode erro = api.post(caminho, treinador, c[0], 422);
                assertThat(erro.path("codigo").asString()).isEqualTo("GRUPOS_INVALIDOS");
                assertThat(erro.path("fieldErrors").get(0).path("field").asString()).as(c[1].toString()).isEqualTo(c[1]);
                assertThat(erro.toString()).as(c[1].toString()).doesNotContain(marcador);
            }
        }
        // 60 depois do strip cabe, na origem e no destino.
        assertThat(alterados(PREVIA, List.of(" " + "Z".repeat(60) + " "), " " + "Y".repeat(60) + " ")).isZero();
        assertThat(eventosDeUniao()).isZero();
    }

    @Test
    void unirAuditaComResumoFixoEAPreviaNao() throws Exception {
        exercicio(treinador, "Rosca", g("Bíceps"));
        exercicio(treinador, "Rosca martelo", g("Biceps"));
        alterados(PREVIA, List.of(g("Biceps")), g("Bíceps"));
        assertThat(eventosDeUniao()).isZero();
        // União que não acha nada também não audita.
        assertThat(alterados(UNIR, List.of(g("Tríceps")), g("Bíceps"))).isZero();
        assertThat(eventosDeUniao()).isZero();

        assertThat(alterados(UNIR, List.of(g("Biceps")), g("Bíceps"))).isEqualTo(1);
        List<Map<String, Object>> eventos = banco.queryForList(
                "select resumo, entidade from auditoria where consultoria_id = ? and acao = 'GRUPOS_MUSCULARES_UNIDOS'", consultoria);
        assertThat(eventos).hasSize(1);
        assertThat(eventos.getFirst()).containsEntry("resumo", "Grupos musculares unidos").containsEntry("entidade", "EXERCICIO");
    }

    /**
     * Lock otimista no flush (outra união ou um {@code PUT /exercicios/{id}} no meio) vira 409 sem auditar. Com mocks: pela
     * API não dá para encaixar a outra transação entre a leitura e o flush do mesmo pedido.
     */
    @Test
    void exercicioAlteradoNoMeioDa409SemAuditar() {
        ExercicioRepository repositorio = mock(ExercicioRepository.class);
        Auditoria auditoria = mock(Auditoria.class);
        Exercicio e = new Exercicio("Crucifixo", "Peito", null, Exercicio.Modalidade.LIVRE, null, null, Exercicio.Origem.MANUAL);
        when(repositorio.comGrupoParaUnir(any(), any())).thenReturn(List.of(e));
        doThrow(new ObjectOptimisticLockingFailureException(Exercicio.class, UUID.randomUUID())).when(repositorio).flush();

        GruposMuscularesService servico = new GruposMuscularesService(repositorio, auditoria);
        assertThatThrownBy(() -> servico.unir(new UnirGruposRequest(List.of("Peito"), "Peitoral")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("A biblioteca mudou. Confira e tente de novo.")
                .hasFieldOrPropertyWithValue("codigo", "CONFLITO_EDICAO");
        verifyNoInteractions(auditoria);
    }

    /** O histórico lê o grupo ao vivo da biblioteca: depois de unir, um dia passado já mostra o nome novo. */
    @Test
    void historicoMostraONomeUnidoTambemNosDiasPassados() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Fictício " + sufixo);
        ApiDeTeste.TreinoDeTeste treino = ApiDeTeste.treino();
        api.publicarTreino(treinador, alunoId, treino.conteudo());
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);
        String versaoId = api.get("/aluno/painel", aluno, 200).get("treino").get("versaoId").asString();
        banco.update("update exercicio set grupo_muscular = ? where id = ?", g("Costas"), treino.exercicioId());

        Map<String, Object> registro = new LinkedHashMap<>();
        registro.put("id", UUID.randomUUID().toString());
        registro.put("planoVersaoId", versaoId);
        registro.put("sessaoUid", treino.sessaoUid().toString());
        registro.put("exercicioUid", treino.exercicioUid().toString());
        registro.put("serieUid", treino.wsUid().toString());
        registro.put("data", LocalDate.now(Fuso.BRASILIA).minusDays(3).toString());
        registro.put("carga", "30");
        registro.put("repeticoes", 6);
        registro.put("concluida", true);
        registro.put("alteradoNoAparelhoEm", Instant.now().toString());
        JsonNode lote = api.post("/aluno/execucoes/lote", aluno, Map.of("registros", List.of(registro)), 200);
        assertThat(lote.get("resultados").get(0).get("situacao").asString()).isEqualTo("ACEITO");

        assertThat(alterados(UNIR, List.of(g("Costas")), g("Dorso"))).isEqualTo(1);
        JsonNode historico = api.get("/alunos/" + alunoId + "/execucoes", treinador, 200);
        JsonNode exercicio = historico.get(0).get("sessoes").get(0).get("exercicios").get(0);
        assertThat(exercicio.get("grupoMuscular").asString()).isEqualTo(g("Dorso"));
    }
}
