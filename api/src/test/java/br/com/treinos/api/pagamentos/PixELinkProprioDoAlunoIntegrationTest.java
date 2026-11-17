package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Link próprio no plano comercial, {@code formasDePagamento} do aluno e {@code POST /aluno/financeiro/cobrancas/{id}/pix}: o
 * código Pix é montado no servidor com o valor da cobrança (conferido contra {@link BrCodePix}), só para a cobrança aberta do
 * próprio aluno, e a chave do treinador nunca vai a log. Só dados fictícios.
 */
@AutoConfigureMockMvc
class PixELinkProprioDoAlunoIntegrationTest extends AbstractIntegrationTest {

    private static final String FORMAS = "/financeiro/formas-de-recebimento";
    private static final String LINK = "https://pague.exemplo.com.br/plano-mensal";
    private static final String CHAVE = "recebe.pix.teste@example.com";
    private static final String NOME = "Academia Teste";
    private static final String CIDADE = "Curitiba";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;
    private ListAppender<ILoggingEvent> log;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void soltarOLog() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
    }

    // ---- ajudantes ----

    private JsonNode plano(String link, long valor) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", "Plano " + UUID.randomUUID());
        corpo.put("valorCentavos", valor);
        corpo.put("periodicidade", "MENSAL");
        if (link != null) {
            corpo.put("linkDePagamento", link);
        }
        return api.post("/financeiro/planos", admin, corpo, 200);
    }

    private void contratar(UUID aluno, JsonNode plano) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private JsonNode cobrancaAberta(UUID aluno) throws Exception {
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança aberta.");
    }

    private void formas(boolean infinite, boolean link, boolean pix) throws Exception {
        JsonNode atual = api.get(FORMAS, admin, 200);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("infinitePay", infinite);
        corpo.put("linkProprio", link);
        corpo.put("pix", pix);
        corpo.put("manual", true);
        if (pix) {
            corpo.put("pixConfig", Map.of("tipoChave", "EMAIL", "chave", CHAVE, "nomeRecebedor", NOME, "cidade", CIDADE));
        }
        if (!atual.get("versao").isNull()) {
            corpo.put("versao", atual.get("versao").asLong());
        }
        api.put(FORMAS, admin, corpo, 200);
    }

    private void configurarInfinitePay() throws Exception {
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$treinador-fake"), 200);
    }

    private List<String> formasDoAluno(JsonNode aluno) throws Exception {
        List<String> r = new ArrayList<>();
        api.get("/aluno/financeiro", aluno, 200).get("formasDePagamento").forEach(f -> r.add(f.asString()));
        return r;
    }

    private String semLog(String... segredos) {
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String s : segredos) {
            assertThat(logado).as("log").doesNotContain(s);
        }
        return logado;
    }

    private static String codigoEsperado(String cobrancaId, long valorCentavos) {
        return BrCodePix.montar(CHAVE, valorCentavos, NOME, CIDADE, cobrancaId.replace("-", "").substring(0, 25));
    }

    // ---- link no plano ----

    @Test
    void linkDoPlanoOpcionalHttpsNuloApagaE422NoCampoSemRepetirOValor() throws Exception {
        JsonNode sem = plano(null, 10_000);
        assertThat(sem.get("linkDePagamento").isNull()).isTrue();

        JsonNode com = plano("  " + LINK + " ", 10_000);
        assertThat(com.get("linkDePagamento").asString()).isEqualTo(LINK);
        assertThat(api.get("/financeiro/planos", admin, 200).toString()).contains(LINK);

        for (String ruim : new String[] {"http://inseguro.exemplo.com/x", "javascript:alert(1)", "https://usuario:senha@exemplo.com/x",
                "isto nao e um link", "https://exemplo.com:8443/x", "https://exemplo.com/" + "a".repeat(500)}) {
            Map<String, Object> corpo = new LinkedHashMap<>();
            corpo.put("nome", "Plano ruim " + UUID.randomUUID());
            corpo.put("valorCentavos", 10_000);
            corpo.put("periodicidade", "MENSAL");
            corpo.put("linkDePagamento", ruim);
            JsonNode erro = api.post("/financeiro/planos", admin, corpo, 422);
            assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
            assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("linkDePagamento");
            assertThat(erro.toString()).doesNotContain("senha@");
        }

        // Alterar com o campo nulo apaga; em branco também.
        Map<String, Object> alterar = new LinkedHashMap<>();
        alterar.put("nome", com.get("nome").asString());
        alterar.put("valorCentavos", 10_000);
        alterar.put("periodicidade", "MENSAL");
        alterar.put("versao", com.get("versao").asLong());
        JsonNode apagado = api.put("/financeiro/planos/" + com.get("id").asString(), admin, alterar, 200);
        assertThat(apagado.get("linkDePagamento").isNull()).isTrue();
        alterar.put("linkDePagamento", LINK);
        alterar.put("versao", apagado.get("versao").asLong());
        JsonNode posto = api.put("/financeiro/planos/" + com.get("id").asString(), admin, alterar, 200);
        assertThat(posto.get("linkDePagamento").asString()).isEqualTo(LINK);
        alterar.put("linkDePagamento", "   ");
        alterar.put("versao", posto.get("versao").asLong());
        assertThat(api.put("/financeiro/planos/" + com.get("id").asString(), admin, alterar, 200).get("linkDePagamento").isNull())
                .isTrue();
    }

    @Test
    void oAlunoVeOLinkDoSeuPlano() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Link " + UUID.randomUUID());
        contratar(id, plano(LINK, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);

        JsonNode meu = api.get("/aluno/financeiro", aluno, 200);

        assertThat(meu.get("plano").get("linkDePagamento").asString()).isEqualTo(LINK);
    }

    // ---- formasDePagamento ----

    @Test
    void formasDePagamentoNosCasosPadraoELinkProprioEPixESemCredencial() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Formas " + UUID.randomUUID());
        contratar(id, plano(LINK, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);

        // Sem linha e sem credencial da InfinitePay: só o Manual.
        assertThat(formasDoAluno(aluno)).containsExactly("MANUAL");
        // Com a credencial, vale o comportamento de hoje (InfinitePay e Manual), sem gravar as formas.
        configurarInfinitePay();
        assertThat(formasDoAluno(aluno)).containsExactly("INFINITEPAY", "MANUAL");
        assertThat(api.get("/aluno/financeiro", aluno, 200).get("pagamentoOnline").asBoolean()).isTrue();
        // Link próprio ligado e o plano tem link.
        formas(true, true, false);
        assertThat(formasDoAluno(aluno)).containsExactly("INFINITEPAY", "LINK_PROPRIO", "MANUAL");
        // Tudo ligado, na ordem do aluno.
        formas(true, true, true);
        assertThat(formasDoAluno(aluno)).containsExactly("INFINITEPAY", "LINK_PROPRIO", "PIX", "MANUAL");
        // InfinitePay desligada pelo treinador mesmo com credencial.
        formas(false, false, true);
        assertThat(formasDoAluno(aluno)).containsExactly("PIX", "MANUAL");
        // Pix desligado mantém a configuração mas some da lista.
        formas(false, false, false);
        assertThat(formasDoAluno(aluno)).containsExactly("MANUAL");
    }

    @Test
    void linkProprioSemLinkNoPlanoNaoEntraEPixSoComCobrancaAberta() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Sem Link " + UUID.randomUUID());
        contratar(id, plano(null, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, true, true);

        assertThat(formasDoAluno(aluno)).containsExactly("PIX", "MANUAL");

        // Aluno sem nenhuma cobrança em aberto: o Pix também sai da lista.
        UUID outro = api.criarAluno(admin, "Aluno Sem Cobranca " + UUID.randomUUID());
        JsonNode semCobranca = api.convidarEEntrar(admin, outro);
        assertThat(formasDoAluno(semCobranca)).containsExactly("MANUAL");
    }

    @Test
    void linkProprioNaoValeParaAvulsaMasPixSim() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Avulsa " + UUID.randomUUID());
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, true, true);
        avulsa(id, 7_550);

        // Sem plano nem mensalidade em aberto: sem LINK_PROPRIO, com PIX.
        assertThat(formasDoAluno(aluno)).containsExactly("PIX", "MANUAL");
    }

    private void avulsa(UUID aluno, long valor) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("alunoIds", List.of(aluno.toString()));
        corpo.put("descricao", "Camiseta do time");
        corpo.put("valorCentavos", valor);
        corpo.put("primeiroVencimento", hoje.plusDays(5).toString());
        corpo.put("parcelas", 1);
        api.post("/financeiro/cobrancas-avulsas", admin, corpo, 201);
    }

    // ---- rota do Pix ----

    @Test
    void oCodigoPixTemOValorDaCobrancaEBateComOBrCode() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Pix " + UUID.randomUUID());
        contratar(id, plano(null, 15_050));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, false, true);
        JsonNode cobranca = cobrancaAberta(id);
        String cobrancaId = cobranca.get("id").asString();

        var resposta = mvc.perform(MockMvcRequestBuilders.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix")
                .header("Authorization", ApiDeTeste.bearer(aluno)).header("X-Treinos-Cliente", "nativo")).andReturn().getResponse();

        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        JsonNode corpo = api.ler(mvc.perform(MockMvcRequestBuilders.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix")
                .header("Authorization", ApiDeTeste.bearer(aluno)).header("X-Treinos-Cliente", "nativo")).andReturn());
        assertThat(corpo.propertyNames()).containsExactly("codigo");
        String codigo = corpo.get("codigo").asString();
        assertThat(codigo).isEqualTo(codigoEsperado(cobrancaId, 15_050)).contains("5406150.50").contains("5914ACADEMIA TESTE")
                .contains("6008CURITIBA").endsWith(BrCodePix.crc16(codigo.substring(0, codigo.length() - 4)));
        semLog(CHAVE, codigo, "recebe.pix");
    }

    @Test
    void oValorNuncaVemDoCorpo() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Corpo " + UUID.randomUUID());
        contratar(id, plano(null, 9_990));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, false, true);
        String cobrancaId = cobrancaAberta(id).get("id").asString();

        JsonNode r = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, Map.of("valorCentavos", 1, "valor", 1), 200);

        assertThat(r.get("codigo").asString()).isEqualTo(codigoEsperado(cobrancaId, 9_990));
    }

    @Test
    void funcionaParaCobrancaAvulsa() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Avulsa Pix " + UUID.randomUUID());
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, false, true);
        avulsa(id, 7_550);
        String cobrancaId = cobrancaAberta(id).get("id").asString();

        JsonNode r = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, null, 200);

        assertThat(r.get("codigo").asString()).isEqualTo(codigoEsperado(cobrancaId, 7_550)).contains("540575.50");
    }

    @Test
    void pixDesligadoOuSemConfiguracaoE409PixIndisponivelComMensagemFixa() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Sem Pix " + UUID.randomUUID());
        contratar(id, plano(null, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        String cobrancaId = cobrancaAberta(id).get("id").asString();

        // Sem linha gravada.
        JsonNode semLinha = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, null, 409);
        assertThat(semLinha.get("codigo").asString()).isEqualTo("PIX_INDISPONIVEL");
        assertThat(semLinha.get("message").asString()).isEqualTo("O Pix não está disponível para esta cobrança.");
        // Configurado e depois desligado.
        formas(true, false, true);
        formas(true, false, false);
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, null, 409).get("codigo").asString())
                .isEqualTo("PIX_INDISPONIVEL");
    }

    @Test
    void cobrancaPagaOuCanceladaE409() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Paga " + UUID.randomUUID());
        contratar(id, plano(null, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(false, false, true);
        JsonNode cobranca = cobrancaAberta(id);
        String cobrancaId = cobranca.get("id").asString();
        api.post("/cobrancas/" + cobrancaId + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca.get("versao").asLong()), 200);

        JsonNode r = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, null, 409);

        assertThat(r.get("codigo").asString()).isEqualTo("PIX_INDISPONIVEL");
        semLog(CHAVE, "recebe.pix");
    }

    @Test
    void cobrancaDeOutroAlunoEDeOutraConsultoriaE404() throws Exception {
        UUID dono = api.criarAluno(admin, "Aluno Dono " + UUID.randomUUID());
        contratar(dono, plano(null, 15_000));
        UUID intruso = api.criarAluno(admin, "Aluno Intruso " + UUID.randomUUID());
        JsonNode loginIntruso = api.convidarEEntrar(admin, intruso);
        formas(false, false, true);
        String cobrancaId = cobrancaAberta(dono).get("id").asString();

        api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", loginIntruso, null, 404);
        api.post("/aluno/financeiro/cobrancas/" + UUID.randomUUID() + "/pix", loginIntruso, null, 404);

        // Aluno de outra consultoria: 404 também.
        JsonNode outroTreinador = api.novoTreinador();
        UUID alunoDeFora = api.criarAluno(outroTreinador, "Aluno de Fora " + UUID.randomUUID());
        JsonNode loginDeFora = api.convidarEEntrar(outroTreinador, alunoDeFora);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", loginDeFora, null, 404);
        semLog(CHAVE, "recebe.pix");
    }

    @Test
    void treinadorEVisitanteNaoUsamARotaDoAluno() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Papel " + UUID.randomUUID());
        contratar(id, plano(null, 15_000));
        formas(false, false, true);
        String cobrancaId = cobrancaAberta(id).get("id").asString();

        api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", admin, null, 403);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", null, null, 401);
    }

    @Test
    void aChaveNuncaApareceEmLogNemNaAuditoriaDepoisDoFluxoTodo() throws Exception {
        UUID id = api.criarAluno(admin, "Aluno Varredura " + UUID.randomUUID());
        contratar(id, plano(LINK, 15_000));
        JsonNode aluno = api.convidarEEntrar(admin, id);
        formas(true, true, true);
        String cobrancaId = cobrancaAberta(id).get("id").asString();
        String codigo = api.post("/aluno/financeiro/cobrancas/" + cobrancaId + "/pix", aluno, null, 200).get("codigo").asString();
        formasDoAluno(aluno);

        semLog(CHAVE, "recebe.pix", codigo);
        UUID consultoria = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
        assertThat(jdbc.queryForObject("select coalesce(string_agg(coalesce(resumo,'') || coalesce(entidade,''), ' '), '') "
                + "from auditoria where consultoria_id = ?", String.class, consultoria))
                .doesNotContain("recebe.pix").doesNotContain(codigo).doesNotContain(NOME);
    }
}
