package br.com.treinos.api.agenda;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Avisos de compromisso dentro do app (D12, V042): os cinco casos de geração (novo, remarcado só quando muda data, hora
 * ou duração, cancelado, aluno que entra e sai, reabrir), nenhum aviso para compromisso que já terminou, realizado e falta
 * que não avisam, a substituição do não visto (o visto fica), um aviso por aluno em operação de série, as rotas do aluno
 * (só os próprios, visto idempotente, 404 de outro aluno e de outra consultoria, só ALUNO), a limpeza diária, a exportação
 * e a anonimização. Cada teste cria o próprio treinador (consultoria) e só dados fictícios; a consulta direta filtra pelo
 * aluno ou pela consultoria do próprio teste.
 */
@AutoConfigureMockMvc
class AvisosDeCompromissoIntegrationTest extends AbstractIntegrationTest {

    private static final String OBSERVACAO = "Observação fictícia da equipe";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;
    @Autowired private AvisosDeCompromissoRetencao retencao;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;
    private UUID bruna;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício dos Avisos");
        bruna = api.criarAluno(admin, "Bruna Fictícia dos Avisos");
    }

    // ---- auxiliares ----

    private static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    private String eu() {
        return admin.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.path("usuario").path("id").asString());
    }

    private Map<String, Object> pedido(List<UUID> alunoIds, LocalDate data, String hora, int duracao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", eu());
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("local", "Sala 2");
        corpo.put("observacao", OBSERVACAO);
        return corpo;
    }

    private JsonNode marcar(List<UUID> alunoIds, LocalDate data, String hora, int duracao) throws Exception {
        return api.post("/agenda/compromissos", admin, pedido(alunoIds, data, hora, duracao), 200);
    }

    private JsonNode marcar(UUID umAluno, LocalDate data, String hora, int duracao) throws Exception {
        return marcar(List.of(umAluno), data, hora, duracao);
    }

    private JsonNode criarSerie(List<UUID> alunoIds, LocalDate data, String hora, int duracao, int vezes) throws Exception {
        Map<String, Object> corpo = pedido(alunoIds, data, hora, duracao);
        corpo.put("repeticao", Map.of("tipo", "DIARIA", "vezes", vezes));
        return api.post("/agenda/compromissos", admin, corpo, 200);
    }

    /** Os ids das ocorrências da série, em ordem de início. */
    private List<String> ocorrencias(JsonNode primeira) {
        return banco.queryForList("select id::text from compromisso where serie_id = ?::uuid and consultoria_id = ? order by inicio",
                String.class, primeira.path("serieId").asString(), consultoriaDe(admin));
    }

    private JsonNode detalhe(String id) throws Exception {
        return api.get("/agenda/compromissos/" + id, admin, 200);
    }

    /** Remarca/corrige a partir do estado atual de {@code c}, mudando só o que {@code mudanca} mexer. */
    private JsonNode alterar(JsonNode c, Consumer<Map<String, Object>> mudanca, String escopo) throws Exception {
        List<UUID> alunoIds = new ArrayList<>();
        c.path("participantes").forEach(p -> alunoIds.add(UUID.fromString(p.path("id").asString())));
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", c.path("responsavelId").asString());
        corpo.put("data", c.path("data").asString());
        corpo.put("hora", c.path("hora").asString());
        corpo.put("duracaoMinutos", c.path("duracaoMinutos").asInt());
        corpo.put("local", c.path("local").asString());
        corpo.put("observacao", c.path("observacao").asString());
        corpo.put("versao", c.path("versao").asLong());
        mudanca.accept(corpo);
        return api.put("/agenda/compromissos/" + c.path("id").asString() + (escopo == null ? "" : "?escopo=" + escopo), admin,
                corpo, 200);
    }

    private JsonNode alterar(JsonNode c, Consumer<Map<String, Object>> mudanca) throws Exception {
        return alterar(c, mudanca, null);
    }

    private JsonNode cancelar(JsonNode c, boolean cancelado, String escopo) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao"
                + (escopo == null ? "" : "?escopo=" + escopo), admin,
                Map.of("cancelado", cancelado, "versao", c.path("versao").asLong()), 200);
    }

    private JsonNode situacaoDoAluno(JsonNode c, UUID alunoId, String situacao, String escopo) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/alunos/" + alunoId + "/situacao"
                + (escopo == null ? "" : "?escopo=" + escopo), admin,
                Map.of("situacao", situacao, "versao", c.path("versao").asLong()), 200);
    }

    private JsonNode outroMembro() throws Exception {
        String perfilId = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfilId), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    /** Os avisos do aluno no banco, do mais antigo ao mais novo. */
    private List<Map<String, Object>> noBanco(UUID alunoId) {
        return banco.queryForList("select id, tipo, compromisso_id, inicio, responsavel_nome, criado_em, visto_em "
                + "from aviso_compromisso where aluno_id = ? order by criado_em, id", alunoId);
    }

    private List<Map<String, Object>> naoVistosNoBanco(UUID alunoId) {
        return noBanco(alunoId).stream().filter(a -> a.get("visto_em") == null).toList();
    }

    private static String tipo(Map<String, Object> aviso) {
        return (String) aviso.get("tipo");
    }

    private static String compromissoDe(Map<String, Object> aviso) {
        return aviso.get("compromisso_id").toString();
    }

    private static Instant inicioDe(Map<String, Object> aviso) {
        return ((Timestamp) aviso.get("inicio")).toInstant();
    }

    private static Instant instante(JsonNode compromisso) {
        return Instant.parse(compromisso.path("inicio").asString());
    }

    private JsonNode naoVistos(JsonNode loginDoAluno) throws Exception {
        return api.get("/aluno/avisos-de-compromisso", loginDoAluno, 200);
    }

    /** Põe o compromisso em andamento: começou há 30 minutos e termina daqui a 90. */
    private void emAndamento(String compromissoId) {
        banco.update("update compromisso set inicio = now() - interval '30 minutes', fim = now() + interval '90 minutes' "
                + "where id = ?::uuid", compromissoId);
    }

    // ---- geração ----

    @Test
    void compromissoNovoAvisaCadaParticipanteSoComTipoQuandoEResponsavel() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode loginDaBruna = api.convidarEEntrar(admin, bruna);
        JsonNode c = marcar(List.of(aluno, bruna), hoje().plusDays(3), "09:00", 45);

        for (JsonNode login : List.of(loginDoAluno, loginDaBruna)) {
            JsonNode avisos = naoVistos(login);
            assertThat(avisos).hasSize(1);
            JsonNode a = avisos.get(0);
            assertThat(a.path("tipo").asString()).isEqualTo("NOVO");
            assertThat(Instant.parse(a.path("inicio").asString())).isEqualTo(instante(c));
            assertThat(a.path("responsavelNome").asString()).isEqualTo(c.path("responsavelNome").asString());
            // Só a estrutura: o app monta o texto; nada do compromisso, de outro aluno, da equipe nem observação.
            assertThat(a.propertyNames()).containsExactlyInAnyOrder("id", "tipo", "inicio", "responsavelNome");
            assertThat(a.toString()).doesNotContain(OBSERVACAO).doesNotContain("Sala 2").doesNotContain("Bruna")
                    .doesNotContain("Aluno Fictício").doesNotContain(c.path("id").asString()).doesNotContain(eu());
        }
        // Resposta sem cache, e o texto do aviso nunca vem do servidor.
        String corpo = mvc.perform(MockMvcRequestBuilders.get("/aluno/avisos-de-compromisso")
                        .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginDoAluno)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")))
                .andReturn().getResponse().getContentAsString();
        assertThat(corpo).doesNotContain("mensagem").doesNotContain("texto");
    }

    @Test
    void remarcadoSoQuandoMudaDataHoraOuDuracao() throws Exception {
        JsonNode c = marcar(aluno, hoje().plusDays(4), "10:00", 60);
        assertThat(noBanco(aluno)).hasSize(1);
        UUID avisoOriginal = (UUID) noBanco(aluno).getFirst().get("id");

        // Mudar só local, observação ou responsável não avisa nesta etapa.
        c = alterar(c, corpo -> corpo.put("local", "Sala 9"));
        c = alterar(c, corpo -> corpo.put("observacao", "Outra observação fictícia"));
        JsonNode membro = outroMembro();
        String outroResponsavel = membro.path("usuario").path("id").asString();
        c = alterar(c, corpo -> corpo.put("responsavelId", outroResponsavel));
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(noBanco(aluno).getFirst().get("id")).isEqualTo(avisoOriginal);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("NOVO");

        // Hora, duração e data avisam REMARCADO e substituem o não visto (sempre um só, com o início novo).
        c = alterar(c, corpo -> corpo.put("hora", "11:00"));
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("REMARCADO");
        assertThat(inicioDe(noBanco(aluno).getFirst())).isEqualTo(instante(c));
        // O nome é o do responsável do momento do aviso.
        assertThat(noBanco(aluno).getFirst().get("responsavel_nome")).isEqualTo(c.path("responsavelNome").asString());

        UUID idDaHora = (UUID) noBanco(aluno).getFirst().get("id");
        c = alterar(c, corpo -> corpo.put("duracaoMinutos", 90));
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(noBanco(aluno).getFirst().get("id")).isNotEqualTo(idDaHora);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("REMARCADO");

        LocalDate novaData = hoje().plusDays(6);
        c = alterar(c, corpo -> corpo.put("data", novaData.toString()));
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(inicioDe(noBanco(aluno).getFirst())).isEqualTo(instante(c));
        assertThat(c.path("data").asString()).isEqualTo(novaData.toString());
    }

    @Test
    void cancelarOCompromissoInteiroEsoUmAlunoEReabrirViraNovo() throws Exception {
        UUID carla = api.criarAluno(admin, "Carla Fictícia dos Avisos");
        JsonNode c = marcar(List.of(aluno, bruna, carla), hoje().plusDays(5), "08:00", 30);

        // Cancelar só a Bruna avisa só a ela.
        c = situacaoDoAluno(c, bruna, "CANCELADO", null);
        assertThat(tipo(noBanco(bruna).getLast())).isEqualTo("CANCELADO");
        assertThat(noBanco(bruna)).hasSize(1);
        assertThat(inicioDe(noBanco(bruna).getFirst())).isEqualTo(instante(c));
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("NOVO");
        assertThat(tipo(noBanco(carla).getFirst())).isEqualTo("NOVO");

        // Cancelar o compromisso inteiro avisa quem ainda não estava cancelado (a Bruna já sabe).
        UUID avisoDaBruna = (UUID) noBanco(bruna).getFirst().get("id");
        c = cancelar(c, true, null);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("CANCELADO");
        assertThat(tipo(noBanco(carla).getFirst())).isEqualTo("CANCELADO");
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(noBanco(bruna)).hasSize(1);
        assertThat(noBanco(bruna).getFirst().get("id")).isEqualTo(avisoDaBruna);

        // Reabrir é como marcar de novo: NOVO para todos, no lugar do cancelado ainda não visto.
        c = cancelar(c, false, null);
        for (UUID a : List.of(aluno, bruna, carla)) {
            assertThat(noBanco(a)).hasSize(1);
            assertThat(tipo(noBanco(a).getFirst())).isEqualTo("NOVO");
        }

        // Voltar um aluno de cancelado para agendado também é reabrir (NOVO só para ele); realizado não avisaria.
        c = situacaoDoAluno(c, carla, "CANCELADO", null);
        assertThat(tipo(noBanco(carla).getFirst())).isEqualTo("CANCELADO");
        situacaoDoAluno(c, carla, "AGENDADO", null);
        assertThat(noBanco(carla)).hasSize(1);
        assertThat(tipo(noBanco(carla).getFirst())).isEqualTo("NOVO");
    }

    @Test
    void alunoQueEntraRecebeNovoEQueSaiRecebeCanceladoComOHorarioQueConhecia() throws Exception {
        JsonNode c = marcar(aluno, hoje().plusDays(7), "14:00", 60);
        Instant inicioAntigo = instante(c);
        UUID avisoDoAluno = (UUID) noBanco(aluno).getFirst().get("id");

        // Entra a Bruna: NOVO para ela; quem ficou e nada de data/hora/duração mudou segue como está.
        c = alterar(c, corpo -> corpo.put("alunoIds", List.of(aluno, bruna)));
        assertThat(noBanco(bruna)).hasSize(1);
        assertThat(tipo(noBanco(bruna).getFirst())).isEqualTo("NOVO");
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(noBanco(aluno).getFirst().get("id")).isEqualTo(avisoDoAluno);

        // Sai o aluno e, no mesmo pedido, o horário muda: ele é avisado do cancelamento no horário que conhecia; a Bruna,
        // que ficou, é avisada da remarcação.
        c = alterar(c, corpo -> {
            corpo.put("alunoIds", List.of(bruna));
            corpo.put("hora", "15:00");
        });
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("CANCELADO");
        assertThat(inicioDe(noBanco(aluno).getFirst())).isEqualTo(inicioAntigo);
        assertThat(noBanco(bruna)).hasSize(1);
        assertThat(tipo(noBanco(bruna).getFirst())).isEqualTo("REMARCADO");
        assertThat(inicioDe(noBanco(bruna).getFirst())).isEqualTo(instante(c)).isNotEqualTo(inicioAntigo);
    }

    @Test
    void alunoQueEntraEmCompromissoCanceladoNaoRecebeAviso() throws Exception {
        JsonNode c = marcar(aluno, hoje().plusDays(7), "14:00", 60);
        c = cancelar(c, true, null);
        alterar(c, corpo -> corpo.put("alunoIds", List.of(aluno, bruna)));
        assertThat(noBanco(bruna)).isEmpty();
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("CANCELADO");
    }

    @Test
    void realizadoEFaltouNaoAvisamNemOCanceladoQueViraRealizado() throws Exception {
        JsonNode c = marcar(List.of(aluno, bruna), hoje().plusDays(2), "16:00", 30);
        UUID carla = api.criarAluno(admin, "Carla Fictícia dos Avisos");
        c = alterar(c, corpo -> corpo.put("alunoIds", List.of(aluno, bruna, carla)));
        c = situacaoDoAluno(c, carla, "CANCELADO", null);
        long antes = noBanco(aluno).size() + noBanco(bruna).size() + noBanco(carla).size();

        // Em andamento (começou, ainda não terminou): realizado e falta só valem agora e não geram aviso.
        emAndamento(c.path("id").asString());
        c = detalhe(c.path("id").asString());
        c = situacaoDoAluno(c, aluno, "REALIZADO", null);
        c = situacaoDoAluno(c, bruna, "FALTOU", null);
        // Cancelado que vira realizado não é "reabrir": não avisa NOVO.
        c = situacaoDoAluno(c, carla, "REALIZADO", null);
        assertThat(noBanco(aluno).size() + noBanco(bruna).size() + noBanco(carla).size()).isEqualTo(antes);
        assertThat(tipo(noBanco(carla).getFirst())).isEqualTo("CANCELADO");
        assertThat(c.path("participantes")).hasSize(3);
    }

    @Test
    void compromissoQueJaTerminouNaoGeraAviso() throws Exception {
        // Marcado, alterado e cancelado no passado: nenhum aviso.
        JsonNode passado = marcar(List.of(aluno, bruna), hoje().minusDays(3), "07:00", 30);
        assertThat(noBanco(aluno)).isEmpty();
        passado = alterar(passado, corpo -> corpo.put("hora", "08:00"));
        passado = alterar(passado, corpo -> corpo.put("alunoIds", List.of(aluno)));
        cancelar(passado, true, null);
        assertThat(noBanco(aluno)).isEmpty();
        assertThat(noBanco(bruna)).isEmpty();

        // Um futuro com aviso que termina e depois é cancelado: o aviso que existia fica e nenhum outro nasce.
        JsonNode c = marcar(aluno, hoje().plusDays(3), "07:00", 30);
        banco.update("update compromisso set inicio = now() - interval '2 hours', fim = now() - interval '1 hour' "
                + "where id = ?::uuid", c.path("id").asString());
        c = detalhe(c.path("id").asString());
        cancelar(c, true, null);
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("NOVO");
    }

    @Test
    void avisoNovoSubstituiOQueNaoFoiVistoEOVistoFica() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode c = marcar(aluno, hoje().plusDays(4), "10:00", 60);
        c = alterar(c, corpo -> corpo.put("hora", "11:00"));
        JsonNode lista = naoVistos(loginDoAluno);
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).path("tipo").asString()).isEqualTo("REMARCADO");

        // Visto, ele fica; o próximo é outro aviso, e só ele aparece na lista.
        api.post("/aluno/avisos-de-compromisso/" + lista.get(0).path("id").asString() + "/visto", loginDoAluno, null, 204);
        c = alterar(c, corpo -> corpo.put("hora", "12:00"));
        assertThat(noBanco(aluno)).hasSize(2);
        assertThat(noBanco(aluno).getFirst().get("visto_em")).isNotNull();
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("REMARCADO");
        JsonNode agora = naoVistos(loginDoAluno);
        assertThat(agora).hasSize(1);
        assertThat(Instant.parse(agora.get(0).path("inicio").asString())).isEqualTo(instante(c));

        // Cancelar substitui o REMARCADO ainda não visto.
        cancelar(c, true, null);
        assertThat(noBanco(aluno)).hasSize(2);
        assertThat(naoVistosNoBanco(aluno)).hasSize(1);
        assertThat(tipo(naoVistosNoBanco(aluno).getFirst())).isEqualTo("CANCELADO");
    }

    @Test
    void responsavelRemovidoViraNuloNoAvisoQueOAppLeComoAEquipe() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode c = marcar(aluno, hoje().plusDays(3), "09:00", 30);
        String id = c.path("id").asString();
        // Membro removido: o compromisso fica sem responsável (FK SET NULL); cancelar não exige responsável.
        banco.update("update compromisso set responsavel_id = null where id = ?::uuid", id);
        cancelar(detalhe(id), true, null);

        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("CANCELADO");
        assertThat(noBanco(aluno).getFirst().get("responsavel_nome")).isNull();
        JsonNode item = naoVistos(loginDoAluno).get(0);
        assertThat(item.propertyNames()).contains("responsavelNome");
        assertThat(item.path("responsavelNome").isNull()).isTrue();
    }

    // ---- série ----

    @Test
    void serieGeraUmAvisoPorAlunoApontandoParaAPrimeiraOcorrenciaAindaFutura() throws Exception {
        // Começa no passado (a criação não recusa datas passadas): as que já terminaram não contam.
        JsonNode primeira = criarSerie(List.of(aluno, bruna), hoje().minusDays(3), "07:00", 30, 6);
        List<Map<String, Object>> primeiraFutura = banco.queryForList("select id::text as id, inicio from compromisso "
                + "where serie_id = ?::uuid and consultoria_id = ? and fim > now() order by inicio limit 1",
                primeira.path("serieId").asString(), consultoriaDe(admin));
        assertThat(ocorrencias(primeira)).hasSize(6);
        assertThat(primeiraFutura).hasSize(1);
        for (UUID a : List.of(aluno, bruna)) {
            assertThat(noBanco(a)).hasSize(1);
            Map<String, Object> aviso = noBanco(a).getFirst();
            assertThat(tipo(aviso)).isEqualTo("NOVO");
            assertThat(compromissoDe(aviso)).isEqualTo(primeiraFutura.getFirst().get("id"));
            assertThat(inicioDe(aviso)).isEqualTo(((Timestamp) primeiraFutura.getFirst().get("inicio")).toInstant());
        }
    }

    @Test
    void serieComEscopoAvisaUmaVezPorAlunoEOCancelamentoSubstituiOQueEstavaNasOcorrenciasTocadas() throws Exception {
        JsonNode primeira = criarSerie(List.of(aluno, bruna), hoje().plusDays(10), "09:00", 30, 4);
        List<String> ids = ocorrencias(primeira);
        for (UUID a : List.of(aluno, bruna)) {
            assertThat(noBanco(a)).hasSize(1);
            assertThat(compromissoDe(noBanco(a).getFirst())).isEqualTo(ids.get(0));
        }

        // Cancelar "seguintes" a partir da 3ª: um CANCELADO por aluno, na 3ª; o NOVO da 1ª não foi tocado e fica.
        JsonNode terceira = detalhe(ids.get(2));
        cancelar(terceira, true, "SEGUINTES");
        for (UUID a : List.of(aluno, bruna)) {
            assertThat(noBanco(a)).hasSize(2);
            Map<String, Object> cancelado = noBanco(a).getLast();
            assertThat(tipo(cancelado)).isEqualTo("CANCELADO");
            assertThat(compromissoDe(cancelado)).isEqualTo(ids.get(2));
            assertThat(inicioDe(cancelado)).isEqualTo(instante(terceira));
        }

        // Reabrir "seguintes": um NOVO por aluno, na 3ª, no lugar do CANCELADO (a 4ª, também tocada, não ganha outro).
        terceira = detalhe(ids.get(2));
        cancelar(terceira, false, "SEGUINTES");
        for (UUID a : List.of(aluno, bruna)) {
            assertThat(noBanco(a)).hasSize(2);
            assertThat(noBanco(a)).allMatch(av -> tipo(av).equals("NOVO"));
            assertThat(noBanco(a).stream().map(AvisosDeCompromissoIntegrationTest::compromissoDe).toList())
                    .containsExactlyInAnyOrder(ids.get(0), ids.get(2));
        }

        // Cancelar só um aluno em todas as ocorrências: um aviso só para ele, na 1ª, no lugar dos que estavam nas tocadas.
        situacaoDoAluno(detalhe(ids.get(1)), aluno, "CANCELADO", "TODAS");
        assertThat(noBanco(aluno)).hasSize(1);
        assertThat(tipo(noBanco(aluno).getFirst())).isEqualTo("CANCELADO");
        assertThat(compromissoDe(noBanco(aluno).getFirst())).isEqualTo(ids.get(0));
        assertThat(noBanco(bruna)).hasSize(2);
    }

    @Test
    void remarcarUmaSerieInteiraAvisaUmaVezPorAluno() throws Exception {
        JsonNode primeira = criarSerie(List.of(aluno, bruna), hoje().plusDays(10), "09:00", 30, 4);
        List<String> ids = ocorrencias(primeira);
        alterar(detalhe(ids.get(1)), corpo -> corpo.put("hora", "10:00"), "TODAS");
        for (UUID a : List.of(aluno, bruna)) {
            assertThat(noBanco(a)).hasSize(1);
            assertThat(tipo(noBanco(a).getFirst())).isEqualTo("REMARCADO");
            assertThat(compromissoDe(noBanco(a).getFirst())).isEqualTo(ids.get(0));
            assertThat(inicioDe(noBanco(a).getFirst())).isEqualTo(instante(detalhe(ids.get(0))));
        }
    }

    // ---- rotas do aluno ----

    @Test
    void listaOsNaoVistosDoMaisNovoAoMaisAntigoAte20SoOsProprios() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode loginDaBruna = api.convidarEEntrar(admin, bruna);
        List<String> ordem = new ArrayList<>();
        for (int i = 0; i < 22; i++) {
            JsonNode c = marcar(aluno, hoje().plusDays(30 + i), "08:00", 30);
            ordem.add(c.path("id").asString());
        }
        marcar(bruna, hoje().plusDays(60), "08:00", 30);
        // `criado_em` vem do relógio de parede do servidor, que pode voltar alguns milissegundos (ajuste do relógio da
        // máquina): em 29/10 dois avisos criados em sequência saíram trocados. A ordem por criação é o contrato; o teste
        // fixa os instantes (um segundo entre cada um, na ordem em que foram marcados) para provar a consulta sem depender
        // do relógio. Os dois últimos ficam no mesmo instante: o desempate pelo id tem de ser estável.
        Instant base = Instant.parse("2026-01-01T12:00:00Z");
        for (int i = 0; i < ordem.size(); i++) {
            Instant criado = base.plusSeconds(Math.min(i, 20));
            banco.update("update aviso_compromisso set criado_em = ? where compromisso_id = ?::uuid",
                    java.sql.Timestamp.from(criado), ordem.get(i));
        }

        JsonNode lista = naoVistos(loginDoAluno);
        assertThat(lista).hasSize(20);
        // Do mais novo ao mais antigo: o último marcado vem primeiro e os dois mais antigos ficam de fora (máximo de 20).
        List<Instant> inicios = new ArrayList<>();
        lista.forEach(a -> inicios.add(Instant.parse(a.path("inicio").asString())));
        List<Instant> esperados = new ArrayList<>();
        for (int i = 21; i >= 2; i--) esperados.add(instante(detalhe(ordem.get(i))));
        // Empate de criado_em entre os dois últimos: a ordem entre eles segue o id (decrescente), sempre a mesma.
        List<String> ids = new ArrayList<>();
        lista.forEach(a -> ids.add(a.path("id").asString()));
        assertThat(ids.subList(0, 2)).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        assertThat(java.util.Set.copyOf(inicios.subList(0, 2))).isEqualTo(java.util.Set.copyOf(esperados.subList(0, 2)));
        assertThat(inicios.subList(2, 20)).isEqualTo(esperados.subList(2, 20));
        assertThat(naoVistos(loginDoAluno).toString()).isEqualTo(lista.toString());

        JsonNode daBruna = naoVistos(loginDaBruna);
        assertThat(daBruna).hasSize(1);
        assertThat(lista.toString()).doesNotContain(daBruna.get(0).path("id").asString());
    }

    @Test
    void vistoEIdempotenteENaoMudaOVistoEm() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        marcar(aluno, hoje().plusDays(3), "09:00", 30);
        String id = naoVistos(loginDoAluno).get(0).path("id").asString();

        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", loginDoAluno, null, 204);
        Object primeiroVisto = noBanco(aluno).getFirst().get("visto_em");
        assertThat(primeiroVisto).isNotNull();
        assertThat(naoVistos(loginDoAluno)).isEmpty();
        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", loginDoAluno, null, 204);
        assertThat(noBanco(aluno).getFirst().get("visto_em")).isEqualTo(primeiroVisto);
    }

    @Test
    void avisoDeOutroAlunoOuDeOutraConsultoriaOuInexistenteDa404SemMarcar() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode loginDaBruna = api.convidarEEntrar(admin, bruna);
        marcar(aluno, hoje().plusDays(3), "09:00", 30);
        String id = naoVistos(loginDoAluno).get(0).path("id").asString();

        // Outro aluno da mesma consultoria.
        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", loginDaBruna, null, 404);
        // Aluno de outra consultoria.
        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outroTreinador, "Aluno Fictício de Fora");
        JsonNode loginDeFora = api.convidarEEntrar(outroTreinador, alunoDeFora);
        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", loginDeFora, null, 404);
        api.post("/aluno/avisos-de-compromisso/" + UUID.randomUUID() + "/visto", loginDoAluno, null, 404);
        assertThat(naoVistosNoBanco(aluno)).hasSize(1);
        assertThat(naoVistos(loginDeFora)).isEmpty();
    }

    @Test
    void soOAlunoUsaARotaETreinadorOuSemSessaoNao() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        marcar(aluno, hoje().plusDays(3), "09:00", 30);
        String id = naoVistos(loginDoAluno).get(0).path("id").asString();

        api.get("/aluno/avisos-de-compromisso", admin, 403);
        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", admin, null, 403);
        api.get("/aluno/avisos-de-compromisso", null, 401);
        api.post("/aluno/avisos-de-compromisso/" + id + "/visto", null, null, 401);
        assertThat(naoVistosNoBanco(aluno)).hasSize(1);

        // Aluno inativo perde a sessão (401), como nas outras rotas do aluno.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.get("/aluno/avisos-de-compromisso", loginDoAluno, 401);
    }

    // ---- limpeza ----

    @Test
    void limpezaApagaVistosHaMaisDe30DiasENaoVistosDeCompromissoEncerradoHaMaisDe7() throws Exception {
        JsonNode encerrado8 = marcar(aluno, hoje().plusDays(20), "08:00", 30);
        JsonNode encerrado6 = marcar(aluno, hoje().plusDays(21), "08:00", 30);
        JsonNode futuro = marcar(aluno, hoje().plusDays(22), "08:00", 30);
        JsonNode vistoHa31 = marcar(aluno, hoje().plusDays(23), "08:00", 30);
        JsonNode vistoHa29 = marcar(aluno, hoje().plusDays(24), "08:00", 30);
        assertThat(noBanco(aluno)).hasSize(5);
        banco.update("update compromisso set inicio = now() - interval '8 days 2 hours', fim = now() - interval '8 days 1 hour' "
                + "where id = ?::uuid", encerrado8.path("id").asString());
        banco.update("update compromisso set inicio = now() - interval '6 days 2 hours', fim = now() - interval '6 days 1 hour' "
                + "where id = ?::uuid", encerrado6.path("id").asString());
        banco.update("update aviso_compromisso set visto_em = now() - interval '31 days' where compromisso_id = ?::uuid",
                vistoHa31.path("id").asString());
        banco.update("update aviso_compromisso set visto_em = now() - interval '29 days' where compromisso_id = ?::uuid",
                vistoHa29.path("id").asString());
        // Outra consultoria: um aviso novo dela nunca sai por causa desta.
        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outroTreinador, "Aluno Fictício de Fora");
        api.post("/agenda/compromissos", outroTreinador, Map.of("alunoIds", List.of(alunoDeFora),
                "responsavelId", outroTreinador.path("usuario").path("id").asString(), "data", hoje().plusDays(3).toString(),
                "hora", "09:00", "duracaoMinutos", 30), 200);

        assertThat(retencao.limpar(Instant.now())).isGreaterThanOrEqualTo(2);

        List<String> restantes = noBanco(aluno).stream().map(AvisosDeCompromissoIntegrationTest::compromissoDe).toList();
        assertThat(restantes).containsExactlyInAnyOrder(encerrado6.path("id").asString(), futuro.path("id").asString(),
                vistoHa29.path("id").asString());
        assertThat(noBanco(alunoDeFora)).hasSize(1);
        // Rodar de novo não apaga mais nada do aluno.
        retencao.limpar(Instant.now());
        assertThat(noBanco(aluno)).hasSize(3);
    }

    // ---- privacidade ----

    @Test
    void exportacaoTrazOsAvisosDoAlunoSemIdsNemOutrosAlunosEExigeAgendaLer() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode c = marcar(List.of(aluno, bruna), hoje().plusDays(4), "18:00", 30);
        marcar(bruna, hoje().plusDays(5), "18:00", 30);
        alterar(c, corpo -> corpo.put("hora", "19:00"));
        api.post("/aluno/avisos-de-compromisso/" + naoVistos(loginDoAluno).get(0).path("id").asString() + "/visto",
                loginDoAluno, null, 204);

        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        JsonNode itens = exportacao.path("avisosDeCompromisso").path("itens");
        assertThat(itens).hasSize(1);
        JsonNode item = itens.get(0);
        assertThat(item.propertyNames()).containsExactlyInAnyOrder("tipo", "inicio", "criadoEm", "vistoEm");
        assertThat(item.path("tipo").asString()).isEqualTo("REMARCADO");
        assertThat(item.path("vistoEm").isNull()).isFalse();
        assertThat(itens.toString()).doesNotContain("Bruna").doesNotContain(bruna.toString()).doesNotContain(eu())
                .doesNotContain(OBSERVACAO);
        // A Bruna tem os dois dela, ainda não vistos.
        JsonNode daBruna = api.get("/alunos/" + bruna + "/exportacao", admin, 200).path("avisosDeCompromisso").path("itens");
        assertThat(daBruna).hasSize(2);
        assertThat(daBruna.toString()).doesNotContain("Aluno Fictício dos Avisos");

        // Sem AGENDA_LER a seção sai junto com a de compromissos, e vem listada como omitida.
        UUID perfil = UUID.randomUUID();
        banco.update("insert into perfil(id, consultoria_id, nome) values (?, ?, ?)", perfil, consultoriaDe(admin), "Perfil " + perfil);
        for (String codigo : List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR")) {
            banco.update("insert into perfil_permissao(perfil_id, codigo) values (?, ?)", perfil, codigo);
        }
        banco.update("update usuario set perfil_id = ? where id = ?::uuid", perfil, eu());
        JsonNode semAgenda = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(semAgenda.has("avisosDeCompromisso")).isFalse();
        assertThat(semAgenda.path("secoesOmitidas").toString()).contains("avisosDeCompromisso");
    }

    @Test
    void anonimizarOAlunoApagaOsAvisosDeleESoDele() throws Exception {
        marcar(List.of(aluno, bruna), hoje().plusDays(4), "18:00", 30);
        assertThat(noBanco(aluno)).hasSize(1);
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício dos Avisos"), 200);
        assertThat(noBanco(aluno)).isEmpty();
        assertThat(noBanco(bruna)).hasSize(1);
    }
}
