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
 * Agenda presencial: conflito do responsável (e a trava contra duas reservas simultâneas), fuso de Brasília atravessando
 * a meia-noite, versão, situação, permissões dos perfis padrão, observação como dado sensível, isolamento entre
 * consultorias (404), a visão do aluno e a privacidade (exportação, anonimização e "Excluir minha conta"). Só dados
 * fictícios; toda consulta direta filtra pela consultoria ou pelo aluno do próprio teste.
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

    private static Map<String, Object> pedido(UUID alunoId, String responsavelId, LocalDate data, String hora, int duracao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoId", alunoId);
        corpo.put("responsavelId", responsavelId);
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("local", "Sala 2");
        corpo.put("observacao", OBSERVACAO);
        return corpo;
    }

    private JsonNode marcar(JsonNode login, LocalDate data, String hora, int duracao, int status) throws Exception {
        return api.post("/agenda/compromissos", login, pedido(aluno, usuarioId(admin), data, hora, duracao), status);
    }

    private JsonNode listar(JsonNode login, LocalDate de, LocalDate ate) throws Exception {
        return api.get("/agenda/compromissos?de=" + de + "&ate=" + ate, login, 200);
    }

    private static List<String> ids(JsonNode lista) {
        List<String> ids = new ArrayList<>();
        lista.forEach(c -> ids.add(c.path("id").asString()));
        return ids;
    }

    private JsonNode situacao(JsonNode login, JsonNode c, String situacao, int status) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", login,
                Map.of("situacao", situacao, "versao", c.path("versao").asLong()), status);
    }

    private long compromissosDoAluno(UUID alunoId) {
        Long total = banco.queryForObject("select count(*) from compromisso where aluno_id = ?", Long.class, alunoId);
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

        // Perfil sem as permissões da agenda: 403 nas quatro rotas.
        banco.update("delete from perfil_permissao where codigo like 'AGENDA_%' and perfil_id = "
                + "(select id from perfil where consultoria_id = ? and nome = 'Assistente')", consultoria);
        String id = doTreinador.path("id").asString();
        api.get("/agenda/compromissos", admin, 403);
        api.post("/agenda/compromissos", admin, pedido(aluno, usuarioId(admin), dia, "15:00", 30), 403);
        api.put("/agenda/compromissos/" + id, admin, remarcar, 403);
        api.post("/agenda/compromissos/" + id + "/situacao", admin, Map.of("situacao", "CANCELADO", "versao", 0), 403);
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
        assertThat(c.path("situacao").asString()).isEqualTo("AGENDADO");
        assertThat(c.path("alunoNome").asString()).isEqualTo("Aluno Fictício da Agenda");

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

        // Cancelar libera o horário; voltar o cancelado a agendado com o horário tomado: 409.
        JsonNode cancelado = situacao(admin, primeiro, "CANCELADO", 200);
        JsonNode novo = marcar(admin, dia, "08:00", 30, 200);
        assertThat(situacao(admin, cancelado, "AGENDADO", 409).path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        situacao(admin, novo, "CANCELADO", 200);
        situacao(admin, cancelado, "AGENDADO", 200);
        // Filtro de situação.
        JsonNode cancelados = api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia + "&situacao=CANCELADO", admin, 200);
        assertThat(ids(cancelados)).containsExactly(novo.path("id").asString());
    }

    @Test
    void realizadoEFaltaSoDepoisDoInicioEAuditoriaComResumoFixo() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode futuro = marcar(admin, hoje().plusDays(2), "09:00", 45, 200);
        assertThat(situacao(admin, futuro, "REALIZADO", 409).path("codigo").asString()).isEqualTo("COMPROMISSO_NO_FUTURO");
        assertThat(situacao(admin, futuro, "FALTOU", 409).path("codigo").asString()).isEqualTo("COMPROMISSO_NO_FUTURO");

        JsonNode passado = marcar(admin, hoje().minusDays(2), "09:00", 45, 200);
        JsonNode realizado = situacao(admin, passado, "REALIZADO", 200);
        assertThat(realizado.path("situacao").asString()).isEqualTo("REALIZADO");
        // Mesma situação de novo: nada muda e não audita outra vez.
        situacao(admin, realizado, "REALIZADO", 200);
        JsonNode faltou = situacao(admin, realizado, "FALTOU", 200);
        assertThat(faltou.path("situacao").asString()).isEqualTo("FALTOU");
        // Versão velha.
        assertThat(situacao(admin, realizado, "AGENDADO", 409).path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

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
        api.post("/agenda/compromissos/" + id + "/situacao", outra, Map.of("situacao", "CANCELADO", "versao", 0), 404);
        assertThat(listar(outra, dia, dia)).isEmpty();
        // Aluno e responsável de outra consultoria também são 404.
        api.post("/agenda/compromissos", outra, pedido(aluno, usuarioId(outra), dia, "08:00", 30), 404);
        api.post("/agenda/compromissos", outra, pedido(alunoDaOutra, usuarioId(admin), dia, "08:00", 30), 404);
        // Responsável de outra consultoria não bloqueia o horário desta.
        api.post("/agenda/compromissos", outra, pedido(alunoDaOutra, usuarioId(outra), dia, "14:00", 60), 200);
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
    void alunoVeSoOsPropriosProximosSemObservacao() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        JsonNode futuro = marcar(admin, hoje().plusDays(2), "07:00", 30, 200);
        JsonNode cancelado = marcar(admin, hoje().plusDays(3), "07:00", 30, 200);
        situacao(admin, cancelado, "CANCELADO", 200);
        JsonNode passado = marcar(admin, hoje().minusDays(3), "07:00", 30, 200);
        situacao(admin, passado, "REALIZADO", 200);
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício");
        api.post("/agenda/compromissos", admin, pedido(outroAluno, usuarioId(admin), hoje().plusDays(2), "09:00", 30), 200);

        JsonNode meus = api.get("/aluno/compromissos", loginDoAluno, 200);
        assertThat(ids(meus)).containsExactly(futuro.path("id").asString(), cancelado.path("id").asString());
        JsonNode primeiro = meus.get(0);
        assertThat(primeiro.path("hora").asString()).isEqualTo("07:00");
        assertThat(primeiro.path("local").asString()).isEqualTo("Sala 2");
        assertThat(primeiro.path("responsavelNome").asString()).isNotBlank();
        assertThat(primeiro.has("observacao")).isFalse();
        assertThat(primeiro.has("alunoId")).isFalse();
        assertThat(primeiro.has("responsavelId")).isFalse();
        assertThat(meus.toString()).doesNotContain(OBSERVACAO).doesNotContain("Outro Aluno");

        // Só o aluno: o treinador na rota do aluno é 403; o aluno na agenda da equipe também.
        api.get("/aluno/compromissos", admin, 403);
        api.get("/agenda/compromissos", loginDoAluno, 403);
    }

    @Test
    void exportacaoLevaOsCompromissosEAnonimizarApaga() throws Exception {
        marcar(admin, hoje().plusDays(6), "18:00", 50, 200);
        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        JsonNode itens = exportacao.path("compromissos").path("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).path("observacao").asString()).isEqualTo(OBSERVACAO);
        assertThat(itens.get(0).path("hora").asString()).isEqualTo("18:00");

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", "Aluno Fictício da Agenda"), 200);
        assertThat(compromissosDoAluno(aluno)).isZero();
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
    void excluirMinhaContaApagaOsCompromissos() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        marcar(admin, hoje().plusDays(8), "12:00", 30, 200);
        assertThat(compromissosDoAluno(aluno)).isEqualTo(1);
        api.post("/aluno/conta/excluir", loginDoAluno, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);
        assertThat(compromissosDoAluno(aluno)).isZero();
    }
}
