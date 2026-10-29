package br.com.treinos.api.agenda;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Agenda presencial com vários alunos (V042): conflito do responsável (e a trava contra duas reservas simultâneas), fuso de
 * Brasília atravessando a meia-noite, versão, situação por aluno e do compromisso inteiro (o último participante cancelado
 * cancela o compromisso e libera o horário), troca da lista de alunos, aluno ocupado (só aviso), permissões dos perfis
 * padrão, observação como dado sensível, isolamento entre consultorias (404), a visão de cada aluno e a privacidade
 * (exportação, anonimização e "Excluir minha conta" tiram só aquele aluno). Só dados fictícios; toda consulta direta filtra
 * pela consultoria ou pelo aluno do próprio teste.
 */
@AutoConfigureMockMvc
class AgendaPresencialIntegrationTest extends AbstractIntegrationTest {

    private static final String OBSERVACAO = "Observação fictícia da equipe";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        aluno = api.criarAluno(admin, "Aluno Fictício da Agenda");
    }

    // ---- auxiliares ----

    private static String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoriaDe(JsonNode login) {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, usuarioId(login));
    }

    private void perfil(JsonNode login, String nome) {
        banco.update("update usuario u set perfil_id = p.id from perfil p where u.id = ?::uuid "
                + "and p.consultoria_id = u.consultoria_id and p.nome = ?", usuarioId(login), nome);
    }

    private List<String> permissoes(UUID consultoria, String perfil) {
        return banco.queryForList("select pp.codigo from perfil_permissao pp join perfil p on p.id = pp.perfil_id"
                + " where p.consultoria_id = ? and p.nome = ?", String.class, consultoria, perfil);
    }

    /** Segundo membro ativo da equipe (perfil Administrador), para ser outro responsável. */
    private JsonNode outroMembro() throws Exception {
        String perfilId = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfilId), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Map<String, Object> pedido(List<UUID> alunoIds, String responsavelId, LocalDate data, String hora, int duracao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", responsavelId);
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("local", "Sala 2");
        corpo.put("observacao", OBSERVACAO);
        return corpo;
    }

    private static Map<String, Object> pedido(UUID alunoId, String responsavelId, LocalDate data, String hora, int duracao) {
        return pedido(List.of(alunoId), responsavelId, data, hora, duracao);
    }

    private JsonNode marcar(JsonNode login, LocalDate data, String hora, int duracao, int status) throws Exception {
        return api.post("/agenda/compromissos", login, pedido(aluno, usuarioId(admin), data, hora, duracao), status);
    }

    private JsonNode marcarGrupo(List<UUID> alunoIds, LocalDate data, String hora, int duracao, int status) throws Exception {
        return api.post("/agenda/compromissos", admin, pedido(alunoIds, usuarioId(admin), data, hora, duracao), status);
    }

    private UUID novoAluno(String nome) throws Exception {
        return api.criarAluno(admin, nome);
    }

    private JsonNode listar(JsonNode login, LocalDate de, LocalDate ate) throws Exception {
        return api.get("/agenda/compromissos?de=" + de + "&ate=" + ate, login, 200);
    }

    private static List<String> ids(JsonNode lista) {
        List<String> ids = new ArrayList<>();
        lista.forEach(c -> ids.add(c.path("id").asString()));
        return ids;
    }

    /** Cancela o compromisso inteiro ({@code true}) ou o reabre ({@code false}). */
    private JsonNode cancelar(JsonNode login, JsonNode c, boolean cancelado, int status) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", login,
                Map.of("cancelado", cancelado, "versao", c.path("versao").asLong()), status);
    }

    /** A situação de um aluno no compromisso. */
    private JsonNode situacaoDoAluno(JsonNode login, JsonNode c, UUID alunoId, String situacao, int status) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/alunos/" + alunoId + "/situacao", login,
                Map.of("situacao", situacao, "versao", c.path("versao").asLong()), status);
    }

    private static String situacaoDe(JsonNode compromisso, UUID alunoId) {
        for (JsonNode p : compromisso.path("participantes")) {
            if (p.path("id").asString().equals(alunoId.toString())) return p.path("situacao").asString();
        }
        return null;
    }

    private static List<String> nomesDosParticipantes(JsonNode compromisso) {
        List<String> nomes = new ArrayList<>();
        compromisso.path("participantes").forEach(p -> nomes.add(p.path("nome").asString()));
        return nomes;
    }

    private JsonNode ocupados(JsonNode login, LocalDate data, String hora, int duracao, List<UUID> alunoIds, String ignorar,
                              int status) throws Exception {
        StringBuilder url = new StringBuilder("/agenda/compromissos/alunos-ocupados?data=" + data + "&hora=" + hora
                + "&duracaoMinutos=" + duracao);
        alunoIds.forEach(a -> url.append("&alunoIds=").append(a));
        if (ignorar != null) url.append("&ignorar=").append(ignorar);
        return api.get(url.toString(), login, status);
    }

    private long participacoesDoAluno(UUID alunoId) {
        Long total = banco.queryForObject("select count(*) from compromisso_aluno where aluno_id = ?", Long.class, alunoId);
        return total == null ? 0 : total;
    }

    private long compromissosExistentes(String id) {
        Long total = banco.queryForObject("select count(*) from compromisso where id = ?::uuid", Long.class, id);
        return total == null ? 0 : total;
    }

    private long versaoNoBanco(String id) {
        Long versao = banco.queryForObject("select versao from compromisso where id = ?::uuid", Long.class, id);
        return versao == null ? -1 : versao;
    }

    private boolean canceladoNoBanco(String id) {
        return Boolean.TRUE.equals(banco.queryForObject("select cancelado from compromisso where id = ?::uuid", Boolean.class, id));
    }

    private long avisosDoAluno(UUID alunoId) {
        Long total = banco.queryForObject("select count(*) from aviso_compromisso where aluno_id = ?", Long.class, alunoId);
        return total == null ? 0 : total;
    }

    private long auditorias(UUID consultoria, String acao) {
        Long total = banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?",
                Long.class, consultoria, acao);
        return total == null ? 0 : total;
    }

    private static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    // ---- perfis padrão e permissões ----

    @Test
    void perfisPadraoTreinadorNutricionistaEAssistenteMarcamEQuemNaoTemAPermissaoRecebe403() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        for (String nome : List.of("Treinador", "Nutricionista", "Assistente")) {
            assertThat(permissoes(consultoria, nome)).as(nome).contains("AGENDA_LER", "AGENDA_ALTERAR");
        }
        LocalDate dia = hoje().plusDays(3);

        perfil(admin, "Assistente");
        JsonNode doAssistente = marcar(admin, dia, "09:00", 30, 200);
        // Sem ALUNO_SENSIVEL_*: a observação não é gravada nem lida (dado sensível).
        assertThat(doAssistente.path("observacao").isNull()).isTrue();
        assertThat(banco.queryForObject("select observacao from compromisso where id = ?::uuid", String.class,
                doAssistente.path("id").asString())).isNull();

        perfil(admin, "Nutricionista");
        assertThat(ids(listar(admin, dia, dia))).contains(doAssistente.path("id").asString());

        perfil(admin, "Treinador");
        JsonNode doTreinador = marcar(admin, dia, "10:00", 30, 200);
        assertThat(doTreinador.path("observacao").asString()).isEqualTo(OBSERVACAO);

        // O Assistente remarca sem apagar a observação que não pode ver.
        perfil(admin, "Assistente");
        Map<String, Object> remarcar = pedido(aluno, usuarioId(admin), dia, "11:00", 30);
        remarcar.put("observacao", null);
        remarcar.put("versao", doTreinador.path("versao").asLong());
        api.put("/agenda/compromissos/" + doTreinador.path("id").asString(), admin, remarcar, 200);
        assertThat(banco.queryForObject("select observacao from compromisso where id = ?::uuid", String.class,
                doTreinador.path("id").asString())).isEqualTo(OBSERVACAO);

        // Perfil sem as permissões da agenda: 403 em todas as rotas.
        banco.update("delete from perfil_permissao where codigo like 'AGENDA_%' and perfil_id = "
                + "(select id from perfil where consultoria_id = ? and nome = 'Assistente')", consultoria);
        String id = doTreinador.path("id").asString();
        api.get("/agenda/compromissos", admin, 403);
        api.get("/agenda/compromissos/" + id, admin, 403);
        ocupados(admin, dia, "09:00", 30, List.of(aluno), null, 403);
        api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "15:00", 30), 403);
        api.put("/agenda/compromissos/" + id, admin, remarcar, 403);
        api.post("/agenda/compromissos/" + id + "/situacao", admin, Map.of("cancelado", true, "versao", 0), 403);
        api.post("/agenda/compromissos/" + id + "/alunos/" + aluno + "/situacao", admin,
                Map.of("situacao", "CANCELADO", "versao", 0), 403);
    }

    // ---- fuso e conflito ----

    @Test
    void horarioDeBrasiliaAtravessandoAMeiaNoiteEConflitoDoResponsavel() throws Exception {
        LocalDate dia = hoje().plusDays(30);
        JsonNode c = marcar(admin, dia, "23:30", 60, 200);
        // 23:30 em Brasília (UTC-3, sem horário de verão) é 02:30 UTC do dia seguinte; a resposta fala em Brasília.
        assertThat(Instant.parse(c.path("inicio").asString()))
                .isEqualTo(dia.plusDays(1).atTime(2, 30).toInstant(java.time.ZoneOffset.UTC));
        assertThat(c.path("data").asString()).isEqualTo(dia.toString());
        assertThat(c.path("hora").asString()).isEqualTo("23:30");
        assertThat(c.path("horaFim").asString()).isEqualTo("00:30");
        assertThat(c.path("cancelado").asBoolean()).isFalse();
        assertThat(nomesDosParticipantes(c)).containsExactly("Aluno Fictício da Agenda");
        assertThat(situacaoDe(c, aluno)).isEqualTo("AGENDADO");
        // Formato novo, sem compatibilidade: a situação e o aluno vivem em participantes.
        assertThat(c.has("alunoId")).isFalse();
        assertThat(c.has("alunoNome")).isFalse();
        assertThat(c.has("situacao")).isFalse();

        // Aparece no dia em que começa e no seguinte (toca a madrugada), e não no anterior.
        assertThat(ids(listar(admin, dia, dia))).containsExactly(c.path("id").asString());
        assertThat(ids(listar(admin, dia.plusDays(1), dia.plusDays(1)))).containsExactly(c.path("id").asString());
        assertThat(ids(listar(admin, dia.minusDays(1), dia.minusDays(1)))).isEmpty();

        // Mesmo responsável, 00:15 do dia seguinte: sobrepõe. A resposta não diz nada do outro compromisso.
        UUID outroAluno = api.criarAluno(admin, "Outra Pessoa Fictícia");
        JsonNode ocupado = api.post("/agenda/compromissos", admin,
                pedido(outroAluno, usuarioId(admin), dia.plusDays(1), "00:15", 30), 409);
        assertThat(ocupado.path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        assertThat(ocupado.toString()).doesNotContain("Aluno Fictício").doesNotContain("Sala 2").doesNotContain(OBSERVACAO);
        // Encostar não é sobrepor: começa quando o outro termina.
        api.post("/agenda/compromissos", admin, pedido(outroAluno, usuarioId(admin), dia.plusDays(1), "00:30", 30), 200);
        // Outro responsável no mesmo horário: livre.
        JsonNode membro = outroMembro();
        api.post("/agenda/compromissos", admin, pedido(outroAluno, usuarioId(membro), dia, "23:45", 30), 200);
        // Filtro por responsável.
        JsonNode doMembro = api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia.plusDays(1) + "&responsavel="
                + usuarioId(membro), admin, 200);
        assertThat(doMembro).hasSize(1);
        assertThat(doMembro.get(0).path("responsavelId").asString()).isEqualTo(usuarioId(membro));
    }

    @Test
    void remarcarComVersaoECancelarLiberaOHorario() throws Exception {
        LocalDate dia = hoje().plusDays(5);
        JsonNode primeiro = marcar(admin, dia, "08:00", 60, 200);
        JsonNode segundo = marcar(admin, dia, "10:00", 60, 200);

        Map<String, Object> mover = pedido(aluno, usuarioId(admin), dia, "08:30", 60);
        mover.put("versao", segundo.path("versao").asLong() + 1);
        assertThat(api.put("/agenda/compromissos/" + segundo.path("id").asString(), admin, mover, 409)
                .path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        mover.put("versao", segundo.path("versao").asLong());
        assertThat(api.put("/agenda/compromissos/" + segundo.path("id").asString(), admin, mover, 409)
                .path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        // Remarcar para o mesmo horário (ou um que só sobrepõe a si mesmo) não conflita consigo.
        mover.put("hora", "10:15");
        JsonNode remarcado = api.put("/agenda/compromissos/" + segundo.path("id").asString(), admin, mover, 200);
        assertThat(remarcado.path("hora").asString()).isEqualTo("10:15");
        assertThat(remarcado.path("versao").asLong()).isGreaterThan(segundo.path("versao").asLong());

        // Cancelar libera o horário; reabrir com o horário tomado: 409.
        JsonNode cancelado = cancelar(admin, primeiro, true, 200);
        assertThat(cancelado.path("cancelado").asBoolean()).isTrue();
        assertThat(situacaoDe(cancelado, aluno)).isEqualTo("CANCELADO");
        JsonNode novo = marcar(admin, dia, "08:00", 30, 200);
        assertThat(cancelar(admin, cancelado, false, 409).path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        cancelar(admin, novo, true, 200);
        JsonNode reaberto = cancelar(admin, cancelado, false, 200);
        assertThat(reaberto.path("cancelado").asBoolean()).isFalse();
        assertThat(situacaoDe(reaberto, aluno)).isEqualTo("AGENDADO");
        // Filtro de situação: compromissos em que algum aluno está cancelado.
        JsonNode cancelados = api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia + "&situacao=CANCELADO", admin, 200);
        assertThat(ids(cancelados)).containsExactly(novo.path("id").asString());
    }

    @Test
    void realizadoEFaltaSoDepoisDoInicioEAuditoriaComResumoFixo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode futuro = marcar(admin, hoje().plusDays(2), "09:00", 45, 200);
        assertThat(situacaoDoAluno(admin, futuro, aluno, "REALIZADO", 409).path("codigo").asString())
                .isEqualTo("COMPROMISSO_NO_FUTURO");
        assertThat(situacaoDoAluno(admin, futuro, aluno, "FALTOU", 409).path("codigo").asString())
                .isEqualTo("COMPROMISSO_NO_FUTURO");

        JsonNode passado = marcar(admin, hoje().minusDays(2), "09:00", 45, 200);
        JsonNode realizado = situacaoDoAluno(admin, passado, aluno, "REALIZADO", 200);
        assertThat(situacaoDe(realizado, aluno)).isEqualTo("REALIZADO");
        assertThat(realizado.path("cancelado").asBoolean()).isFalse();
        assertThat(realizado.path("versao").asLong()).isGreaterThan(passado.path("versao").asLong());
        // Mesma situação de novo: nada muda e não audita outra vez.
        JsonNode igual = situacaoDoAluno(admin, realizado, aluno, "REALIZADO", 200);
        assertThat(igual.path("versao").asLong()).isEqualTo(realizado.path("versao").asLong());
        JsonNode faltou = situacaoDoAluno(admin, realizado, aluno, "FALTOU", 200);
        assertThat(situacaoDe(faltou, aluno)).isEqualTo("FALTOU");
        // Versão velha.
        assertThat(situacaoDoAluno(admin, realizado, aluno, "AGENDADO", 409).path("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        // Aluno que não está no compromisso: 404.
        situacaoDoAluno(admin, faltou, novoAluno("Fora do Compromisso Fictício"), "AGENDADO", 404);

        assertThat(auditorias(consultoria, "COMPROMISSO_CRIADO")).isEqualTo(2);
        assertThat(auditorias(consultoria, "COMPROMISSO_SITUACAO_ALTERADA")).isEqualTo(2);
        List<String> resumos = banco.queryForList("select resumo from auditoria where consultoria_id = ? "
                + "and acao like 'COMPROMISSO_%'", String.class, consultoria);
        assertThat(String.join(" ", resumos)).doesNotContain(OBSERVACAO).doesNotContain("Sala 2").doesNotContain("Fictício");
    }

    @Test
    void validacoesDoPedidoDoPeriodoEDoAluno() throws Exception {
        LocalDate dia = hoje().plusDays(1);
        // Duração fora de 5 a 480 e local/observação longos: 400.
        api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "09:00", 4), 400);
        api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "09:00", 481), 400);
        Map<String, Object> longo = pedido(aluno, usuarioId(admin), dia, "09:00", 30);
        longo.put("local", "x".repeat(121));
        api.post("/agenda/compromissos", admin, longo, 400);
        longo.put("local", null);
        longo.put("observacao", "x".repeat(501));
        api.post("/agenda/compromissos", admin, longo, 400);
        api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "9h", 30), 400);

        // Lista de alunos: de 1 a 20, sem repetir, sem o campo antigo alunoId.
        api.post("/agenda/compromissos", admin, pedido(List.<UUID>of(), usuarioId(admin), dia, "09:00", 30), 400);
        List<UUID> vinteEUm = new ArrayList<>();
        for (int i = 0; i < 21; i++) vinteEUm.add(UUID.randomUUID());
        api.post("/agenda/compromissos", admin, pedido(vinteEUm, usuarioId(admin), dia, "09:00", 30), 400);
        assertThat(api.post("/agenda/compromissos", admin, pedido(List.of(aluno, aluno), usuarioId(admin), dia, "09:00", 30),
                400).path("codigo").asString()).isEqualTo("ALUNOS_REPETIDOS");
        Map<String, Object> semLista = pedido(aluno, usuarioId(admin), dia, "09:00", 30);
        semLista.remove("alunoIds");
        semLista.put("alunoId", aluno);
        api.post("/agenda/compromissos", admin, semLista, 400);
        assertThat(compromissosDoResponsavel()).isZero();

        // Vinte alunos cabem.
        List<UUID> vinte = new ArrayList<>();
        for (int i = 0; i < 20; i++) vinte.add(novoAluno("Participante Fictício " + i));
        assertThat(api.post("/agenda/compromissos", admin, pedido(vinte, usuarioId(admin), dia, "10:00", 30), 200)
                .path("participantes")).hasSize(20);

        // Período: até 62 dias, e a data final não vem antes da inicial.
        api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia.plusDays(61), admin, 200);
        api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia.plusDays(62), admin, 400);
        api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia.minusDays(1), admin, 400);
        api.get("/agenda/compromissos?situacao=OUTRA", admin, 400);

        // Responsável que não é membro ativo: 404.
        api.post("/agenda/compromissos", admin, pedido(aluno, UUID.randomUUID().toString(), dia, "09:00", 30), 404);

        // Aluno inativo e anonimizado: 409 com o código de cada caso.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(marcar(admin, dia, "09:00", 30, 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        banco.update("update aluno set anonimizado_em = now() where id = ?", aluno);
        assertThat(marcar(admin, dia, "09:00", 30, 409).path("codigo").asString()).isEqualTo("ALUNO_ANONIMIZADO");
    }

    private long compromissosDoResponsavel() {
        Long total = banco.queryForObject("select count(*) from compromisso where consultoria_id = ? and responsavel_id = ?::uuid",
                Long.class, consultoriaDe(admin), usuarioId(admin));
        return total == null ? 0 : total;
    }

    // ---- vários alunos ----

    @Test
    void compromissoComVariosAlunosCriaTrocaAListaERemarca() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        UUID bruna = novoAluno("Bruna Fictícia");
        UUID carla = novoAluno("Carla Fictícia");
        UUID daniela = novoAluno("Daniela Fictícia");
        LocalDate dia = hoje().plusDays(9);

        JsonNode c = marcarGrupo(List.of(carla, aluno, bruna), dia, "09:00", 60, 200);
        String id = c.path("id").asString();
        // Participantes por nome, todos agendados.
        assertThat(nomesDosParticipantes(c)).containsExactly("Aluno Fictício da Agenda", "Bruna Fictícia", "Carla Fictícia");
        assertThat(c.path("participantes").findValuesAsString("situacao")).containsOnly("AGENDADO");
        assertThat(c.path("cancelado").asBoolean()).isFalse();

        // Trocar a lista inteira: Bruna e Carla saem, Daniela entra (nasce agendada); quem fica mantém a situação.
        Map<String, Object> troca = pedido(List.of(aluno, daniela), usuarioId(admin), dia, "09:00", 60);
        troca.put("versao", c.path("versao").asLong());
        JsonNode trocado = api.put("/agenda/compromissos/" + id, admin, troca, 200);
        assertThat(nomesDosParticipantes(trocado)).containsExactly("Aluno Fictício da Agenda", "Daniela Fictícia");
        assertThat(situacaoDe(trocado, daniela)).isEqualTo("AGENDADO");
        assertThat(trocado.path("versao").asLong()).isGreaterThan(c.path("versao").asLong());
        assertThat(participacoesDoAluno(bruna)).isZero();
        assertThat(participacoesDoAluno(carla)).isZero();
        // Mesma lista com versão velha: 409, e o horário do responsável continua um só.
        assertThat(api.put("/agenda/compromissos/" + id, admin, troca, 409).path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

        // Remarcar exige participantes não cancelados ativos e não anonimizados; quem entra também.
        // Por SQL: inativar pela rota cancelaria a participação dela (D18, InativarAlunoCancelaCompromissosIntegrationTest).
        banco.update("update aluno set ativo = false, inativado_em = now() where id = ?", daniela);
        Map<String, Object> remarcar = pedido(List.of(aluno, daniela), usuarioId(admin), dia, "10:00", 60);
        remarcar.put("versao", trocado.path("versao").asLong());
        assertThat(api.put("/agenda/compromissos/" + id, admin, remarcar, 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        remarcar.put("alunoIds", List.of(aluno, bruna, daniela));
        assertThat(api.put("/agenda/compromissos/" + id, admin, remarcar, 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        banco.update("update aluno set anonimizado_em = now() where id = ?", daniela);
        assertThat(api.put("/agenda/compromissos/" + id, admin, remarcar, 409).path("codigo").asString())
                .isEqualTo("ALUNO_ANONIMIZADO");
        // Tirar quem não pode estar e remarcar: passa.
        remarcar.put("alunoIds", List.of(aluno, bruna));
        JsonNode remarcado = api.put("/agenda/compromissos/" + id, admin, remarcar, 200);
        assertThat(nomesDosParticipantes(remarcado)).containsExactly("Aluno Fictício da Agenda", "Bruna Fictícia");
        assertThat(remarcado.path("hora").asString()).isEqualTo("10:00");

        // Um aluno cancelado e inativo não impede remarcar os outros (ele não está mais no horário).
        JsonNode semBruna = situacaoDoAluno(admin, remarcado, bruna, "CANCELADO", 200);
        api.patch("/alunos/" + bruna + "/situacao", admin, Map.of("ativo", false), 200);
        Map<String, Object> outra = pedido(List.of(aluno, bruna), usuarioId(admin), dia, "11:00", 60);
        outra.put("versao", semBruna.path("versao").asLong());
        JsonNode ok = api.put("/agenda/compromissos/" + id, admin, outra, 200);
        assertThat(situacaoDe(ok, bruna)).isEqualTo("CANCELADO");
        assertThat(ok.path("cancelado").asBoolean()).isFalse();

        // Auditoria com resumo fixo: nem nome, nem observação, nem data.
        assertThat(auditorias(consultoria, "COMPROMISSO_ALTERADO")).isGreaterThanOrEqualTo(3);
        List<String> resumos = banco.queryForList("select resumo from auditoria where consultoria_id = ? "
                + "and acao like 'COMPROMISSO_%'", String.class, consultoria);
        assertThat(String.join(" ", resumos)).doesNotContain(OBSERVACAO).doesNotContain("Sala 2").doesNotContain("Fictícia")
                .doesNotContain(dia.toString());
    }

    @Test
    void cancelarTudoCancelarUmSoEUltimoCanceladoCancelaOCompromissoELiberaOHorario() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        UUID outro = novoAluno("Outro Fictício");
        LocalDate dia = hoje().plusDays(7);
        JsonNode ab = marcarGrupo(List.of(aluno, bruna), dia, "09:00", 60, 200);
        String id = ab.path("id").asString();

        // Cancelar só um aluno: o outro segue agendado, o compromisso não é cancelado e o horário continua ocupado.
        JsonNode semAluno = situacaoDoAluno(admin, ab, aluno, "CANCELADO", 200);
        assertThat(situacaoDe(semAluno, aluno)).isEqualTo("CANCELADO");
        assertThat(situacaoDe(semAluno, bruna)).isEqualTo("AGENDADO");
        assertThat(semAluno.path("cancelado").asBoolean()).isFalse();
        assertThat(semAluno.path("versao").asLong()).isGreaterThan(ab.path("versao").asLong());
        assertThat(versaoNoBanco(id)).isEqualTo(semAluno.path("versao").asLong());
        assertThat(api.post("/agenda/compromissos", admin, pedido(outro, usuarioId(admin), dia, "09:30", 30), 409)
                .path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");

        // O último participante não cancelado que for cancelado cancela o compromisso, e o horário fica livre.
        JsonNode todosCancelados = situacaoDoAluno(admin, semAluno, bruna, "CANCELADO", 200);
        assertThat(todosCancelados.path("cancelado").asBoolean()).isTrue();
        assertThat(canceladoNoBanco(id)).isTrue();
        JsonNode livre = api.post("/agenda/compromissos", admin, pedido(outro, usuarioId(admin), dia, "09:00", 60), 200);

        // Voltar um aluno ao agendado reabre o compromisso: o horário agora é do outro, então 409.
        assertThat(situacaoDoAluno(admin, todosCancelados, bruna, "AGENDADO", 409).path("codigo").asString())
                .isEqualTo("HORARIO_OCUPADO");
        cancelar(admin, livre, true, 200);
        JsonNode reaberto = situacaoDoAluno(admin, todosCancelados, bruna, "AGENDADO", 200);
        assertThat(reaberto.path("cancelado").asBoolean()).isFalse();
        assertThat(situacaoDe(reaberto, bruna)).isEqualTo("AGENDADO");
        assertThat(situacaoDe(reaberto, aluno)).isEqualTo("CANCELADO");

        // Cancelar o compromisso inteiro cancela todos; repetir não muda nada; reabrir devolve todos a agendado.
        JsonNode grupo = marcarGrupo(List.of(aluno, bruna), dia.plusDays(1), "09:00", 60, 200);
        JsonNode tudo = cancelar(admin, grupo, true, 200);
        assertThat(tudo.path("cancelado").asBoolean()).isTrue();
        assertThat(tudo.path("participantes").findValuesAsString("situacao")).containsOnly("CANCELADO");
        assertThat(cancelar(admin, tudo, true, 200).path("versao").asLong()).isEqualTo(tudo.path("versao").asLong());
        JsonNode devolta = cancelar(admin, tudo, false, 200);
        assertThat(devolta.path("cancelado").asBoolean()).isFalse();
        assertThat(devolta.path("participantes").findValuesAsString("situacao")).containsOnly("AGENDADO");

        // Reabrir exige aluno ativo (ALUNO_INATIVO) e a lista sem cancelado também libera o horário na troca.
        cancelar(admin, devolta, true, 200);
        api.patch("/alunos/" + bruna + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode cancelado = api.get("/agenda/compromissos/" + grupo.path("id").asString(), admin, 200);
        assertThat(cancelar(admin, cancelado, false, 409).path("codigo").asString()).isEqualTo("ALUNO_INATIVO");
    }

    @Test
    void alunoOcupadoSoAvisaEEncostarNaoConta() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        LocalDate dia = hoje().plusDays(11);
        JsonNode membro = outroMembro();
        // Aluno com um compromisso das 10:00 às 11:00 com outro responsável.
        JsonNode existente = api.post("/agenda/compromissos", admin,
                pedido(aluno, usuarioId(membro), dia, "10:00", 60), 200);
        String idExistente = existente.path("id").asString();

        JsonNode ocupado = ocupados(admin, dia, "10:30", 30, List.of(aluno, bruna), null, 200);
        assertThat(ocupado).hasSize(1);
        assertThat(ocupado.get(0).path("id").asString()).isEqualTo(aluno.toString());
        assertThat(ocupado.get(0).path("nome").asString()).isEqualTo("Aluno Fictício da Agenda");
        // Só id e nome: nada do horário, do local, da observação nem do responsável do outro compromisso.
        assertThat(ocupado.get(0).size()).isEqualTo(2);
        assertThat(ocupado.toString()).doesNotContain(OBSERVACAO).doesNotContain("Sala 2");
        // Encostar não conta (termina às 10:00 / começa às 11:00); sobrepor por um minuto, sim.
        assertThat(ocupados(admin, dia, "09:30", 30, List.of(aluno), null, 200)).isEmpty();
        assertThat(ocupados(admin, dia, "11:00", 30, List.of(aluno), null, 200)).isEmpty();
        assertThat(ocupados(admin, dia, "09:30", 31, List.of(aluno), null, 200)).hasSize(1);
        // O próprio compromisso (ao remarcar) fica de fora.
        assertThat(ocupados(admin, dia, "10:30", 30, List.of(aluno), idExistente, 200)).isEmpty();

        // Só aviso: marcar o mesmo aluno no horário com o responsável livre é permitido.
        JsonNode dupla = api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "10:30", 30), 200);

        // Cancelado (o aluno ou o compromisso) não ocupa o aluno.
        JsonNode canceladoSoDele = situacaoDoAluno(admin, existente, aluno, "CANCELADO", 200);
        assertThat(ocupados(admin, dia, "10:30", 30, List.of(aluno), dupla.path("id").asString(), 200)).isEmpty();
        JsonNode reaberto = situacaoDoAluno(admin, canceladoSoDele, aluno, "AGENDADO", 200);
        assertThat(ocupados(admin, dia, "10:30", 30, List.of(aluno), dupla.path("id").asString(), 200)).hasSize(1);
        cancelar(admin, reaberto, true, 200);
        assertThat(ocupados(admin, dia, "10:30", 30, List.of(aluno), dupla.path("id").asString(), 200)).isEmpty();

        // Pedido inválido: duração fora do limite, lista vazia, lista grande demais, repetido.
        ocupados(admin, dia, "10:30", 4, List.of(aluno), null, 400);
        api.get("/agenda/compromissos/alunos-ocupados?data=" + dia + "&hora=10:30&duracaoMinutos=30", admin, 400);
        List<UUID> vinteEUm = new ArrayList<>();
        for (int i = 0; i < 21; i++) vinteEUm.add(UUID.randomUUID());
        ocupados(admin, dia, "10:30", 30, vinteEUm, null, 400);
        ocupados(admin, dia, "10:30", 30, List.of(aluno, aluno), null, 400);
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaRecebe404() throws Exception {
        LocalDate dia = hoje().plusDays(4);
        JsonNode c = marcar(admin, dia, "14:00", 60, 200);
        String id = c.path("id").asString();
        JsonNode outra = api.novoTreinador();
        UUID alunoDaOutra = api.criarAluno(outra, "Aluno Fictício da Outra");

        api.get("/agenda/compromissos/" + id, outra, 404);
        Map<String, Object> corpo = pedido(alunoDaOutra, usuarioId(outra), dia, "14:00", 60);
        corpo.put("versao", c.path("versao").asLong());
        api.put("/agenda/compromissos/" + id, outra, corpo, 404);
        api.post("/agenda/compromissos/" + id + "/situacao", outra, Map.of("cancelado", true, "versao", 0), 404);
        api.post("/agenda/compromissos/" + id + "/alunos/" + aluno + "/situacao", outra,
                Map.of("situacao", "CANCELADO", "versao", 0), 404);
        api.post("/agenda/compromissos/" + id + "/alunos/" + alunoDaOutra + "/situacao", outra,
                Map.of("situacao", "CANCELADO", "versao", 0), 404);
        assertThat(listar(outra, dia, dia)).isEmpty();
        // Aluno e responsável de outra consultoria também são 404, sozinhos ou numa lista com alunos válidos.
        api.post("/agenda/compromissos", outra, pedido(aluno, usuarioId(outra), dia, "08:00", 30), 404);
        api.post("/agenda/compromissos", outra, pedido(alunoDaOutra, usuarioId(admin), dia, "08:00", 30), 404);
        api.post("/agenda/compromissos", outra, pedido(List.of(alunoDaOutra, aluno), usuarioId(outra), dia, "08:00", 30), 404);
        // Trocar a lista com um aluno de outra consultoria: 404, e o compromisso fica como estava.
        Map<String, Object> troca = pedido(List.of(aluno, alunoDaOutra), usuarioId(admin), dia, "14:00", 60);
        troca.put("versao", c.path("versao").asLong());
        api.put("/agenda/compromissos/" + id, admin, troca, 404);
        assertThat(participacoesDoAluno(alunoDaOutra)).isZero();
        // Responsável de outra consultoria não bloqueia o horário desta.
        JsonNode daOutra = api.post("/agenda/compromissos", outra, pedido(alunoDaOutra, usuarioId(outra), dia, "14:00", 60), 200);
        // Aluno ocupado: só os alunos da própria consultoria aparecem.
        assertThat(ocupados(admin, dia, "14:00", 60, List.of(alunoDaOutra), null, 200)).isEmpty();
        assertThat(ocupados(outra, dia, "14:00", 60, List.of(alunoDaOutra, aluno), null, 200)).hasSize(1);
        assertThat(daOutra.path("participantes")).hasSize(1);
    }

    // ---- concorrência ----

    @Test
    void duasReservasSimultaneasDoMesmoHorarioSoUmaPassa() throws Exception {
        LocalDate dia = hoje().plusDays(10);
        UUID outroAluno = api.criarAluno(admin, "Segunda Pessoa Fictícia");
        CountDownLatch largada = new CountDownLatch(1);
        List<Callable<String>> reservas = new ArrayList<>();
        for (UUID quem : List.of(aluno, outroAluno)) {
            String corpo = json.writeValueAsString(pedido(quem, usuarioId(admin), dia, "16:00", 60));
            reservas.add(() -> {
                largada.await();
                var resposta = mvc.perform(MockMvcRequestBuilders.post("/agenda/compromissos")
                        .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(corpo)).andReturn().getResponse();
                String texto = resposta.getContentAsString(StandardCharsets.UTF_8);
                return resposta.getStatus() + (resposta.getStatus() == 200 ? "" : ":" + json.readTree(texto).path("codigo").asString());
            });
        }
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = executor.submit(reservas.get(0));
            var b = executor.submit(reservas.get(1));
            largada.countDown();
            assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("200", "409:HORARIO_OCUPADO");
        }
        assertThat(banco.queryForObject("select count(*) from compromisso where consultoria_id = ? and responsavel_id = ?::uuid",
                Long.class, consultoriaDe(admin), usuarioId(admin))).isEqualTo(1);
    }

    // ---- aluno e privacidade ----

    @Test
    void cadaAlunoVeSoOProprioSemObservacaoNemOsOutrosParticipantes() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode loginDaBruna = api.convidarEEntrar(admin, bruna);
        JsonNode futuro = marcar(admin, hoje().plusDays(2), "07:00", 30, 200);
        JsonNode cancelado = marcar(admin, hoje().plusDays(3), "07:00", 30, 200);
        cancelar(admin, cancelado, true, 200);
        JsonNode passado = marcar(admin, hoje().minusDays(3), "07:00", 30, 200);
        situacaoDoAluno(admin, passado, aluno, "REALIZADO", 200);
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício");
        api.post("/agenda/compromissos", admin, pedido(outroAluno, usuarioId(admin), hoje().plusDays(2), "09:00", 30), 200);
        // Um compromisso em grupo: a Bruna cancela só o dela (a equipe cancela), o aluno segue agendado.
        JsonNode grupo = marcarGrupo(List.of(aluno, bruna), hoje().plusDays(4), "07:00", 30, 200);
        situacaoDoAluno(admin, grupo, bruna, "CANCELADO", 200);

        JsonNode meus = api.get("/aluno/compromissos", loginDoAluno, 200);
        assertThat(ids(meus)).containsExactly(futuro.path("id").asString(), cancelado.path("id").asString(),
                grupo.path("id").asString());
        JsonNode primeiro = meus.get(0);
        assertThat(primeiro.path("hora").asString()).isEqualTo("07:00");
        assertThat(primeiro.path("local").asString()).isEqualTo("Sala 2");
        assertThat(primeiro.path("situacao").asString()).isEqualTo("AGENDADO");
        assertThat(meus.get(1).path("situacao").asString()).isEqualTo("CANCELADO");
        assertThat(primeiro.path("responsavelNome").asString()).isNotBlank();
        assertThat(primeiro.has("observacao")).isFalse();
        assertThat(primeiro.has("alunoId")).isFalse();
        assertThat(primeiro.has("responsavelId")).isFalse();
        assertThat(primeiro.has("participantes")).isFalse();
        // No grupo, cada um vê a situação DELE.
        assertThat(meus.get(2).path("situacao").asString()).isEqualTo("AGENDADO");
        JsonNode daBruna = api.get("/aluno/compromissos", loginDaBruna, 200);
        assertThat(ids(daBruna)).containsExactly(grupo.path("id").asString());
        assertThat(daBruna.get(0).path("situacao").asString()).isEqualTo("CANCELADO");
        for (JsonNode lista : List.of(meus, daBruna)) {
            assertThat(lista.toString()).doesNotContain(OBSERVACAO).doesNotContain("Outro Aluno").doesNotContain("Bruna")
                    .doesNotContain("Aluno Fictício da Agenda").doesNotContain(usuarioId(admin))
                    .doesNotContain(bruna.toString()).doesNotContain(aluno.toString());
        }

        // Só o aluno: o treinador na rota do aluno é 403; o aluno na agenda da equipe também.
        api.get("/aluno/compromissos", admin, 403);
        api.get("/agenda/compromissos", loginDoAluno, 403);
        ocupados(loginDoAluno, hoje().plusDays(2), "07:00", 30, List.of(aluno), null, 403);
    }

    @Test
    void exportacaoSemNomesDosOutrosESemObservacaoEmGrupoEAnonimizarTiraSoAqueleAluno() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        JsonNode unico = marcar(admin, hoje().plusDays(6), "18:00", 50, 200);
        JsonNode grupo = marcarGrupo(List.of(aluno, bruna), hoje().plusDays(7), "18:00", 50, 200);
        // Marcar já gerou os avisos (um por compromisso e aluno): dois para o aluno, um para a Bruna.
        assertThat(avisosDoAluno(aluno)).isEqualTo(2);
        assertThat(avisosDoAluno(bruna)).isEqualTo(1);

        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        JsonNode itens = exportacao.path("compromissos").path("itens");
        assertThat(itens).hasSize(2);
        JsonNode doUnico = itens.get(0);
        assertThat(doUnico.path("observacao").asString()).isEqualTo(OBSERVACAO);
        assertThat(doUnico.path("hora").asString()).isEqualTo("18:00");
        assertThat(doUnico.path("situacao").asString()).isEqualTo("AGENDADO");
        // Em grupo: sem a observação e sem nada dos outros participantes.
        JsonNode doGrupo = itens.get(1);
        assertThat(doGrupo.path("id").asString()).isEqualTo(grupo.path("id").asString());
        assertThat(doGrupo.path("observacao").isNull() || doGrupo.path("observacao").isMissingNode()).isTrue();
        assertThat(doGrupo.has("participantes")).isFalse();
        assertThat(itens.toString()).doesNotContain("Bruna").doesNotContain(bruna.toString());
        assertThat(doGrupo.toString()).doesNotContain(OBSERVACAO);
        // A Bruna também vê o grupo sem a observação.
        JsonNode daBruna = api.get("/alunos/" + bruna + "/exportacao", admin, 200).path("compromissos").path("itens");
        assertThat(daBruna).hasSize(1);
        assertThat(daBruna.toString()).doesNotContain(OBSERVACAO).doesNotContain("Aluno Fictício da Agenda");

        long versaoDoGrupo = versaoNoBanco(grupo.path("id").asString());
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício da Agenda"), 200);
        // Saiu só ele: o compromisso dele sozinho e os avisos dele somem; o grupo e a Bruna ficam.
        assertThat(participacoesDoAluno(aluno)).isZero();
        assertThat(compromissosExistentes(unico.path("id").asString())).isZero();
        assertThat(compromissosExistentes(grupo.path("id").asString())).isEqualTo(1);
        assertThat(participacoesDoAluno(bruna)).isEqualTo(1);
        assertThat(avisosDoAluno(aluno)).isZero();
        assertThat(avisosDoAluno(bruna)).isEqualTo(1);
        assertThat(versaoNoBanco(grupo.path("id").asString())).isGreaterThan(versaoDoGrupo);
        JsonNode restante = api.get("/agenda/compromissos/" + grupo.path("id").asString(), admin, 200);
        assertThat(nomesDosParticipantes(restante)).containsExactly("Bruna Fictícia");
    }

    @Test
    void anonimizarOAlunoQuandoOsOutrosJaEstavamCanceladosCancelaOCompromisso() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        JsonNode grupo = marcarGrupo(List.of(aluno, bruna), hoje().plusDays(5), "13:00", 30, 200);
        String id = grupo.path("id").asString();
        situacaoDoAluno(admin, grupo, bruna, "CANCELADO", 200);
        assertThat(canceladoNoBanco(id)).isFalse();
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício da Agenda"), 200);
        // Sobrou só a Bruna, já cancelada: o compromisso passa a cancelado e o horário do responsável fica livre.
        assertThat(canceladoNoBanco(id)).isTrue();
        api.post("/agenda/compromissos", admin,
                pedido(novoAluno("Livre Fictício"), usuarioId(admin), hoje().plusDays(5), "13:00", 30), 200);
    }

    @Test
    void exportacaoSemAgendaLerOmiteASecao() throws Exception {
        marcar(admin, hoje().plusDays(6), "18:00", 50, 200);
        UUID consultoria = consultoriaDe(admin);
        // Perfil com tudo da exportação menos a agenda.
        banco.update("update usuario set perfil_id = ? where id = ?::uuid",
                criarPerfil(consultoria, List.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR")), usuarioId(admin));
        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(exportacao.has("compromissos")).isFalse();
        assertThat(exportacao.path("secoesOmitidas").toString()).contains("compromissos");
    }

    private UUID criarPerfil(UUID consultoria, List<String> codigos) {
        UUID id = UUID.randomUUID();
        banco.update("insert into perfil(id, consultoria_id, nome) values (?, ?, ?)", id, consultoria, "Perfil " + id);
        for (String codigo : codigos) {
            banco.update("insert into perfil_permissao(perfil_id, codigo) values (?, ?)", id, codigo);
        }
        return id;
    }

    @Test
    void excluirMinhaContaTiraSoOAlunoEApagaOCompromissoDoAlunoUnico() throws Exception {
        UUID bruna = novoAluno("Bruna Fictícia");
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode unico = marcar(admin, hoje().plusDays(8), "12:00", 30, 200);
        JsonNode grupo = marcarGrupo(List.of(aluno, bruna), hoje().plusDays(9), "12:00", 30, 200);
        assertThat(participacoesDoAluno(aluno)).isEqualTo(2);
        assertThat(avisosDoAluno(aluno)).isEqualTo(2);

        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(participacoesDoAluno(aluno)).isZero();
        assertThat(avisosDoAluno(aluno)).isZero();
        assertThat(compromissosExistentes(unico.path("id").asString())).isZero();
        assertThat(compromissosExistentes(grupo.path("id").asString())).isEqualTo(1);
        assertThat(participacoesDoAluno(bruna)).isEqualTo(1);
    }
}
