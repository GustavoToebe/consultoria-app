package br.com.treinos.api.agenda;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Eventos que se repetem (passo 10 do plano do calendário): a regra expandida na leitura (inclusive "nunca termina"), as
 * exceções de uma ocorrência (editar, mover para dentro e para fora da janela, cancelar) e os escopos ESTA, SEGUINTES e
 * TODAS ao editar e excluir, com a divisão da contagem de "vezes". Datas fixas do futuro; uma consultoria por teste.
 */
@AutoConfigureMockMvc
class EventoSerieIntegrationTest extends AbstractIntegrationTest {

    /** Uma segunda-feira: 03/03/2031 (01/03/2031 é sábado). */
    private static final LocalDate SEGUNDA = LocalDate.of(2031, 3, 3);

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;
    private String agendaId;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        agendaId = api.post("/agenda/agendas", admin, Map.of("nome", "Pessoal", "cor", "AZUL"), 200).path("id").asString();
    }

    // ---- auxiliares ----

    private Map<String, Object> corpo(String titulo, LocalDate data, Map<String, Object> repeticao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("agendaId", agendaId);
        corpo.put("titulo", titulo);
        corpo.put("data", data.toString());
        corpo.put("diaInteiro", false);
        corpo.put("hora", "10:00");
        corpo.put("duracaoMinutos", 60);
        corpo.put("repeticao", repeticao);
        return corpo;
    }

    private static Map<String, Object> semanal(DayOfWeek dia) {
        return Map.of("tipo", "SEMANAL", "diasDaSemana", List.of(dia.name()));
    }

    private static Map<String, Object> diaria(Integer vezes) {
        Map<String, Object> repeticao = new HashMap<>();
        repeticao.put("tipo", "DIARIA");
        if (vezes != null) repeticao.put("vezes", vezes);
        return repeticao;
    }

    private JsonNode criar(String titulo, LocalDate data, Map<String, Object> repeticao) throws Exception {
        return api.post("/agenda/eventos", admin, corpo(titulo, data, repeticao), 200);
    }

    private JsonNode detalhe(String id) throws Exception {
        return api.get("/agenda/eventos/" + id, admin, 200);
    }

    private long versao(String id) throws Exception {
        return detalhe(id).path("versao").asLong();
    }

    private JsonNode alterar(String id, Map<String, Object> corpo, String escopo, LocalDate ocorrencia, int status)
            throws Exception {
        corpo.put("versao", versao(id));
        return api.put("/agenda/eventos/" + id + "?escopo=" + escopo
                + (ocorrencia == null ? "" : "&ocorrencia=" + ocorrencia), admin, corpo, status);
    }

    private void excluir(String id, String escopo, LocalDate ocorrencia, int status) throws Exception {
        api.delete("/agenda/eventos/" + id + "?versao=" + versao(id) + "&escopo=" + escopo
                + (ocorrencia == null ? "" : "&ocorrencia=" + ocorrencia), admin, status);
    }

    private JsonNode listar(LocalDate de, LocalDate ate) throws Exception {
        return api.get("/agenda/eventos?de=" + de + "&ate=" + ate, admin, 200);
    }

    /** "dia titulo hora" de cada ocorrência, na ordem da listagem. */
    private static List<String> resumo(JsonNode ocorrencias) {
        List<String> linhas = new ArrayList<>();
        ocorrencias.forEach(o -> linhas.add(o.path("data").asString() + " " + o.path("titulo").asString() + " "
                + o.path("hora").asString()));
        return linhas;
    }

    private static List<String> idsDistintos(JsonNode ocorrencias) {
        return ocorrencias.valueStream().map(o -> o.path("eventoId").asString()).distinct().toList();
    }

    private String codigo(JsonNode erro) {
        return erro.path("codigo").asString();
    }

    private long excecoes(String eventoId) {
        Long total = banco.queryForObject("select count(*) from evento_agenda_excecao where evento_id = ?::uuid", Long.class,
                eventoId);
        return total == null ? 0 : total;
    }

    // ---- a regra expandida ----

    @Test
    void referenciaDoCalendario() {
        assertThat(SEGUNDA.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
    }

    @Test
    void nuncaTerminaEExpandeNaLeituraEmQualquerJanela() throws Exception {
        JsonNode serie = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY));
        assertThat(serie.path("repeticao").path("tipo").asString()).isEqualTo("SEMANAL");
        assertThat(serie.path("repeticao").path("diasDaSemana")).extracting(JsonNode::asString).containsExactly("MONDAY");
        assertThat(serie.path("repeticao").path("ate").isEmpty()).isTrue();
        assertThat(serie.path("repeticao").path("vezes").isEmpty()).isTrue();

        JsonNode marco = listar(LocalDate.of(2031, 3, 1), LocalDate.of(2031, 3, 31));
        assertThat(resumo(marco)).containsExactly("2031-03-03 Reunião 10:00", "2031-03-10 Reunião 10:00",
                "2031-03-17 Reunião 10:00", "2031-03-24 Reunião 10:00", "2031-03-31 Reunião 10:00");
        assertThat(marco.get(0).path("recorrente").asBoolean()).isTrue();
        assertThat(idsDistintos(marco)).containsExactly(serie.path("id").asString());
        // sessenta anos depois, sem nenhuma linha gravada a mais
        JsonNode longe = listar(LocalDate.of(2090, 3, 1), LocalDate.of(2090, 3, 31));
        assertThat(longe).isNotEmpty().allSatisfy(o -> assertThat(LocalDate.parse(o.path("data").asString()).getDayOfWeek())
                .isEqualTo(DayOfWeek.MONDAY));
        assertThat(banco.queryForObject("select count(*) from evento_agenda where id = ?::uuid", Long.class,
                serie.path("id").asString())).isOne();
        // antes do início não há nada
        assertThat(listar(LocalDate.of(2031, 2, 1), LocalDate.of(2031, 3, 2))).isEmpty();
    }

    @Test
    void comecaNoPrimeiroDiaQueCasaComARegraEMensalPulaMesCurto() throws Exception {
        // 04/03/2031 é terça: a série de segundas começa em 10/03
        JsonNode semanal = criar("Segundas", SEGUNDA.plusDays(1), semanal(DayOfWeek.MONDAY));
        assertThat(semanal.path("data").asString()).isEqualTo("2031-03-10");
        JsonNode mensal = criar("Dia 31", LocalDate.of(2031, 1, 31), Map.of("tipo", "MENSAL"));
        assertThat(mensal.path("data").asString()).isEqualTo("2031-01-31");
        assertThat(resumo(listar(LocalDate.of(2031, 2, 1), LocalDate.of(2031, 3, 31)))).contains("2031-03-31 Dia 31 10:00")
                .noneMatch(l -> l.startsWith("2031-02") && l.contains("Dia 31"));
    }

    @Test
    void fimPorDataEPorVezesELimitesDaRegra() throws Exception {
        Map<String, Object> ate = diaria(null);
        ate.put("ate", "2031-03-05");
        criar("Até 05/03", SEGUNDA, ate);
        criar("Três vezes", SEGUNDA, diaria(3));
        JsonNode lista = listar(SEGUNDA, SEGUNDA.plusDays(10));
        assertThat(resumo(lista)).containsExactlyInAnyOrder("2031-03-03 Até 05/03 10:00", "2031-03-04 Até 05/03 10:00",
                "2031-03-05 Até 05/03 10:00", "2031-03-03 Três vezes 10:00", "2031-03-04 Três vezes 10:00",
                "2031-03-05 Três vezes 10:00");

        Map<String, Object> os2 = diaria(2);
        os2.put("ate", "2031-03-09");
        for (Map<String, Object> invalida : List.of(diaria(1), diaria(1000), os2, Map.<String, Object>of("tipo", "SEMANAL"),
                Map.<String, Object>of("tipo", "SEMANAL", "diasDaSemana", List.of("FOO")),
                Map.<String, Object>of("tipo", "MENSAL", "diasDaSemana", List.of("MONDAY")),
                Map.<String, Object>of("tipo", "NENHUMA", "vezes", 3),
                Map.<String, Object>of("tipo", "DIARIA", "ate", "2031-03-02"))) {
            assertThat(codigo(api.post("/agenda/eventos", admin, corpo("Inválida", SEGUNDA, invalida), 400)))
                    .isEqualTo("REPETICAO_INVALIDA");
        }
        api.post("/agenda/eventos", admin, corpo("Sem tipo", SEGUNDA, Map.of("vezes", 3)), 400);
        // "NENHUMA" explícito é evento avulso
        JsonNode avulso = criar("Avulso", SEGUNDA, Map.of("tipo", "NENHUMA"));
        assertThat(avulso.path("repeticao").isEmpty()).isTrue();
    }

    // ---- escopo ESTA ----

    @Test
    void estaGravaUmaExcecaoEditaMoveParaDentroEForaDaJanelaECancela() throws Exception {
        JsonNode serie = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY));
        String id = serie.path("id").asString();
        LocalDate dia10 = SEGUNDA.plusDays(7);
        LocalDate dia17 = SEGUNDA.plusDays(14);
        LocalDate dia24 = SEGUNDA.plusDays(21);
        LocalDate dia31 = SEGUNDA.plusDays(28);

        // editar só o título do dia 10
        JsonNode editado = alterar(id, corpo("Reunião especial", dia10, null), "ESTA", dia10, 200);
        assertThat(editado.path("ocorrencia").path("titulo").asString()).isEqualTo("Reunião especial");
        assertThat(editado.path("titulo").asString()).isEqualTo("Reunião");
        assertThat(editado.path("versao").asLong()).isEqualTo(1);
        assertThat(resumo(listar(SEGUNDA, dia31))).containsExactly("2031-03-03 Reunião 10:00",
                "2031-03-10 Reunião especial 10:00", "2031-03-17 Reunião 10:00", "2031-03-24 Reunião 10:00",
                "2031-03-31 Reunião 10:00");

        // mover o dia 17 para terça às 15:00: sai do dia 17, entra no 18 (a original fica fora da janela pedida)
        Map<String, Object> movido = corpo("Reunião", dia17.plusDays(1), null);
        movido.put("hora", "15:00");
        alterar(id, movido, "ESTA", dia17, 200);
        assertThat(listar(dia17, dia17)).isEmpty();
        JsonNode terca = listar(dia17.plusDays(1), dia17.plusDays(1));
        assertThat(resumo(terca)).containsExactly("2031-03-18 Reunião 15:00");
        assertThat(terca.get(0).path("dataOriginal").asString()).isEqualTo(dia17.toString());

        // mover o dia 24 para abril: sai de março
        alterar(id, corpo("Reunião", LocalDate.of(2031, 4, 20), null), "ESTA", dia24, 200);
        assertThat(resumo(listar(dia24, dia31))).containsExactly("2031-03-31 Reunião 10:00");
        assertThat(resumo(listar(LocalDate.of(2031, 4, 20), LocalDate.of(2031, 4, 20)))).contains("2031-04-20 Reunião 10:00");

        // cancelar o dia 31: a ocorrência some da lista e do detalhe, a série continua
        excluir(id, "ESTA", dia31, 204);
        api.get("/agenda/eventos/" + id + "?ocorrencia=" + dia31, admin, 404);
        assertThat(resumo(listar(dia31, dia31.plusDays(7)))).containsExactly("2031-04-07 Reunião 10:00");
        assertThat(excecoes(id)).isEqualTo(4);
        assertThat(detalhe(id).path("ocorrencia").path("data").asString()).isEqualTo(SEGUNDA.toString());

        // uma exceção sem diferença nenhuma deixa de existir
        alterar(id, corpo("Reunião", dia10, null), "ESTA", dia10, 200);
        assertThat(excecoes(id)).isEqualTo(3);
        assertThat(resumo(listar(dia10, dia10))).containsExactly("2031-03-10 Reunião 10:00");
    }

    @Test
    void estaExigeUmaOcorrenciaDaRegraEUmaVersaoAtual() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        String outraAgenda = api.post("/agenda/agendas", admin, Map.of("nome", "Outra", "cor", "OLIVA"), 200).path("id").asString();
        LocalDate dia10 = SEGUNDA.plusDays(7);

        assertThat(codigo(alterar(id, corpo("Reunião", dia10, null), "ESTA", null, 400))).isEqualTo("OCORRENCIA_OBRIGATORIA");
        alterar(id, corpo("Reunião", dia10, null), "ESTA", dia10.plusDays(1), 404);
        Map<String, Object> naOutraAgenda = corpo("Reunião", dia10, null);
        naOutraAgenda.put("agendaId", outraAgenda);
        assertThat(codigo(alterar(id, naOutraAgenda, "ESTA", dia10, 400))).isEqualTo("AGENDA_SO_NA_SERIE_TODA");
        // a regra do pedido é ignorada em ESTA
        JsonNode comRegra = alterar(id, corpo("Só esta", dia10, diaria(3)), "ESTA", dia10, 200);
        assertThat(comRegra.path("repeticao").path("tipo").asString()).isEqualTo("SEMANAL");
        // versão velha
        Map<String, Object> velho = corpo("Velho", dia10, null);
        velho.put("versao", 0);
        assertThat(codigo(api.put("/agenda/eventos/" + id + "?escopo=ESTA&ocorrencia=" + dia10, admin, velho, 409)))
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(codigo(api.delete("/agenda/eventos/" + id + "?versao=0&escopo=ESTA&ocorrencia=" + dia10, admin, 409)))
                .isEqualTo("CONFLITO_EDICAO");
        // ESTA sem ocorrência na exclusão
        excluir(id, "ESTA", null, 400);
        // cancelada uma vez, não dá para cancelar nem editar de novo
        excluir(id, "ESTA", dia10, 204);
        excluir(id, "ESTA", dia10, 404);
        alterar(id, corpo("Reunião", dia10, null), "ESTA", dia10, 404);
    }

    // ---- escopo TODAS ----

    @Test
    void todasTrocaARegraMantemOPrimeiroDiaEApagaAsExcecoesOrfas() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        LocalDate dia10 = SEGUNDA.plusDays(7);
        LocalDate dia17 = SEGUNDA.plusDays(14);
        excluir(id, "ESTA", dia10, 204);
        alterar(id, corpo("Especial", dia17, null), "ESTA", dia17, 200);
        assertThat(excecoes(id)).isEqualTo(2);

        // a data do pedido tem de ser a da ocorrência escolhida
        assertThat(codigo(alterar(id, corpo("Nova", dia17.plusDays(1), semanal(DayOfWeek.MONDAY)), "TODAS", dia17, 400)))
                .isEqualTo("DATA_SO_NESTA_OCORRENCIA");

        // passa para terças: o primeiro dia vira a primeira terça a partir de 03/03; as exceções de segunda saem
        JsonNode nova = alterar(id, corpo("Terças", dia17, semanal(DayOfWeek.TUESDAY)), "TODAS", dia17, 200);
        assertThat(nova.path("id").asString()).isEqualTo(id);
        assertThat(nova.path("data").asString()).isEqualTo("2031-03-04");
        assertThat(excecoes(id)).isZero();
        assertThat(resumo(listar(LocalDate.of(2031, 3, 1), LocalDate.of(2031, 3, 31)))).containsExactly("2031-03-04 Terças 10:00",
                "2031-03-11 Terças 10:00", "2031-03-18 Terças 10:00", "2031-03-25 Terças 10:00");
        // sem ocorrência, a data é a do início da série
        alterar(id, corpo("Terças de novo", LocalDate.of(2031, 3, 4), semanal(DayOfWeek.TUESDAY)), "TODAS", null, 200);
        assertThat(detalhe(id).path("titulo").asString()).isEqualTo("Terças de novo");
        // e a regra pode virar "não repete": evento avulso no primeiro dia
        JsonNode avulso = alterar(id, corpo("Avulso", LocalDate.of(2031, 3, 4), null), "TODAS", null, 200);
        assertThat(avulso.path("repeticao").isEmpty()).isTrue();
        assertThat(resumo(listar(LocalDate.of(2031, 3, 1), LocalDate.of(2031, 3, 31)))).containsExactly("2031-03-04 Avulso 10:00");
    }

    @Test
    void excluirTodasApagaASerieEAsExcecoes() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        excluir(id, "ESTA", SEGUNDA.plusDays(7), 204);
        excluir(id, "TODAS", null, 204);
        api.get("/agenda/eventos/" + id, admin, 404);
        assertThat(excecoes(id)).isZero();
        assertThat(listar(SEGUNDA, SEGUNDA.plusDays(30))).isEmpty();
    }

    // ---- escopo SEGUINTES ----

    @Test
    void seguintesCortaASerieAntigaECriaOutraDaOcorrenciaEmDiante() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        LocalDate dia17 = SEGUNDA.plusDays(14);

        // a data tem de ser a da ocorrência
        assertThat(codigo(alterar(id, corpo("Nova", dia17.plusDays(1), semanal(DayOfWeek.MONDAY)), "SEGUINTES", dia17, 400)))
                .isEqualTo("DATA_SO_NESTA_OCORRENCIA");
        assertThat(codigo(alterar(id, corpo("Nova", dia17, semanal(DayOfWeek.MONDAY)), "SEGUINTES", null, 400)))
                .isEqualTo("OCORRENCIA_OBRIGATORIA");

        JsonNode nova = alterar(id, corpo("Reunião nova", dia17, semanal(DayOfWeek.MONDAY)), "SEGUINTES", dia17, 200);
        String novoId = nova.path("id").asString();
        assertThat(novoId).isNotEqualTo(id);
        assertThat(nova.path("data").asString()).isEqualTo(dia17.toString());
        assertThat(nova.path("repeticao").path("ate").isEmpty()).isTrue();
        JsonNode antiga = detalhe(id);
        assertThat(antiga.path("repeticao").path("ate").asString()).isEqualTo(dia17.minusDays(1).toString());
        assertThat(antiga.path("repeticao").path("vezes").isEmpty()).isTrue();

        JsonNode marco = listar(SEGUNDA, LocalDate.of(2031, 3, 31));
        assertThat(resumo(marco)).containsExactly("2031-03-03 Reunião 10:00", "2031-03-10 Reunião 10:00",
                "2031-03-17 Reunião nova 10:00", "2031-03-24 Reunião nova 10:00", "2031-03-31 Reunião nova 10:00");
        assertThat(idsDistintos(marco)).containsExactly(id, novoId);
        // a série nova continua sem fim
        assertThat(listar(LocalDate.of(2090, 3, 1), LocalDate.of(2090, 3, 31))).isNotEmpty();

        // na primeira ocorrência, SEGUINTES é o mesmo que TODAS: continua o mesmo evento
        JsonNode primeira = alterar(id, corpo("Tudo", SEGUNDA, semanal(DayOfWeek.MONDAY)), "SEGUINTES", SEGUNDA, 200);
        assertThat(primeira.path("id").asString()).isEqualTo(id);
        assertThat(detalhe(id).path("titulo").asString()).isEqualTo("Tudo");
    }

    @Test
    void excluirSeguintesTerminaASerieNoDiaAnterior() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        LocalDate dia17 = SEGUNDA.plusDays(14);
        excluir(id, "ESTA", dia17.plusDays(7), 204);
        excluir(id, "SEGUINTES", dia17, 204);
        assertThat(detalhe(id).path("repeticao").path("ate").asString()).isEqualTo(dia17.minusDays(1).toString());
        assertThat(resumo(listar(SEGUNDA, LocalDate.of(2031, 3, 31)))).containsExactly("2031-03-03 Reunião 10:00",
                "2031-03-10 Reunião 10:00");
        assertThat(excecoes(id)).isZero();
        // na primeira ocorrência, apaga tudo
        excluir(id, "SEGUINTES", SEGUNDA, 204);
        api.get("/agenda/eventos/" + id, admin, 404);
    }

    @Test
    void ocorrenciaCanceladaDepoisDoCorteNaoVoltaNaSerieNova() throws Exception {
        LocalDate dia = LocalDate.of(2031, 5, 1);
        String id = criar("Diário", dia, diaria(null)).path("id").asString();
        excluir(id, "ESTA", dia.plusDays(4), 204);
        alterar(id, corpo("Diário novo", dia.plusDays(3), diaria(null)), "SEGUINTES", dia.plusDays(3), 200);
        JsonNode semana = listar(dia, dia.plusDays(6));
        assertThat(resumo(semana)).containsExactly("2031-05-01 Diário 10:00", "2031-05-02 Diário 10:00",
                "2031-05-03 Diário 10:00", "2031-05-04 Diário novo 10:00", "2031-05-06 Diário novo 10:00",
                "2031-05-07 Diário novo 10:00");
        assertThat(idsDistintos(semana)).hasSize(2);
    }

    @Test
    void seguintesDivideAContagemDeVezesParaOTotalNaoCrescer() throws Exception {
        LocalDate dia = LocalDate.of(2031, 6, 1);
        String id = criar("Cinco dias", dia, diaria(5)).path("id").asString();
        JsonNode nova = alterar(id, corpo("Cinco dias (novo)", dia.plusDays(2), diaria(5)), "SEGUINTES", dia.plusDays(2), 200);
        // 2 ficaram na série antiga; a nova leva as 3 que sobraram
        assertThat(nova.path("repeticao").path("vezes").asInt()).isEqualTo(3);
        assertThat(detalhe(id).path("repeticao").path("ate").asString()).isEqualTo(dia.plusDays(1).toString());
        assertThat(resumo(listar(dia, dia.plusDays(15)))).hasSize(5);

        // sobrando só uma, a série nova vira um evento avulso
        String outro = criar("Outro", dia, diaria(5)).path("id").asString();
        JsonNode avulsa = alterar(outro, corpo("Outro (novo)", dia.plusDays(4), diaria(5)), "SEGUINTES", dia.plusDays(4), 200);
        assertThat(avulsa.path("repeticao").isEmpty()).isTrue();
        assertThat(avulsa.path("data").asString()).isEqualTo(dia.plusDays(4).toString());
        assertThat(resumo(listar(dia, dia.plusDays(15))).stream().filter(l -> l.contains("Outro"))).hasSize(5);

        // com uma regra diferente, o pedido vale como veio
        String terceiro = criar("Terceiro", dia, diaria(5)).path("id").asString();
        JsonNode outraRegra = alterar(terceiro, corpo("Terceiro (novo)", dia.plusDays(2), diaria(10)), "SEGUINTES",
                dia.plusDays(2), 200);
        assertThat(outraRegra.path("repeticao").path("vezes").asInt()).isEqualTo(10);
    }

    @Test
    void movidaParaDentroDaJanelaEntraMesmoQueAOriginalEstejaFora() throws Exception {
        String id = criar("Reunião", SEGUNDA, semanal(DayOfWeek.MONDAY)).path("id").asString();
        LocalDate dia31 = SEGUNDA.plusDays(28);
        // 31/03 vai para 02/03 (antes da primeira ocorrência): aparece lá, e a janela de março inteira não a repete
        alterar(id, corpo("Reunião", dia31.minusDays(29), null), "ESTA", dia31, 200);
        JsonNode antes = listar(dia31.minusDays(29), dia31.minusDays(29));
        assertThat(resumo(antes)).containsExactly("2031-03-02 Reunião 10:00");
        assertThat(antes.get(0).path("dataOriginal").asString()).isEqualTo(dia31.toString());
        assertThat(resumo(listar(SEGUNDA.minusDays(2), dia31))).hasSize(5);
        assertThat(resumo(listar(SEGUNDA.minusDays(2), dia31)).get(0)).startsWith("2031-03-02");
    }
}
