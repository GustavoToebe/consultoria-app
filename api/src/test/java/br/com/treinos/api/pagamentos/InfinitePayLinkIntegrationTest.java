package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.CredencialDoProvedor;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.ModoDoLink;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa.Requisicao;
import br.com.treinos.api.pagamentos.provedor.PedidoDeCobranca;
import br.com.treinos.api.pagamentos.provedor.ProvedorDePagamento;
import br.com.treinos.api.pagamentos.provedor.ProvedoresDePagamento;
import br.com.treinos.api.web.Fuso;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Link de pagamento (InfinitePay) ponta a ponta contra a InfinitePay de mentira: o valor enviado é o da cobrança no
 * servidor, o aluno só pega o link da própria cobrança, o link é reaproveitado, a chave nunca vaza (resposta, log,
 * auditoria, banco) e a falha do provedor deixa a cobrança como estava. Nenhuma chamada real; só dados fictícios.
 */
@AutoConfigureMockMvc
class InfinitePayLinkIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();
    private static final String TAG = "treinador-fake";
    private static final String CHAVE = "chave-fake-do-teste-9876543210";
    private static final String URL_PUBLICA = "https://api.teste.local";

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
        // Com o app em https, o redirect_url vai no pedido (com http não iria).
        registry.add("treinos.app-url", () -> "https://app.teste.local");
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ProvedoresDePagamento provedores;
    @Autowired private PlatformTransactionManager transacoes;

    private ApiDeTeste api;
    private JsonNode admin;
    private ListAppender<ILoggingEvent> log;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        log = new ListAppender<>();
        log.start();
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).addAppender(log);
    }

    @AfterEach
    void conferirAFalsa() {
        ((Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME)).detachAppender(log);
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    // ---- ajudantes ----

    private void configurarRecebimento(JsonNode quem, String chave) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("infiniteTag", "$" + TAG.toUpperCase(java.util.Locale.ROOT));
        if (chave != null) {
            corpo.put("apiKey", chave);
        }
        api.put("/financeiro/recebimento-online", quem, corpo, 200);
    }

    private UUID alunoNovo(String nome) throws Exception {
        return api.criarAluno(admin, nome);
    }

    private JsonNode plano(String nome, long valor) throws Exception {
        return api.post("/financeiro/planos", admin,
                Map.of("nome", nome + " " + UUID.randomUUID(), "valorCentavos", valor, "periodicidade", "MENSAL"), 200);
    }

    private JsonNode contratarHoje(UUID aluno, JsonNode plano) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        return api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
    }

    private JsonNode cobrancaAberta(UUID aluno) throws Exception {
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança aberta.");
    }

    private JsonNode cobranca(UUID aluno, String id) throws Exception {
        for (JsonNode c : api.get("/alunos/" + aluno + "/cobrancas", admin, 200)) {
            if (id.equals(c.get("id").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem a cobrança.");
    }

    private UUID consultoriaDe(JsonNode login) {
        return jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                login.get("usuario").get("id").asString());
    }

    private String tokenDoAviso(JsonNode login) {
        return jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?", String.class,
                consultoriaDe(login));
    }

    private Map<String, Object> linhaDoLink(String cobrancaId) {
        return jdbc.queryForMap("select link_url, link_slug, link_valor_centavos, link_gerado_em, link_valido_ate "
                + "from cobranca_aluno where id = ?::uuid", cobrancaId);
    }

    private int auditorias(String cobrancaId) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where acao = 'LINK_DE_PAGAMENTO_GERADO' "
                + "and entidade_id = ?::uuid", Integer.class, cobrancaId);
        return n == null ? 0 : n;
    }

    private JsonNode gerar(String cobrancaId, int esperado) throws Exception {
        return api.post("/cobrancas/" + cobrancaId + "/link", admin, Map.of(), esperado);
    }

    private static String codigo(JsonNode erro) {
        return erro.get("codigo").asString();
    }

    private static java.util.Set<String> campos(JsonNode objeto) {
        java.util.Set<String> nomes = new java.util.TreeSet<>();
        objeto.propertyNames().forEach(nomes::add);
        return nomes;
    }

    private static boolean nulo(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode();
    }

    private void semNoLog(String... proibidos) {
        for (ILoggingEvent evento : List.copyOf(log.list)) {
            String texto = evento.getFormattedMessage() + (evento.getThrowableProxy() == null ? "" : evento.getThrowableProxy().getMessage());
            for (String proibido : proibidos) {
                assertThat(texto).as("log: " + evento.getLoggerName()).doesNotContain(proibido);
            }
        }
    }

    /** Aluno, plano e contratação de hoje prontos, com o recebimento configurado só com a Tag; devolve a cobrança aberta. */
    private JsonNode cenarioSemChave(UUID aluno, long valor) throws Exception {
        configurarRecebimento(admin, null);
        contratarHoje(aluno, plano("Plano do link", valor));
        return cobrancaAberta(aluno);
    }

    // ---- o link ----

    @Test
    void geraOLinkComOValorDoServidorEOsIdentificadoresCertos() throws Exception {
        String nomeDoAluno = "Maria Fictícia do Link " + UUID.randomUUID();
        UUID aluno = alunoNovo(nomeDoAluno);
        JsonNode cobranca = cenarioSemChave(aluno, 12_000);
        String id = cobranca.get("id").asString();
        FALSA.esperaPreco(12_000).esperaPedido(UUID.fromString(id)).esperaHandle(TAG).exigeChave(false)
                .esperaTokenDoAviso(tokenDoAviso(admin)).descricaoSemTexto("Maria");

        // O corpo nunca traz valor: um valor mandado é ignorado.
        var resposta = mvc.perform(MockMvcRequestBuilders.post("/cobrancas/" + id + "/link")
                .header("X-Treinos-Cliente", "nativo")
                .header("Authorization", ApiDeTeste.bearer(admin)).contentType("application/json")
                .content("{\"valorCentavos\":1}")).andReturn().getResponse();

        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        String url = json.readTree(resposta.getContentAsString()).get("url").asString();
        assertThat(url).startsWith("https://checkout.falsa.test/pagar/");

        List<Requisicao> enviadas = FALSA.requisicoes();
        assertThat(enviadas).hasSize(1);
        JsonNode corpo = enviadas.get(0).corpo();
        assertThat(corpo.get("items").get(0).get("price").longValue()).isEqualTo(12_000L);
        assertThat(corpo.get("order_nsu").asString()).isEqualTo(id);
        assertThat(corpo.get("webhook_url").asString()).isEqualTo(URL_PUBLICA + "/publico/pagamentos/infinitepay/" + tokenDoAviso(admin));
        assertThat(corpo.get("redirect_url").asString()).isEqualTo("https://app.teste.local/aluno/conta");
        String competencia = LocalDate.parse(cobranca.get("competencia").asString()).format(DateTimeFormatter.ofPattern("MM/yyyy"));
        assertThat(corpo.get("items").get(0).get("description").asString())
                .startsWith("Mensalidade: Plano do link ").endsWith("(" + competencia + ")").doesNotContain("Maria");
        // Sem chave: só o básico e webhook_url; nada de options, webhook em objeto, customer nem address.
        assertThat(campos(corpo)).containsExactly("handle", "items", "order_nsu", "redirect_url", "webhook_url");
        assertThat(enviadas.get(0).chave()).isNull();

        Map<String, Object> linha = linhaDoLink(id);
        assertThat(linha.get("link_url")).isEqualTo(url);
        assertThat(linha.get("link_valor_centavos")).isEqualTo(12_000L);
        assertThat(linha.get("link_gerado_em")).isNotNull();
        assertThat(linha.get("link_slug")).isNull();
        assertThat(linha.get("link_valido_ate")).as("sem chave o link não vence").isNull();
        // Gerar o link não conta como edição: a versão da cobrança (e a baixa com ela) segue valendo.
        assertThat(cobranca(aluno, id).get("versao")).isEqualTo(cobranca.get("versao"));

        assertThat(auditorias(id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'LINK_DE_PAGAMENTO_GERADO' and entidade_id = ?::uuid",
                String.class, id)).isEqualTo("Gerou o link de pagamento de uma cobrança.");
        assertThat(jdbc.queryForObject("select usuario_id from auditoria where acao = 'LINK_DE_PAGAMENTO_GERADO' and entidade_id = ?::uuid",
                String.class, id)).isEqualTo(admin.get("usuario").get("id").asString());
        semNoLog(url, TAG, nomeDoAluno);
    }

    @Test
    void guardaSlugQuandoAInfinitePayDevolveLinkESlug() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Slug " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 9_900).get("id").asString();
        FALSA.linkResponde(ModoDoLink.LINK_E_SLUG);

        String url = gerar(id, 200).get("url").asString();

        Map<String, Object> linha = linhaDoLink(id);
        assertThat(linha.get("link_url")).isEqualTo(url);
        assertThat((String) linha.get("link_slug")).isNotBlank();
        assertThat(url).endsWith((String) linha.get("link_slug"));
    }

    @Test
    void reaproveitaOLinkSemChamarAInfinitePayDeNovo() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Reuso " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();

        String primeiro = gerar(id, 200).get("url").asString();
        String segundo = gerar(id, 200).get("url").asString();

        assertThat(segundo).isEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(1);
        assertThat(auditorias(id)).isEqualTo(1);
    }

    @Test
    void linkSemValidadeSegueValendoMesmoVelhoEDeOutroValorNaoEReaproveitado() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Novo Link " + UUID.randomUUID());
        JsonNode contratacao = contratarComRecebimento(aluno, 10_000);
        String id = cobrancaAberta(aluno).get("id").asString();
        String primeiro = gerar(id, 200).get("url").asString();

        // Sem chave o link não vence: a idade dele não importa.
        jdbc.update("update cobranca_aluno set link_gerado_em = now() - interval '400 days' where id = ?::uuid", id);
        assertThat(gerar(id, 200).get("url").asString()).isEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(1);

        // Valor da cobrança muda (alterar a contratação): o link antigo não vale.
        Map<String, Object> alteracao = new LinkedHashMap<>();
        alteracao.put("valorCentavos", 13_000);
        alteracao.put("motivoValor", "Acerto fictício");
        alteracao.put("diaVencimento", hoje.getDayOfMonth());
        alteracao.put("versao", contratacao.get("versao").asLong());
        api.put("/contratacoes/" + contratacao.get("id").asString(), admin, alteracao, 200);
        FALSA.esperaPreco(13_000);
        String segundo = gerar(id, 200).get("url").asString();

        assertThat(segundo).isNotEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(2);
        assertThat(linhaDoLink(id).get("link_valor_centavos")).isEqualTo(13_000L);
        assertThat(auditorias(id)).isEqualTo(2);
    }

    @Test
    void linkComChaveSoEReaproveitadoAteVencer() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Link Vence " + UUID.randomUUID());
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano que vence", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();
        FALSA.exigeChave(true);
        String primeiro = gerar(id, 200).get("url").asString();
        assertThat(linhaDoLink(id).get("link_valido_ate")).isNotNull();

        // Dentro da validade: o mesmo link, mesmo que tenha sido gerado há muito tempo.
        jdbc.update("update cobranca_aluno set link_gerado_em = now() - interval '400 days' where id = ?::uuid", id);
        assertThat(gerar(id, 200).get("url").asString()).isEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(1);

        // Vencido: gera de novo.
        jdbc.update("update cobranca_aluno set link_valido_ate = now() - interval '1 minute' where id = ?::uuid", id);
        String segundo = gerar(id, 200).get("url").asString();
        assertThat(segundo).isNotEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(2);
        assertThat(((java.sql.Timestamp) linhaDoLink(id).get("link_valido_ate")).toInstant()).isAfter(Instant.now());
    }

    private JsonNode contratarComRecebimento(UUID aluno, long valor) throws Exception {
        configurarRecebimento(admin, null);
        return contratarHoje(aluno, plano("Plano do link", valor));
    }

    // ---- trocar ou remover a credencial: links velhos ----

    private static final String OUTRA_TAG = "outra-tag-fake";

    /** Altera o recebimento já configurado (a versão vem do servidor); {@code removerChave} apaga a API Key. */
    private JsonNode alterarRecebimento(JsonNode quem, String tag, String chave, boolean removerChave) throws Exception {
        return alterarRecebimento(quem, tag, chave, removerChave, null);
    }

    private JsonNode alterarRecebimento(JsonNode quem, String tag, String chave, boolean removerChave, String juros)
            throws Exception {
        long versao = api.get("/financeiro/recebimento-online", quem, 200).get("versao").asLong();
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("infiniteTag", tag);
        if (juros != null) {
            corpo.put("jurosDoParcelamento", juros);
        }
        if (chave != null) {
            corpo.put("apiKey", chave);
        }
        if (removerChave) {
            corpo.put("removerApiKey", true);
        }
        corpo.put("versao", versao);
        return api.put("/financeiro/recebimento-online", quem, corpo, 200);
    }

    private String tokenNoBanco() {
        return jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?", String.class,
                consultoriaDe(admin));
    }

    private void linkEsquecido(String cobrancaId) {
        Map<String, Object> linha = linhaDoLink(cobrancaId);
        assertThat(linha.values()).as("link da cobrança aberta zerado").containsOnlyNulls();
    }

    @Test
    void trocarATagEsqueceOsLinksDasAbertasEOProximoUsaOHandleNovoSemMexerNoToken() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Troca de Tag " + UUID.randomUUID());
        JsonNode cobranca = cenarioSemChave(aluno, 11_000);
        String id = cobranca.get("id").asString();
        FALSA.esperaHandle(TAG);
        String antigo = gerar(id, 200).get("url").asString();
        String tokenAntes = tokenNoBanco();

        // Outra consultoria, com o próprio link: o update em lote respeita o @TenantId.
        JsonNode outro = api.novoTreinador();
        configurarRecebimento(outro, null);
        UUID alunoDoOutro = api.criarAluno(outro, "Aluno Fictício Outra Consultoria " + UUID.randomUUID());
        JsonNode planoDoOutro = api.post("/financeiro/planos", outro,
                Map.of("nome", "Plano outra " + UUID.randomUUID(), "valorCentavos", 8_000, "periodicidade", "MENSAL"), 200);
        api.post("/alunos/" + alunoDoOutro + "/contratacoes", outro, Map.of("planoComercialId", planoDoOutro.get("id").asString(),
                "inicio", hoje.toString(), "diaVencimento", hoje.getDayOfMonth()), 200);
        String idDoOutro = null;
        for (JsonNode c : api.get("/alunos/" + alunoDoOutro + "/cobrancas", outro, 200)) {
            if ("ABERTA".equals(c.get("situacao").asString())) {
                idDoOutro = c.get("id").asString();
            }
        }
        assertThat(idDoOutro).isNotNull();
        String linkDoOutro = api.post("/cobrancas/" + idDoOutro + "/link", outro, Map.of(), 200).get("url").asString();

        JsonNode alterada = alterarRecebimento(admin, OUTRA_TAG, null, false);

        assertThat(alterada.get("infiniteTag").asString()).isEqualTo(OUTRA_TAG);
        linkEsquecido(id);
        assertThat(tokenNoBanco()).as("o PUT mantém o token do webhook").isEqualTo(tokenAntes);
        assertThat(cobranca(aluno, id).get("versao").asLong()).isEqualTo(cobranca.get("versao").asLong());
        assertThat(linhaDoLink(idDoOutro).get("link_url")).as("outra consultoria não é tocada").isEqualTo(linkDoOutro);

        FALSA.esperaHandle(OUTRA_TAG);
        String novo = gerar(id, 200).get("url").asString();

        assertThat(novo).isNotEqualTo(antigo);
        List<Requisicao> links = FALSA.requisicoes("/links");
        assertThat(links).hasSize(3);
        assertThat(links.get(2).corpo().get("handle").asString()).isEqualTo(OUTRA_TAG);
        assertThat(linhaDoLink(id).get("link_url")).isEqualTo(novo);
    }

    @Test
    void regravarAMesmaTagComAMesmaChaveOuSemMandarChaveNaoMexeNosLinks() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Mesma Credencial " + UUID.randomUUID());
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano mesma credencial", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();
        FALSA.exigeChave(true).esperaChave(CHAVE).esperaHandle(TAG);
        String primeiro = gerar(id, 200).get("url").asString();
        Map<String, Object> antes = linhaDoLink(id);

        // A chave é recifrada (nonce novo), mas continua sendo "com chave": nada é zerado.
        alterarRecebimento(admin, "$" + TAG.toUpperCase(java.util.Locale.ROOT), CHAVE, false);
        assertThat(linhaDoLink(id)).isEqualTo(antes);
        alterarRecebimento(admin, TAG, null, false);
        assertThat(linhaDoLink(id)).isEqualTo(antes);
        // Trocar uma chave por outra também mantém o link (a conta e a regra são as mesmas).
        alterarRecebimento(admin, TAG, CHAVE + "-b", false);
        assertThat(linhaDoLink(id)).isEqualTo(antes);

        assertThat(gerar(id, 200).get("url").asString()).isEqualTo(primeiro);
        assertThat(FALSA.requisicoes("/links")).hasSize(1);
        assertThat(auditorias(id)).isEqualTo(1);
    }

    @Test
    void ganharOuPerderAChaveEsqueceOsLinksDasAbertas() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Chave Muda " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();
        FALSA.exigeChave(false);
        String semChave = gerar(id, 200).get("url").asString();

        // Sem chave -> com chave: o link novo precisa ser single_payment e vencer.
        alterarRecebimento(admin, TAG, CHAVE, false);
        linkEsquecido(id);
        FALSA.exigeChave(true).esperaChave(CHAVE);
        String comChave = gerar(id, 200).get("url").asString();
        assertThat(comChave).isNotEqualTo(semChave);
        List<Requisicao> links = FALSA.requisicoes("/links");
        assertThat(links).hasSize(2);
        assertThat(links.get(1).chave()).isEqualTo(CHAVE);
        assertThat(links.get(1).corpo().get("options").get("single_payment").asBoolean()).isTrue();

        // Com chave -> sem chave: volta a ser o link sem validade.
        alterarRecebimento(admin, TAG, null, true);
        linkEsquecido(id);
        FALSA.exigeChave(false);
        String denovoSemChave = gerar(id, 200).get("url").asString();
        assertThat(denovoSemChave).isNotEqualTo(comChave);
        assertThat(FALSA.requisicoes("/links")).hasSize(3);
        assertThat(campos(FALSA.requisicoes("/links").get(2).corpo()))
                .containsExactly("handle", "items", "order_nsu", "redirect_url", "webhook_url");
    }

    @Test
    void mudarQuemPagaOsJurosEsqueceOsLinksDasAbertasEMandaAsParcelasSemJuros() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Juros " + UUID.randomUUID());
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano dos juros", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();
        FALSA.exigeChave(true).esperaChave(CHAVE).esperaParcelasSemJuros(0);
        String comAluno = gerar(id, 200).get("url").asString();

        // Regravar o mesmo valor não mexe no link.
        alterarRecebimento(admin, TAG, null, false, "ALUNO");
        assertThat(linhaDoLink(id).get("link_url")).isEqualTo(comAluno);

        // ALUNO -> TREINADOR: o link velho sai e o novo pede 12 parcelas sem juros.
        JsonNode alterada = alterarRecebimento(admin, TAG, null, false, "TREINADOR");
        assertThat(alterada.get("jurosDoParcelamento").asString()).isEqualTo("TREINADOR");
        linkEsquecido(id);
        FALSA.esperaParcelasSemJuros(12);
        String comTreinador = gerar(id, 200).get("url").asString();
        assertThat(comTreinador).isNotEqualTo(comAluno);

        // Sem mandar o campo, o valor não muda e o link fica.
        alterarRecebimento(admin, TAG, null, false);
        assertThat(linhaDoLink(id).get("link_url")).isEqualTo(comTreinador);

        // TREINADOR -> ALUNO: zera de novo e volta a 0.
        alterarRecebimento(admin, TAG, null, false, "ALUNO");
        linkEsquecido(id);
        FALSA.esperaParcelasSemJuros(0);
        gerar(id, 200);

        List<Requisicao> links = FALSA.requisicoes("/links");
        assertThat(links).hasSize(3);
        assertThat(links.get(0).corpo().get("options").get("assured_installments").intValue()).isZero();
        assertThat(links.get(1).corpo().get("options").get("assured_installments").intValue()).isEqualTo(12);
        assertThat(links.get(2).corpo().get("options").get("assured_installments").intValue()).isZero();
    }

    @Test
    void semChaveAOpcaoDeParcelasNaoVaiMesmoComJurosDoAluno() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Sem Chave Juros " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();
        FALSA.exigeChave(false);

        gerar(id, 200);

        assertThat(FALSA.requisicoes("/links").get(0).corpo().has("options")).isFalse();
    }

    @Test
    void removerACredencialEsqueceOsLinksDasAbertasEMantemOHistoricoDasPagas() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Remocao " + UUID.randomUUID());
        String paga = cenarioSemChave(aluno, 10_000).get("id").asString();
        String linkDaPaga = gerar(paga, 200).get("url").asString();
        api.post("/cobrancas/" + paga + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca(aluno, paga).get("versao").asLong()), 200);
        // A baixa gera a cobrança seguinte, que fica aberta e com link.
        JsonNode abertaJson = cobrancaAberta(aluno);
        String aberta = abertaJson.get("id").asString();
        gerar(aberta, 200);
        String tokenAntes = tokenNoBanco();
        long versao = api.get("/financeiro/recebimento-online", admin, 200).get("versao").asLong();

        api.delete("/financeiro/recebimento-online?versao=" + versao, admin, 204);

        linkEsquecido(aberta);
        assertThat(linhaDoLink(paga).get("link_url")).as("o histórico da paga fica").isEqualTo(linkDaPaga);
        assertThat(cobranca(aluno, aberta).get("versao").asLong()).isEqualTo(abertaJson.get("versao").asLong());
        assertThat(api.get("/financeiro/recebimento-online", admin, 200).get("configurado").asBoolean()).isFalse();

        // Sem credencial não há link; cadastrar de novo gera outro token (os avisos dos links antigos passam a dar 404).
        assertThat(codigo(gerar(aberta, 409))).isEqualTo("RECEBIMENTO_ONLINE_NAO_CONFIGURADO");
        configurarRecebimento(admin, null);
        assertThat(tokenNoBanco()).isNotEqualTo(tokenAntes);
    }

    // ---- recusas ----

    @Test
    void semCredencialDa409ESemChamarAInfinitePay() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Sem Credencial " + UUID.randomUUID());
        contratarHoje(aluno, plano("Plano sem credencial", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();

        assertThat(codigo(gerar(id, 409))).isEqualTo("RECEBIMENTO_ONLINE_NAO_CONFIGURADO");
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void cobrancaPagaOuCanceladaDa409() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Paga " + UUID.randomUUID());
        String paga = cenarioSemChave(aluno, 10_000).get("id").asString();
        api.post("/cobrancas/" + paga + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobranca(aluno, paga).get("versao").asLong()), 200);
        // A baixa gera a cobrança seguinte: essa é cancelada.
        String cancelada = cobrancaAberta(aluno).get("id").asString();
        api.post("/cobrancas/" + cancelada + "/cancelar", admin,
                Map.of("motivo", "Cancelada de propósito", "versao", cobranca(aluno, cancelada).get("versao").asLong()), 200);

        assertThat(codigo(gerar(paga, 409))).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(codigo(gerar(cancelada, 409))).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void cobrancaInexistenteOuDeOutraConsultoriaDa404() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Alheio " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();
        JsonNode outro = api.novoTreinador();
        configurarRecebimento(outro, null);

        api.post("/cobrancas/" + id + "/link", outro, Map.of(), 404);
        gerar(UUID.randomUUID().toString(), 404);
        assertThat(FALSA.requisicoes()).isEmpty();
        assertThat(linhaDoLink(id).get("link_url")).isNull();
    }

    @Test
    void soQuemTemFinanceiroAlterarGeraOLinkDaEquipe() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Permissão " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();
        JsonNode loginAluno = api.convidarEEntrar(admin, aluno);

        api.post("/cobrancas/" + id + "/link", loginAluno, Map.of(), 403);
        api.post("/cobrancas/" + id + "/link", null, Map.of(), 401);
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    // ---- aluno ----

    @Test
    void alunoPegaOProprioLinkEOutraCobrancaDa404() throws Exception {
        UUID alunoA = alunoNovo("Aluno Fictício A " + UUID.randomUUID());
        UUID alunoB = alunoNovo("Aluno Fictício B " + UUID.randomUUID());
        configurarRecebimento(admin, null);
        JsonNode plano = plano("Plano dos dois", 11_000);
        contratarHoje(alunoA, plano);
        contratarHoje(alunoB, plano);
        String cobrancaA = cobrancaAberta(alunoA).get("id").asString();
        String cobrancaB = cobrancaAberta(alunoB).get("id").asString();
        JsonNode loginA = api.convidarEEntrar(admin, alunoA);
        FALSA.esperaPreco(11_000).esperaPedido(UUID.fromString(cobrancaA));

        // Outro aluno e a rota da equipe não servem; um id alheio é 404 e nada vai à InfinitePay.
        api.post("/aluno/financeiro/cobrancas/" + cobrancaB + "/link", loginA, Map.of(), 404);
        api.post("/aluno/financeiro/cobrancas/" + UUID.randomUUID() + "/link", loginA, Map.of(), 404);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaA + "/link", admin, Map.of(), 403);
        api.post("/aluno/financeiro/cobrancas/" + cobrancaA + "/link", null, Map.of(), 401);
        assertThat(FALSA.requisicoes()).isEmpty();

        var resposta = mvc.perform(MockMvcRequestBuilders.post("/aluno/financeiro/cobrancas/" + cobrancaA + "/link")
                .header("X-Treinos-Cliente", "nativo").header("Authorization", ApiDeTeste.bearer(loginA))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        String url = json.readTree(resposta.getContentAsString()).get("url").asString();
        assertThat(linhaDoLink(cobrancaA).get("link_url")).isEqualTo(url);
        assertThat(linhaDoLink(cobrancaB).get("link_url")).isNull();
        assertThat(FALSA.requisicoes("/links")).hasSize(1);
        // A ação do aluno entra na auditoria com ele como autor.
        assertThat(jdbc.queryForObject("select usuario_id from auditoria where acao = 'LINK_DE_PAGAMENTO_GERADO' and entidade_id = ?::uuid",
                String.class, cobrancaA)).isEqualTo(loginA.get("usuario").get("id").asString());
        // Segunda vez, o mesmo link, sem nova chamada.
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobrancaA + "/link", loginA, Map.of(), 200).get("url").asString())
                .isEqualTo(url);
        assertThat(FALSA.requisicoes("/links")).hasSize(1);
    }

    @Test
    void financeiroDoAlunoDizSePagamentoOnlineEstaDisponivel() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Online " + UUID.randomUUID());
        contratarHoje(aluno, plano("Plano online", 10_000));
        JsonNode login = api.convidarEEntrar(admin, aluno);

        assertThat(api.get("/aluno/financeiro", login, 200).get("pagamentoOnline").asBoolean()).isFalse();

        configurarRecebimento(admin, CHAVE);
        JsonNode com = api.get("/aluno/financeiro", login, 200);
        assertThat(com.get("pagamentoOnline").asBoolean()).isTrue();
        // A Tag e a chave nunca vão ao aluno.
        assertThat(com.toString()).doesNotContain(TAG).doesNotContain(CHAVE).doesNotContain("v1:");

        api.delete("/financeiro/recebimento-online", admin, 204);
        assertThat(api.get("/aluno/financeiro", login, 200).get("pagamentoOnline").asBoolean()).isFalse();
    }

    // ---- chave ----

    @Test
    void comChaveMandaOCabecalhoOptionsWebhookObjetoEValidadeESemChaveNada() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Chave " + UUID.randomUUID());
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano com chave", 10_000));
        JsonNode aberta = cobrancaAberta(aluno);
        String id = aberta.get("id").asString();
        FALSA.exigeChave(true).esperaChave(CHAVE).esperaParcelasSemJuros(0).esperaTokenDoAviso(tokenDoAviso(admin));

        String url = gerar(id, 200).get("url").asString();

        Requisicao enviada = FALSA.requisicoes("/links").get(0);
        assertThat(enviada.chave()).isEqualTo(CHAVE);
        JsonNode corpo = enviada.corpo();
        assertThat(campos(corpo)).containsExactly("handle", "items", "options", "order_nsu", "redirect_url", "webhook");
        assertThat(corpo.has("webhook_url")).isFalse();
        assertThat(corpo.get("webhook").get("url").asString())
                .isEqualTo(URL_PUBLICA + "/publico/pagamentos/infinitepay/" + tokenDoAviso(admin));
        assertThat(corpo.get("webhook").get("events").toString()).isEqualTo("[\"paid\",\"refunded\"]");
        JsonNode opcoes = corpo.get("options");
        assertThat(opcoes.get("single_payment").asBoolean()).isTrue();
        assertThat(opcoes.get("assured_installments").intValue()).isZero();
        // 30 dias depois do maior entre o vencimento e hoje, às 23:59:59 de Brasília.
        LocalDate vencimento = LocalDate.parse(aberta.get("vencimento").asString());
        LocalDate base = vencimento.isAfter(hoje) ? vencimento : hoje;
        Instant esperada = base.plusDays(30).atTime(23, 59, 59).atZone(Fuso.BRASILIA).toInstant();
        Instant validade = Instant.parse(opcoes.get("valid_until").asString());
        assertThat(validade).isEqualTo(esperada);
        // O que ficou guardado é exatamente o que foi enviado.
        assertThat(((java.sql.Timestamp) linhaDoLink(id).get("link_valido_ate")).toInstant()).isEqualTo(validade);

        // A chave não aparece na resposta, no log, na auditoria, no que ficou salvo da cobrança nem no texto do erro.
        String corpoSalvo = jdbc.queryForObject("select cast(row_to_json(c) as text) from cobranca_aluno c where id = ?::uuid",
                String.class, id);
        assertThat(corpoSalvo).doesNotContain(CHAVE);
        assertThat(jdbc.queryForObject("select string_agg(resumo || coalesce(entidade, ''), ' ') from auditoria "
                + "where consultoria_id = ?", String.class, consultoriaDe(admin))).doesNotContain(CHAVE).doesNotContain(url);
        assertThat(api.get("/alunos/" + aluno + "/cobrancas", admin, 200).toString()).doesNotContain(CHAVE);
        semNoLog(CHAVE, TAG, url);
    }

    // ---- falhas ----

    @Test
    void falhaDaInfinitePayDa503EACobrancaSeguiSemLink() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Falha " + UUID.randomUUID());
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano da falha", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();

        for (ModoDoLink modo : List.of(ModoDoLink.HTTP_500, ModoDoLink.JSON_INVALIDO, ModoDoLink.CORPO_GRANDE, ModoDoLink.SEM_URL)) {
            FALSA.linkResponde(modo);
            JsonNode erro = gerar(id, 503);
            assertThat(codigo(erro)).as(modo.name()).isEqualTo("PROVEDOR_INDISPONIVEL");
            assertThat(erro.toString()).doesNotContain("SEGREDO").doesNotContain(CHAVE).doesNotContain(TAG)
                    .doesNotContain("checkout.falsa");
        }
        assertThat(linhaDoLink(id).get("link_url")).isNull();
        assertThat(auditorias(id)).isZero();
        assertThat(cobranca(aluno, id).get("situacao").asString()).isEqualTo("ABERTA");
        semNoLog(CHAVE, TAG, "SEGREDO");

        // Passou o problema: o mesmo pedido agora gera.
        FALSA.linkResponde(ModoDoLink.URL);
        assertThat(gerar(id, 200).get("url").asString()).startsWith("https://");
        assertThat(auditorias(id)).isEqualTo(1);
    }

    @Test
    void cobrancaQueMudaEnquantoAInfinitePayRespondeNaoRecebeOLink() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Corrida " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();

        // O valor muda no banco durante a chamada: 409, e o link órfão não é gravado.
        FALSA.aoReceberLink(() -> jdbc.update("update cobranca_aluno set valor_centavos = 11000 where id = ?::uuid", id));
        assertThat(codigo(gerar(id, 409))).isEqualTo("CONFLITO_EDICAO");
        assertThat(linhaDoLink(id).get("link_url")).isNull();

        // A cobrança é cancelada durante a chamada: 409 COBRANCA_NAO_ABERTA.
        FALSA.esperaPreco(11_000).aoReceberLink(() -> jdbc.update("update cobranca_aluno set situacao = 'CANCELADA' where id = ?::uuid", id));
        assertThat(codigo(gerar(id, 409))).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(linhaDoLink(id).get("link_url")).isNull();
        assertThat(auditorias(id)).isZero();
    }

    @Test
    void seOutroLinkFoiGravadoNoMeioFicaOPrimeiro() throws Exception {
        UUID aluno = alunoNovo("Aluno Fictício Dois Cliques " + UUID.randomUUID());
        String id = cenarioSemChave(aluno, 10_000).get("id").asString();
        String primeiro = "https://checkout.falsa.test/pagar/o-primeiro";
        FALSA.aoReceberLink(() -> jdbc.update("update cobranca_aluno set link_url = ?, link_valor_centavos = 10000, "
                + "link_gerado_em = now() where id = ?::uuid", primeiro, id));

        assertThat(gerar(id, 200).get("url").asString()).isEqualTo(primeiro);
        assertThat(linhaDoLink(id).get("link_url")).isEqualTo(primeiro);
        assertThat(auditorias(id)).isZero();
    }

    // ---- guarda e LGPD ----

    @Test
    void oProvedorDentroDeUmaTransacaoLancaSemChamarARede() {
        ProvedorDePagamento infinitePay = provedores.buscar("INFINITEPAY").orElseThrow();
        var credencial = new CredencialDoProvedor(UUID.randomUUID(), TAG, CHAVE);
        var pedido = new PedidoDeCobranca(UUID.randomUUID(), 10_000, hoje, "Mensalidade", Set.of(), 1, null, null, Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS), 0);

        assertThatThrownBy(() -> new TransactionTemplate(transacoes).executeWithoutResult(
                status -> infinitePay.gerarCobranca(credencial, pedido)))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining(TAG).hasMessageNotContaining(CHAVE);
        assertThat(FALSA.requisicoes()).isEmpty();
    }

    @Test
    void anonimizarOAlunoLimpaOLinkEMantemValorEDatas() throws Exception {
        String nome = "Joana Fictícia do Link " + UUID.randomUUID();
        UUID aluno = alunoNovo(nome);
        FALSA.linkResponde(ModoDoLink.LINK_E_SLUG);
        configurarRecebimento(admin, CHAVE);
        contratarHoje(aluno, plano("Plano da LGPD", 10_000));
        String id = cobrancaAberta(aluno).get("id").asString();
        gerar(id, 200);
        assertThat(linhaDoLink(id).get("link_url")).isNotNull();
        assertThat(linhaDoLink(id).get("link_slug")).isNotNull();
        assertThat(linhaDoLink(id).get("link_valido_ate")).isNotNull();

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        Map<String, Object> linha = linhaDoLink(id);
        assertThat(linha.get("link_url")).isNull();
        assertThat(linha.get("link_slug")).isNull();
        assertThat(linha.get("link_valido_ate")).isNull();
        assertThat(linha.get("link_valor_centavos")).isEqualTo(10_000L);
        assertThat(linha.get("link_gerado_em")).isNotNull();
        assertThat(nulo(api.get("/alunos/" + aluno + "/cobrancas", admin, 200).get(0).get("valorCentavos"))).isFalse();
    }
}
