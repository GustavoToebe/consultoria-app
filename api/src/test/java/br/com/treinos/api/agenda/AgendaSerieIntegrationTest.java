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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Série de compromissos com aluno (passo 2 do plano da agenda, D4): criar com fim obrigatório e até 52 ocorrências, o
 * conflito de UMA ocorrência recusando tudo (409 com as datas, nada gravado), editar e cancelar com escopo (esta, seguintes,
 * todas; as passadas nunca mudam; a data só em "esta"), participantes trocados na série e isolamento entre consultorias.
 * Cada teste cria o próprio treinador (consultoria) e só dados fictícios; a consulta direta filtra pela consultoria ou pelo
 * aluno do teste. As ocorrências passadas nascem de uma série criada no passado (a criação não recusa datas passadas), com
 * datas que nunca caem em hoje, para o resultado não depender do relógio.
 */
@AutoConfigureMockMvc
class AgendaSerieIntegrationTest extends AbstractIntegrationTest {

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
        aluno = api.criarAluno(admin, "Aluno Fictício da Série");
    }

    // ---- auxiliares ----

    private static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    private String eu() {
        return admin.path("usuario").path("id").asString();
    }

    private UUID consultoria() {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, eu());
    }

    private static Map<String, Object> pedido(List<UUID> alunoIds, String responsavelId, LocalDate data, String hora, int duracao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", alunoIds);
        corpo.put("responsavelId", responsavelId);
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("local", "Sala 2");
        corpo.put("observacao", "Observação fictícia");
        return corpo;
    }

    private static Map<String, Object> semanal(LocalDate primeira, int vezes) {
        Map<String, Object> repeticao = new HashMap<>();
        repeticao.put("tipo", "SEMANAL");
        repeticao.put("diasDaSemana", List.of(primeira.getDayOfWeek().name()));
        repeticao.put("vezes", vezes);
        return repeticao;
    }

    private static Map<String, Object> diaria(Integer vezes, LocalDate ate) {
        Map<String, Object> repeticao = new HashMap<>();
        repeticao.put("tipo", "DIARIA");
        if (vezes != null) repeticao.put("vezes", vezes);
        if (ate != null) repeticao.put("ate", ate.toString());
        return repeticao;
    }

    private JsonNode criarSerie(List<UUID> alunoIds, LocalDate data, String hora, int duracao, Map<String, Object> repeticao,
                                int status) throws Exception {
        Map<String, Object> corpo = pedido(alunoIds, eu(), data, hora, duracao);
        corpo.put("repeticao", repeticao);
        return api.post("/agenda/compromissos", admin, corpo, status);
    }

    private JsonNode marcarAvulso(LocalDate data, String hora, int duracao, UUID umAluno, int status) throws Exception {
        return api.post("/agenda/compromissos", admin, pedido(List.of(umAluno), eu(), data, hora, duracao), status);
    }

    /** Os ids das ocorrências da série, em ordem de início. */
    private List<String> ocorrencias(JsonNode primeira) {
        return banco.queryForList("select id::text from compromisso where serie_id = ?::uuid and consultoria_id = ? order by inicio",
                String.class, primeira.path("serieId").asString(), consultoria());
    }

    private JsonNode detalhe(String id) throws Exception {
        return api.get("/agenda/compromissos/" + id, admin, 200);
    }

    private List<JsonNode> detalhes(List<String> ids) throws Exception {
        List<JsonNode> lista = new ArrayList<>();
        for (String id : ids) lista.add(detalhe(id));
        return lista;
    }

    private JsonNode alterar(String id, Map<String, Object> corpo, long versao, String escopo, int status) throws Exception {
        corpo.put("versao", versao);
        return api.put("/agenda/compromissos/" + id + (escopo == null ? "" : "?escopo=" + escopo), admin, corpo, status);
    }

    private JsonNode cancelar(JsonNode c, boolean cancelado, String escopo, int status) throws Exception {
        return api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao"
                + (escopo == null ? "" : "?escopo=" + escopo), admin,
                Map.of("cancelado", cancelado, "versao", c.path("versao").asLong()), status);
    }

    private long compromissosDaConsultoria() {
        Long total = banco.queryForObject("select count(*) from compromisso where consultoria_id = ?", Long.class, consultoria());
        return total == null ? 0 : total;
    }

    private long auditorias(String acao) {
        Long total = banco.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = ?", Long.class,
                consultoria(), acao);
        return total == null ? 0 : total;
    }

    private static List<String> datas(JsonNode erro) {
        List<String> datas = new ArrayList<>();
        erro.path("fieldErrors").forEach(f -> {
            if (f.path("field").asString().equals("datasEmConflito")) datas.add(f.path("message").asString());
        });
        return datas;
    }

    private static String hora(JsonNode c) {
        return c.path("hora").asString();
    }

    // ---- criar ----

    @Test
    void criaSeriePorDataComUmCompromissoDeVerdadePorDia() throws Exception {
        LocalDate dia = hoje().plusDays(20);
        JsonNode primeira = criarSerie(List.of(aluno), dia, "09:00", 45, diaria(null, dia.plusDays(3)), 200);

        assertThat(primeira.path("serieId").isNull()).isFalse();
        assertThat(primeira.path("ocorrenciaDaSerie").asInt()).isEqualTo(1);
        assertThat(primeira.path("totalDaSerie").asInt()).isEqualTo(4);
        assertThat(primeira.path("data").asString()).isEqualTo(dia.toString());
        List<JsonNode> todas = detalhes(ocorrencias(primeira));
        assertThat(todas).hasSize(4);
        for (int i = 0; i < todas.size(); i++) {
            JsonNode c = todas.get(i);
            assertThat(c.path("data").asString()).isEqualTo(dia.plusDays(i).toString());
            assertThat(c.path("hora").asString()).isEqualTo("09:00");
            assertThat(c.path("duracaoMinutos").asInt()).isEqualTo(45);
            assertThat(c.path("serieId").asString()).isEqualTo(primeira.path("serieId").asString());
            assertThat(c.path("ocorrenciaDaSerie").asInt()).isEqualTo(i + 1);
            assertThat(c.path("totalDaSerie").asInt()).isEqualTo(4);
            assertThat(c.path("participantes")).hasSize(1);
            assertThat(c.path("participantes").get(0).path("situacao").asString()).isEqualTo("AGENDADO");
        }
        // Uma operação, um evento de auditoria (resumo fixo).
        assertThat(auditorias("COMPROMISSO_CRIADO")).isEqualTo(1);
        // A lista traz a posição de cada ocorrência.
        JsonNode lista = api.get("/agenda/compromissos?de=" + dia + "&ate=" + dia.plusDays(3), admin, 200);
        assertThat(lista).hasSize(4);
        assertThat(lista.get(3).path("ocorrenciaDaSerie").asInt()).isEqualTo(4);
    }

    @Test
    void criaSeriePorNSemanalComVariosAlunosEOCompromissoAvulsoNaoTemSerie() throws Exception {
        UUID outro = api.criarAluno(admin, "Outro Aluno Fictício da Série");
        LocalDate dia = hoje().plusDays(20);
        JsonNode primeira = criarSerie(List.of(aluno, outro), dia, "14:30", 60, semanal(dia, 5), 200);
        List<JsonNode> todas = detalhes(ocorrencias(primeira));

        assertThat(todas).hasSize(5);
        for (int i = 0; i < 5; i++) {
            assertThat(todas.get(i).path("data").asString()).isEqualTo(dia.plusWeeks(i).toString());
            assertThat(todas.get(i).path("participantes")).hasSize(2);
        }
        assertThat(banco.queryForObject("select count(*) from compromisso_aluno where aluno_id = ?", Long.class, aluno)).isEqualTo(5);

        JsonNode avulso = marcarAvulso(dia.plusDays(1), "10:00", 30, aluno, 200);
        assertThat(avulso.path("serieId").isNull()).isTrue();
        assertThat(avulso.path("ocorrenciaDaSerie").isNull()).isTrue();
        assertThat(avulso.path("totalDaSerie").isNull()).isTrue();
        // Repetição "nunca" deixou de existir no pedido: o tipo é fechado.
        Map<String, Object> corpo = pedido(List.of(aluno), eu(), dia.plusDays(2), "11:00", 30);
        corpo.put("repeticao", Map.of("tipo", "NUNCA"));
        api.post("/agenda/compromissos", admin, corpo, 400);
    }

    @Test
    void fimObrigatorioELimiteDe52SemNadaGravado() throws Exception {
        LocalDate dia = hoje().plusDays(20);
        // Sem fim, com os dois fins, vezes fora de 2..52 e data final que passa de 52 ocorrências.
        criarSerie(List.of(aluno), dia, "09:00", 30, diaria(null, null), 400);
        criarSerie(List.of(aluno), dia, "09:00", 30, diaria(3, dia.plusDays(5)), 400);
        criarSerie(List.of(aluno), dia, "09:00", 30, diaria(1, null), 400);
        criarSerie(List.of(aluno), dia, "09:00", 30, diaria(53, null), 400);
        JsonNode grande = criarSerie(List.of(aluno), dia, "09:00", 30, diaria(null, dia.plusDays(52)), 400);
        assertThat(grande.path("codigo").asString()).isEqualTo("SERIE_GRANDE_DEMAIS");
        // Semanal sem o dia do compromisso, ou sem dias.
        Map<String, Object> semDia = new HashMap<>();
        semDia.put("tipo", "SEMANAL");
        semDia.put("diasDaSemana", List.of(dia.getDayOfWeek().plus(1).name()));
        semDia.put("vezes", 3);
        criarSerie(List.of(aluno), dia, "09:00", 30, semDia, 400);
        semDia.put("diasDaSemana", List.of("SEGUNDA"));
        criarSerie(List.of(aluno), dia, "09:00", 30, semDia, 400);
        assertThat(compromissosDaConsultoria()).isZero();

        // 52 é o máximo e vale: a primeira conta.
        JsonNode cheia = criarSerie(List.of(aluno), dia, "09:00", 30, diaria(52, null), 200);
        assertThat(cheia.path("totalDaSerie").asInt()).isEqualTo(52);
        assertThat(ocorrencias(cheia)).hasSize(52);
    }

    @Test
    void diasDaSemanaEmNumeroNaoViramOrdinalEmSilencio() throws Exception {
        // O ordinal 1 do enum seria TUESDAY: numa terça-feira o número passaria como "terça" se o Jackson o convertesse.
        LocalDate terca = hoje().plusDays(20);
        while (terca.getDayOfWeek() != java.time.DayOfWeek.TUESDAY) terca = terca.plusDays(1);
        Map<String, Object> repeticao = new HashMap<>();
        repeticao.put("tipo", "SEMANAL");
        repeticao.put("diasDaSemana", List.of(1));  // número, não nome
        repeticao.put("vezes", 3);
        criarSerie(List.of(aluno), terca, "09:00", 30, repeticao, 400);
        repeticao.put("diasDaSemana", List.of(2));
        criarSerie(List.of(aluno), terca, "09:00", 30, repeticao, 400);
        assertThat(compromissosDaConsultoria()).isZero();
    }

    @Test
    void conflitoEmUmaOcorrenciaRecusaTudoEDevolveAsDatas() throws Exception {
        LocalDate dia = hoje().plusDays(20);
        UUID outro = api.criarAluno(admin, "Aluno Fictício do Conflito");
        marcarAvulso(dia.plusDays(2), "09:15", 30, outro, 200);
        long antes = compromissosDaConsultoria();

        JsonNode erro = criarSerie(List.of(aluno), dia, "09:00", 60, diaria(5, null), 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        assertThat(datas(erro)).containsExactly(dia.plusDays(2).toString());
        assertThat(compromissosDaConsultoria()).isEqualTo(antes);
        assertThat(banco.queryForObject("select count(*) from compromisso_aluno where aluno_id = ?", Long.class, aluno)).isZero();
        assertThat(auditorias("COMPROMISSO_CRIADO")).isEqualTo(1);

        // Duas ocorrências em conflito: as duas datas, em ordem.
        marcarAvulso(dia.plusDays(4), "09:30", 30, outro, 200);
        JsonNode duas = criarSerie(List.of(aluno), dia, "09:00", 60, diaria(5, null), 409);
        assertThat(datas(duas)).containsExactly(dia.plusDays(2).toString(), dia.plusDays(4).toString());

        // Encostar não conflita (09:00 + 15 min termina às 09:15).
        JsonNode livre = criarSerie(List.of(aluno), dia, "09:00", 15, diaria(2, null), 200);
        assertThat(livre.path("totalDaSerie").asInt()).isEqualTo(2);
    }

    @Test
    void repeticaoNoPutEhRecusada() throws Exception {
        LocalDate dia = hoje().plusDays(20);
        JsonNode avulso = marcarAvulso(dia, "09:00", 30, aluno, 200);
        Map<String, Object> corpo = pedido(List.of(aluno), eu(), dia, "09:00", 30);
        corpo.put("repeticao", diaria(3, null));
        JsonNode erro = alterar(avulso.path("id").asString(), corpo, avulso.path("versao").asLong(), null, 400);
        assertThat(erro.path("codigo").asString()).isEqualTo("REPETICAO_SO_AO_CRIAR");
    }

    // ---- editar ----

    @Test
    void editarSoEstaMudaUmaOcorrenciaEAceitaMudarADataEAsOutrasSeguemIguais() throws Exception {
        LocalDate dia = hoje().plusDays(20);
        JsonNode primeira = criarSerie(List.of(aluno), dia, "09:00", 30, semanal(dia, 3), 200);
        List<String> ids = ocorrencias(primeira);

        Map<String, Object> corpo = pedido(List.of(aluno), eu(), dia.plusDays(1), "16:00", 50);
        JsonNode editada = alterar(ids.get(1), corpo, detalhe(ids.get(1)).path("versao").asLong(), null, 200);
        assertThat(editada.path("data").asString()).isEqualTo(dia.plusDays(1).toString());
        assertThat(editada.path("hora").asString()).isEqualTo("16:00");
        assertThat(editada.path("ocorrenciaDaSerie").asInt()).isEqualTo(2);
        for (String id : List.of(ids.get(0), ids.get(2))) {
            assertThat(hora(detalhe(id))).isEqualTo("09:00");
            assertThat(detalhe(id).path("duracaoMinutos").asInt()).isEqualTo(30);
        }
        assertThat(detalhe(ids.get(1)).path("serieId").asString()).isEqualTo(primeira.path("serieId").asString());
    }

    @Test
    void editarSeguintesETodasNuncaMudamAsPassadasENaoMudamADataOuAVersaoDasOutras() throws Exception {
        // Semanal começando 10 dias atrás: -10 e -3 já passaram; +4, +11 e +18 ainda não (nenhuma cai hoje).
        LocalDate inicio = hoje().minusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 5), 200);
        List<String> ids = ocorrencias(primeira);
        assertThat(ids).hasSize(5);
        long versaoDaQuarta = detalhe(ids.get(3)).path("versao").asLong();

        // SEGUINTES a partir da terceira (+4): muda a terceira, a quarta e a quinta; as passadas ficam.
        LocalDate terceira = inicio.plusWeeks(2);
        Map<String, Object> corpo = pedido(List.of(aluno), eu(), terceira, "15:00", 45);
        corpo.put("local", "Sala 9");
        JsonNode resposta = alterar(ids.get(2), corpo, detalhe(ids.get(2)).path("versao").asLong(), "SEGUINTES", 200);
        assertThat(resposta.path("id").asString()).isEqualTo(ids.get(2));
        assertThat(resposta.path("hora").asString()).isEqualTo("15:00");
        for (int i = 0; i < 5; i++) {
            JsonNode c = detalhe(ids.get(i));
            boolean mudou = i >= 2;
            assertThat(hora(c)).as("hora " + i).isEqualTo(mudou ? "15:00" : "09:00");
            assertThat(c.path("duracaoMinutos").asInt()).as("duração " + i).isEqualTo(mudou ? 45 : 30);
            assertThat(c.path("local").asString()).as("local " + i).isEqualTo(mudou ? "Sala 9" : "Sala 2");
            // Cada uma conserva o próprio dia.
            assertThat(c.path("data").asString()).isEqualTo(inicio.plusWeeks(i).toString());
        }
        // A versão das outras subiu sem o cliente tê-la mandado.
        assertThat(detalhe(ids.get(3)).path("versao").asLong()).isGreaterThan(versaoDaQuarta);
        assertThat(auditorias("COMPROMISSO_ALTERADO")).isEqualTo(1);

        // A data só muda em ESTA.
        Map<String, Object> outraData = pedido(List.of(aluno), eu(), terceira.plusDays(1), "15:00", 45);
        JsonNode recusa = alterar(ids.get(2), outraData, detalhe(ids.get(2)).path("versao").asLong(), "SEGUINTES", 400);
        assertThat(recusa.path("codigo").asString()).isEqualTo("DATA_SO_NESTA_OCORRENCIA");
        assertThat(alterar(ids.get(2), outraData, detalhe(ids.get(2)).path("versao").asLong(), "TODAS", 400)
                .path("codigo").asString()).isEqualTo("DATA_SO_NESTA_OCORRENCIA");

        // TODAS escolhendo uma passada: muda as três que ainda não começaram, nunca as passadas (nem a escolhida).
        Map<String, Object> todas = pedido(List.of(aluno), eu(), inicio, "17:00", 20);
        JsonNode daPassada = alterar(ids.get(0), todas, detalhe(ids.get(0)).path("versao").asLong(), "TODAS", 200);
        assertThat(daPassada.path("id").asString()).isEqualTo(ids.get(0));
        assertThat(daPassada.path("hora").asString()).isEqualTo("09:00");
        for (int i = 0; i < 5; i++) {
            assertThat(hora(detalhe(ids.get(i)))).as("hora " + i).isEqualTo(i >= 2 ? "17:00" : "09:00");
        }

        // Versão velha da escolhida: 409.
        JsonNode velha = alterar(ids.get(2), pedido(List.of(aluno), eu(), terceira, "10:00", 20), 0L, "SEGUINTES", 409);
        assertThat(velha.path("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
    }

    @Test
    void trocarOsAlunosDaSerieValeSoParaOEscopo() throws Exception {
        UUID outro = api.criarAluno(admin, "Segundo Aluno Fictício da Série");
        LocalDate inicio = hoje().minusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 4), 200);
        List<String> ids = ocorrencias(primeira);

        // Da terceira em diante a lista passa a ser só o outro aluno; as duas primeiras (uma passada, uma passada) ficam.
        Map<String, Object> corpo = pedido(List.of(outro), eu(), inicio.plusWeeks(2), "09:00", 30);
        alterar(ids.get(2), corpo, detalhe(ids.get(2)).path("versao").asLong(), "SEGUINTES", 200);
        for (int i = 0; i < 4; i++) {
            List<String> alunos = new ArrayList<>();
            detalhe(ids.get(i)).path("participantes").forEach(p -> alunos.add(p.path("id").asString()));
            assertThat(alunos).as("ocorrência " + i).containsExactly((i >= 2 ? outro : aluno).toString());
        }
        assertThat(banco.queryForObject("select count(*) from compromisso_aluno where aluno_id = ?", Long.class, aluno)).isEqualTo(2);
        assertThat(banco.queryForObject("select count(*) from compromisso_aluno where aluno_id = ?", Long.class, outro)).isEqualTo(2);
    }

    @Test
    void conflitoEmUmaOcorrenciaDoEscopoRecusaAEdicaoInteiraComAsDatas() throws Exception {
        LocalDate inicio = hoje().plusDays(10);
        UUID outro = api.criarAluno(admin, "Aluno Fictício do Outro Compromisso");
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 4), 200);
        List<String> ids = ocorrencias(primeira);
        marcarAvulso(inicio.plusWeeks(2), "17:10", 30, outro, 200);

        Map<String, Object> corpo = pedido(List.of(aluno), eu(), inicio.plusWeeks(1), "17:00", 30);
        JsonNode erro = alterar(ids.get(1), corpo, detalhe(ids.get(1)).path("versao").asLong(), "SEGUINTES", 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        assertThat(datas(erro)).containsExactly(inicio.plusWeeks(2).toString());
        // Nada mudou, nenhuma ocorrência.
        for (String id : ids) {
            assertThat(hora(detalhe(id))).isEqualTo("09:00");
        }
        assertThat(auditorias("COMPROMISSO_ALTERADO")).isZero();
    }

    @Test
    void ocorrenciasDaMesmaSerieNaoConflitamComAPosicaoAntigaUmaDaOutra() throws Exception {
        // Diária das 07:00 por 8 h; passar para 23:30 por 8 h sobrepõe o 07:00 ANTIGO do dia seguinte, que também vai mudar.
        LocalDate inicio = hoje().plusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "07:00", 480, diaria(3, null), 200);
        List<String> ids = ocorrencias(primeira);
        Map<String, Object> corpo = pedido(List.of(aluno), eu(), inicio, "23:30", 480);
        alterar(ids.getFirst(), corpo, detalhe(ids.getFirst()).path("versao").asLong(), "TODAS", 200);
        for (String id : ids) {
            assertThat(hora(detalhe(id))).isEqualTo("23:30");
        }
    }

    @Test
    void avulsoSoAceitaEstaESerieTodaNoPassadoNaoTemOQueAlterar() throws Exception {
        LocalDate dia = hoje().plusDays(10);
        JsonNode avulso = marcarAvulso(dia, "09:00", 30, aluno, 200);
        Map<String, Object> corpo = pedido(List.of(aluno), eu(), dia, "10:00", 30);
        assertThat(alterar(avulso.path("id").asString(), corpo, avulso.path("versao").asLong(), "TODAS", 400)
                .path("codigo").asString()).isEqualTo("COMPROMISSO_SEM_SERIE");
        assertThat(cancelar(avulso, true, "SEGUINTES", 400).path("codigo").asString()).isEqualTo("COMPROMISSO_SEM_SERIE");
        // ESTA explícito é o comportamento de sempre.
        assertThat(alterar(avulso.path("id").asString(), corpo, avulso.path("versao").asLong(), "ESTA", 200)
                .path("hora").asString()).isEqualTo("10:00");
        // Escopo desconhecido.
        alterar(avulso.path("id").asString(), corpo, 1L, "TUDO", 400);

        // Série inteira no passado: TODAS não tem o que alterar.
        LocalDate antiga = hoje().minusDays(40);
        JsonNode passada = criarSerie(List.of(aluno), antiga, "09:00", 30, semanal(antiga, 3), 200);
        List<String> ids = ocorrencias(passada);
        Map<String, Object> todas = pedido(List.of(aluno), eu(), antiga, "11:00", 30);
        JsonNode erro = alterar(ids.getFirst(), todas, detalhe(ids.getFirst()).path("versao").asLong(), "TODAS", 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("SERIE_SEM_OCORRENCIAS");
        assertThat(hora(detalhe(ids.getFirst()))).isEqualTo("09:00");
    }

    // ---- cancelar ----

    @Test
    void cancelarEscoposLiberaOHorarioSoDasOcorrenciasDoEscopoEReabrirConfereOConflito() throws Exception {
        LocalDate inicio = hoje().minusDays(10);
        UUID outro = api.criarAluno(admin, "Aluno Fictício do Horário Livre");
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 5), 200);
        List<String> ids = ocorrencias(primeira);

        // SEGUINTES a partir da terceira: cancela as três que ainda não terminaram; as passadas ficam agendadas.
        JsonNode cancelada = cancelar(detalhe(ids.get(2)), true, "SEGUINTES", 200);
        assertThat(cancelada.path("cancelado").asBoolean()).isTrue();
        for (int i = 0; i < 5; i++) {
            JsonNode c = detalhe(ids.get(i));
            assertThat(c.path("cancelado").asBoolean()).as("cancelado " + i).isEqualTo(i >= 2);
            assertThat(c.path("participantes").get(0).path("situacao").asString()).isEqualTo(i >= 2 ? "CANCELADO" : "AGENDADO");
        }
        assertThat(auditorias("COMPROMISSO_SITUACAO_ALTERADA")).isEqualTo(1);
        // Cancelar de novo no mesmo escopo não muda nada nem audita.
        cancelar(detalhe(ids.get(2)), true, "SEGUINTES", 200);
        assertThat(auditorias("COMPROMISSO_SITUACAO_ALTERADA")).isEqualTo(1);

        // O horário liberado pode ser ocupado por outro compromisso do mesmo responsável.
        marcarAvulso(inicio.plusWeeks(3), "09:10", 30, outro, 200);
        long antes = banco.queryForObject("select count(*) from compromisso where consultoria_id = ? and cancelado = false",
                Long.class, consultoria());
        JsonNode erro = cancelar(detalhe(ids.get(2)), false, "TODAS", 409);
        assertThat(erro.path("codigo").asString()).isEqualTo("HORARIO_OCUPADO");
        assertThat(datas(erro)).containsExactly(inicio.plusWeeks(3).toString());
        assertThat(banco.queryForObject("select count(*) from compromisso where consultoria_id = ? and cancelado = false",
                Long.class, consultoria())).isEqualTo(antes);

        // Cancelando o que atrapalha, reabrir TODAS volta as três ocorrências futuras (a passada nunca é tocada).
        String atrapalha = banco.queryForObject("select id::text from compromisso where consultoria_id = ? and serie_id is null",
                String.class, consultoria());
        cancelar(detalhe(atrapalha), true, null, 200);
        cancelar(detalhe(ids.get(0)), false, "TODAS", 200);
        for (int i = 0; i < 5; i++) {
            assertThat(detalhe(ids.get(i)).path("cancelado").asBoolean()).as("cancelado " + i).isFalse();
        }
    }

    @Test
    void cancelarTodasNaoTocaNasPassadasECancelarEstaDeixaAsOutras() throws Exception {
        LocalDate inicio = hoje().minusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 5), 200);
        List<String> ids = ocorrencias(primeira);

        cancelar(detalhe(ids.get(3)), true, null, 200);
        assertThat(detalhe(ids.get(3)).path("cancelado").asBoolean()).isTrue();
        assertThat(detalhe(ids.get(2)).path("cancelado").asBoolean()).isFalse();
        assertThat(detalhe(ids.get(4)).path("cancelado").asBoolean()).isFalse();

        // TODAS escolhendo a primeira (passada): cancela as ainda não começadas (3 e 5; a 4 já estava cancelada).
        cancelar(detalhe(ids.get(0)), true, "TODAS", 200);
        for (int i = 0; i < 5; i++) {
            assertThat(detalhe(ids.get(i)).path("cancelado").asBoolean()).as("cancelado " + i).isEqualTo(i >= 2);
        }
    }

    @Test
    void situacaoDoAlunoComEscopoEmSerieComVariosAlunos() throws Exception {
        UUID outro = api.criarAluno(admin, "Aluno Fictício que Fica");
        LocalDate inicio = hoje().plusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno, outro), inicio, "09:00", 30, semanal(inicio, 3), 200);
        List<String> ids = ocorrencias(primeira);
        String rota = "/agenda/compromissos/" + ids.get(0) + "/alunos/" + aluno + "/situacao";

        // Realizado e falta são sempre de uma ocorrência só.
        JsonNode so = api.post(rota + "?escopo=TODAS", admin, Map.of("situacao", "REALIZADO", "versao", detalhe(ids.get(0)).path("versao").asLong()), 400);
        assertThat(so.path("codigo").asString()).isEqualTo("SITUACAO_SO_NESTA_OCORRENCIA");

        // Cancelar só um aluno em todas as ocorrências: o outro continua, o compromisso não é cancelado.
        api.post(rota + "?escopo=TODAS", admin, Map.of("situacao", "CANCELADO", "versao", detalhe(ids.get(0)).path("versao").asLong()), 200);
        for (String id : ids) {
            JsonNode c = detalhe(id);
            assertThat(c.path("cancelado").asBoolean()).isFalse();
            for (JsonNode p : c.path("participantes")) {
                assertThat(p.path("situacao").asString())
                        .isEqualTo(p.path("id").asString().equals(aluno.toString()) ? "CANCELADO" : "AGENDADO");
            }
        }
        // Voltar a agendado só a partir da segunda: a primeira continua cancelada para ele.
        api.post("/agenda/compromissos/" + ids.get(1) + "/alunos/" + aluno + "/situacao?escopo=SEGUINTES", admin,
                Map.of("situacao", "AGENDADO", "versao", detalhe(ids.get(1)).path("versao").asLong()), 200);
        List<String> situacoes = new ArrayList<>();
        for (String id : ids) {
            for (JsonNode p : detalhe(id).path("participantes")) {
                if (p.path("id").asString().equals(aluno.toString())) situacoes.add(p.path("situacao").asString());
            }
        }
        assertThat(situacoes).containsExactly("CANCELADO", "AGENDADO", "AGENDADO");

        // Aluno que não está na ocorrência escolhida: 404.
        api.post("/agenda/compromissos/" + ids.get(0) + "/alunos/" + UUID.randomUUID() + "/situacao?escopo=TODAS", admin,
                Map.of("situacao", "CANCELADO", "versao", detalhe(ids.get(0)).path("versao").asLong()), 404);
    }

    // ---- isolamento ----

    @Test
    void outraConsultoriaNaoVeNemAlteraNemCancelaASerie() throws Exception {
        LocalDate inicio = hoje().plusDays(10);
        JsonNode primeira = criarSerie(List.of(aluno), inicio, "09:00", 30, semanal(inicio, 3), 200);
        List<String> ids = ocorrencias(primeira);
        JsonNode estranho = api.novoTreinador();
        String id = ids.get(1);

        api.get("/agenda/compromissos/" + id, estranho, 404);
        for (String escopo : List.of("ESTA", "SEGUINTES", "TODAS")) {
            Map<String, Object> corpo = pedido(List.of(aluno), estranho.path("usuario").path("id").asString(), inicio.plusWeeks(1), "10:00", 30);
            corpo.put("versao", 0L);
            api.put("/agenda/compromissos/" + id + "?escopo=" + escopo, estranho, corpo, 404);
            api.post("/agenda/compromissos/" + id + "/situacao?escopo=" + escopo, estranho, Map.of("cancelado", true, "versao", 0), 404);
            api.post("/agenda/compromissos/" + id + "/alunos/" + aluno + "/situacao?escopo=" + escopo, estranho,
                    Map.of("situacao", "CANCELADO", "versao", 0), 404);
        }
        for (String o : ids) {
            assertThat(hora(detalhe(o))).isEqualTo("09:00");
            assertThat(detalhe(o).path("cancelado").asBoolean()).isFalse();
        }
        // Os dias da série existem em outra consultoria sem se misturar.
        assertThat(api.get("/agenda/compromissos?de=" + inicio + "&ate=" + inicio.plusWeeks(3), estranho, 200)).isEmpty();
    }
}
