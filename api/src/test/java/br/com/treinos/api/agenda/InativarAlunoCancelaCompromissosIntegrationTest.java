package br.com.treinos.api.agenda;

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

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D18: inativar o aluno cancela os compromissos futuros dele, na mesma transação, pela rota individual e pelo lote (a
 * planilha está no {@code ImportacaoIntegrationTest}). Só a participação dele é cancelada; o compromisso só fica cancelado
 * (e libera o horário do responsável) se ele era o último não cancelado; passados, em andamento, realizados e faltas não
 * mudam; reativar não devolve nada; não gera aviso; a auditoria é uma por aluno, de resumo fixo. Só dados fictícios; toda
 * consulta direta filtra pelo compromisso ou pelo aluno do próprio teste.
 */
@AutoConfigureMockMvc
class InativarAlunoCancelaCompromissosIntegrationTest extends AbstractIntegrationTest {

    private static final String ACAO = "ALUNO_COMPROMISSOS_CANCELADOS";
    private static final String NOME = "Aluno Fictício da Inativação";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String eu;
    private UUID aluno;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        eu = admin.path("usuario").path("id").asString();
        aluno = api.criarAluno(admin, NOME);
    }

    // ---- auxiliares ----

    private static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    private Map<String, Object> pedido(List<UUID> alunoIds, LocalDate data, String hora) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", eu);
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", 45);
        corpo.put("local", "Sala 2");
        return corpo;
    }

    private JsonNode marcar(List<UUID> alunoIds, LocalDate data, String hora) throws Exception {
        return api.post("/agenda/compromissos", admin, pedido(alunoIds, data, hora), 200);
    }

    private JsonNode marcar(UUID alunoId, LocalDate data, String hora) throws Exception {
        return marcar(List.of(alunoId), data, hora);
    }

    private JsonNode inativar(UUID alunoId) throws Exception {
        return api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", false), 200);
    }

    private JsonNode reativar(UUID alunoId) throws Exception {
        return api.patch("/alunos/" + alunoId + "/situacao", admin, Map.of("ativo", true), 200);
    }

    private String situacao(JsonNode c, UUID alunoId) {
        return banco.queryForObject("select situacao from compromisso_aluno where compromisso_id = ?::uuid and aluno_id = ?",
                String.class, c.path("id").asString(), alunoId);
    }

    private boolean cancelado(JsonNode c) {
        return Boolean.TRUE.equals(banco.queryForObject("select cancelado from compromisso where id = ?::uuid", Boolean.class,
                c.path("id").asString()));
    }

    private long versao(JsonNode c) {
        return banco.queryForObject("select versao from compromisso where id = ?::uuid", Long.class, c.path("id").asString());
    }

    private long avisos(UUID alunoId) {
        return banco.queryForObject("select count(*) from aviso_compromisso where aluno_id = ?", Long.class, alunoId);
    }

    private long auditorias(UUID alunoId) {
        return banco.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?", Long.class, ACAO,
                alunoId);
    }

    private String resumo(UUID alunoId) {
        return banco.queryForObject("select resumo from auditoria where acao = ? and entidade_id = ?", String.class, ACAO,
                alunoId);
    }

    /** O horário do responsável está livre quando outro aluno consegue marcar nele. */
    private void horarioLivre(JsonNode c, boolean livre) throws Exception {
        UUID outro = api.criarAluno(admin, "Quem Testa o Horário Fictício");
        api.post("/agenda/compromissos", admin, pedido(List.of(outro), LocalDate.parse(c.path("data").asString()),
                c.path("hora").asString()), livre ? 200 : 409);
    }

    // ---- rota individual ----

    @Test
    void inativarCancelaOsFuturosAgendadosEDeixaOResto() throws Exception {
        UUID outroAluno = api.criarAluno(admin, "Outro Aluno Fictício da Inativação");
        JsonNode futuro1 = marcar(aluno, hoje().plusDays(3), "09:00");
        JsonNode futuro2 = marcar(aluno, hoje().plusDays(4), "09:00");
        JsonNode passado = marcar(aluno, hoje().minusDays(3), "09:00");
        JsonNode realizadoFuturo = marcar(aluno, hoje().plusDays(5), "09:00");
        JsonNode faltouFuturo = marcar(aluno, hoje().plusDays(6), "09:00");
        JsonNode emAndamento = marcar(aluno, hoje().plusDays(7), "09:00");
        JsonNode doOutro = marcar(outroAluno, hoje().plusDays(3), "11:00");
        // Realizado e falta no futuro só existem por SQL (a API recusa antes do início).
        banco.update("update compromisso_aluno set situacao = 'REALIZADO' where compromisso_id = ?::uuid",
                realizadoFuturo.path("id").asString());
        banco.update("update compromisso_aluno set situacao = 'FALTOU' where compromisso_id = ?::uuid",
                faltouFuturo.path("id").asString());
        // Já começou e ainda não terminou: não "começa depois de agora".
        banco.update("update compromisso set inicio = now() - interval '10 minutes', fim = now() + interval '35 minutes' "
                + "where id = ?::uuid", emAndamento.path("id").asString());
        long avisosAntes = avisos(aluno);
        long avisosDoOutroAntes = avisos(outroAluno);
        long versaoAntes = versao(futuro1);
        long versaoDoPassado = versao(passado);

        assertThat(inativar(aluno).path("ativo").asBoolean()).isFalse();

        assertThat(situacao(futuro1, aluno)).isEqualTo("CANCELADO");
        assertThat(situacao(futuro2, aluno)).isEqualTo("CANCELADO");
        assertThat(cancelado(futuro1)).isTrue();
        assertThat(cancelado(futuro2)).isTrue();
        assertThat(versao(futuro1)).isGreaterThan(versaoAntes);
        assertThat(situacao(passado, aluno)).isEqualTo("AGENDADO");
        assertThat(cancelado(passado)).isFalse();
        assertThat(versao(passado)).isEqualTo(versaoDoPassado);
        assertThat(situacao(realizadoFuturo, aluno)).isEqualTo("REALIZADO");
        assertThat(cancelado(realizadoFuturo)).isFalse();
        assertThat(situacao(faltouFuturo, aluno)).isEqualTo("FALTOU");
        assertThat(situacao(emAndamento, aluno)).isEqualTo("AGENDADO");
        assertThat(cancelado(emAndamento)).isFalse();
        assertThat(situacao(doOutro, outroAluno)).isEqualTo("AGENDADO");
        // O compromisso do aluno único foi cancelado: o horário do responsável fica livre.
        horarioLivre(futuro1, true);
        horarioLivre(realizadoFuturo, false);
        // Sem aviso novo para ele nem para os outros; os não vistos dele saem (D12), os do outro aluno ficam.
        assertThat(avisosAntes).isPositive(); // marcar gerou avisos NOVO, todos não vistos
        assertThat(avisos(aluno)).isZero();
        assertThat(avisos(outroAluno)).isEqualTo(avisosDoOutroAntes);
        // Uma auditoria, com a quantidade e sem nome nem data.
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(resumo(aluno)).isEqualTo("Cancelou 2 compromissos futuros do aluno ao inativá-lo.")
                .doesNotContain("Fictício").doesNotContain(String.valueOf(hoje().getYear()));
        assertThat(auditorias(outroAluno)).isZero();
    }

    @Test
    void reativarNaoVoltaNadaEInativarDeNovoNaoDuplicaAAuditoria() throws Exception {
        JsonNode futuro = marcar(aluno, hoje().plusDays(3), "09:00");
        inativar(aluno);
        assertThat(cancelado(futuro)).isTrue();
        long versaoCancelado = versao(futuro);

        assertThat(reativar(aluno).path("ativo").asBoolean()).isTrue();
        assertThat(situacao(futuro, aluno)).isEqualTo("CANCELADO");
        assertThat(cancelado(futuro)).isTrue();
        assertThat(versao(futuro)).isEqualTo(versaoCancelado);

        inativar(aluno);
        inativar(aluno); // já inativo: nada a cancelar
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(versao(futuro)).isEqualTo(versaoCancelado);
    }

    @Test
    void semCompromissoFuturoNaoAudita() throws Exception {
        marcar(aluno, hoje().minusDays(2), "09:00");
        inativar(aluno);
        assertThat(auditorias(aluno)).isZero();
        UUID semNada = api.criarAluno(admin, "Aluno Sem Agenda Fictício");
        inativar(semNada);
        assertThat(auditorias(semNada)).isZero();
    }

    @Test
    void compromissoComVariosAlunosCancelaSoAParticipacaoEOCompromissoSeguiAtivo() throws Exception {
        UUID bruna = api.criarAluno(admin, "Bruna Fictícia da Inativação");
        JsonNode grupo = marcar(List.of(aluno, bruna), hoje().plusDays(4), "10:00");
        long avisosDaBruna = avisos(bruna);
        long versaoAntes = versao(grupo);

        inativar(aluno);

        assertThat(situacao(grupo, aluno)).isEqualTo("CANCELADO");
        assertThat(situacao(grupo, bruna)).isEqualTo("AGENDADO");
        assertThat(cancelado(grupo)).isFalse();
        assertThat(versao(grupo)).isGreaterThan(versaoAntes);
        horarioLivre(grupo, false); // segue ocupado pela Bruna
        assertThat(avisos(bruna)).isEqualTo(avisosDaBruna);
        assertThat(resumo(aluno)).isEqualTo("Cancelou 1 compromisso futuro do aluno ao inativá-lo.");

        // O último não cancelado que sai cancela o compromisso e libera o horário.
        inativar(bruna);
        assertThat(situacao(grupo, bruna)).isEqualTo("CANCELADO");
        assertThat(cancelado(grupo)).isTrue();
        horarioLivre(grupo, true);
    }

    @Test
    void quemEraOUltimoNaoCanceladoCancelaOCompromisso() throws Exception {
        UUID bruna = api.criarAluno(admin, "Bruna Fictícia Já Cancelada");
        JsonNode grupo = marcar(List.of(aluno, bruna), hoje().plusDays(4), "10:00");
        api.post("/agenda/compromissos/" + grupo.path("id").asString() + "/alunos/" + bruna + "/situacao", admin,
                Map.of("situacao", "CANCELADO", "versao", grupo.path("versao").asLong()), 200);
        assertThat(cancelado(grupo)).isFalse();

        inativar(aluno);

        assertThat(cancelado(grupo)).isTrue();
        horarioLivre(grupo, true);
    }

    @Test
    void serieCancelaCadaOcorrenciaFutura() throws Exception {
        LocalDate primeira = hoje().plusDays(2);
        Map<String, Object> corpo = pedido(List.of(aluno), primeira, "08:00");
        corpo.put("repeticao", Map.of("tipo", "SEMANAL", "diasDaSemana", List.of(primeira.getDayOfWeek().name()), "vezes", 4));
        JsonNode serie = api.post("/agenda/compromissos", admin, corpo, 200);
        List<String> ids = banco.queryForList("select id::text from compromisso where serie_id = ?::uuid order by inicio",
                String.class, serie.path("serieId").asString());
        assertThat(ids).hasSize(4);
        // A primeira ocorrência já passou (SQL): só as outras três são futuras.
        banco.update("update compromisso set inicio = inicio - interval '10 days', fim = fim - interval '10 days' "
                + "where id = ?::uuid", ids.getFirst());
        long avisosAntes = avisos(aluno);

        inativar(aluno);

        List<String> situacoes = banco.queryForList("select ca.situacao from compromisso_aluno ca join compromisso c "
                + "on c.id = ca.compromisso_id where c.serie_id = ?::uuid and ca.aluno_id = ? order by c.inicio",
                String.class, serie.path("serieId").asString(), aluno);
        assertThat(situacoes).containsExactly("AGENDADO", "CANCELADO", "CANCELADO", "CANCELADO");
        assertThat(banco.queryForList("select cancelado from compromisso where serie_id = ?::uuid order by inicio",
                Boolean.class, serie.path("serieId").asString())).containsExactly(false, true, true, true);
        assertThat(resumo(aluno)).isEqualTo("Cancelou 3 compromissos futuros do aluno ao inativá-lo.");
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(avisosAntes).isPositive();
        assertThat(avisos(aluno)).isZero(); // os não vistos saem; a inativação não gera aviso de cancelamento
    }

    // ---- avisos não vistos (D12) ----

    private long avisosNaoVistos(UUID alunoId) {
        return banco.queryForObject("select count(*) from aviso_compromisso where aluno_id = ? and visto_em is null",
                Long.class, alunoId);
    }

    private long avisosVistos(UUID alunoId) {
        return banco.queryForObject("select count(*) from aviso_compromisso where aluno_id = ? and visto_em is not null",
                Long.class, alunoId);
    }

    private JsonNode loginDoAlunoJaConvidado(UUID alunoId) throws Exception {
        String email = banco.queryForObject("select u.email from usuario u join aluno a on a.usuario_id = u.id "
                + "where a.id = ?", String.class, alunoId);
        return api.post("/auth/login", null, Map.of("email", email, "senha", ApiDeTeste.SENHA), 200);
    }

    @Test
    void inativarApagaTodosOsAvisosNaoVistosEMantemOVistoInclusiveDeCompromissoTerminado() throws Exception {
        JsonNode loginDoAluno = api.convidarEEntrar(admin, aluno);
        UUID bruna = api.criarAluno(admin, "Bruna Fictícia dos Avisos");
        JsonNode visto = marcar(aluno, hoje().plusDays(3), "09:00");
        JsonNode lista = api.get("/aluno/avisos-de-compromisso", loginDoAluno, 200);
        assertThat(lista).hasSize(1);
        api.post("/aluno/avisos-de-compromisso/" + lista.get(0).path("id").asString() + "/visto", loginDoAluno, null, 204);
        marcar(aluno, hoje().plusDays(4), "09:00"); // NOVO não visto, compromisso futuro
        JsonNode terminado = marcar(aluno, hoje().plusDays(5), "09:00"); // NOVO não visto...
        banco.update("update compromisso set inicio = now() - interval '2 hours', fim = now() - interval '1 hour' "
                + "where id = ?::uuid", terminado.path("id").asString()); // ...de um compromisso que já terminou
        marcar(bruna, hoje().plusDays(3), "11:00");
        assertThat(avisosNaoVistos(aluno)).isEqualTo(2);
        assertThat(avisosVistos(aluno)).isEqualTo(1);
        assertThat(avisos(bruna)).isEqualTo(1);

        inativar(aluno);

        assertThat(avisosNaoVistos(aluno)).isZero();
        assertThat(avisosVistos(aluno)).isEqualTo(1); // o visto fica
        assertThat(avisos(bruna)).isEqualTo(1); // o de outro aluno não é tocado
        assertThat(situacao(visto, aluno)).isEqualTo("CANCELADO");

        reativar(aluno);

        // Quem volta não encontra aviso velho; o visto continua no banco e na exportação.
        assertThat(api.get("/aluno/avisos-de-compromisso", loginDoAlunoJaConvidado(aluno), 200)).isEmpty();
        assertThat(avisosVistos(aluno)).isEqualTo(1);
        JsonNode exportacao = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        assertThat(exportacao.path("avisosDeCompromisso").path("itens")).hasSize(1);
    }

    @Test
    void inativarSemNadaParaCancelarApagaOsAvisosNaoVistosDeCompromissoTerminado() throws Exception {
        JsonNode c = marcar(aluno, hoje().plusDays(3), "09:00");
        banco.update("update compromisso set inicio = now() - interval '2 hours', fim = now() - interval '1 hour' "
                + "where id = ?::uuid", c.path("id").asString());
        assertThat(avisosNaoVistos(aluno)).isEqualTo(1);

        inativar(aluno);

        assertThat(avisos(aluno)).isZero();
        assertThat(situacao(c, aluno)).isEqualTo("AGENDADO"); // terminado: nada a cancelar
        assertThat(auditorias(aluno)).isZero();
    }

    // ---- lote ----

    @Test
    void loteCancelaOsFuturosDeCadaAlunoEAuditaUmaVezPorAluno() throws Exception {
        UUID bruna = api.criarAluno(admin, "Bruna Fictícia do Lote");
        UUID semAgenda = api.criarAluno(admin, "Aluno Do Lote Sem Agenda Fictício");
        JsonNode soDele = marcar(aluno, hoje().plusDays(3), "09:00");
        JsonNode emGrupo = marcar(List.of(aluno, bruna), hoje().plusDays(4), "09:00");
        JsonNode soDela = marcar(bruna, hoje().plusDays(5), "09:00");
        JsonNode passado = marcar(bruna, hoje().minusDays(1), "09:00");
        long avisosAntes = avisos(aluno) + avisos(bruna);

        JsonNode r = api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(aluno, bruna, semAgenda)), 200);

        assertThat(r.path("alterados").asInt()).isEqualTo(3);
        assertThat(cancelado(soDele)).isTrue();
        assertThat(cancelado(soDela)).isTrue();
        // Os dois saíram na mesma transação: o compromisso em grupo termina cancelado e o horário fica livre.
        assertThat(situacao(emGrupo, aluno)).isEqualTo("CANCELADO");
        assertThat(situacao(emGrupo, bruna)).isEqualTo("CANCELADO");
        assertThat(cancelado(emGrupo)).isTrue();
        horarioLivre(emGrupo, true);
        assertThat(situacao(passado, bruna)).isEqualTo("AGENDADO");
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(auditorias(bruna)).isEqualTo(1);
        assertThat(auditorias(semAgenda)).isZero();
        assertThat(resumo(aluno)).isEqualTo("Cancelou 2 compromissos futuros do aluno ao inativá-lo.");
        assertThat(resumo(bruna)).isEqualTo("Cancelou 2 compromissos futuros do aluno ao inativá-lo.");
        assertThat(avisosAntes).isPositive();
        assertThat(avisos(aluno) + avisos(bruna)).isZero(); // não vistos saem; nenhum aviso de cancelamento nasce

        // Repetir o lote: já estão inativos, nada muda e a auditoria não duplica.
        assertThat(api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(aluno, bruna)), 200)
                .path("alterados").asInt()).isZero();
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(auditorias(bruna)).isEqualTo(1);
    }

    @Test
    void loteComIdDeOutraConsultoriaNaoCancelaNada() throws Exception {
        JsonNode futuro = marcar(aluno, hoje().plusDays(3), "09:00");
        JsonNode outro = api.novoTreinador();
        UUID estranho = api.criarAluno(outro, "Aluno de Outra Consultoria Fictício");

        api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(aluno, estranho)), 404);

        assertThat(situacao(futuro, aluno)).isEqualTo("AGENDADO");
        assertThat(cancelado(futuro)).isFalse();
        assertThat(auditorias(aluno)).isZero();
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaNaoInativaNemCancelaECadaConsultoriaCancelaSoOsSeus() throws Exception {
        JsonNode meu = marcar(aluno, hoje().plusDays(3), "09:00");
        JsonNode outro = api.novoTreinador();
        String responsavelDeLa = outro.path("usuario").path("id").asString();
        UUID alunoDeLa = api.criarAluno(outro, "Aluno da Outra Consultoria Fictício");
        Map<String, Object> corpo = pedido(List.of(alunoDeLa), hoje().plusDays(3), "09:00");
        corpo.put("responsavelId", responsavelDeLa);
        JsonNode dela = api.post("/agenda/compromissos", outro, corpo, 200);

        // Aluno de outra consultoria: 404 e nada muda.
        api.patch("/alunos/" + aluno + "/situacao", outro, Map.of("ativo", false), 404);
        assertThat(situacao(meu, aluno)).isEqualTo("AGENDADO");
        assertThat(api.get("/alunos/" + aluno, admin, 200).path("ativo").asBoolean()).isTrue();

        // Inativar o meu não toca nos dela, e o contrário também.
        inativar(aluno);
        assertThat(situacao(dela, alunoDeLa)).isEqualTo("AGENDADO");
        assertThat(cancelado(dela)).isFalse();
        api.patch("/alunos/" + alunoDeLa + "/situacao", outro, Map.of("ativo", false), 200);
        assertThat(situacao(dela, alunoDeLa)).isEqualTo("CANCELADO");
        assertThat(auditorias(aluno)).isEqualTo(1);
        assertThat(auditorias(alunoDeLa)).isEqualTo(1);
    }
}
