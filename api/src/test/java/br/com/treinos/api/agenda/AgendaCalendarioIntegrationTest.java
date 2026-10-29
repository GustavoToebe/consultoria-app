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

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Agendas pessoais e eventos sem aluno (passo 10 do plano do calendário): CRUD das agendas com limite, nome único e paleta,
 * o dono (outro membro e outra consultoria = 404), as permissões, o evento avulso (hora, dia inteiro, meia-noite, janela
 * de 62 dias, versão), a sobreposição que só avisa (P5), apagar a agenda com a contagem (P4), o resumo do Ano, a auditoria de
 * resumo fixo e a privacidade (o evento não entra na exportação nem na anonimização do aluno). As séries ficam em
 * {@link EventoSerieIntegrationTest}. Cada teste cria a própria consultoria e usa só dados fictícios, em datas fixas do
 * futuro para não depender do relógio.
 */
@AutoConfigureMockMvc
class AgendaCalendarioIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate DIA = LocalDate.of(2031, 3, 10);

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate banco;

    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- auxiliares ----

    private static String id(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    private UUID consultoria() {
        return banco.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class, id(admin));
    }

    private JsonNode membroComPerfil(String perfilId) throws Exception {
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Membro fictício",
                "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfilId), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    /** Outro membro com o mesmo perfil do administrador. */
    private JsonNode outroMembro() throws Exception {
        return membroComPerfil(api.get("/eu", admin, 200).path("perfil").path("id").asString());
    }

    private JsonNode membroSoCom(Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(), "permissoes", permissoes), 200)
                .path("id").asString();
        return membroComPerfil(perfil);
    }

    private JsonNode agenda(JsonNode quem, String nome, int status) throws Exception {
        return api.post("/agenda/agendas", quem, Map.of("nome", nome, "cor", "AZUL"), status);
    }

    private JsonNode agenda(String nome) throws Exception {
        return agenda(admin, nome, 200);
    }

    private static Map<String, Object> corpo(String agendaId, String titulo, LocalDate data, String hora, Integer duracao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("agendaId", agendaId);
        corpo.put("titulo", titulo);
        corpo.put("data", data.toString());
        corpo.put("diaInteiro", hora == null);
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        return corpo;
    }

    private JsonNode evento(JsonNode quem, String agendaId, String titulo, LocalDate data, String hora, Integer duracao,
                            int status) throws Exception {
        return api.post("/agenda/eventos", quem, corpo(agendaId, titulo, data, hora, duracao), status);
    }

    private JsonNode evento(String agendaId, String titulo, LocalDate data, String hora, Integer duracao) throws Exception {
        return evento(admin, agendaId, titulo, data, hora, duracao, 200);
    }

    private JsonNode eventos(JsonNode quem, LocalDate de, LocalDate ate) throws Exception {
        return api.get("/agenda/eventos?de=" + de + "&ate=" + ate, quem, 200);
    }

    private static List<String> titulos(JsonNode ocorrencias) {
        List<String> titulos = new ArrayList<>();
        ocorrencias.forEach(o -> titulos.add(o.path("titulo").asString()));
        return titulos;
    }

    private String codigo(JsonNode erro) {
        return erro.path("codigo").asString();
    }

    private long contar(String sql, Object... args) {
        Long total = banco.queryForObject(sql, Long.class, args);
        return total == null ? 0 : total;
    }

    // ---- agendas ----

    @Test
    void agendasCriamAlteramListamEValidam() throws Exception {
        JsonNode pessoal = api.post("/agenda/agendas", admin, Map.of("nome", "  Pessoal  ", "cor", "turquesa"), 200);
        assertThat(pessoal.path("nome").asString()).isEqualTo("Pessoal");
        assertThat(pessoal.path("cor").asString()).isEqualTo("TURQUESA");
        assertThat(pessoal.path("versao").asLong()).isZero();
        JsonNode aulas = agenda("aulas");
        assertThat(api.get("/agenda/agendas", admin, 200)).extracting(a -> a.path("nome").asString())
                .containsExactly("aulas", "Pessoal");

        // nome repetido (sem diferença de caixa), cor fora da paleta e nome em branco
        assertThat(codigo(agenda(admin, "PESSOAL", 409))).isEqualTo("AGENDA_NOME_EM_USO");
        assertThat(codigo(api.post("/agenda/agendas", admin, Map.of("nome", "Outra", "cor", "VERDE"), 400)))
                .isEqualTo("COR_INVALIDA");
        agenda(admin, "   ", 400);
        agenda(admin, "x".repeat(41), 400);

        // renomear: versão obrigatória, nome de outra agenda recusado, o próprio nome em outra caixa aceito
        long versao = pessoal.path("versao").asLong();
        String caminho = "/agenda/agendas/" + pessoal.path("id").asString();
        assertThat(codigo(api.put(caminho, admin, Map.of("nome", "Pessoal", "cor", "OLIVA", "versao", versao + 5), 409)))
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(codigo(api.put(caminho, admin, Map.of("nome", "Aulas", "cor", "OLIVA", "versao", versao), 409)))
                .isEqualTo("AGENDA_NOME_EM_USO");
        JsonNode renomeada = api.put(caminho, admin, Map.of("nome", "PESSOAL", "cor", "OLIVA", "versao", versao), 200);
        assertThat(renomeada.path("nome").asString()).isEqualTo("PESSOAL");
        assertThat(renomeada.path("cor").asString()).isEqualTo("OLIVA");
        assertThat(renomeada.path("versao").asLong()).isEqualTo(versao + 1);
        assertThat(aulas.path("id").asString()).isNotEqualTo(renomeada.path("id").asString());
    }

    @Test
    void cadaMembroTemNoMaximoVinteAgendas() throws Exception {
        for (int i = 1; i <= 20; i++) {
            agenda("Agenda %02d".formatted(i));
        }
        assertThat(codigo(agenda(admin, "Agenda 21", 409))).isEqualTo("LIMITE_DE_AGENDAS");
        assertThat(api.get("/agenda/agendas", admin, 200)).hasSize(20);
        // o limite é por membro
        JsonNode outro = outroMembro();
        agenda(outro, "Agenda 01", 200);
    }

    @Test
    void apagarAConfirmaComAContagemEApagaOsEventosEAsExcecoes() throws Exception {
        JsonNode agenda = agenda("Para apagar");
        JsonNode outraAgenda = agenda("Para ficar");
        String id = agenda.path("id").asString();
        evento(id, "Avulso", DIA, "10:00", 60);
        Map<String, Object> pedidoSerie = corpo(id, "Série", DIA, "11:00", 60);
        pedidoSerie.put("repeticao", Map.of("tipo", "DIARIA", "vezes", 3));
        JsonNode serie = api.post("/agenda/eventos", admin, pedidoSerie, 200);
        evento(outraAgenda.path("id").asString(), "Fica", DIA, "12:00", 60);
        // uma exceção na série, para conferir que ela sai junto
        JsonNode comRegra = serie;
        Map<String, Object> soEsta = corpo(id, "Só esta", DIA.plusDays(1), "11:00", 60);
        api.put("/agenda/eventos/" + serie.path("id").asString() + "?escopo=ESTA&ocorrencia=" + DIA.plusDays(1), admin,
                withVersao(soEsta, comRegra.path("versao").asLong()), 200);
        assertThat(contar("select count(*) from evento_agenda_excecao where evento_id = ?::uuid", serie.path("id").asString()))
                .isEqualTo(1);

        assertThat(api.get("/agenda/agendas/" + id + "/contagem", admin, 200).path("eventos").asLong()).isEqualTo(2);
        assertThat(codigo(api.delete("/agenda/agendas/" + id + "?versao=" + (agenda.path("versao").asLong() + 3), admin, 409)))
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(contar("select count(*) from evento_agenda where agenda_id = ?::uuid", id)).isEqualTo(2);

        api.delete("/agenda/agendas/" + id + "?versao=" + agenda.path("versao").asLong(), admin, 204);
        assertThat(contar("select count(*) from agenda_pessoal where id = ?::uuid", id)).isZero();
        assertThat(contar("select count(*) from evento_agenda where agenda_id = ?::uuid", id)).isZero();
        assertThat(contar("select count(*) from evento_agenda_excecao where evento_id = ?::uuid", serie.path("id").asString()))
                .isZero();
        api.get("/agenda/agendas/" + id + "/contagem", admin, 404);
        assertThat(titulos(eventos(admin, DIA, DIA.plusDays(5)))).containsExactly("Fica");
        assertThat(contar("select count(*) from auditoria where consultoria_id = ? and acao = 'AGENDA_PESSOAL_APAGADA'"
                + " and resumo like '%2 eventos%'", consultoria())).isEqualTo(1);
    }

    private static Map<String, Object> withVersao(Map<String, Object> corpo, long versao) {
        corpo.put("versao", versao);
        return corpo;
    }

    // ---- dono e permissões ----

    @Test
    void agendaEEventoSaoSoDoDonoOutroMembroEOutraConsultoriaRecebem404() throws Exception {
        JsonNode minha = agenda("Minha");
        String agendaId = minha.path("id").asString();
        JsonNode meuEvento = evento(agendaId, "Meu evento", DIA, "10:00", 60);
        String eventoId = meuEvento.path("id").asString();

        JsonNode colega = outroMembro();
        JsonNode outraConsultoria = api.novoTreinador();
        for (JsonNode intruso : new JsonNode[]{colega, outraConsultoria}) {
            assertThat(api.get("/agenda/agendas", intruso, 200)).isEmpty();
            assertThat(eventos(intruso, DIA, DIA)).isEmpty();
            // pedir a agenda do outro pelo filtro não revela nada: nem na lista, nem na contagem do resumo
            assertThat(api.get("/agenda/eventos?de=" + DIA + "&ate=" + DIA + "&agendas=" + agendaId, intruso, 200)).isEmpty();
            assertThat(api.get("/agenda/resumo?de=" + DIA + "&ate=" + DIA + "&agendas=" + agendaId, intruso, 200)
                    .path("dias")).isEmpty();
            api.put("/agenda/agendas/" + agendaId, intruso, Map.of("nome", "Roubada", "cor", "AZUL", "versao", 0), 404);
            api.get("/agenda/agendas/" + agendaId + "/contagem", intruso, 404);
            api.delete("/agenda/agendas/" + agendaId + "?versao=0", intruso, 404);
            evento(intruso, agendaId, "Em agenda alheia", DIA, "10:00", 60, 404);
            api.get("/agenda/eventos/" + eventoId, intruso, 404);
            api.put("/agenda/eventos/" + eventoId, intruso,
                    withVersao(corpo(agendaId, "Roubado", DIA, "10:00", 60), 0), 404);
            api.delete("/agenda/eventos/" + eventoId + "?versao=0", intruso, 404);
        }
        // o colega pode ter uma agenda com o mesmo nome (a unicidade é por dono) e não mexe na do outro
        JsonNode dele = agenda(colega, "Minha", 200);
        assertThat(dele.path("id").asString()).isNotEqualTo(agendaId);
        evento(colega, agendaId, "Em agenda alheia", DIA, "10:00", 60, 404);
        assertThat(eventos(admin, DIA, DIA)).hasSize(1);
        assertThat(api.get("/agenda/agendas/" + agendaId + "/contagem", admin, 200).path("eventos").asLong()).isOne();
    }

    @Test
    void semAsPermissoesDaAgendaNadaAbre() throws Exception {
        JsonNode agenda = agenda("Minha");
        JsonNode semAgenda = membroSoCom(Set.of("PAINEL_VER"));
        JsonNode soLeitura = membroSoCom(Set.of("ALUNO_LER", "AGENDA_LER"));
        UUID aluno = api.criarAluno(admin, "Aluno Fictício da Agenda");
        JsonNode logadoComoAluno = api.convidarEEntrar(admin, aluno);

        for (JsonNode quem : new JsonNode[]{semAgenda, logadoComoAluno}) {
            api.get("/agenda/agendas", quem, 403);
            api.get("/agenda/eventos", quem, 403);
            api.get("/agenda/resumo?de=" + DIA + "&ate=" + DIA, quem, 403);
            api.post("/agenda/agendas", quem, Map.of("nome", "Nova", "cor", "AZUL"), 403);
        }
        // só leitura: lê a própria (vazia), não cria nem altera nem apaga
        api.get("/agenda/agendas", soLeitura, 200);
        api.get("/agenda/eventos", soLeitura, 200);
        api.get("/agenda/resumo?de=" + DIA + "&ate=" + DIA, soLeitura, 200);
        api.post("/agenda/agendas", soLeitura, Map.of("nome", "Nova", "cor", "AZUL"), 403);
        evento(soLeitura, agenda.path("id").asString(), "Evento", DIA, "10:00", 60, 403);
        api.delete("/agenda/agendas/" + agenda.path("id").asString() + "?versao=0", soLeitura, 403);
        api.put("/agenda/agendas/" + agenda.path("id").asString(), soLeitura,
                Map.of("nome", "Renomeada", "cor", "AZUL", "versao", 0), 403);
        String eventoId = evento(agenda.path("id").asString(), "Do dono", DIA, "10:00", 60).path("id").asString();
        api.put("/agenda/eventos/" + eventoId, soLeitura,
                withVersao(corpo(agenda.path("id").asString(), "Alterado", DIA, "10:00", 60), 0), 403);
        api.delete("/agenda/eventos/" + eventoId + "?versao=0", soLeitura, 403);
    }

    // ---- evento avulso ----

    @Test
    void eventoComHoraDiaInteiroEMeiaNoiteAparecemNoDiaCerto() throws Exception {
        String agendaId = agenda("Pessoal").path("id").asString();
        Map<String, Object> pedido = corpo(agendaId, "  Dentista  ", DIA, "10:00", 90);
        pedido.put("local", "Clínica Fictícia");
        pedido.put("descricao", "Levar exames");
        JsonNode criado = api.post("/agenda/eventos", admin, pedido, 200);
        assertThat(criado.path("titulo").asString()).isEqualTo("Dentista");
        assertThat(criado.path("hora").asString()).isEqualTo("10:00");
        assertThat(criado.path("duracaoMinutos").asInt()).isEqualTo(90);
        assertThat(criado.path("repeticao").isEmpty()).isTrue();
        assertThat(criado.path("versao").asLong()).isZero();

        // dia inteiro: hora e duração do pedido são ignoradas
        Map<String, Object> inteiro = corpo(agendaId, "Feriado", DIA.plusDays(2), null, null);
        inteiro.put("hora", "08:00");
        inteiro.put("duracaoMinutos", 30);
        api.post("/agenda/eventos", admin, inteiro, 200);
        // começa antes da meia-noite e termina depois
        evento(agendaId, "Plantão", DIA.plusDays(4), "23:00", 120);

        JsonNode lista = eventos(admin, DIA, DIA.plusDays(6));
        assertThat(titulos(lista)).containsExactly("Dentista", "Feriado", "Plantão");
        JsonNode dentista = lista.get(0);
        assertThat(dentista.path("hora").asString()).isEqualTo("10:00");
        assertThat(dentista.path("horaFim").asString()).isEqualTo("11:30");
        assertThat(dentista.path("local").asString()).isEqualTo("Clínica Fictícia");
        assertThat(dentista.path("recorrente").asBoolean()).isFalse();
        // Brasília é UTC-3
        assertThat(Instant.parse(dentista.path("inicio").asString())).isEqualTo(Instant.parse("2031-03-10T13:00:00Z"));
        assertThat(Instant.parse(dentista.path("fim").asString())).isEqualTo(Instant.parse("2031-03-10T14:30:00Z"));
        JsonNode feriado = lista.get(1);
        assertThat(feriado.path("diaInteiro").asBoolean()).isTrue();
        assertThat(feriado.path("hora").isEmpty()).isTrue();
        assertThat(Instant.parse(feriado.path("inicio").asString())).isEqualTo(Instant.parse("2031-03-12T03:00:00Z"));
        assertThat(Instant.parse(feriado.path("fim").asString())).isEqualTo(Instant.parse("2031-03-13T03:00:00Z"));

        // o plantão também aparece no dia seguinte, com o horário de fim já na madrugada
        JsonNode amanha = eventos(admin, DIA.plusDays(5), DIA.plusDays(5));
        assertThat(titulos(amanha)).containsExactly("Plantão");
        assertThat(amanha.get(0).path("data").asString()).isEqualTo(DIA.plusDays(4).toString());
        assertThat(amanha.get(0).path("horaFim").asString()).isEqualTo("01:00");
        assertThat(eventos(admin, DIA.plusDays(6), DIA.plusDays(6))).isEmpty();
        // só o dia da véspera não traz o que acabou antes dele
        assertThat(eventos(admin, DIA.minusDays(1), DIA.minusDays(1))).isEmpty();
    }

    @Test
    void periodoDaListagemTemOLimiteDe62Dias() throws Exception {
        agenda("Pessoal");
        api.get("/agenda/eventos?de=" + DIA + "&ate=" + DIA.plusDays(61), admin, 200);
        assertThat(codigo(api.get("/agenda/eventos?de=" + DIA + "&ate=" + DIA.plusDays(62), admin, 400)))
                .isEqualTo("PERIODO_INVALIDO");
        assertThat(codigo(api.get("/agenda/eventos?de=" + DIA + "&ate=" + DIA.minusDays(1), admin, 400)))
                .isEqualTo("PERIODO_INVALIDO");
        api.get("/agenda/eventos", admin, 200);
    }

    @Test
    void eventoAvulsoAlteraComVersaoEExcluiEOutrosEscoposSaoRecusados() throws Exception {
        String agendaId = agenda("Pessoal").path("id").asString();
        String outraId = agenda("Outra").path("id").asString();
        JsonNode criado = evento(agendaId, "Original", DIA, "10:00", 60);
        String caminho = "/agenda/eventos/" + criado.path("id").asString();

        JsonNode alterado = api.put(caminho, admin,
                withVersao(corpo(outraId, "Alterado", DIA.plusDays(1), "15:30", 45), criado.path("versao").asLong()), 200);
        assertThat(alterado.path("titulo").asString()).isEqualTo("Alterado");
        assertThat(alterado.path("agendaId").asString()).isEqualTo(outraId);
        assertThat(alterado.path("data").asString()).isEqualTo(DIA.plusDays(1).toString());
        assertThat(alterado.path("ocorrencia").path("hora").asString()).isEqualTo("15:30");
        assertThat(alterado.path("versao").asLong()).isEqualTo(criado.path("versao").asLong() + 1);

        // versão velha: 409; escopo de série num evento avulso: 400
        assertThat(codigo(api.put(caminho, admin, withVersao(corpo(agendaId, "Velho", DIA, "10:00", 60), 0), 409)))
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(codigo(api.put(caminho + "?escopo=TODAS", admin,
                withVersao(corpo(agendaId, "Série", DIA, "10:00", 60), alterado.path("versao").asLong()), 400)))
                .isEqualTo("EVENTO_SEM_SERIE");
        assertThat(codigo(api.delete(caminho + "?versao=" + alterado.path("versao").asLong() + "&escopo=SEGUINTES", admin, 400)))
                .isEqualTo("EVENTO_SEM_SERIE");

        assertThat(codigo(api.delete(caminho + "?versao=0", admin, 409))).isEqualTo("CONFLITO_EDICAO");
        api.delete(caminho + "?versao=" + alterado.path("versao").asLong(), admin, 204);
        api.get(caminho, admin, 404);
        assertThat(eventos(admin, DIA, DIA.plusDays(5))).isEmpty();
    }

    @Test
    void eventoInvalidoERecusado() throws Exception {
        String agendaId = agenda("Pessoal").path("id").asString();
        // com hora, a duração é obrigatória (e o contrário)
        Map<String, Object> semDuracao = corpo(agendaId, "Evento", DIA, "10:00", null);
        semDuracao.put("diaInteiro", false);
        assertThat(codigo(api.post("/agenda/eventos", admin, semDuracao, 400))).isEqualTo("EVENTO_INVALIDO");
        Map<String, Object> semHora = corpo(agendaId, "Evento", DIA, null, 60);
        semHora.put("diaInteiro", false);
        assertThat(codigo(api.post("/agenda/eventos", admin, semHora, 400))).isEqualTo("EVENTO_INVALIDO");
        evento(admin, agendaId, "   ", DIA, "10:00", 60, 400);
        evento(admin, agendaId, "x".repeat(121), DIA, "10:00", 60, 400);
        evento(admin, agendaId, "Evento", DIA, "10:00", 4, 400);
        evento(admin, agendaId, "Evento", DIA, "10:00", 1441, 400);
        evento(admin, UUID.randomUUID().toString(), "Evento", DIA, "10:00", 60, 404);
        // 1.440 minutos (um dia) é o máximo e passa
        evento(agendaId, "Um dia todo", DIA, "00:00", 1440);
    }

    @Test
    void sobreposicaoSoAvisaNaLeituraNaoBloqueia() throws Exception {
        String agendaId = agenda("Pessoal").path("id").asString();
        evento(agendaId, "Primeiro", DIA, "10:00", 60);
        evento(agendaId, "Segundo no mesmo horário", DIA, "10:00", 60);
        evento(agendaId, "Terceiro no meio", DIA, "10:30", 15);
        assertThat(eventos(admin, DIA, DIA)).hasSize(3);
    }

    @Test
    void cadaMembroTemNoMaximoMilEventos() throws Exception {
        String agendaId = agenda("Pessoal").path("id").asString();
        banco.update("insert into evento_agenda (id, consultoria_id, dono_id, agenda_id, titulo, data_inicio)"
                + " select gen_random_uuid(), ?, ?::uuid, ?::uuid, 'Evento ' || g, date '2031-01-01'"
                + " from generate_series(1, 1000) g", consultoria(), id(admin), agendaId);
        assertThat(codigo(evento(admin, agendaId, "Mil e um", DIA, "10:00", 60, 409))).isEqualTo("LIMITE_DE_EVENTOS");
    }

    // ---- resumo do Ano ----

    @Test
    void resumoContaPorDiaOsCompromissosEOsEventosSemTexto() throws Exception {
        String pessoal = agenda("Pessoal").path("id").asString();
        String aulas = agenda("Aulas").path("id").asString();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício do Resumo");
        Map<String, Object> compromisso = new HashMap<>();
        compromisso.put("alunoIds", List.of(aluno));
        compromisso.put("responsavelId", id(admin));
        compromisso.put("data", DIA.toString());
        compromisso.put("hora", "11:00");
        compromisso.put("duracaoMinutos", 60);
        JsonNode marcado = api.post("/agenda/compromissos", admin, compromisso, 200);
        evento(pessoal, "Segredo A", DIA, "09:00", 30);
        evento(pessoal, "Segredo B", DIA, "14:00", 30);
        evento(aulas, "Segredo C", DIA.plusDays(1), "09:00", 30);
        evento(pessoal, "Segredo da madrugada", DIA.plusDays(10), "23:00", 120);

        String periodo = "de=2031-01-01&ate=2031-12-31";
        JsonNode resumo = api.get("/agenda/resumo?" + periodo, admin, 200);
        assertThat(resumo.toString()).doesNotContain("Segredo").doesNotContain("Fictício");
        assertThat(contagens(resumo)).containsExactly("2031-03-10:1/2", "2031-03-11:0/1", "2031-03-20:0/1", "2031-03-21:0/1");

        // filtro de agendas só vale para os eventos
        assertThat(contagens(api.get("/agenda/resumo?" + periodo + "&agendas=" + aulas, admin, 200)))
                .containsExactly("2031-03-10:1/0", "2031-03-11:0/1");
        // responsável filtra os compromissos; os eventos continuam sendo os do dono
        JsonNode colega = outroMembro();
        assertThat(contagens(api.get("/agenda/resumo?" + periodo + "&responsavel=" + id(colega), admin, 200)))
                .containsExactly("2031-03-10:0/2", "2031-03-11:0/1", "2031-03-20:0/1", "2031-03-21:0/1");
        // o colega vê os compromissos da consultoria, não os eventos de outro membro
        assertThat(contagens(api.get("/agenda/resumo?" + periodo, colega, 200))).containsExactly("2031-03-10:1/0");

        // cancelado não conta, a menos que a situação seja pedida
        api.post("/agenda/compromissos/" + marcado.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", true, "versao", marcado.path("versao").asLong()), 200);
        assertThat(contagens(api.get("/agenda/resumo?" + periodo, admin, 200)))
                .containsExactly("2031-03-10:0/2", "2031-03-11:0/1", "2031-03-20:0/1", "2031-03-21:0/1");
        assertThat(contagens(api.get("/agenda/resumo?" + periodo + "&situacao=CANCELADO", admin, 200)).get(0))
                .isEqualTo("2031-03-10:1/2");
    }

    @Test
    void resumoTemLimiteDe366DiasEPeriodoValido() throws Exception {
        api.get("/agenda/resumo?de=2031-01-01&ate=2032-01-01", admin, 200);
        assertThat(codigo(api.get("/agenda/resumo?de=2031-01-01&ate=2032-01-02", admin, 400))).isEqualTo("PERIODO_INVALIDO");
        assertThat(codigo(api.get("/agenda/resumo?de=2031-01-02&ate=2031-01-01", admin, 400))).isEqualTo("PERIODO_INVALIDO");
        api.get("/agenda/resumo?de=2031-01-01", admin, 400);
        assertThat(api.get("/agenda/resumo?de=2031-01-01&ate=2031-01-31", admin, 200).path("dias")).isEmpty();
    }

    private static List<String> contagens(JsonNode resumo) {
        List<String> dias = new ArrayList<>();
        resumo.path("dias").forEach(d -> dias.add(d.path("data").asString() + ":" + d.path("compromissos").asInt() + "/"
                + d.path("eventos").asInt()));
        return dias;
    }

    // ---- auditoria e privacidade ----

    @Test
    void auditoriaGuardaSoUmResumoFixoSemTituloNomeNemData() throws Exception {
        String sigilo = "Sigiloso" + UUID.randomUUID().toString().substring(0, 8);
        JsonNode agenda = agenda("Agenda " + sigilo);
        String agendaId = agenda.path("id").asString();
        api.put("/agenda/agendas/" + agendaId, admin, Map.of("nome", "Renomeada " + sigilo, "cor", "TERRA", "versao", 0), 200);
        Map<String, Object> pedido = corpo(agendaId, "Evento " + sigilo, DIA, "10:00", 60);
        pedido.put("local", "Local " + sigilo);
        pedido.put("descricao", "Descrição " + sigilo);
        JsonNode evento = api.post("/agenda/eventos", admin, pedido, 200);
        String caminho = "/agenda/eventos/" + evento.path("id").asString();
        JsonNode alterado = api.put(caminho, admin, withVersao(corpo(agendaId, "Mudou " + sigilo, DIA.plusDays(1), "11:00", 60), 0), 200);
        api.delete(caminho + "?versao=" + alterado.path("versao").asLong(), admin, 204);
        api.delete("/agenda/agendas/" + agendaId + "?versao=1", admin, 204);

        List<Map<String, Object>> linhas = banco.queryForList("select acao, entidade, resumo from auditoria"
                + " where consultoria_id = ? and acao in ('AGENDA_PESSOAL_CRIADA', 'AGENDA_PESSOAL_ALTERADA',"
                + " 'AGENDA_PESSOAL_APAGADA', 'EVENTO_CRIADO', 'EVENTO_ALTERADO', 'EVENTO_EXCLUIDO')", consultoria());
        assertThat(linhas).extracting(l -> l.get("acao")).containsExactlyInAnyOrder("AGENDA_PESSOAL_CRIADA",
                "AGENDA_PESSOAL_ALTERADA", "AGENDA_PESSOAL_APAGADA", "EVENTO_CRIADO", "EVENTO_ALTERADO", "EVENTO_EXCLUIDO");
        for (Map<String, Object> linha : linhas) {
            String resumo = String.valueOf(linha.get("resumo"));
            assertThat(resumo).doesNotContain(sigilo).doesNotContain("2031").doesNotContain("Clínica").doesNotContain("10:00");
            assertThat(String.valueOf(linha.get("entidade"))).isIn("AGENDA_PESSOAL", "EVENTO_AGENDA");
        }
        assertThat(banco.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'AGENDA_PESSOAL_APAGADA'",
                String.class, consultoria())).isEqualTo("Apagou uma agenda pessoal e 0 eventos dela.");
        // nada do texto livre ficou em nenhuma linha da auditoria da consultoria
        assertThat(contar("select count(*) from auditoria where consultoria_id = ? and (resumo like ? or entidade_id::text like ?)",
                consultoria(), "%" + sigilo + "%", "%" + sigilo + "%")).isZero();
    }

    @Test
    void eventoNaoEntraNaExportacaoNemNaAnonimizacaoDoAluno() throws Exception {
        String nome = "Aluna Fictícia " + UUID.randomUUID().toString().substring(0, 8);
        UUID aluno = api.criarAluno(admin, nome);
        String agendaId = agenda("Pessoal").path("id").asString();
        String titulo = "Conversa com " + nome;
        JsonNode evento = evento(agendaId, titulo, DIA, "10:00", 60);

        String exportado = api.get("/alunos/" + aluno + "/exportacao", admin, 200).toString();
        assertThat(exportado).contains(nome).doesNotContain(titulo);

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        // o evento não tem aluno: continua exatamente como o membro escreveu
        assertThat(banco.queryForObject("select titulo from evento_agenda where id = ?::uuid", String.class,
                evento.path("id").asString())).isEqualTo(titulo);
        assertThat(titulos(eventos(admin, DIA, DIA))).containsExactly(titulo);
    }
}
