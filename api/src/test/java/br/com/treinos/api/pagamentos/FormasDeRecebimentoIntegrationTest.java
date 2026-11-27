package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code GET/PUT /financeiro/formas-de-recebimento} (V087): padrão sem linha (e sem criar nenhuma), criação e alteração com
 * versão (409), 422 por campo, a chave Pix que só entra (nunca volta, nunca vai a log nem auditoria), {@code pix:false} que
 * mantém a configuração, permissões e isolamento por consultoria. Só dados fictícios.
 */
@AutoConfigureMockMvc
class FormasDeRecebimentoIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/financeiro/formas-de-recebimento";
    private static final String CHAVE = "chave.sigilosa.teste@example.com";
    private static final String CPF = "52998224725";
    private static final String NOME = "Academia Sigilo Teste";

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

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private static Map<String, Object> pix(String tipo, String chave) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("tipoChave", tipo);
        if (chave != null) {
            m.put("chave", chave);
        }
        m.put("nomeRecebedor", NOME.substring(0, 21));
        m.put("cidade", "São José dos P");
        return m;
    }

    private static Map<String, Object> corpo(boolean infinite, boolean link, boolean pix, Map<String, Object> cfg, Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("infinitePay", infinite);
        m.put("linkProprio", link);
        m.put("pix", pix);
        m.put("manual", true);
        if (cfg != null) {
            m.put("pixConfig", cfg);
        }
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private Map<String, Object> linha(UUID consultoria) {
        return jdbc.queryForMap("select * from forma_de_recebimento where consultoria_id = ?", consultoria);
    }

    private int auditorias(UUID consultoria) {
        return jdbc.queryForObject("select count(*) from auditoria where consultoria_id = ? and acao = 'FORMAS_DE_RECEBIMENTO_CONFIGURADAS'",
                Integer.class, consultoria);
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    private static Set<String> campos(JsonNode erro) {
        Set<String> nomes = new TreeSet<>();
        erro.get("fieldErrors").forEach(f -> nomes.add(f.get("field").asString()));
        return nomes;
    }

    private void nadaVazou(UUID consultoria, String... segredos) {
        String auditoria = jdbc.queryForObject(
                "select coalesce(string_agg(coalesce(acao,'') || ' ' || coalesce(resumo,'') || ' ' || coalesce(entidade,''), ' '), '') "
                        + "from auditoria where consultoria_id = ?", String.class, consultoria);
        String logado = String.join("\n", log.list.stream().map(ILoggingEvent::getFormattedMessage).toList());
        for (String segredo : segredos) {
            assertThat(auditoria).as("auditoria").doesNotContain(segredo);
            assertThat(logado).as("log").doesNotContain(segredo);
        }
    }

    @Test
    void semLinhaOGetDevolveOPadraoSemCriarNada() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        JsonNode r = api.get(ROTA, admin, 200);

        assertThat(r.propertyNames()).containsExactlyInAnyOrder("infinitePay", "overtrainingPay", "linkProprio", "pix", "manual", "pixConfig", "versao");
        assertThat(r.get("infinitePay").asBoolean()).isTrue();
        assertThat(r.get("overtrainingPay").asBoolean()).isFalse();
        assertThat(r.get("linkProprio").asBoolean()).isFalse();
        assertThat(r.get("pix").asBoolean()).isFalse();
        assertThat(r.get("manual").asBoolean()).isTrue();
        assertThat(r.get("pixConfig").isNull()).isTrue();
        assertThat(r.get("versao").isNull()).isTrue();
        api.get(ROTA, admin, 200);
        assertThat(jdbc.queryForObject("select count(*) from forma_de_recebimento where consultoria_id = ?", Integer.class,
                consultoria)).isZero();
    }

    @Test
    void criaComPixENuncaDevolveAChaveInteiraNemGravaNaAuditoriaOuNoLog() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        JsonNode criada = api.put(ROTA, admin, corpo(false, true, true, pix("EMAIL", "  Chave.Sigilosa.Teste@Example.com "), null), 200);

        assertThat(criada.get("infinitePay").asBoolean()).isFalse();
        assertThat(criada.get("linkProprio").asBoolean()).isTrue();
        assertThat(criada.get("pix").asBoolean()).isTrue();
        assertThat(criada.get("manual").asBoolean()).isTrue();
        assertThat(criada.get("versao").asLong()).isZero();
        JsonNode cfg = criada.get("pixConfig");
        assertThat(cfg.propertyNames()).containsExactlyInAnyOrder("tipoChave", "chaveConfigurada", "chaveMascarada", "nomeRecebedor",
                "cidade");
        assertThat(cfg.get("tipoChave").asString()).isEqualTo("EMAIL");
        assertThat(cfg.get("chaveConfigurada").asBoolean()).isTrue();
        assertThat(cfg.get("chaveMascarada").asString()).isEqualTo("c***@example.com");
        assertThat(cfg.get("nomeRecebedor").asString()).isEqualTo(NOME.substring(0, 21));
        assertThat(cfg.get("cidade").asString()).isEqualTo("São José dos P");
        assertThat(criada.toString()).doesNotContain(CHAVE).doesNotContain("chave.sigilosa");
        assertThat(api.get(ROTA, admin, 200).toString()).doesNotContain("chave.sigilosa");

        Map<String, Object> linha = linha(consultoria);
        assertThat(linha.get("pix_chave")).isEqualTo(CHAVE);
        assertThat(linha.get("pix_tipo_chave")).isEqualTo("EMAIL");
        assertThat(auditorias(consultoria)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where consultoria_id = ? and acao = 'FORMAS_DE_RECEBIMENTO_CONFIGURADAS'",
                String.class, consultoria)).isEqualTo("Configurou as formas de recebimento.");
        nadaVazou(consultoria, "chave.sigilosa", "Sigilo");
    }

    @Test
    void chaveCpfSaiSoComDigitosEATelaVeApenasOFim() throws Exception {
        UUID consultoria = consultoriaDe(admin);

        JsonNode criada = api.put(ROTA, admin, corpo(true, false, true, pix("CPF", "529.982.247-25"), null), 200);

        assertThat(linha(consultoria).get("pix_chave")).isEqualTo(CPF);
        assertThat(criada.get("pixConfig").get("chaveMascarada").asString()).isEqualTo("***.***.***-25");
        assertThat(criada.toString()).doesNotContain(CPF).doesNotContain("529.982");
        nadaVazou(consultoria, CPF, "529.982");
    }

    @Test
    void alterarExigeAVersaoMantemAChaveSemChaveNovaEAuditaSoQuandoMuda() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criada = api.put(ROTA, admin, corpo(true, false, true, pix("EMAIL", CHAVE), null), 200);
        long v0 = criada.get("versao").asLong();

        // Sem chave nova: a gravada fica; muda só o que o corpo muda.
        JsonNode alterada = api.put(ROTA, admin, corpo(true, true, true, pix("EMAIL", null), v0), 200);
        assertThat(alterada.get("linkProprio").asBoolean()).isTrue();
        assertThat(alterada.get("versao").asLong()).isGreaterThan(v0);
        assertThat(linha(consultoria).get("pix_chave")).isEqualTo(CHAVE);
        assertThat(auditorias(consultoria)).isEqualTo(2);

        // Igual ao gravado: 200 e nada de auditoria nova.
        api.put(ROTA, admin, corpo(true, true, true, pix("EMAIL", null), alterada.get("versao").asLong()), 200);
        assertThat(auditorias(consultoria)).isEqualTo(2);

        // Versão velha e ausente: 409.
        assertThat(api.put(ROTA, admin, corpo(true, true, true, pix("EMAIL", null), v0), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.put(ROTA, admin, corpo(true, true, true, pix("EMAIL", null), null), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        nadaVazou(consultoria, "chave.sigilosa");
    }

    @Test
    void criarComVersaoEConflito() throws Exception {
        assertThat(api.put(ROTA, admin, corpo(true, false, false, null, 3L), 409).get("codigo").asString())
                .isEqualTo("CONFLITO_EDICAO");
        assertThat(api.get(ROTA, admin, 200).get("versao").isNull()).isTrue();
    }

    @Test
    void trocarOTipoSemChaveNovaE422NoCampoDaChave() throws Exception {
        JsonNode criada = api.put(ROTA, admin, corpo(true, false, true, pix("EMAIL", CHAVE), null), 200);

        JsonNode erro = api.put(ROTA, admin, corpo(true, false, true, pix("CPF", null), criada.get("versao").asLong()), 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("FORMAS_INVALIDAS");
        assertThat(campos(erro)).containsExactly("pixConfig.chave");
        assertThat(erro.toString()).doesNotContain("chave.sigilosa");
        // Trocar o tipo COM chave nova vale.
        api.put(ROTA, admin, corpo(true, false, true, pix("CPF", CPF), criada.get("versao").asLong()), 200);
    }

    @Test
    void pixDesligadoSemPixConfigMantemAConfiguracaoGravada() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        JsonNode criada = api.put(ROTA, admin, corpo(true, false, true, pix("EMAIL", CHAVE), null), 200);

        JsonNode desligada = api.put(ROTA, admin, corpo(true, false, false, null, criada.get("versao").asLong()), 200);

        assertThat(desligada.get("pix").asBoolean()).isFalse();
        assertThat(desligada.get("pixConfig").get("chaveConfigurada").asBoolean()).isTrue();
        assertThat(linha(consultoria).get("pix_chave")).isEqualTo(CHAVE);
        // Religar sem o pixConfig é 422: a tela manda os dados de novo (o servidor não adivinha).
        assertThat(campos(api.put(ROTA, admin, corpo(true, false, true, null, desligada.get("versao").asLong()), 422)))
                .containsExactly("pixConfig");
    }

    @Test
    void erro422PorCampoSemRepetirOValorDigitado() throws Exception {
        UUID consultoria = consultoriaDe(admin);
        Map<String, Object> ruim = new LinkedHashMap<>();
        ruim.put("tipoChave", "EMAIL");
        ruim.put("chave", "segredo-que-nao-e-email");
        ruim.put("nomeRecebedor", "N".repeat(26));
        ruim.put("cidade", "C".repeat(16));

        JsonNode erro = api.put(ROTA, admin, corpo(true, false, true, ruim, null), 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("FORMAS_INVALIDAS");
        assertThat(campos(erro)).containsExactlyInAnyOrder("pixConfig.chave", "pixConfig.nomeRecebedor", "pixConfig.cidade");
        assertThat(erro.toString()).doesNotContain("segredo-que-nao-e-email");
        assertThat(campos(api.put(ROTA, admin, corpo(true, false, true, pix("OUTRO", CHAVE), null), 422)))
                .containsExactly("pixConfig.tipoChave");
        assertThat(campos(api.put(ROTA, admin, corpo(true, false, true, pix("CPF", "111.111.111-11"), null), 422)))
                .containsExactly("pixConfig.chave");
        // Pix ligado sem pixConfig e manual desligado.
        Map<String, Object> semManual = corpo(true, false, true, null, null);
        semManual.put("manual", false);
        assertThat(campos(api.put(ROTA, admin, semManual, 422))).containsExactlyInAnyOrder("manual", "pixConfig");
        assertThat(jdbc.queryForObject("select count(*) from forma_de_recebimento where consultoria_id = ?", Integer.class,
                consultoria)).isZero();
        nadaVazou(consultoria, "segredo-que-nao-e-email");
    }

    @Test
    void permissoes() throws Exception {
        JsonNode leitor = membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        JsonNode semFinanceiro = membro("Sem financeiro", Set.of("ALUNO_LER"));
        JsonNode escritor = membro("Escritor", Set.of("FINANCEIRO_LER", "FINANCEIRO_ALTERAR", "ALUNO_LER"));

        api.get(ROTA, leitor, 200);
        api.put(ROTA, leitor, corpo(true, false, false, null, null), 403);
        api.get(ROTA, semFinanceiro, 403);
        api.put(ROTA, semFinanceiro, corpo(true, false, false, null, null), 403);
        api.put(ROTA, escritor, corpo(true, true, false, null, null), 200);
        api.get(ROTA, null, 401);
        assertThat(api.get(ROTA, admin, 200).get("linkProprio").asBoolean()).isTrue();
    }

    @Test
    void cadaConsultoriaTemAsSuasFormas() throws Exception {
        JsonNode outro = api.novoTreinador();
        api.put(ROTA, admin, corpo(false, true, true, pix("EMAIL", CHAVE), null), 200);

        JsonNode doOutro = api.get(ROTA, outro, 200);
        assertThat(doOutro.get("infinitePay").asBoolean()).isTrue();
        assertThat(doOutro.get("linkProprio").asBoolean()).isFalse();
        assertThat(doOutro.get("pixConfig").isNull()).isTrue();
        assertThat(doOutro.get("versao").isNull()).isTrue();

        // A outra consultoria grava a sua sem tocar na primeira (versão própria, a primeira continua como estava).
        JsonNode gravada = api.put(ROTA, outro, corpo(true, false, true, pix("CPF", CPF), null), 200);
        assertThat(gravada.get("versao").asLong()).isZero();
        JsonNode daPrimeira = api.get(ROTA, admin, 200);
        assertThat(daPrimeira.get("pixConfig").get("tipoChave").asString()).isEqualTo("EMAIL");
        assertThat(daPrimeira.get("infinitePay").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select pix_chave from forma_de_recebimento where consultoria_id = ?", String.class,
                consultoriaDe(admin))).isEqualTo(CHAVE);
    }
}
