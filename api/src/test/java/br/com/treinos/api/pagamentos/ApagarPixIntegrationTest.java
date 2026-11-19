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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D12: {@code POST /financeiro/formas-de-recebimento/pix/apagar} zera chave, tipo, nome e cidade e desliga o Pix, com
 * {@code versao} (409), idempotente, auditoria de resumo fixo, a chave nunca em resposta, log, auditoria nem erro, e o aluno
 * deixa de receber o Pix. Só dados fictícios.
 */
@AutoConfigureMockMvc
class ApagarPixIntegrationTest extends AbstractIntegrationTest {

    private static final String FORMAS = "/financeiro/formas-de-recebimento";
    private static final String APAGAR = FORMAS + "/pix/apagar";
    private static final String CHAVE = "recebe.pix.apagar@example.com";
    private static final String NOME = "Treinador Apagar Pix";
    private static final String CIDADE = "Cascavel";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

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

    private UUID consultoria() {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                admin.get("usuario").get("id").asString());
    }

    private JsonNode ligarPix() throws Exception {
        JsonNode atual = api.get(FORMAS, admin, 200);
        Map<String, Object> corpo = new java.util.LinkedHashMap<>();
        corpo.put("infinitePay", false);
        corpo.put("linkProprio", false);
        corpo.put("pix", true);
        corpo.put("manual", true);
        corpo.put("pixConfig", Map.of("tipoChave", "EMAIL", "chave", CHAVE, "nomeRecebedor", NOME, "cidade", CIDADE));
        if (!atual.get("versao").isNull()) {
            corpo.put("versao", atual.get("versao").asLong());
        }
        return api.put(FORMAS, admin, corpo, 200);
    }

    private int auditorias(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = 'PIX_APAGADO'",
                Integer.class, consultoria);
    }

    private void nadaVazou(UUID consultoria) {
        String auditoria = jdbc.queryForObject("select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,''), ' '), '') "
                + "from auditoria where consultoria_id = ?", String.class, consultoria);
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String segredo : List.of("recebe.pix", "Apagar Pix", CIDADE)) {
            assertThat(auditoria).as("auditoria").doesNotContain(segredo);
            assertThat(logado).as("log").doesNotContain(segredo);
        }
    }

    @Test
    void apagaTudoDesligaOPixEAuditaComResumoFixo() throws Exception {
        UUID consultoria = consultoria();
        JsonNode ligada = ligarPix();
        assertThat(ligada.get("pixConfig").get("chaveConfigurada").asBoolean()).isTrue();

        JsonNode r = api.post(APAGAR, admin, Map.of("versao", ligada.get("versao").asLong()), 200);

        assertThat(r.get("pix").asBoolean()).isFalse();
        assertThat(r.get("pixConfig").isNull()).as("sem chave, nome nem cidade: mesmo corpo do GET").isTrue();
        assertThat(r.get("manual").asBoolean()).isTrue();
        assertThat(r.get("versao").asLong()).isEqualTo(ligada.get("versao").asLong() + 1);
        assertThat(api.get(FORMAS, admin, 200).toString()).isEqualTo(r.toString());
        Map<String, Object> linha = jdbc.queryForMap("select * from forma_de_recebimento where consultoria_id = ?", consultoria);
        assertThat(linha.get("pix")).isEqualTo(false);
        assertThat(linha.get("pix_tipo_chave")).isNull();
        assertThat(linha.get("pix_chave")).isNull();
        assertThat(linha.get("pix_nome_recebedor")).isNull();
        assertThat(linha.get("pix_cidade")).isNull();
        assertThat(auditorias(consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'PIX_APAGADO'",
                String.class, consultoria)).isEqualTo("Apagou os dados do Pix.");
        nadaVazou(consultoria);
    }

    @Test
    void versaoVelhaESemLinhaDao409EONaoMudaNada() throws Exception {
        UUID consultoria = consultoria();
        // Sem linha gravada não há o que apagar.
        assertThat(api.post(APAGAR, admin, Map.of("versao", 0), 409).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");

        JsonNode ligada = ligarPix();
        JsonNode erro = api.post(APAGAR, admin, Map.of("versao", ligada.get("versao").asLong() + 7), 409);

        assertThat(erro.get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(erro.toString()).doesNotContain("recebe.pix");
        assertThat(jdbc.queryForObject("select pix_chave from forma_de_recebimento where consultoria_id = ?", String.class,
                consultoria)).isEqualTo(CHAVE);
        assertThat(auditorias(consultoria)).isZero();
        api.post(APAGAR, admin, Map.of(), 400);
        nadaVazou(consultoria);
    }

    @Test
    void repetirComAVersaoNovaNaoAuditaDeNovoEPodeConfigurarOutraVez() throws Exception {
        UUID consultoria = consultoria();
        JsonNode apagada = api.post(APAGAR, admin, Map.of("versao", ligarPix().get("versao").asLong()), 200);

        JsonNode denovo = api.post(APAGAR, admin, Map.of("versao", apagada.get("versao").asLong()), 200);

        assertThat(denovo.get("versao").asLong()).as("nada mudou: a versão fica").isEqualTo(apagada.get("versao").asLong());
        assertThat(auditorias(consultoria)).isEqualTo(1);
        // Depois de apagar, o treinador volta a configurar do zero (a chave é obrigatória outra vez).
        Map<String, Object> semChave = new java.util.LinkedHashMap<>();
        semChave.put("infinitePay", false);
        semChave.put("linkProprio", false);
        semChave.put("pix", true);
        semChave.put("manual", true);
        semChave.put("pixConfig", Map.of("tipoChave", "EMAIL", "nomeRecebedor", NOME, "cidade", CIDADE));
        semChave.put("versao", apagada.get("versao").asLong());
        assertThat(api.put(FORMAS, admin, semChave, 422).get("codigo").asString()).isEqualTo("FORMAS_INVALIDAS");
        assertThat(ligarPix().get("pixConfig").get("chaveConfigurada").asBoolean()).isTrue();
    }

    @Test
    void oAlunoDeixaDeReceberOPixEOCodigoVira409() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
        JsonNode login = api.convidarEEntrar(admin, aluno);
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(aluno.toString()), "descricao", "Camiseta",
                "valorCentavos", 5_000, "primeiroVencimento", LocalDate.now(Fuso.BRASILIA).plusDays(10).toString(), "parcelas", 1), 201);
        JsonNode ligada = ligarPix();
        String cobranca = api.get("/aluno/financeiro", login, 200).get("abertas").get(0).get("id").asString();
        assertThat(formasDoAluno(login)).contains("PIX");

        api.post(APAGAR, admin, Map.of("versao", ligada.get("versao").asLong()), 200);

        assertThat(formasDoAluno(login)).doesNotContain("PIX");
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobranca + "/pix", login, null, 409).get("codigo").asString())
                .isEqualTo("PIX_INDISPONIVEL");
        nadaVazou(consultoria());
    }

    @Test
    void semFinanceiroAlterarDa403() throws Exception {
        JsonNode ligada = ligarPix();
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil leitor " + UUID.randomUUID(),
                "permissoes", Set.of("ALUNO_LER", "FINANCEIRO_LER")), 200).get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", "Leitor", "email", ApiDeTeste.emailUnico("leitor"), "perfilId", perfil), 200);
        JsonNode leitor = api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);

        api.post(APAGAR, leitor, Map.of("versao", ligada.get("versao").asLong()), 403);

        assertThat(jdbc.queryForObject("select pix_chave from forma_de_recebimento where consultoria_id = ?", String.class,
                consultoria())).isEqualTo(CHAVE);
    }

    private List<String> formasDoAluno(JsonNode aluno) throws Exception {
        List<String> r = new ArrayList<>();
        api.get("/aluno/financeiro", aluno, 200).get("formasDePagamento").forEach(f -> r.add(f.asString()));
        return r;
    }
}
