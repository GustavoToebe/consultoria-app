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

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code POST /agenda/eventos/cruzamentos} (aviso de sobreposição que enxerga a repetição): só leitura, um ano à frente do
 * primeiro dia, eventos pessoais e compromissos (não cancelados, em que o membro é o responsável) do próprio membro, resposta
 * com contagem e datas e nada de texto, aluno ou id de outro evento ou compromisso.
 * Datas fixas do futuro; uma consultoria por teste, dados fictícios.
 */
@AutoConfigureMockMvc
class EventoCruzamentosIntegrationTest extends AbstractIntegrationTest {

    private static final String CAMINHO = "/agenda/eventos/cruzamentos";
    /** Uma segunda-feira: 10/03/2031 (03/03/2031 é segunda, como em {@link EventoSerieIntegrationTest}). */
    private static final LocalDate SEGUNDA = LocalDate.of(2031, 3, 10);

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

    private static Map<String, Object> diaria() {
        return Map.of("tipo", "DIARIA");
    }

    private static Map<String, Object> semanal(String... dias) {
        return Map.of("tipo", "SEMANAL", "diasDaSemana", List.of(dias));
    }

    private Map<String, Object> eventoCom(String titulo, LocalDate data, String hora, Integer duracao,
                                          Map<String, Object> repeticao) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("agendaId", agendaId);
        corpo.put("titulo", titulo);
        corpo.put("local", "Local de " + titulo);
        corpo.put("descricao", "Descrição de " + titulo);
        corpo.put("data", data.toString());
        corpo.put("diaInteiro", hora == null);
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("repeticao", repeticao);
        return corpo;
    }

    private JsonNode criar(String titulo, LocalDate data, String hora, Integer duracao, Map<String, Object> repeticao)
            throws Exception {
        return api.post("/agenda/eventos", admin, eventoCom(titulo, data, hora, duracao, repeticao), 200);
    }

    private static Map<String, Object> pergunta(LocalDate data, String hora, Integer duracao, Map<String, Object> repeticao,
                                                String eventoId) {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("data", data.toString());
        corpo.put("diaInteiro", false);
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("repeticao", repeticao);
        corpo.put("eventoId", eventoId);
        return corpo;
    }

    private JsonNode cruza(JsonNode quem, Map<String, Object> corpo, int status) throws Exception {
        return api.post(CAMINHO, quem, corpo, status);
    }

    private JsonNode cruza(LocalDate data, String hora, Integer duracao, Map<String, Object> repeticao) throws Exception {
        return cruza(admin, pergunta(data, hora, duracao, repeticao, null), 200);
    }

    private static List<String> datas(JsonNode resposta) {
        List<String> datas = new ArrayList<>();
        resposta.path("datas").forEach(d -> datas.add(d.asString()));
        return datas;
    }

    private String usuarioId(JsonNode login) {
        return login.path("usuario").path("id").asString();
    }

    /** Um compromisso fictício (com aluno, local e observação) de {@code responsavel}, marcado por {@code quemMarca}. */
    private JsonNode compromisso(JsonNode quemMarca, JsonNode responsavel, UUID aluno, LocalDate data, String hora, int duracao)
            throws Exception {
        Map<String, Object> corpo = new HashMap<>();
        corpo.put("alunoIds", List.of(aluno));
        corpo.put("responsavelId", usuarioId(responsavel));
        corpo.put("data", data.toString());
        corpo.put("hora", hora);
        corpo.put("duracaoMinutos", duracao);
        corpo.put("local", "Sala secreta do compromisso");
        corpo.put("observacao", "Observação secreta do compromisso");
        return api.post("/agenda/compromissos", quemMarca, corpo, 200);
    }

    private JsonNode colega() throws Exception {
        String perfilId = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Colega fictício",
                "email", ApiDeTeste.emailUnico("colega"), "perfilId", perfilId), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private long eventosNoBanco() {
        Long total = banco.queryForObject("select count(*) from evento_agenda where dono_id = ?::uuid", Long.class,
                admin.path("usuario").path("id").asString());
        return total == null ? 0 : total;
    }

    // ---- a regra ----

    @Test
    void repeticaoDiariaCruzandoAvulsosContaEDizAsDatasSemGravarNada() throws Exception {
        criar("Avulso de terça", SEGUNDA.plusDays(1), "10:30", 60, null);
        // encostar (10:00-11:00 e 11:00-12:00) e outra hora não cruzam
        criar("Encosta", SEGUNDA.plusDays(2), "11:00", 60, null);
        criar("Outra hora", SEGUNDA.plusDays(3), "14:00", 60, null);
        long antes = eventosNoBanco();

        JsonNode um = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(um.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(um)).containsExactly("2031-03-11");
        assertThat(um.path("incompleto").asBoolean()).isFalse();

        criar("Avulso de sexta", SEGUNDA.plusDays(4), "09:30", 45, null);
        JsonNode dois = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(dois.path("quantidade").asInt()).isEqualTo(2);
        assertThat(datas(dois)).containsExactly("2031-03-11", "2031-03-14");

        // o mesmo avulso, sem repetição, só cruza no próprio dia
        assertThat(cruza(SEGUNDA, "10:00", 60, null).path("quantidade").asInt()).isZero();
        assertThat(cruza(SEGUNDA.plusDays(1), "10:00", 60, null).path("quantidade").asInt()).isEqualTo(1);
        assertThat(eventosNoBanco()).isEqualTo(antes + 1);
    }

    @Test
    void repeticaoSemanalQueNaoCaiNoHorarioDoAvulsoNaoCruza() throws Exception {
        criar("Avulso de terça", SEGUNDA.plusDays(1), "10:00", 60, null);
        JsonNode segundas = cruza(SEGUNDA, "10:00", 60, semanal("MONDAY"));
        assertThat(segundas.path("quantidade").asInt()).isZero();
        assertThat(datas(segundas)).isEmpty();
        // com a terça entre os dias, cruza todas as terças do ano que têm o avulso: só a primeira
        JsonNode comTerca = cruza(SEGUNDA, "10:00", 60, semanal("MONDAY", "TUESDAY"));
        assertThat(comTerca.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(comTerca)).containsExactly("2031-03-11");
    }

    @Test
    void repeticaoComFimOuVezesSoContaAteOndeAcaba() throws Exception {
        criar("Avulso de sexta", SEGUNDA.plusDays(4), "10:00", 60, null);
        Map<String, Object> tresVezes = new HashMap<>(diaria());
        tresVezes.put("vezes", 3); // segunda, terça, quarta
        assertThat(cruza(SEGUNDA, "10:00", 60, tresVezes).path("quantidade").asInt()).isZero();
        Map<String, Object> cincoVezes = new HashMap<>(diaria());
        cincoVezes.put("vezes", 5); // até sexta
        assertThat(datas(cruza(SEGUNDA, "10:00", 60, cincoVezes))).containsExactly("2031-03-14");
        Map<String, Object> ateQuinta = new HashMap<>(diaria());
        ateQuinta.put("ate", SEGUNDA.plusDays(3).toString());
        assertThat(cruza(SEGUNDA, "10:00", 60, ateQuinta).path("quantidade").asInt()).isZero();
    }

    @Test
    void alcanceDeUmAnoAPartirDoPrimeiroDiaComAPontaInclusive() throws Exception {
        LocalDate limite = SEGUNDA.plusYears(1);
        criar("Passou de um ano", limite.plusDays(1), "10:00", 60, null);
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isZero();

        criar("No limite", limite, "10:00", 60, null);
        JsonNode noLimite = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(noLimite.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(noLimite)).containsExactly(limite.toString());

        criar("Antes do limite", SEGUNDA.plusDays(300), "09:30", 60, null);
        JsonNode dois = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(dois.path("quantidade").asInt()).isEqualTo(2);
        assertThat(datas(dois)).containsExactly(SEGUNDA.plusDays(300).toString(), limite.toString());
    }

    @Test
    void contaTodasMasSoTrazAsPrimeirasCincoDatas() throws Exception {
        criar("Todo dia", SEGUNDA, "10:00", 60, diaria());
        JsonNode r = cruza(SEGUNDA, "10:30", 60, diaria());
        long diasDoAno = ChronoUnit.DAYS.between(SEGUNDA, SEGUNDA.plusYears(1)) + 1;
        assertThat(r.path("quantidade").asLong()).isEqualTo(diasDoAno);
        assertThat(datas(r)).containsExactly("2031-03-10", "2031-03-11", "2031-03-12", "2031-03-13", "2031-03-14");
        assertThat(r.path("incompleto").asBoolean()).isFalse();
    }

    @Test
    void ocorrenciaCanceladaNaoCruzaEMovidaValeOndeCaiu() throws Exception {
        JsonNode serie = criar("Todo dia", SEGUNDA, "10:00", 60, diaria());
        String id = serie.path("id").asString();
        LocalDate quarta = SEGUNDA.plusDays(2);
        api.delete("/agenda/eventos/" + id + "?versao=" + serie.path("versao").asLong() + "&escopo=ESTA&ocorrencia=" + quarta,
                admin, 204);

        // duas quartas (a 12/03 foi cancelada, a 19/03 não): só a segunda cruza
        Map<String, Object> duasQuartas = new HashMap<>(semanal("WEDNESDAY"));
        duasQuartas.put("vezes", 2);
        JsonNode r = cruza(quarta, "10:00", 60, duasQuartas);
        assertThat(r.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(r)).containsExactly("2031-03-19");
    }

    @Test
    void ocorrenciaMovidaCruzaNoDiaNovoENaoNoOriginal() throws Exception {
        JsonNode serie = criar("Toda segunda", SEGUNDA, "10:00", 60, semanal("MONDAY"));
        String id = serie.path("id").asString();
        LocalDate segundaMovida = SEGUNDA.plusDays(7);
        LocalDate quarta = SEGUNDA.plusDays(9);
        Map<String, Object> mover = eventoCom("Toda segunda", quarta, "10:00", 60, null);
        mover.put("versao", serie.path("versao").asLong());
        api.put("/agenda/eventos/" + id + "?escopo=ESTA&ocorrencia=" + segundaMovida, admin, mover, 200);

        assertThat(cruza(segundaMovida, "10:00", 60, null).path("quantidade").asInt()).isZero();
        JsonNode nova = cruza(quarta, "10:00", 60, null);
        assertThat(nova.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(nova)).containsExactly(quarta.toString());
    }

    @Test
    void diaInteiroNaoEntraNemComoOutroEventoNemComoPergunta() throws Exception {
        criar("Dia inteiro", SEGUNDA.plusDays(1), null, null, null);
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isZero();

        criar("Com hora", SEGUNDA.plusDays(1), "10:00", 60, null);
        Map<String, Object> diaInteiro = pergunta(SEGUNDA, null, null, diaria(), null);
        diaInteiro.put("diaInteiro", true);
        JsonNode r = cruza(admin, diaInteiro, 200);
        assertThat(r.path("quantidade").asInt()).isZero();
        assertThat(datas(r)).isEmpty();
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isEqualTo(1);
    }

    @Test
    void oProprioEventoEditadoNaoCruzaConsigo() throws Exception {
        JsonNode serie = criar("Todo dia", SEGUNDA, "10:00", 60, diaria());
        String id = serie.path("id").asString();
        long diasDoAno = ChronoUnit.DAYS.between(SEGUNDA, SEGUNDA.plusYears(1)) + 1;
        // sem dizer qual é o evento, ele mesmo cruza em todos os dias; dizendo, nenhum
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asLong()).isEqualTo(diasDoAno);
        JsonNode editando = cruza(admin, pergunta(SEGUNDA, "10:00", 60, diaria(), id), 200);
        assertThat(editando.path("quantidade").asInt()).isZero();
        assertThat(datas(editando)).isEmpty();

        // outro evento continua contando na edição
        criar("Avulso de quarta", SEGUNDA.plusDays(2), "10:15", 30, null);
        JsonNode comOutro = cruza(admin, pergunta(SEGUNDA, "10:00", 60, diaria(), id), 200);
        assertThat(comOutro.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(comOutro)).containsExactly("2031-03-12");
    }

    // ---- compromissos como segunda fonte ----

    @Test
    void eventoRepetidoQueCruzaCompromissoDoMembroConta() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício do Compromisso");
        compromisso(admin, admin, aluno, SEGUNDA.plusDays(1), "10:30", 60);
        // encostar e outra hora não cruzam
        compromisso(admin, admin, aluno, SEGUNDA.plusDays(2), "11:00", 60);
        compromisso(admin, admin, aluno, SEGUNDA.plusDays(3), "14:00", 60);

        JsonNode um = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(um.path("quantidade").asInt()).isEqualTo(1);
        assertThat(datas(um)).containsExactly("2031-03-11");

        // e soma com um evento pessoal que também cruza
        criar("Avulso de sexta", SEGUNDA.plusDays(4), "09:30", 45, null);
        JsonNode dois = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(dois.path("quantidade").asInt()).isEqualTo(2);
        assertThat(datas(dois)).containsExactly("2031-03-11", "2031-03-14");
        assertThat(dois.path("incompleto").asBoolean()).isFalse();
    }

    @Test
    void compromissoCanceladoNoMesmoHorarioNaoConta() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício do Compromisso");
        JsonNode c = compromisso(admin, admin, aluno, SEGUNDA.plusDays(1), "10:30", 60);
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isEqualTo(1);

        api.post("/agenda/compromissos/" + c.path("id").asString() + "/situacao", admin,
                Map.of("cancelado", true, "versao", c.path("versao").asLong()), 200);
        JsonNode r = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(r.path("quantidade").asInt()).isZero();
        assertThat(datas(r)).isEmpty();
    }

    @Test
    void compromissoDeOutroMembroNaoConta() throws Exception {
        JsonNode colega = colega();
        UUID aluno = api.criarAluno(admin, "Aluno Fictício do Compromisso");
        compromisso(admin, colega, aluno, SEGUNDA.plusDays(1), "10:30", 60);

        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isZero();
        // ele conta para o responsável, e o aluno marcado por outro não muda isso
        JsonNode doColega = cruza(colega, pergunta(SEGUNDA, "10:00", 60, diaria(), null), 200);
        assertThat(datas(doColega)).containsExactly("2031-03-11");
    }

    @Test
    void compromissoDeOutraConsultoriaNaoConta() throws Exception {
        JsonNode outra = api.novoTreinador();
        UUID alunoDela = api.criarAluno(outra, "Aluno Fictício de Outra");
        compromisso(outra, outra, alunoDela, SEGUNDA.plusDays(1), "10:30", 60);
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isZero();
        assertThat(cruza(outra, pergunta(SEGUNDA, "10:00", 60, diaria(), null), 200).path("quantidade").asInt()).isEqualTo(1);
    }

    @Test
    void compromissoNoUltimoDiaDoAlcanceConta() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício do Compromisso");
        LocalDate limite = SEGUNDA.plusYears(1);
        compromisso(admin, admin, aluno, limite, "10:30", 60);
        JsonNode r = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(datas(r)).containsExactly(limite.toString());
    }

    @Test
    void respostaComCompromissoNaoTrazCampoNemTextoDele() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Secreto Fictício");
        JsonNode c = compromisso(admin, admin, aluno, SEGUNDA.plusDays(1), "10:30", 60);
        JsonNode r = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(r.path("quantidade").asInt()).isEqualTo(1);
        List<String> campos = new ArrayList<>();
        r.propertyNames().forEach(campos::add);
        assertThat(campos).containsExactlyInAnyOrder("quantidade", "datas", "incompleto");
        assertThat(r.toString()).doesNotContain("Aluno Secreto").doesNotContain("Sala secreta")
                .doesNotContain("Observação secreta").doesNotContain(c.path("id").asString()).doesNotContain(aluno.toString());
    }

    // ---- dono, tenant e permissão ----

    @Test
    void outroMembroEOutraConsultoriaNaoVemNemCruzamComOEventoDeOutroERecebem404() throws Exception {
        JsonNode meu = criar("Todo dia", SEGUNDA, "10:00", 60, diaria());
        String eventoId = meu.path("id").asString();

        String perfilId = api.get("/eu", admin, 200).path("perfil").path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Colega fictício",
                "email", ApiDeTeste.emailUnico("colega"), "perfilId", perfilId), 200);
        JsonNode colega = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        JsonNode outraConsultoria = api.novoTreinador();

        for (JsonNode intruso : new JsonNode[]{colega, outraConsultoria}) {
            // o evento alheio no corpo: 404, como as outras rotas do evento
            cruza(intruso, pergunta(SEGUNDA, "10:00", 60, diaria(), eventoId), 404);
            cruza(intruso, pergunta(SEGUNDA, "10:00", 60, diaria(), UUID.randomUUID().toString()), 404);
            // e os meus eventos não contam para ele
            JsonNode r = cruza(intruso, pergunta(SEGUNDA, "10:00", 60, diaria(), null), 200);
            assertThat(r.path("quantidade").asInt()).isZero();
            assertThat(datas(r)).isEmpty();
        }
        assertThat(cruza(SEGUNDA, "10:00", 60, diaria()).path("quantidade").asInt()).isPositive();
    }

    @Test
    void semAgendaLerNegaEOAlunoTambem() throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + UUID.randomUUID(),
                "permissoes", Set.of("PAINEL_VER")), 200).path("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin, Map.of("nome", "Sem agenda fictício",
                "email", ApiDeTeste.emailUnico("semagenda"), "perfilId", perfil), 200);
        JsonNode semAgenda = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.path("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
        UUID aluno = api.criarAluno(admin, "Aluno Fictício dos Cruzamentos");
        JsonNode logadoComoAluno = api.convidarEEntrar(admin, aluno);

        cruza(semAgenda, pergunta(SEGUNDA, "10:00", 60, null, null), 403);
        cruza(logadoComoAluno, pergunta(SEGUNDA, "10:00", 60, null, null), 403);
        cruza(null, pergunta(SEGUNDA, "10:00", 60, null, null), 401);
    }

    // ---- privacidade e validação ----

    @Test
    void respostaTrazSoContagemEDatasNuncaTextoDeOutroEvento() throws Exception {
        criar("Título secreto do outro", SEGUNDA.plusDays(1), "10:00", 60, null);
        JsonNode r = cruza(SEGUNDA, "10:00", 60, diaria());
        assertThat(r.path("quantidade").asInt()).isEqualTo(1);
        List<String> campos = new ArrayList<>();
        r.propertyNames().forEach(campos::add);
        assertThat(campos).containsExactlyInAnyOrder("quantidade", "datas", "incompleto");
        String bruto = r.toString();
        assertThat(bruto).doesNotContain("Título secreto").doesNotContain("Local de").doesNotContain("Descrição de")
                .doesNotContain(agendaId);
    }

    @Test
    void pedidoInvalidoE400() throws Exception {
        // repetição incompleta (semanal sem dias) e fim duplo
        assertThat(cruza(admin, pergunta(SEGUNDA, "10:00", 60, Map.of("tipo", "SEMANAL"), null), 400).path("codigo").asString())
                .isEqualTo("REPETICAO_INVALIDA");
        Map<String, Object> doisFins = new HashMap<>(diaria());
        doisFins.put("vezes", 3);
        doisFins.put("ate", SEGUNDA.plusDays(9).toString());
        assertThat(cruza(admin, pergunta(SEGUNDA, "10:00", 60, doisFins, null), 400).path("codigo").asString())
                .isEqualTo("REPETICAO_INVALIDA");
        // duração fora de 5 a 1440 e hora sem duração
        cruza(admin, pergunta(SEGUNDA, "10:00", 4, null, null), 400);
        cruza(admin, pergunta(SEGUNDA, "10:00", 1441, null, null), 400);
        assertThat(cruza(admin, pergunta(SEGUNDA, "10:00", null, null, null), 400).path("codigo").asString())
                .isEqualTo("EVENTO_INVALIDO");
        assertThat(cruza(admin, pergunta(SEGUNDA, null, 60, null, null), 400).path("codigo").asString())
                .isEqualTo("EVENTO_INVALIDO");
    }
}
