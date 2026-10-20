package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.tenant.TenantContext;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pagamentos do aluno ao treinador, ponta a ponta: isolamento entre consultorias, permissões, regras de cobrança e de
 * datas, painel, lançamentos, CSV e LGPD. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class PagamentosIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private BaixaDeCobranca baixaDeCobranca;
    @Autowired private PlatformTransactionManager transacoes;

    /** UTF-8 com marca de ordem (BOM): o Excel abre o CSV com a acentuação certa. */
    private static final String MARCA_DE_ORDEM = String.valueOf((char) 0xFEFF);

    private ApiDeTeste api;
    private JsonNode admin;
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    // ---- ajudantes ----

    private JsonNode plano(String nome, long valor, String periodicidade) throws Exception {
        return plano(admin, nome, valor, periodicidade);
    }

    private JsonNode plano(JsonNode quem, String nome, long valor, String periodicidade) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("nome", nome + " " + UUID.randomUUID());
        corpo.put("valorCentavos", valor);
        corpo.put("periodicidade", periodicidade);
        return api.post("/financeiro/planos", quem, corpo, 200);
    }

    private JsonNode contratar(UUID aluno, JsonNode plano, LocalDate inicio, int dia) throws Exception {
        return contratar(admin, aluno, plano, inicio, dia);
    }

    private JsonNode contratar(JsonNode quem, UUID aluno, JsonNode plano, LocalDate inicio, int dia) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano.get("id").asString());
        corpo.put("inicio", inicio.toString());
        corpo.put("diaVencimento", dia);
        return api.post("/alunos/" + aluno + "/contratacoes", quem, corpo, 200);
    }

    /** Contrata hoje, com vencimento hoje (o dia do mês de hoje): a cobrança nasce aberta e ainda não vencida. */
    private JsonNode contratarHoje(UUID aluno, JsonNode plano) throws Exception {
        return contratar(aluno, plano, hoje, hoje.getDayOfMonth());
    }

    private UUID aluno() throws Exception {
        return api.criarAluno(admin, "Aluno Fictício " + UUID.randomUUID());
    }

    /** Da competência mais nova para a mais antiga. */
    private JsonNode cobrancas(UUID aluno) throws Exception {
        return cobrancas(admin, aluno);
    }

    private JsonNode cobrancas(JsonNode quem, UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200);
    }

    private JsonNode porCompetencia(UUID aluno, LocalDate competencia) throws Exception {
        return porCompetencia(admin, aluno, competencia);
    }

    private JsonNode porCompetencia(JsonNode quem, UUID aluno, LocalDate competencia) throws Exception {
        for (JsonNode c : cobrancas(quem, aluno)) {
            if (competencia.toString().equals(c.get("competencia").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem cobrança na competência pedida.");
    }

    private JsonNode baixar(JsonNode cobranca, LocalDate data, int esperado) throws Exception {
        return baixar(admin, cobranca, data, esperado);
    }

    private JsonNode baixar(JsonNode quem, JsonNode cobranca, LocalDate data, int esperado) throws Exception {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("data", data.toString());
        corpo.put("forma", "PIX_DIRETO");
        corpo.put("versao", cobranca.get("versao").asLong());
        return api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", quem, corpo, esperado);
    }

    private JsonNode motivo(String caminho, JsonNode cobranca, int esperado) throws Exception {
        return motivo(admin, caminho, cobranca, esperado);
    }

    private JsonNode motivo(JsonNode quem, String caminho, JsonNode cobranca, int esperado) throws Exception {
        return api.post(caminho, quem, Map.of("motivo", "Motivo fictício", "versao", cobranca.get("versao").asLong()), esperado);
    }

    /** Move o vencimento da cobrança para N dias atrás (vencida, sem passar pelo calendário). */
    private void vencerHaDias(JsonNode cobranca, int dias) {
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(dias).toString(),
                cobranca.get("id").asString());
    }

    /** Estorna pelo serviço comum de baixa (ainda sem chamador HTTP), na consultoria do aluno. */
    private void estornar(UUID aluno, JsonNode cobranca) {
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?::uuid", UUID.class, aluno.toString());
        UUID cobrancaId = UUID.fromString(cobranca.get("id").asString());
        var tx = new TransactionTemplate(transacoes);
        var resultado = TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.estornar(cobrancaId, "Devolvido")));
        assertThat(resultado.cobranca().getSituacao()).isEqualTo(CobrancaAluno.Situacao.ESTORNADA);
    }

    /** Os valores de um campo em cada item de uma lista. */
    private static Set<String> campo(JsonNode itens, String campo) {
        Set<String> valores = new java.util.HashSet<>();
        itens.forEach(i -> valores.add(i.get(campo).asString()));
        return valores;
    }

    private static String codigo(JsonNode erro) {
        return erro.path("codigo").asString();
    }

    private static boolean nulo(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode();
    }

    private int auditorias(String acao, String entidadeId) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid",
                Integer.class, acao, entidadeId);
        return n == null ? 0 : n;
    }

    private JsonNode membro(String nome, Set<String> permissoes) throws Exception {
        String perfil = api.post("/perfis", admin, Map.of("nome", "Perfil " + nome + UUID.randomUUID(), "permissoes", permissoes), 200)
                .get("id").asString();
        JsonNode convite = api.post("/usuarios/convites", admin,
                Map.of("nome", nome, "email", ApiDeTeste.emailUnico("membro"), "perfilId", perfil), 200);
        return api.post("/publico/convites-equipe/aceitar", null,
                Map.of("codigo", convite.get("codigo").asString(), "senha", ApiDeTeste.SENHA), 200);
    }

    // ---- plano comercial ----

    @Test
    void planoComercialValidaOsLimitesENomeEmUsoEArquivar() throws Exception {
        JsonNode plano = plano("Consultoria mensal", 25000, "MENSAL");
        assertThat(plano.get("valorCentavos").asLong()).isEqualTo(25000);
        assertThat(plano.get("aceitaPix").asBoolean()).isTrue();
        assertThat(plano.get("aceitaBoleto").asBoolean()).isFalse();
        assertThat(plano.get("maxParcelas").asInt()).isEqualTo(1);
        assertThat(plano.get("arquivado").asBoolean()).isFalse();

        Map<String, Object> repetido = new LinkedHashMap<>();
        repetido.put("nome", plano.get("nome").asString().toUpperCase(java.util.Locale.ROOT));
        repetido.put("valorCentavos", 1000);
        repetido.put("periodicidade", "MENSAL");
        assertThat(codigo(api.post("/financeiro/planos", admin, repetido, 409))).isEqualTo("PLANO_COMERCIAL_NOME_EM_USO");

        for (long invalido : new long[] {0, -1, PagamentosDtos.VALOR_MAXIMO + 1}) {
            api.post("/financeiro/planos", admin,
                    Map.of("nome", "Inválido " + UUID.randomUUID(), "valorCentavos", invalido, "periodicidade", "MENSAL"), 400);
        }
        api.post("/financeiro/planos", admin,
                Map.of("nome", "No teto " + UUID.randomUUID(), "valorCentavos", PagamentosDtos.VALOR_MAXIMO,
                        "periodicidade", "ANUAL"), 200);
        api.post("/financeiro/planos", admin, Map.of("nome", "Parcelas " + UUID.randomUUID(), "valorCentavos", 1000,
                "periodicidade", "MENSAL", "maxParcelas", 13), 400);

        Map<String, Object> alteracao = new LinkedHashMap<>();
        alteracao.put("nome", plano.get("nome").asString());
        alteracao.put("valorCentavos", 26000);
        alteracao.put("periodicidade", "MENSAL");
        alteracao.put("versao", plano.get("versao").asLong());
        JsonNode alterado = api.put("/financeiro/planos/" + plano.get("id").asString(), admin, alteracao, 200);
        assertThat(alterado.get("valorCentavos").asLong()).isEqualTo(26000);
        assertThat(codigo(api.put("/financeiro/planos/" + plano.get("id").asString(), admin, alteracao, 409)))
                .isEqualTo("CONFLITO_EDICAO");

        UUID aluno = aluno();
        JsonNode arquivado = api.post("/financeiro/planos/" + plano.get("id").asString() + "/arquivar", admin,
                Map.of("versao", alterado.get("versao").asLong()), 200);
        assertThat(arquivado.get("arquivado").asBoolean()).isTrue();
        assertThat(codigo(api.put("/financeiro/planos/" + plano.get("id").asString(), admin, alteracao, 409)))
                .isIn("PLANO_COMERCIAL_ARQUIVADO", "CONFLITO_EDICAO");
        assertThat(codigo(api.post("/alunos/" + aluno + "/contratacoes", admin,
                Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", 10), 409)))
                .isEqualTo("PLANO_COMERCIAL_ARQUIVADO");

        assertThat(api.get("/financeiro/planos", admin, 200).valueStream().map(n -> n.get("id").asString()))
                .doesNotContain(plano.get("id").asString());
        assertThat(api.get("/financeiro/planos?arquivados=true", admin, 200).valueStream().map(n -> n.get("id").asString()))
                .contains(plano.get("id").asString());
        assertThat(auditorias("PLANO_COMERCIAL_CRIADO", plano.get("id").asString())).isEqualTo(1);
    }

    // ---- isolamento e permissões ----

    @Test
    void outraConsultoriaNaoVeNemAlteraNada() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano isolado", 10000, "MENSAL");
        JsonNode contratacao = contratarHoje(aluno, plano);
        JsonNode cobranca = cobrancas(aluno).get(0);
        JsonNode lancamento = api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao",
                "Entrada fictícia", "valorCentavos", 500, "tipo", "ENTRADA"), 200);

        JsonNode outro = api.novoTreinador();
        UUID alunoDoOutro = api.criarAluno(outro, "Aluno do Outro");
        assertThat(api.get("/financeiro/planos", outro, 200)).isEmpty();
        assertThat(api.get("/financeiro/cobrancas", outro, 200).get("itens")).isEmpty();
        assertThat(api.get("/financeiro/lancamentos", outro, 200).get("itens")).isEmpty();
        assertThat(nulo(api.get("/financeiro/numeros?meses=6", outro, 200).get("previstoCentavos"))).isTrue();

        api.get("/alunos/" + aluno + "/contratacoes", outro, 404);
        api.get("/alunos/" + aluno + "/cobrancas", outro, 404);
        api.post("/alunos/" + aluno + "/contratacoes", outro,
                Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", 5), 404);
        api.post("/alunos/" + alunoDoOutro + "/contratacoes", outro,
                Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", 5), 404);
        String contratacaoId = contratacao.get("id").asString();
        api.put("/contratacoes/" + contratacaoId, outro, Map.of("valorCentavos", 1, "diaVencimento", 5, "versao", 0), 404);
        api.post("/contratacoes/" + contratacaoId + "/pausar", outro, Map.of("versao", 0), 404);
        api.post("/contratacoes/" + contratacaoId + "/retomar", outro, Map.of("versao", 0), 404);
        api.post("/contratacoes/" + contratacaoId + "/encerrar", outro, Map.of("versao", 0), 404);
        String cobrancaId = cobranca.get("id").asString();
        api.post("/cobrancas/" + cobrancaId + "/baixa-manual", outro,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", 0), 404);
        api.post("/cobrancas/" + cobrancaId + "/desfazer-baixa", outro, Map.of("motivo", "x", "versao", 0), 404);
        api.post("/cobrancas/" + cobrancaId + "/cancelar", outro, Map.of("motivo", "x", "versao", 0), 404);
        api.put("/financeiro/planos/" + plano.get("id").asString(), outro,
                Map.of("nome", "Roubado", "valorCentavos", 1, "periodicidade", "MENSAL", "versao", 0), 404);
        api.post("/financeiro/planos/" + plano.get("id").asString() + "/arquivar", outro, Map.of("versao", 0), 404);
        api.put("/financeiro/lancamentos/" + lancamento.get("id").asString(), outro, Map.of("data", hoje.toString(),
                "descricao", "x", "valorCentavos", 1, "tipo", "SAIDA", "versao", 0), 404);
        api.delete("/financeiro/lancamentos/" + lancamento.get("id").asString() + "?versao=0", outro, 404);

        assertThat(cobrancas(aluno).get(0).get("situacao").asString()).isEqualTo("ABERTA");
    }

    @Test
    void painelInadimplentesCsvELancamentosNuncaMisturamConsultorias() throws Exception {
        JsonNode outro = api.novoTreinador();
        String nomeA1 = "Alice Fictícia Alfa " + UUID.randomUUID();
        String nomeA2 = "Aline Fictícia Alfa " + UUID.randomUUID();
        String nomeB1 = "Bruno Fictício Beta " + UUID.randomUUID();
        String nomeB2 = "Bianca Fictícia Beta " + UUID.randomUUID();
        UUID a1 = api.criarAluno(admin, nomeA1);
        UUID a2 = api.criarAluno(admin, nomeA2);
        UUID b1 = api.criarAluno(outro, nomeB1);
        UUID b2 = api.criarAluno(outro, nomeB2);

        JsonNode planoA1 = plano(admin, "Plano Alfa pago", 11111, "MENSAL");
        JsonNode planoA2 = plano(admin, "Plano Alfa atrasado", 22222, "MENSAL");
        JsonNode planoB1 = plano(outro, "Plano Beta pago", 77777, "MENSAL");
        JsonNode planoB2 = plano(outro, "Plano Beta atrasado", 66666, "MENSAL");
        contratar(admin, a1, planoA1, hoje, hoje.getDayOfMonth());
        contratar(admin, a2, planoA2, hoje, hoje.getDayOfMonth());
        contratar(outro, b1, planoB1, hoje, hoje.getDayOfMonth());
        contratar(outro, b2, planoB2, hoje, hoje.getDayOfMonth());
        JsonNode pagaA1 = baixar(admin, cobrancas(admin, a1).get(0), hoje, 200);
        JsonNode pagaB1 = baixar(outro, cobrancas(outro, b1).get(0), hoje, 200);
        JsonNode atrasadaA2 = cobrancas(admin, a2).get(0);
        JsonNode atrasadaB2 = cobrancas(outro, b2).get(0);
        vencerHaDias(atrasadaA2, 2);
        vencerHaDias(atrasadaB2, 2);
        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Lançamento Alfa",
                "valorCentavos", 4444, "tipo", "ENTRADA"), 200);
        api.post("/financeiro/lancamentos", outro, Map.of("data", hoje.toString(), "descricao", "Lançamento Beta Secreto",
                "valorCentavos", 33333, "tipo", "ENTRADA"), 200);

        // ---- consultoria A: só os valores e nomes dela ----
        JsonNode painelA = api.get("/financeiro/painel", admin, 200);
        assertThat(painelA.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(11111);
        assertThat(painelA.get("cartoes").get("alunosPagantes").asLong()).isEqualTo(1);
        assertThat(painelA.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(22222);
        assertThat(painelA.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isEqualTo(1);
        assertThat(painelA.get("cartoes").get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(11111 + 22222);
        assertThat(painelA.get("serie").get(5).get("recebidoCentavos").asLong()).isEqualTo(11111);
        assertThat(painelA.get("porPlano")).hasSize(1);
        assertThat(painelA.get("porPlano").get(0).get("nome").asString()).startsWith("Plano Alfa pago");
        assertThat(painelA.get("porPlano").get(0).get("valorCentavos").asLong()).isEqualTo(11111);
        assertThat(painelA.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isEqualTo(2);
        assertThat(painelA.get("resultadoDoMes").get("recebidoCentavos").asLong()).isEqualTo(11111);
        assertThat(painelA.get("resultadoDoMes").get("entradasAvulsasCentavos").asLong()).isEqualTo(4444);
        assertThat(nulo(painelA.get("resultadoDoMes").get("saidasAvulsasCentavos"))).isTrue();
        assertThat(painelA.get("resultadoDoMes").get("resultadoCentavos").asLong()).isEqualTo(11111 + 4444);
        assertThat(painelA.toString()).doesNotContain("Beta");
        JsonNode numerosA = api.get("/financeiro/numeros?meses=6", admin, 200);
        assertThat(numerosA.get("meses").get(5).get("recebidoCentavos").asLong()).isEqualTo(11111);
        assertThat(numerosA.get("previstoCentavos").asLong()).isEqualTo(11111);
        assertThat(numerosA.get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(11111 + 22222);

        JsonNode inadimplentesA = api.get("/financeiro/inadimplentes", admin, 200);
        assertThat(inadimplentesA.get("itens")).hasSize(1);
        assertThat(inadimplentesA.get("itens").get(0).get("alunoId").asString()).isEqualTo(a2.toString());
        assertThat(inadimplentesA.get("itens").get(0).get("alunoNome").asString()).isEqualTo(nomeA2);
        assertThat(inadimplentesA.get("itens").get(0).get("valorCentavos").asLong()).isEqualTo(22222);
        assertThat(inadimplentesA.get("total").asLong()).isEqualTo(1);
        assertThat(inadimplentesA.get("valorTotalCentavos").asLong()).isEqualTo(22222);
        assertThat(inadimplentesA.toString()).doesNotContain("Beta");

        JsonNode cobrancasA = api.get("/financeiro/cobrancas", admin, 200);
        assertThat(campo(cobrancasA.get("itens"), "alunoId")).containsExactlyInAnyOrder(a1.toString(), a2.toString());
        assertThat(cobrancasA.get("total").asLong()).isEqualTo(3);
        assertThat(cobrancasA.toString()).doesNotContain("Beta");

        JsonNode lancamentosA = api.get("/financeiro/lancamentos", admin, 200);
        assertThat(lancamentosA.get("itens")).hasSize(1);
        assertThat(lancamentosA.get("itens").get(0).get("descricao").asString()).isEqualTo("Lançamento Alfa");
        assertThat(lancamentosA.get("total").asLong()).isEqualTo(1);

        String periodo = "?de=" + hoje.minusDays(10) + "&ate=" + hoje.plusMonths(2);
        var respostaA = mvc.perform(MockMvcRequestBuilders.get("/financeiro/exportacao" + periodo)
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))).andReturn().getResponse();
        String csvA = respostaA.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csvA).contains(nomeA1).contains(nomeA2).contains("Lançamento Alfa").contains(";111,11").contains(";222,22")
                .contains(";44,44");
        assertThat(csvA).doesNotContain("Beta").doesNotContain("777,77").doesNotContain("666,66").doesNotContain("333,33");

        // ---- consultoria B: o espelho ----
        JsonNode painelB = api.get("/financeiro/painel", outro, 200);
        assertThat(painelB.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(77777);
        assertThat(painelB.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(66666);
        assertThat(painelB.get("resultadoDoMes").get("entradasAvulsasCentavos").asLong()).isEqualTo(33333);
        assertThat(painelB.toString()).doesNotContain("Alfa");
        JsonNode inadimplentesB = api.get("/financeiro/inadimplentes", outro, 200);
        assertThat(campo(inadimplentesB.get("itens"), "alunoId")).containsExactly(b2.toString());
        assertThat(inadimplentesB.get("valorTotalCentavos").asLong()).isEqualTo(66666);
        assertThat(api.get("/financeiro/lancamentos", outro, 200).get("itens")).hasSize(1);
        var respostaB = mvc.perform(MockMvcRequestBuilders.get("/financeiro/exportacao" + periodo)
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(outro))).andReturn().getResponse();
        String csvB = respostaB.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csvB).contains(nomeB1).contains(nomeB2).contains("Lançamento Beta Secreto").contains(";777,77");
        assertThat(csvB).doesNotContain("Alfa").doesNotContain("111,11").doesNotContain("222,22").doesNotContain("44,44");

        // ---- cruzado: a de uma consultoria nunca alcança o aluno e a cobrança da outra ----
        api.get("/alunos/" + b1 + "/cobrancas", admin, 404);
        api.get("/alunos/" + a1 + "/cobrancas", outro, 404);
        baixar(admin, atrasadaB2, hoje, 404);
        motivo(admin, "/cobrancas/" + atrasadaB2.get("id").asString() + "/cancelar", atrasadaB2, 404);
        motivo(admin, "/cobrancas/" + pagaB1.get("id").asString() + "/desfazer-baixa", pagaB1, 404);
        baixar(outro, atrasadaA2, hoje, 404);
        motivo(outro, "/cobrancas/" + atrasadaA2.get("id").asString() + "/cancelar", atrasadaA2, 404);
        motivo(outro, "/cobrancas/" + pagaA1.get("id").asString() + "/desfazer-baixa", pagaA1, 404);

        // Nada mudou por causa das tentativas.
        assertThat(porCompetencia(outro, b2, hoje).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(porCompetencia(outro, b1, hoje).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(porCompetencia(admin, a2, hoje).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(porCompetencia(admin, a1, hoje).get("situacao").asString()).isEqualTo("PAGA");
        for (JsonNode c : List.of(atrasadaA2, pagaA1, atrasadaB2, pagaB1)) {
            assertThat(auditorias("COBRANCA_CANCELADA", c.get("id").asString())).isZero();
            assertThat(auditorias("COBRANCA_BAIXA_DESFEITA", c.get("id").asString())).isZero();
        }
        assertThat(auditorias("PAGAMENTO_MANUAL_REGISTRADO", atrasadaA2.get("id").asString())).isZero();
        assertThat(auditorias("PAGAMENTO_MANUAL_REGISTRADO", atrasadaB2.get("id").asString())).isZero();
    }

    @Test
    void cadaRotaPedeAPermissaoCerta() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano de permissão", 10000, "MENSAL");
        contratarHoje(aluno, plano);
        JsonNode cobranca = cobrancas(aluno).get(0);

        JsonNode semFinanceiro = membro("Sem financeiro", Set.of("ALUNO_LER"));
        for (String rota : List.of("/financeiro/planos", "/financeiro/cobrancas", "/financeiro/numeros", "/financeiro/painel",
                "/financeiro/inadimplentes", "/financeiro/lancamentos", "/alunos/" + aluno + "/contratacoes",
                "/alunos/" + aluno + "/cobrancas")) {
            api.get(rota, semFinanceiro, 403);
        }
        api.get("/financeiro/exportacao?de=" + hoje + "&ate=" + hoje, semFinanceiro, 403);

        JsonNode leitor = membro("Leitor financeiro", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        for (String rota : List.of("/financeiro/planos", "/financeiro/cobrancas", "/financeiro/numeros?meses=6",
                "/financeiro/painel", "/financeiro/inadimplentes", "/financeiro/lancamentos",
                "/alunos/" + aluno + "/contratacoes", "/alunos/" + aluno + "/cobrancas")) {
            api.get(rota, leitor, 200);
        }
        api.post("/financeiro/planos", leitor,
                Map.of("nome", "Não pode", "valorCentavos", 100, "periodicidade", "MENSAL"), 403);
        api.post("/alunos/" + aluno + "/contratacoes", leitor,
                Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", 5), 403);
        api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", leitor,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", 0), 403);
        api.post("/financeiro/lancamentos", leitor,
                Map.of("data", hoje.toString(), "descricao", "x", "valorCentavos", 1, "tipo", "ENTRADA"), 403);

        JsonNode gestor = membro("Gestor financeiro", Set.of("FINANCEIRO_ALTERAR", "FINANCEIRO_LER", "ALUNO_LER"));
        api.post("/financeiro/planos", gestor,
                Map.of("nome", "Do gestor " + UUID.randomUUID(), "valorCentavos", 100, "periodicidade", "MENSAL"), 200);

        JsonNode alunoLogado = api.convidarEEntrar(admin, aluno);
        api.get("/financeiro/planos", alunoLogado, 403);
        api.get("/financeiro/painel", alunoLogado, 403);
        api.post("/cobrancas/" + cobranca.get("id").asString() + "/cancelar", alunoLogado,
                Map.of("motivo", "x", "versao", 0), 403);
        api.get("/financeiro/planos", null, 401);
        api.get("/aluno/financeiro", admin, 403);
    }

    @Test
    void alunoVeSoOProprioFinanceiroSemTextoInternoDoTreinador() throws Exception {
        UUID alunoA = aluno();
        UUID alunoB = aluno();
        JsonNode plano = plano("Plano do aluno", 12000, "MENSAL");
        contratarHoje(alunoA, plano);
        JsonNode planoB = plano("Plano do outro", 99000, "TRIMESTRAL");
        contratarHoje(alunoB, planoB);
        JsonNode cobrancaA = cobrancas(alunoA).get(0);
        api.post("/cobrancas/" + cobrancaA.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "observacao", "Anotação interna fictícia",
                        "versao", cobrancaA.get("versao").asLong()), 200);

        JsonNode loginA = api.convidarEEntrar(admin, alunoA);
        JsonNode meu = api.get("/aluno/financeiro", loginA, 200);
        assertThat(meu.get("plano").get("valorCentavos").asLong()).isEqualTo(12000);
        assertThat(meu.get("plano").get("planoNome").asString()).startsWith("Plano do aluno");
        assertThat(meu.get("historico")).hasSize(1);
        assertThat(meu.get("abertas")).hasSize(1);
        String texto = meu.toString();
        assertThat(texto).doesNotContain("Anotação interna").doesNotContain("99000").doesNotContain("observacao")
                .doesNotContain("baixaPor").doesNotContain("motivo\"").doesNotContain("provedor").doesNotContain("alunoNome");

        JsonNode semPlano = api.convidarEEntrar(admin, aluno());
        JsonNode vazio = api.get("/aluno/financeiro", semPlano, 200);
        assertThat(nulo(vazio.get("plano"))).isTrue();
        assertThat(vazio.get("abertas")).isEmpty();

        var resposta = mvc.perform(MockMvcRequestBuilders.get("/aluno/financeiro")
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(loginA))).andReturn().getResponse();
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        // O aluno não tem rota para escolher o aluno nem para pagar.
        // Um alunoId na consulta é ignorado: a resposta é idêntica à do próprio aluno e não traz nada do outro.
        JsonNode comIdDoOutro = api.get("/aluno/financeiro?alunoId=" + alunoB, loginA, 200);
        assertThat(comIdDoOutro).isEqualTo(meu);
        assertThat(comIdDoOutro.get("plano").get("valorCentavos").asLong()).isEqualTo(12000);
        assertThat(comIdDoOutro.get("abertas")).hasSize(1);
        assertThat(comIdDoOutro.get("historico")).hasSize(1);
        assertThat(comIdDoOutro.toString()).doesNotContain("99000").doesNotContain("Plano do outro")
                .doesNotContain(cobrancas(alunoB).get(0).get("id").asString());
        api.post("/cobrancas/" + cobrancaA.get("id").asString() + "/baixa-manual", loginA,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", 0), 403);
    }

    // ---- contratação ----

    @Test
    void valorVemDoServidorEOCorpoComValorEIgnorado() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano de valor", 10000, "MENSAL");

        Map<String, Object> diferenteSemMotivo = new LinkedHashMap<>();
        diferenteSemMotivo.put("planoComercialId", plano.get("id").asString());
        diferenteSemMotivo.put("valorCentavos", 8000);
        diferenteSemMotivo.put("inicio", hoje.toString());
        diferenteSemMotivo.put("diaVencimento", hoje.getDayOfMonth());
        assertThat(codigo(api.post("/alunos/" + aluno + "/contratacoes", admin, diferenteSemMotivo, 422)))
                .isEqualTo("CONTRATACAO_INVALIDA");
        diferenteSemMotivo.put("motivoValor", "Desconto combinado fictício");
        JsonNode contratacao = api.post("/alunos/" + aluno + "/contratacoes", admin, diferenteSemMotivo, 200);
        assertThat(contratacao.get("valorCentavos").asLong()).isEqualTo(8000);
        assertThat(cobrancas(aluno).get(0).get("valorCentavos").asLong()).isEqualTo(8000);

        // Corpo da baixa com um valor inventado: o campo não existe no contrato e a cobrança mantém o valor.
        JsonNode cobranca = cobrancas(aluno).get(0);
        Map<String, Object> baixa = new HashMap<>();
        baixa.put("data", hoje.toString());
        baixa.put("forma", "DINHEIRO");
        baixa.put("versao", cobranca.get("versao").asLong());
        baixa.put("valorCentavos", 1);
        baixa.put("valorPagoCentavos", 1);
        JsonNode paga = api.post("/cobrancas/" + cobranca.get("id").asString() + "/baixa-manual", admin, baixa, 200);
        assertThat(paga.get("valorCentavos").asLong()).isEqualTo(8000);
        assertThat(jdbc.queryForObject("select valor_centavos from cobranca_aluno where id = ?::uuid", Long.class,
                cobranca.get("id").asString())).isEqualTo(8000L);

        UUID outro = aluno();
        JsonNode semValor = contratarHoje(outro, plano);
        assertThat(semValor.get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(nulo(semValor.get("motivoValor"))).isTrue();
    }

    @Test
    void contratarConferePeriodoEDiaEUmaContratacaoVigenteSo() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano de regras", 10000, "MENSAL");
        for (int dia : new int[] {0, 32}) {
            api.post("/alunos/" + aluno + "/contratacoes", admin,
                    Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", dia), 400);
        }
        assertThat(codigo(api.post("/alunos/" + aluno + "/contratacoes", admin, Map.of("planoComercialId",
                plano.get("id").asString(), "inicio", hoje.minusYears(11).toString(), "diaVencimento", 5), 422)))
                .isEqualTo("CONTRATACAO_INVALIDA");
        assertThat(codigo(api.post("/alunos/" + aluno + "/contratacoes", admin, Map.of("planoComercialId",
                plano.get("id").asString(), "inicio", hoje.plusYears(2).toString(), "diaVencimento", 5), 422)))
                .isEqualTo("CONTRATACAO_INVALIDA");

        JsonNode contratacao = contratarHoje(aluno, plano);
        assertThat(contratacao.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(auditorias("CONTRATACAO_CRIADA", contratacao.get("id").asString())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'CONTRATACAO_CRIADA' and entidade_id = ?::uuid",
                String.class, contratacao.get("id").asString())).isEqualTo("Contratou um plano comercial para um aluno.");
        assertThat(codigo(api.post("/alunos/" + aluno + "/contratacoes", admin, Map.of("planoComercialId",
                plano.get("id").asString(), "inicio", hoje.toString(), "diaVencimento", 5), 409))).isEqualTo("CONTRATACAO_VIGENTE");
        assertThat(cobrancas(aluno)).hasSize(1);

        JsonNode encerrada = api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin,
                Map.of("versao", contratacao.get("versao").asLong()), 200);
        assertThat(encerrada.get("situacao").asString()).isEqualTo("ENCERRADA");
        api.post("/contratacoes/" + contratacao.get("id").asString() + "/encerrar", admin,
                Map.of("versao", 999), 200);
        assertThat(auditorias("CONTRATACAO_ENCERRADA", contratacao.get("id").asString())).isEqualTo(1);
        assertThat(codigo(api.post("/contratacoes/" + contratacao.get("id").asString() + "/pausar", admin,
                Map.of("versao", encerrada.get("versao").asLong()), 409))).isEqualTo("CONTRATACAO_ENCERRADA");
        contratarHoje(aluno, plano);
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200)).hasSize(2);
    }

    @Test
    void duasContratacoesAoMesmoTempoDeixamUmaSo() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano da corrida", 10000, "MENSAL");
        Map<String, Object> corpo = Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(),
                "diaVencimento", hoje.getDayOfMonth());
        String texto = json.writeValueAsString(corpo);
        Callable<Integer> contratar = () -> mvc.perform(MockMvcRequestBuilders.post("/alunos/" + aluno + "/contratacoes")
                .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                .contentType(MediaType.APPLICATION_JSON).content(texto)).andReturn().getResponse().getStatus();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> futuros = pool.invokeAll(List.of(contratar, contratar));
            List<Integer> status = new ArrayList<>();
            for (Future<Integer> f : futuros) {
                status.add(f.get());
            }
            assertThat(status).containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from contratacao_aluno where aluno_id = ?::uuid and situacao <> 'ENCERRADA'",
                Integer.class, aluno.toString())).isEqualTo(1);
        assertThat(cobrancas(aluno)).hasSize(1);
    }

    @Test
    void alunoInativoEAnonimizadoNaoContratam() throws Exception {
        UUID inativo = aluno();
        JsonNode plano = plano("Plano de aluno que saiu", 10000, "MENSAL");
        api.patch("/alunos/" + inativo + "/situacao", admin, Map.of("ativo", false), 200);
        Map<String, Object> corpo = Map.of("planoComercialId", plano.get("id").asString(), "inicio", hoje.toString(),
                "diaVencimento", 5);
        assertThat(codigo(api.post("/alunos/" + inativo + "/contratacoes", admin, corpo, 409))).isEqualTo("ALUNO_INATIVO");

        UUID anonimizado = api.criarAluno(admin, "Maria Fictícia Anonimizada");
        api.patch("/alunos/" + anonimizado + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + anonimizado + "/anonimizar", admin, Map.of("nomeConfirmado", "Maria Fictícia Anonimizada"), 200);
        assertThat(codigo(api.post("/alunos/" + anonimizado + "/contratacoes", admin, corpo, 409))).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(jdbc.queryForObject("select count(*) from contratacao_aluno where aluno_id = ?::uuid", Integer.class,
                anonimizado.toString())).isZero();
    }

    @Test
    void alterarAtualizaSoAsAbertasQueNaoVenceram() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano de alteração", 10000, "MENSAL");
        JsonNode contratacao = contratarHoje(aluno, plano);
        String id = contratacao.get("id").asString();

        Map<String, Object> semMotivo = new LinkedHashMap<>();
        semMotivo.put("valorCentavos", 12000);
        semMotivo.put("diaVencimento", hoje.getDayOfMonth());
        semMotivo.put("versao", contratacao.get("versao").asLong());
        assertThat(codigo(api.put("/contratacoes/" + id, admin, semMotivo, 422))).isEqualTo("CONTRATACAO_INVALIDA");

        semMotivo.put("motivoValor", "Acerto fictício");
        JsonNode alterada = api.put("/contratacoes/" + id, admin, semMotivo, 200);
        assertThat(alterada.get("valorCentavos").asLong()).isEqualTo(12000);
        assertThat(cobrancas(aluno).get(0).get("valorCentavos").asLong()).isEqualTo(12000);
        assertThat(auditorias("CONTRATACAO_ALTERADA", id)).isEqualTo(1);
        assertThat(codigo(api.put("/contratacoes/" + id, admin, semMotivo, 409))).isEqualTo("CONFLITO_EDICAO");

        // A cobrança vence (data mudada no banco): a edição seguinte não a toca.
        jdbc.update("update cobranca_aluno set vencimento = ?::date where contratacao_id = ?::uuid", hoje.minusDays(5).toString(), id);
        Map<String, Object> outra = new LinkedHashMap<>();
        outra.put("valorCentavos", 13000);
        outra.put("motivoValor", "Outro acerto fictício");
        outra.put("diaVencimento", 20);
        outra.put("versao", alterada.get("versao").asLong());
        api.put("/contratacoes/" + id, admin, outra, 200);
        JsonNode vencida = cobrancas(aluno).get(0);
        assertThat(vencida.get("valorCentavos").asLong()).isEqualTo(12000);
        assertThat(vencida.get("vencimento").asString()).isEqualTo(hoje.minusDays(5).toString());

        // Valor de volta ao do plano: o motivo some.
        JsonNode atual = api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0);
        JsonNode igual = api.put("/contratacoes/" + id, admin, Map.of("valorCentavos", 10000, "diaVencimento", 20,
                "versao", atual.get("versao").asLong()), 200);
        assertThat(nulo(igual.get("motivoValor"))).isTrue();
    }

    // ---- cobranças ----

    @Test
    void baixaManualEIdempotenteConferePeriodoEVersao() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano da baixa", 10000, "MENSAL"));
        JsonNode aberta = cobrancas(aluno).get(0);
        String id = aberta.get("id").asString();

        baixar(aberta, hoje.plusDays(1), 422);
        baixar(aberta, LocalDate.of(1999, 12, 31), 422);
        api.post("/cobrancas/" + id + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "PIX", "versao", aberta.get("versao").asLong()), 422);
        api.post("/cobrancas/" + id + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", aberta.get("versao").asLong() + 7), 409);

        JsonNode paga = baixar(aberta, hoje, 200);
        assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(paga.get("pagoEm").asString()).isEqualTo(hoje.toString());
        assertThat(paga.get("provedor").asString()).isEqualTo("MANUAL");
        assertThat(paga.get("versao").asLong()).isGreaterThan(aberta.get("versao").asLong());
        assertThat(paga.get("vencida").asBoolean()).isFalse();

        // Repetir (mesmo com a versão velha) devolve o estado atual e não duplica a auditoria nem a cobrança seguinte.
        JsonNode repetida = baixar(aberta, hoje, 200);
        assertThat(repetida.get("versao").asLong()).isEqualTo(paga.get("versao").asLong());
        assertThat(auditorias("PAGAMENTO_MANUAL_REGISTRADO", id)).isEqualTo(1);
        assertThat(cobrancas(aluno)).hasSize(2);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'PAGAMENTO_MANUAL_REGISTRADO' and entidade_id = ?::uuid",
                String.class, id)).isEqualTo("Registrou o pagamento de uma cobrança.");

        // Cancelar uma cobrança paga não vale.
        assertThat(codigo(motivo("/cobrancas/" + id + "/cancelar", paga, 409))).isEqualTo("COBRANCA_NAO_ABERTA");
    }

    @Test
    void desfazerBaixaVoltaParaAbertaEExigeMotivoEBaixaManual() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano do desfazer", 10000, "MENSAL"));
        JsonNode aberta = cobrancas(aluno).get(0);
        String id = aberta.get("id").asString();

        // Desfazer em cobrança que não está paga não muda nada.
        JsonNode semMudar = motivo("/cobrancas/" + id + "/desfazer-baixa", aberta, 200);
        assertThat(semMudar.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(auditorias("COBRANCA_BAIXA_DESFEITA", id)).isZero();

        JsonNode paga = baixar(aberta, hoje, 200);
        api.post("/cobrancas/" + id + "/desfazer-baixa", admin, Map.of("versao", paga.get("versao").asLong()), 400);
        api.post("/cobrancas/" + id + "/desfazer-baixa", admin, Map.of("motivo", "  ", "versao", paga.get("versao").asLong()), 400);
        api.post("/cobrancas/" + id + "/desfazer-baixa", admin, Map.of("motivo", "Erro", "versao", paga.get("versao").asLong() + 5), 409);

        JsonNode reaberta = motivo("/cobrancas/" + id + "/desfazer-baixa", paga, 200);
        assertThat(reaberta.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(nulo(reaberta.get("pagoEm"))).isTrue();
        assertThat(nulo(reaberta.get("forma"))).isTrue();
        assertThat(auditorias("COBRANCA_BAIXA_DESFEITA", id)).isEqualTo(1);

        // Baixa que não é manual não se desfaz por aqui.
        JsonNode denovo = baixar(reaberta, hoje, 200);
        jdbc.update("update cobranca_aluno set provedor = 'OUTRO_PROVEDOR' where id = ?::uuid", id);
        assertThat(codigo(motivo("/cobrancas/" + id + "/desfazer-baixa", denovo, 409))).isEqualTo("BAIXA_NAO_MANUAL");
    }

    @Test
    void cancelarSoCobrancaAbertaEPulaOPeriodo() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano do cancelar", 10000, "MENSAL"));
        JsonNode primeira = cobrancas(aluno).get(0);
        String id = primeira.get("id").asString();

        JsonNode cancelada = motivo("/cobrancas/" + id + "/cancelar", primeira, 200);
        assertThat(cancelada.get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(cancelada.get("motivo").asString()).isEqualTo("Motivo fictício");
        // A seguinte nasce quando a última é cancelada.
        assertThat(cobrancas(aluno)).hasSize(2);
        // Repetir devolve o mesmo estado, sem nova auditoria nem nova cobrança.
        motivo("/cobrancas/" + id + "/cancelar", primeira, 200);
        assertThat(auditorias("COBRANCA_CANCELADA", id)).isEqualTo(1);
        assertThat(cobrancas(aluno)).hasSize(2);
        api.post("/cobrancas/" + id + "/cancelar", admin, Map.of("versao", 0), 400);
        // Uma cobrança cancelada não recebe baixa.
        assertThat(codigo(baixar(cancelada, hoje, 409))).isEqualTo("COBRANCA_NAO_ABERTA");
    }

    @Test
    void vencidaECalculadaPelaDataENuncaGravada() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratarHoje(aluno, plano("Plano da vencida", 10000, "MENSAL"));
        JsonNode aberta = cobrancas(aluno).get(0);
        assertThat(aberta.get("vencida").asBoolean()).isFalse();
        assertThat(nulo(aberta.get("diasDeAtraso"))).isTrue();

        jdbc.update("update cobranca_aluno set vencimento = ?::date where contratacao_id = ?::uuid",
                hoje.minusDays(3).toString(), contratacao.get("id").asString());
        JsonNode vencida = cobrancas(aluno).get(0);
        assertThat(vencida.get("vencida").asBoolean()).isTrue();
        assertThat(vencida.get("diasDeAtraso").asLong()).isEqualTo(3);
        assertThat(vencida.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(jdbc.queryForObject("select situacao from cobranca_aluno where id = ?::uuid", String.class,
                vencida.get("id").asString())).isEqualTo("ABERTA");

        assertThat(api.get("/financeiro/cobrancas?situacao=VENCIDA", admin, 200).get("itens")).hasSize(1);
        assertThat(api.get("/financeiro/cobrancas?situacao=ABERTA", admin, 200).get("itens")).hasSize(1);
        assertThat(api.get("/financeiro/cobrancas?situacao=PAGA", admin, 200).get("itens")).isEmpty();
        api.get("/financeiro/cobrancas?situacao=INVENTADA", admin, 400);
        api.get("/financeiro/cobrancas?de=" + hoje + "&ate=" + hoje.minusDays(1), admin, 400);
        assertThat(api.get("/financeiro/cobrancas?de=" + hoje.minusDays(3) + "&ate=" + hoje.minusDays(3), admin, 200)
                .get("itens")).hasSize(1);

        JsonNode inadimplentes = api.get("/financeiro/inadimplentes", admin, 200);
        assertThat(inadimplentes.get("itens")).hasSize(1);
        assertThat(inadimplentes.get("itens").get(0).get("diasDeAtraso").asLong()).isEqualTo(3);
        assertThat(inadimplentes.get("valorTotalCentavos").asLong()).isEqualTo(10000);

        // Paga, deixa de ser vencida.
        baixar(vencida, hoje, 200);
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens")).isEmpty();
    }

    // ---- próxima cobrança e datas ----

    @Test
    void proximaCobrancaNascePorUltimaPagaSemDuplicarNemComDesfazerEPagarDeNovo() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratarHoje(aluno, plano("Plano da sequência", 10000, "MENSAL"));
        JsonNode primeira = cobrancas(aluno).get(0);
        assertThat(primeira.get("competencia").asString()).isEqualTo(hoje.toString());

        JsonNode paga = baixar(primeira, hoje, 200);
        assertThat(cobrancas(aluno)).hasSize(2);
        assertThat(cobrancas(aluno).get(0).get("competencia").asString()).isEqualTo(hoje.plusMonths(1).toString());
        baixar(primeira, hoje, 200);
        assertThat(cobrancas(aluno)).hasSize(2);

        JsonNode reaberta = motivo("/cobrancas/" + primeira.get("id").asString() + "/desfazer-baixa", paga, 200);
        baixar(reaberta, hoje, 200);
        assertThat(cobrancas(aluno)).as("desfazer e pagar de novo não cria outra").hasSize(2);

        // Pular o período: cancelar a última gera a seguinte.
        JsonNode segunda = cobrancas(aluno).get(0);
        motivo("/cobrancas/" + segunda.get("id").asString() + "/cancelar", segunda, 200);
        JsonNode todas = cobrancas(aluno);
        assertThat(todas).hasSize(3);
        assertThat(todas.get(0).get("competencia").asString()).isEqualTo(hoje.plusMonths(2).toString());
        assertThat(todas.get(0).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(todas.get(1).get("situacao").asString()).isEqualTo("CANCELADA");

        // Pagar uma cobrança que não é a última não gera nada.
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where contratacao_id = ?::uuid", Integer.class,
                contratacao.get("id").asString())).isEqualTo(3);
        exigirSeguinteAberta(aluno);
    }

    @Test
    void pausarRetomarEParcelaUnica() throws Exception {
        UUID aluno = aluno();
        JsonNode contratacao = contratarHoje(aluno, plano("Plano da pausa", 10000, "MENSAL"));
        String id = contratacao.get("id").asString();
        JsonNode primeira = cobrancas(aluno).get(0);

        JsonNode pausada = api.post("/contratacoes/" + id + "/pausar", admin, Map.of("versao", contratacao.get("versao").asLong()), 200);
        assertThat(pausada.get("situacao").asString()).isEqualTo("PAUSADA");
        api.post("/contratacoes/" + id + "/pausar", admin, Map.of("versao", 999), 200);
        assertThat(auditorias("CONTRATACAO_PAUSADA", id)).isEqualTo(1);

        // Pausada: pagar a última não gera a seguinte.
        baixar(primeira, hoje, 200);
        assertThat(cobrancas(aluno)).hasSize(1);

        JsonNode retomada = api.post("/contratacoes/" + id + "/retomar", admin, Map.of("versao", pausada.get("versao").asLong()), 200);
        assertThat(retomada.get("situacao").asString()).isEqualTo("ATIVA");
        assertThat(cobrancas(aluno)).hasSize(2);
        exigirSeguinteAberta(aluno);
        api.post("/contratacoes/" + id + "/retomar", admin, Map.of("versao", 999), 200);
        assertThat(cobrancas(aluno)).hasSize(2);
        assertThat(auditorias("CONTRATACAO_RETOMADA", id)).isEqualTo(1);

        // Retomar com uma cobrança aberta já existente não cria outra.
        JsonNode aberta = api.post("/contratacoes/" + id + "/pausar", admin, Map.of("versao", retomada.get("versao").asLong()), 200);
        api.post("/contratacoes/" + id + "/retomar", admin, Map.of("versao", aberta.get("versao").asLong()), 200);
        assertThat(cobrancas(aluno)).hasSize(2);

        UUID unico = aluno();
        JsonNode parcela = contratarHoje(unico, plano("Plano único", 50000, "PARCELA_UNICA"));
        JsonNode cobranca = cobrancas(unico).get(0);
        baixar(cobranca, hoje, 200);
        assertThat(cobrancas(unico)).hasSize(1);
        assertThat(api.get("/alunos/" + unico + "/contratacoes", admin, 200).get(0).get("situacao").asString())
                .isEqualTo("ENCERRADA");
        assertThat(parcela.get("periodicidade").asString()).isEqualTo("PARCELA_UNICA");
    }

    // ---- retomar não sobrepõe período pago ----

    private JsonNode pausar(JsonNode contratacao) throws Exception {
        return api.post("/contratacoes/" + contratacao.get("id").asString() + "/pausar", admin,
                Map.of("versao", contratacao.get("versao").asLong()), 200);
    }

    private JsonNode retomar(JsonNode pausada) throws Exception {
        return api.post("/contratacoes/" + pausada.get("id").asString() + "/retomar", admin,
                Map.of("versao", pausada.get("versao").asLong()), 200);
    }

    /** As competências das cobranças do aluno, da mais nova para a mais antiga, em texto ISO. */
    private List<String> competencias(UUID aluno) throws Exception {
        List<String> lista = new ArrayList<>();
        cobrancas(aluno).forEach(c -> lista.add(c.get("competencia").asString()));
        return lista;
    }

    /** Invariante: contratação ATIVA e recorrente sempre tem a cobrança de maior competência ABERTA (não há agendador). */
    private void exigirSeguinteAberta(UUID aluno) throws Exception {
        JsonNode maior = cobrancas(aluno).get(0);
        assertThat(maior.get("situacao").asString()).as("a de maior competência (%s) deve estar ABERTA",
                maior.get("competencia").asString()).isEqualTo("ABERTA");
    }

    private JsonNode contratacaoDe(UUID aluno) throws Exception {
        return api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0);
    }

    private LocalDate ancoraDe(JsonNode contratacao) {
        return jdbc.queryForObject("select ancora from contratacao_aluno where id = ?::uuid", LocalDate.class,
                contratacao.get("id").asString());
    }

    @Test
    void retomarTrimestralPagoPulaParaOFimDoPeriodoPagoSemDuplicarNemCobrarOsMesesPausados() throws Exception {
        UUID aluno = aluno();
        // O cenário do treinador: início em 1/10, paga a 1ª, pausa em 15/10 e retoma em 1/11 (aqui: início há 31 dias).
        LocalDate inicio = hoje.minusDays(31);
        LocalDate seguinte = inicio.plusMonths(3);
        JsonNode contratacao = contratar(aluno, plano("Plano trimestral da retomada", 30000, "TRIMESTRAL"), inicio, 10);
        baixar(cobrancas(aluno).get(0), hoje, 200);
        // Pagar a 1ª já gera a seguinte, aberta.
        assertThat(competencias(aluno)).containsExactly(seguinte.toString(), inicio.toString());

        JsonNode pausada = pausar(contratacao);
        JsonNode retomada = retomar(pausada);
        assertThat(retomada.get("situacao").asString()).isEqualTo("ATIVA");

        // A âncora vai para o dia seguinte ao fim do período da última não cancelada (a aberta `seguinte`), não para hoje.
        assertThat(ancoraDe(contratacao)).isEqualTo(seguinte.plusMonths(3));
        assertThat(competencias(aluno)).as("exatamente uma de %s e nenhuma nos meses parados", seguinte)
                .containsExactly(seguinte.toString(), inicio.toString());
        for (int meses = 1; meses <= 2; meses++) {
            assertThat(competencias(aluno)).doesNotContain(inicio.plusMonths(meses).toString());
        }
        assertThat(competencias(aluno)).doesNotContain(hoje.toString(), hoje.plusMonths(1).toString());
        JsonNode aberta = porCompetencia(aluno, seguinte);
        assertThat(aberta.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(aberta.get("vencimento").asString()).isEqualTo(CalendarioDeCobranca.vencimento(seguinte, 10, null).toString());
        assertThat(LocalDate.parse(aberta.get("vencimento").asString())).isAfterOrEqualTo(seguinte);
        assertThat(porCompetencia(aluno, inicio).get("situacao").asString()).isEqualTo("PAGA");

        // Repetir não muda nada; e a seguinte, depois de paga, continua a grade a partir da nova âncora.
        retomar(retomada);
        assertThat(competencias(aluno)).hasSize(2);
        assertThat(auditorias("CONTRATACAO_RETOMADA", contratacao.get("id").asString())).isEqualTo(1);
        baixar(porCompetencia(aluno, seguinte), hoje, 200);
        assertThat(competencias(aluno)).containsExactly(seguinte.plusMonths(3).toString(), seguinte.toString(), inicio.toString());
        exigirSeguinteAberta(aluno);
    }

    @Test
    void retomarComAAbertaCanceladaAntesDaPausaMantemOPisoEAUnicidadeDaCompetencia() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusDays(31);
        LocalDate pulada = inicio.plusMonths(3);
        LocalDate seguinte = inicio.plusMonths(6);
        JsonNode contratacao = contratar(aluno, plano("Plano trimestral do pulo", 30000, "TRIMESTRAL"), inicio, 10);
        baixar(cobrancas(aluno).get(0), hoje, 200);
        // Cancelar a aberta (pular o período) gera a seguinte: pulada CANCELADA e inicio+6 meses ABERTA.
        motivo("/cobrancas/" + porCompetencia(aluno, pulada).get("id").asString() + "/cancelar", porCompetencia(aluno, pulada), 200);
        assertThat(competencias(aluno)).containsExactly(seguinte.toString(), pulada.toString(), inicio.toString());

        retomar(pausar(contratacao));

        // Piso = fim do período da aberta `seguinte` (a última não cancelada); a pulada continua ocupando a competência e
        // nada nasce dentro de período pago ou aberto.
        assertThat(ancoraDe(contratacao)).isEqualTo(seguinte.plusMonths(3));
        assertThat(competencias(aluno)).containsExactly(seguinte.toString(), pulada.toString(), inicio.toString());
        assertThat(porCompetencia(aluno, pulada).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(porCompetencia(aluno, seguinte).get("situacao").asString()).isEqualTo("ABERTA");
    }

    @Test
    void retomarSemAbertaComACanceladaOcupandoOPisoGeraAProximaDaGrade() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusDays(31);
        LocalDate pulada = inicio.plusMonths(3);
        LocalDate seguinte = inicio.plusMonths(6);
        JsonNode contratacao = contratar(aluno, plano("Plano trimestral cancelado pausado", 30000, "TRIMESTRAL"), inicio, 10);
        baixar(cobrancas(aluno).get(0), hoje, 200);
        JsonNode pausada = pausar(contratacao);
        // Pausada, cancelar a aberta não gera a seguinte: ao retomar, não há aberta e a conta precisa gerar uma.
        motivo("/cobrancas/" + porCompetencia(aluno, pulada).get("id").asString() + "/cancelar", porCompetencia(aluno, pulada), 200);
        assertThat(competencias(aluno)).containsExactly(pulada.toString(), inicio.toString());

        retomar(pausada);

        // max(hoje, fim do pago) = `pulada`, mas ela já existe (cancelada, ainda ocupa): vem a seguinte, nunca dentro do período pago.
        assertThat(ancoraDe(contratacao)).isEqualTo(pulada);
        assertThat(competencias(aluno)).containsExactly(seguinte.toString(), pulada.toString(), inicio.toString());
        JsonNode nova = porCompetencia(aluno, seguinte);
        assertThat(nova.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(nova.get("vencimento").asString()).isEqualTo(CalendarioDeCobranca.vencimento(seguinte, 10, null).toString());
        assertThat(porCompetencia(aluno, pulada).get("situacao").asString()).isEqualTo("CANCELADA");
    }

    @Test
    void retomarMensalSemNenhumaPagaContinuaGerandoAPartirDeHoje() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = hoje.minusMonths(2);
        JsonNode contratacao = contratar(aluno, plano("Plano mensal sem paga", 10000, "MENSAL"), inicio, hoje.getDayOfMonth());
        JsonNode primeira = cobrancas(aluno).get(0);
        JsonNode pausada = pausar(contratacao);
        motivo("/cobrancas/" + primeira.get("id").asString() + "/cancelar", primeira, 200);
        assertThat(competencias(aluno)).containsExactly(inicio.toString());

        retomar(pausada);

        // Sem PAGA, o comportamento é o de sempre: âncora = hoje e a competência nova é hoje.
        assertThat(ancoraDe(contratacao)).isEqualTo(hoje);
        assertThat(competencias(aluno)).containsExactly(hoje.toString(), inicio.toString());
        JsonNode nova = porCompetencia(aluno, hoje);
        assertThat(nova.get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(nova.get("vencimento").asString()).isEqualTo(hoje.toString());
    }

    @Test
    void retomarComAAbertaNaoGeraCobrancaNoMesmoPeriodoDaAberta() throws Exception {
        UUID aluno = aluno();
        // Início há um mês e 5 dias: a 2ª competência (aberta) já passou, como 10/02 retomado em 15/02.
        LocalDate inicio = hoje.minusMonths(1).minusDays(5);
        LocalDate aberta = inicio.plusMonths(1);
        JsonNode contratacao = contratar(aluno, plano("Plano mensal da retomada com aberta", 10000, "MENSAL"), inicio,
                hoje.getDayOfMonth());
        baixar(cobrancas(aluno).get(0), hoje, 200);
        assertThat(competencias(aluno)).containsExactly(aberta.toString(), inicio.toString());

        retomar(pausar(contratacao));

        // Já existe a aberta: nada nasce, e a âncora vai para depois do período dela (não para hoje).
        assertThat(competencias(aluno)).containsExactly(aberta.toString(), inicio.toString());
        assertThat(ancoraDe(contratacao)).isEqualTo(aberta.plusMonths(1));
        exigirSeguinteAberta(aluno);

        baixar(porCompetencia(aluno, aberta), hoje, 200);

        List<LocalDate> ordem = new ArrayList<>();
        competencias(aluno).forEach(c -> ordem.add(0, LocalDate.parse(c)));
        assertThat(ordem).containsExactly(inicio, aberta, aberta.plusMonths(1));
        for (int i = 0; i < ordem.size(); i++) {
            for (int j = i + 1; j < ordem.size(); j++) {
                assertThat(ordem.get(j)).as("%s não pode cair dentro do período de %s", ordem.get(j), ordem.get(i))
                        .isAfterOrEqualTo(ordem.get(i).plusMonths(1));
            }
        }
        exigirSeguinteAberta(aluno);
    }

    @Test
    void contratacaoAtivaNuncaFicaSemCobrancaFuturaMesmoDesfazendoBaixaAntigaEPausando() throws Exception {
        UUID aluno = aluno();
        // jan, fev e mar são as três primeiras competências; mar cai em hoje.
        LocalDate jan = hoje.minusMonths(2);
        LocalDate fev = jan.plusMonths(1);
        LocalDate mar = jan.plusMonths(2);
        JsonNode contratacao = contratar(aluno, plano("Plano mensal da sequência torta", 10000, "MENSAL"), jan,
                hoje.getDayOfMonth());
        baixar(porCompetencia(aluno, jan), hoje, 200);
        baixar(porCompetencia(aluno, fev), hoje, 200);
        assertThat(competencias(aluno)).containsExactly(mar.toString(), fev.toString(), jan.toString());

        // Desfaz a baixa de jan: abertas jan e mar. Pausa e paga mar (pausada não gera).
        motivo("/cobrancas/" + porCompetencia(aluno, jan).get("id").asString() + "/desfazer-baixa",
                porCompetencia(aluno, jan), 200);
        JsonNode pausada = pausar(contratacao);
        baixar(porCompetencia(aluno, mar), hoje, 200);
        assertThat(competencias(aluno)).hasSize(3);

        // Retomar e pagar jan: a de maior competência não pode ficar paga sem uma aberta depois dela.
        retomar(pausada);
        baixar(porCompetencia(aluno, jan), hoje, 200);

        assertThat(contratacaoDe(aluno).get("situacao").asString()).isEqualTo("ATIVA");
        exigirSeguinteAberta(aluno);
        JsonNode maior = cobrancas(aluno).get(0);
        assertThat(LocalDate.parse(maior.get("competencia").asString())).isAfter(mar);
        assertThat(competencias(aluno)).doesNotHaveDuplicates();
    }

    @Test
    void parcelaUnicaPagaNaoSeDesfazEACanceladaEncerraAContratacao() throws Exception {
        UUID aluno = aluno();
        JsonNode plano = plano("Plano único do desfazer", 50000, "PARCELA_UNICA");
        contratarHoje(aluno, plano);
        JsonNode paga = baixar(cobrancas(aluno).get(0), hoje, 200);
        assertThat(contratacaoDe(aluno).get("situacao").asString()).isEqualTo("ENCERRADA");

        JsonNode erro = motivo("/cobrancas/" + paga.get("id").asString() + "/desfazer-baixa", paga, 409);
        assertThat(codigo(erro)).isEqualTo("PARCELA_UNICA_ENCERRADA");
        assertThat(cobrancas(aluno).get(0).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(contratacaoDe(aluno).get("situacao").asString()).isEqualTo("ENCERRADA");

        // Cancelar a única cobrança encerra a contratação e libera uma nova (antes ficava ATIVA para sempre).
        UUID outro = aluno();
        contratarHoje(outro, plano);
        JsonNode unica = cobrancas(outro).get(0);
        motivo("/cobrancas/" + unica.get("id").asString() + "/cancelar", unica, 200);
        assertThat(contratacaoDe(outro).get("situacao").asString()).isEqualTo("ENCERRADA");
        assertThat(cobrancas(outro)).hasSize(1);
        JsonNode nova = contratarHoje(outro, plano);
        assertThat(nova.get("situacao").asString()).isEqualTo("ATIVA");
    }

    @Test
    void respostasDeCriacaoTrazemCriadoEm() throws Exception {
        JsonNode plano = plano("Plano do criadoEm", 10000, "MENSAL");
        assertThat(nulo(plano.get("criadoEm"))).as("plano").isFalse();
        JsonNode contratacao = contratarHoje(aluno(), plano);
        assertThat(nulo(contratacao.get("criadoEm"))).as("contratação").isFalse();
        JsonNode lancamento = api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Material",
                "valorCentavos", 100, "tipo", "SAIDA"), 200);
        assertThat(nulo(lancamento.get("criadoEm"))).as("lançamento").isFalse();
    }

    @Test
    void competenciasSeguemAAncoraEODia31VaiAoUltimoDiaDoMes() throws Exception {
        UUID aluno = aluno();
        LocalDate inicio = LocalDate.of(hoje.getYear() - 1, 1, 31);
        contratar(aluno, plano("Plano do fim de mês", 10000, "MENSAL"), inicio, 31);
        for (int i = 0; i < 3; i++) {
            baixar(cobrancas(aluno).get(0), hoje, 200);
        }
        JsonNode todas = cobrancas(aluno);
        assertThat(todas).hasSize(4);
        for (int n = 0; n < 4; n++) {
            LocalDate competencia = inicio.plusMonths(n);
            JsonNode c = porCompetencia(aluno, competencia);
            // O dia 31 em mês curto vai para o último dia (28/29 em fevereiro, 30 em abril), sem encadear datas.
            assertThat(c.get("vencimento").asString()).isEqualTo(YearMonth.from(competencia).atEndOfMonth().toString());
        }
        assertThat(porCompetencia(aluno, LocalDate.of(inicio.getYear(), 3, 31))).isNotNull();
        assertThat(porCompetencia(aluno, LocalDate.of(inicio.getYear(), 4, 30)).get("vencimento").asString())
                .isEqualTo(LocalDate.of(inicio.getYear(), 4, 30).toString());
        exigirSeguinteAberta(aluno);
    }

    // ---- aluno que sai ----

    @Test
    void alunoQueSaiEncerraAContratacaoECancelaAsAbertas() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano de quem sai", 10000, "MENSAL"));
        baixar(cobrancas(aluno).get(0), hoje, 200);
        assertThat(cobrancas(aluno)).hasSize(2);

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        JsonNode depois = cobrancas(aluno);
        assertThat(depois.get(0).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(depois.get(0).get("motivo").asString()).isEqualTo("Aluno saiu da consultoria.");
        assertThat(depois.get(1).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(api.get("/alunos/" + aluno + "/contratacoes", admin, 200).get(0).get("situacao").asString())
                .isEqualTo("ENCERRADA");

        // Reativado, pode contratar de novo.
        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", true), 200);
        contratarHoje(aluno, plano("Plano de volta", 10000, "MENSAL"));
        assertThat(cobrancas(aluno)).hasSize(3);

        // O desativar em lote faz o mesmo.
        UUID outro = aluno();
        contratarHoje(outro, plano("Plano do lote", 10000, "MENSAL"));
        api.post("/alunos/lote/desativar", admin, Map.of("alunoIds", List.of(outro)), 200);
        assertThat(cobrancas(outro).get(0).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(api.get("/alunos/" + outro + "/contratacoes", admin, 200).get(0).get("situacao").asString())
                .isEqualTo("ENCERRADA");
    }

    @Test
    void alunoQueSaiuNaoTemMaisBaixaDesfeitaNemCobrancaMexida() throws Exception {
        String nome = "Rita Fictícia Que Saiu";
        UUID aluno = api.criarAluno(admin, nome);
        JsonNode contratacao = contratarHoje(aluno, plano("Plano de quem saiu", 10000, "MENSAL"));
        JsonNode primeira = cobrancas(aluno).get(0);
        JsonNode paga = baixar(primeira, hoje, 200);
        String id = paga.get("id").asString();

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        assertThat(codigo(motivo("/cobrancas/" + id + "/desfazer-baixa", paga, 409))).isEqualTo("ALUNO_INATIVO");
        assertThat(codigo(baixar(cobrancas(aluno).get(0), hoje, 409))).isEqualTo("ALUNO_INATIVO");
        assertThat(codigo(api.post("/contratacoes/" + contratacao.get("id").asString() + "/pausar", admin,
                Map.of("versao", 0), 409))).isEqualTo("ALUNO_INATIVO");
        assertThat(porCompetencia(aluno, hoje).get("situacao").asString()).isEqualTo("PAGA");

        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);
        assertThat(codigo(motivo("/cobrancas/" + id + "/desfazer-baixa", paga, 409))).isEqualTo("ALUNO_ANONIMIZADO");
        assertThat(porCompetencia(aluno, hoje).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(api.get("/financeiro/inadimplentes", admin, 200).get("itens")).isEmpty();
    }

    @Test
    void alunoQueExcluiAPropriaContaEncerraAContratacaoEApagaOTextoLivre() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano de quem exclui a conta", 10000, "MENSAL"));
        JsonNode primeira = cobrancas(aluno).get(0);
        api.post("/cobrancas/" + primeira.get("id").asString() + "/baixa-manual", admin, Map.of("data", hoje.toString(),
                "forma", "OUTRO", "observacao", "Observação fictícia", "versao", primeira.get("versao").asLong()), 200);
        JsonNode segunda = cobrancas(aluno).get(0);
        assertThat(segunda.get("situacao").asString()).isEqualTo("ABERTA");

        JsonNode login = api.convidarEEntrar(admin, aluno);
        api.post("/aluno/conta/excluir", login, Map.of("senha", ApiDeTeste.SENHA, "confirmacao", "EXCLUIR"), 204);

        assertThat(jdbc.queryForObject("select count(*) from contratacao_aluno where aluno_id = ?::uuid and situacao <> 'ENCERRADA'",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and situacao = 'ABERTA'",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and (observacao is not null or motivo is not null)",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and situacao = 'PAGA'",
                Integer.class, aluno.toString())).isEqualTo(1);
    }

    @Test
    void exportacaoTrazOFinanceiroEAnonimizarApagaOTextoLivreMasMantemOsValores() throws Exception {
        String nome = "Joana Fictícia Financeira";
        UUID aluno = api.criarAluno(admin, nome);
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("planoComercialId", plano("Plano exportado", 10000, "MENSAL").get("id").asString());
        corpo.put("valorCentavos", 9000);
        corpo.put("motivoValor", "Desconto fictício de amigo");
        corpo.put("inicio", hoje.toString());
        corpo.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", admin, corpo, 200);
        JsonNode primeira = cobrancas(aluno).get(0);
        api.post("/cobrancas/" + primeira.get("id").asString() + "/baixa-manual", admin, Map.of("data", hoje.toString(),
                "forma", "TRANSFERENCIA", "observacao", "Observação fictícia da baixa", "versao", primeira.get("versao").asLong()), 200);

        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", admin, 200);
        JsonNode financeiro = dados.get("financeiro");
        assertThat(financeiro.get("contratacoes")).hasSize(1);
        assertThat(financeiro.get("contratacoes").get(0).get("motivoValor").asString()).isEqualTo("Desconto fictício de amigo");
        assertThat(financeiro.get("cobrancas")).hasSize(2);
        assertThat(financeiro.get("cobrancas").valueStream().map(c -> c.path("observacao").asString()))
                .contains("Observação fictícia da baixa");
        assertThat(dados.get("secoesOmitidas").valueStream().map(JsonNode::asString)).doesNotContain("financeiro");

        api.patch("/alunos/" + aluno + "/situacao", admin, Map.of("ativo", false), 200);
        api.post("/alunos/" + aluno + "/anonimizar", admin, Map.of("nomeConfirmado", nome), 200);

        assertThat(jdbc.queryForObject("select count(*) from contratacao_aluno where aluno_id = ?::uuid and motivo_valor is not null",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and (observacao is not null or motivo is not null)",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select sum(valor_centavos) from cobranca_aluno where aluno_id = ?::uuid and situacao = 'PAGA'",
                Long.class, aluno.toString())).isEqualTo(9000L);
        assertThat(jdbc.queryForObject("select count(*) from contratacao_aluno where aluno_id = ?::uuid and situacao <> 'ENCERRADA'",
                Integer.class, aluno.toString())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid and situacao = 'ABERTA'",
                Integer.class, aluno.toString())).isZero();
    }

    @Test
    void membroSemFinanceiroLerNaoLeOFinanceiroNaExportacao() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano oculto", 10000, "MENSAL"));
        JsonNode minimo = membro("Exportador sem financeiro", Set.of("ALUNO_LER", "ALUNO_SENSIVEL_LER", "ALUNO_EXPORTAR"));
        JsonNode dados = api.get("/alunos/" + aluno + "/exportacao", minimo, 200);
        assertThat(dados.has("financeiro")).isFalse();
        assertThat(dados.get("secoesOmitidas").valueStream().map(JsonNode::asString)).contains("financeiro");
    }

    // ---- números e painel ----

    @Test
    void numerosSemDadoSaemNulosENuncaZero() throws Exception {
        JsonNode vazio = api.get("/financeiro/numeros?meses=6", admin, 200);
        assertThat(vazio.get("meses")).hasSize(6);
        for (JsonNode mes : vazio.get("meses")) {
            assertThat(nulo(mes.get("recebidoCentavos"))).isTrue();
        }
        assertThat(vazio.get("meses").get(5).get("parcial").asBoolean()).isTrue();
        assertThat(vazio.get("meses").get(0).get("parcial").asBoolean()).isFalse();
        assertThat(nulo(vazio.get("previstoCentavos"))).isTrue();
        assertThat(nulo(vazio.get("inadimplenciaPercentual"))).isTrue();
        assertThat(nulo(vazio.get("receitaRecorrenteMensalCentavos"))).isTrue();
        assertThat(api.get("/financeiro/numeros?meses=12", admin, 200).get("meses")).hasSize(12);
        api.get("/financeiro/numeros?meses=7", admin, 400);

        JsonNode painel = api.get("/financeiro/painel", admin, 200);
        assertThat(painel.get("serie")).hasSize(6);
        assertThat(nulo(painel.get("cartoes").get("recebidoCentavos"))).isTrue();
        assertThat(nulo(painel.get("cartoes").get("alunosPagantes"))).isTrue();
        assertThat(nulo(painel.get("cartoes").get("valorMedioPorAlunoCentavos"))).isTrue();
        assertThat(nulo(painel.get("inadimplencia").get("percentual"))).isTrue();
        assertThat(painel.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isZero();
        assertThat(painel.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isZero();
        assertThat(painel.get("liquido").get("disponivel").asBoolean()).isFalse();
        assertThat(painel.get("resultadoDoMes").get("rotulo").asString()).isEqualTo(FinanceiroService.ROTULO_RESULTADO);
        assertThat(painel.get("porForma")).isEmpty();
        assertThat(painel.get("somenteMeus").asBoolean()).isFalse();
    }

    @Test
    void numerosEPainelSomamRecebidoPrevistoAtrasoEReceitaRecorrente() throws Exception {
        UUID alunoA = aluno();
        UUID alunoB = aluno();
        UUID alunoC = aluno();
        JsonNode mensal = plano("Mensal do painel", 10000, "MENSAL");
        JsonNode trimestral = plano("Trimestral do painel", 10000, "TRIMESTRAL");
        JsonNode unico = plano("Único do painel", 50000, "PARCELA_UNICA");
        contratarHoje(alunoA, mensal);
        contratarHoje(alunoB, trimestral);
        contratarHoje(alunoC, unico);
        baixar(cobrancas(alunoA).get(0), hoje, 200);
        JsonNode cobrancaB = cobrancas(alunoB).get(0);
        jdbc.update("update cobranca_aluno set vencimento = ?::date where id = ?::uuid", hoje.minusDays(2).toString(),
                cobrancaB.get("id").asString());

        JsonNode numeros = api.get("/financeiro/numeros?meses=6", admin, 200);
        assertThat(numeros.get("meses").get(5).get("recebidoCentavos").asLong()).isEqualTo(10000);
        // Mensal 10000 + trimestral 10000/3 (3333, arredondado) ; a parcela única fica de fora.
        assertThat(numeros.get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(10000 + 3333);
        // Previsto: abertas com vencimento de hoje em diante (a do aluno C vence hoje; a seguinte do A, no mês que vem).
        assertThat(numeros.get("previstoCentavos").asLong()).isEqualTo(50000 + 10000);
        assertThat(numeros.get("inadimplenciaPercentual").decimalValue()).isEqualByComparingTo("100.0");

        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Venda fictícia",
                "valorCentavos", 5000, "tipo", "ENTRADA"), 200);
        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Aluguel fictício",
                "valorCentavos", 2000, "tipo", "SAIDA", "categoria", "Espaço"), 200);

        JsonNode painel = api.get("/financeiro/painel", admin, 200);
        assertThat(painel.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(10000);
        assertThat(painel.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(painel.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isEqualTo(1);
        assertThat(painel.get("cartoes").get("alunosPagantes").asLong()).isEqualTo(1);
        assertThat(painel.get("cartoes").get("valorMedioPorAlunoCentavos").asLong()).isEqualTo(10000);
        assertThat(painel.get("cartoes").get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(13333);
        assertThat(painel.get("inadimplencia").get("percentual").decimalValue()).isEqualByComparingTo("100.0");
        assertThat(painel.get("porForma")).hasSize(1);
        assertThat(painel.get("porForma").get(0).get("forma").asString()).isEqualTo("PIX_DIRETO");
        assertThat(painel.get("porForma").get(0).get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(painel.get("porPlano")).hasSize(1);
        assertThat(painel.get("porPlano").get(0).get("nome").asString()).startsWith("Mensal do painel");
        assertThat(painel.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isEqualTo(3);
        JsonNode resultado = painel.get("resultadoDoMes");
        assertThat(resultado.get("recebidoCentavos").asLong()).isEqualTo(10000);
        assertThat(resultado.get("entradasAvulsasCentavos").asLong()).isEqualTo(5000);
        assertThat(resultado.get("saidasAvulsasCentavos").asLong()).isEqualTo(2000);
        assertThat(resultado.get("resultadoCentavos").asLong()).isEqualTo(13000);
        assertThat(painel.get("proximosRecebimentos").get("fonte").asString()).isEqualTo("VENCIMENTO");

        JsonNode meus = api.get("/financeiro/painel?meus=true", admin, 200);
        assertThat(meus.get("somenteMeus").asBoolean()).isTrue();
        assertThat(nulo(meus.get("resultadoDoMes").get("entradasAvulsasCentavos"))).isTrue();
        assertThat(nulo(meus.get("resultadoDoMes").get("resultadoCentavos"))).isTrue();
        assertThat(nulo(meus.get("serie").get(5).get("entradasAvulsasCentavos"))).isTrue();

        JsonNode inadimplentes = api.get("/financeiro/inadimplentes", admin, 200);
        assertThat(inadimplentes.get("itens")).hasSize(1);
        assertThat(inadimplentes.get("itens").get(0).get("alunoId").asString()).isEqualTo(alunoB.toString());
        assertThat(inadimplentes.get("itens").get(0).get("diasDeAtraso").asLong()).isEqualTo(2);

        api.get("/financeiro/painel?de=" + hoje.minusMonths(30) + "&ate=" + hoje, admin, 400);
        api.get("/financeiro/painel?de=" + hoje + "&ate=" + hoje.minusMonths(2), admin, 400);
        assertThat(api.get("/financeiro/painel?de=" + hoje.minusMonths(23) + "&ate=" + hoje, admin, 200).get("serie")).hasSize(24);
    }

    @Test
    void meusSoTrazOsAlunosDeQuemPedeEOutroResponsavelVeOsDele() throws Exception {
        JsonNode outroResponsavel = membro("Outro responsável", Set.of("FINANCEIRO_LER", "ALUNO_LER"));
        String idDoOutro = outroResponsavel.path("usuario").path("id").asString();
        assertThat(idDoOutro).isNotBlank();

        // a1 e a3 são do administrador (quem cria é o responsável); a2 e a4 são do outro responsável.
        UUID a1 = aluno();
        UUID a3 = aluno();
        UUID a2 = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício Do Outro " + UUID.randomUUID(),
                "responsavelId", idDoOutro), 200).get("id").asString());
        UUID a4 = UUID.fromString(api.post("/alunos", admin, Map.of("nome", "Aluno Fictício Do Outro " + UUID.randomUUID(),
                "responsavelId", idDoOutro), 200).get("id").asString());
        contratarHoje(a1, plano("Plano 10", 10000, "MENSAL"));
        contratarHoje(a2, plano("Plano 20", 20000, "MENSAL"));
        contratarHoje(a3, plano("Plano 30", 30000, "MENSAL"));
        contratarHoje(a4, plano("Plano 40", 40000, "MENSAL"));
        vencerHaDias(cobrancas(a1).get(0), 3);
        vencerHaDias(cobrancas(a2).get(0), 2);
        baixar(cobrancas(a3).get(0), hoje, 200);
        baixar(cobrancas(a4).get(0), hoje, 200);
        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Venda fictícia",
                "valorCentavos", 5000, "tipo", "ENTRADA"), 200);

        // Cobranças
        assertThat(campo(api.get("/financeiro/cobrancas?meus=true", admin, 200).get("itens"), "alunoId"))
                .containsExactlyInAnyOrder(a1.toString(), a3.toString());
        assertThat(campo(api.get("/financeiro/cobrancas?meus=true", outroResponsavel, 200).get("itens"), "alunoId"))
                .containsExactlyInAnyOrder(a2.toString(), a4.toString());
        assertThat(campo(api.get("/financeiro/cobrancas", admin, 200).get("itens"), "alunoId"))
                .containsExactlyInAnyOrder(a1.toString(), a2.toString(), a3.toString(), a4.toString());
        assertThat(campo(api.get("/financeiro/cobrancas?meus=false", admin, 200).get("itens"), "alunoId")).hasSize(4);

        // Painel do administrador: "meus" só soma a1 e a3; lançamentos avulsos e resultado ficam sem dado.
        JsonNode meus = api.get("/financeiro/painel?meus=true", admin, 200);
        assertThat(meus.get("somenteMeus").asBoolean()).isTrue();
        assertThat(meus.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(30000);
        assertThat(meus.get("cartoes").get("alunosPagantes").asLong()).isEqualTo(1);
        assertThat(meus.get("cartoes").get("valorMedioPorAlunoCentavos").asLong()).isEqualTo(30000);
        assertThat(meus.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(meus.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isEqualTo(1);
        assertThat(meus.get("cartoes").get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(10000 + 30000);
        assertThat(meus.get("porForma")).hasSize(1);
        assertThat(meus.get("porForma").get(0).get("valorCentavos").asLong()).isEqualTo(30000);
        assertThat(meus.get("porPlano")).hasSize(1);
        assertThat(meus.get("porPlano").get(0).get("nome").asString()).startsWith("Plano 30");
        assertThat(meus.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isEqualTo(2);
        assertThat(meus.get("serie").get(5).get("recebidoCentavos").asLong()).isEqualTo(30000);
        assertThat(nulo(meus.get("serie").get(5).get("entradasAvulsasCentavos"))).isTrue();
        assertThat(nulo(meus.get("serie").get(5).get("saidasAvulsasCentavos"))).isTrue();
        assertThat(nulo(meus.get("serie").get(5).get("resultadoCentavos"))).isTrue();
        JsonNode resultadoMeus = meus.get("resultadoDoMes");
        assertThat(resultadoMeus.get("recebidoCentavos").asLong()).isEqualTo(30000);
        assertThat(nulo(resultadoMeus.get("entradasAvulsasCentavos"))).isTrue();
        assertThat(nulo(resultadoMeus.get("saidasAvulsasCentavos"))).isTrue();
        assertThat(nulo(resultadoMeus.get("resultadoCentavos"))).isTrue();

        // Sem "meus": todos os quatro e as avulsas aparecem.
        JsonNode todos = api.get("/financeiro/painel", admin, 200);
        assertThat(todos.get("somenteMeus").asBoolean()).isFalse();
        assertThat(todos.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(70000);
        assertThat(todos.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(30000);
        assertThat(todos.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isEqualTo(2);
        assertThat(todos.get("cartoes").get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(100000);
        assertThat(todos.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isEqualTo(4);
        assertThat(todos.get("resultadoDoMes").get("entradasAvulsasCentavos").asLong()).isEqualTo(5000);
        assertThat(todos.get("resultadoDoMes").get("resultadoCentavos").asLong()).isEqualTo(75000);

        // O outro responsável vê o que é dele (e nunca o do administrador), também sem avulsas.
        JsonNode doOutro = api.get("/financeiro/painel?meus=true", outroResponsavel, 200);
        assertThat(doOutro.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(40000);
        assertThat(doOutro.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(20000);
        assertThat(doOutro.get("cartoes").get("receitaRecorrenteMensalCentavos").asLong()).isEqualTo(20000 + 40000);
        assertThat(doOutro.get("movimentoDeAlunos").get(5).get("contratacoesNovas").asLong()).isEqualTo(2);
        assertThat(nulo(doOutro.get("resultadoDoMes").get("entradasAvulsasCentavos"))).isTrue();
        assertThat(nulo(doOutro.get("resultadoDoMes").get("resultadoCentavos"))).isTrue();

        // Inadimplentes
        JsonNode inadMeus = api.get("/financeiro/inadimplentes?meus=true", admin, 200);
        assertThat(campo(inadMeus.get("itens"), "alunoId")).containsExactly(a1.toString());
        assertThat(inadMeus.get("total").asLong()).isEqualTo(1);
        assertThat(inadMeus.get("valorTotalCentavos").asLong()).isEqualTo(10000);
        JsonNode inadOutro = api.get("/financeiro/inadimplentes?meus=true", outroResponsavel, 200);
        assertThat(campo(inadOutro.get("itens"), "alunoId")).containsExactly(a2.toString());
        assertThat(inadOutro.get("valorTotalCentavos").asLong()).isEqualTo(20000);
        JsonNode inadTodos = api.get("/financeiro/inadimplentes", admin, 200);
        assertThat(campo(inadTodos.get("itens"), "alunoId")).containsExactlyInAnyOrder(a1.toString(), a2.toString());
        assertThat(inadTodos.get("valorTotalCentavos").asLong()).isEqualTo(30000);
    }

    @Test
    void desfazerABaixaManualTiraOValorDoRecebidoEDoPainel() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano do recebido", 10000, "MENSAL"));
        JsonNode aberta = cobrancas(aluno).get(0);

        // Antes da baixa: nada recebido; o previsto é só a cobrança de hoje.
        assertThat(nulo(api.get("/financeiro/numeros?meses=6", admin, 200).get("meses").get(5).get("recebidoCentavos"))).isTrue();
        assertThat(api.get("/financeiro/numeros?meses=6", admin, 200).get("previstoCentavos").asLong()).isEqualTo(10000);
        assertThat(nulo(api.get("/financeiro/painel", admin, 200).get("cartoes").get("recebidoCentavos"))).isTrue();

        // Com a baixa: soma no recebido (números e painel).
        JsonNode paga = baixar(aberta, hoje, 200);
        assertThat(api.get("/financeiro/numeros?meses=6", admin, 200).get("meses").get(5).get("recebidoCentavos").asLong())
                .isEqualTo(10000);
        JsonNode comBaixa = api.get("/financeiro/painel", admin, 200);
        assertThat(comBaixa.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(10000);
        assertThat(comBaixa.get("cartoes").get("alunosPagantes").asLong()).isEqualTo(1);
        assertThat(comBaixa.get("serie").get(5).get("recebidoCentavos").asLong()).isEqualTo(10000);
        assertThat(comBaixa.get("porForma")).hasSize(1);
        assertThat(comBaixa.get("resultadoDoMes").get("recebidoCentavos").asLong()).isEqualTo(10000);

        // Desfeita a baixa: o valor sai do recebido e a cobrança volta a ser prevista.
        motivo("/cobrancas/" + aberta.get("id").asString() + "/desfazer-baixa", paga, 200);
        JsonNode numeros = api.get("/financeiro/numeros?meses=6", admin, 200);
        assertThat(nulo(numeros.get("meses").get(5).get("recebidoCentavos"))).isTrue();
        assertThat(numeros.get("previstoCentavos").asLong()).isEqualTo(10000 + 10000);
        JsonNode semBaixa = api.get("/financeiro/painel", admin, 200);
        assertThat(nulo(semBaixa.get("cartoes").get("recebidoCentavos"))).isTrue();
        assertThat(nulo(semBaixa.get("cartoes").get("alunosPagantes"))).isTrue();
        assertThat(nulo(semBaixa.get("cartoes").get("valorMedioPorAlunoCentavos"))).isTrue();
        assertThat(nulo(semBaixa.get("serie").get(5).get("recebidoCentavos"))).isTrue();
        assertThat(semBaixa.get("porForma")).isEmpty();
        assertThat(semBaixa.get("porPlano")).isEmpty();
        assertThat(nulo(semBaixa.get("resultadoDoMes").get("recebidoCentavos"))).isTrue();
        assertThat(nulo(semBaixa.get("resultadoDoMes").get("resultadoCentavos"))).isTrue();
    }

    @Test
    void canceladaEEstornadaFicamForaDoRecebidoEDaInadimplencia() throws Exception {
        UUID aberta = aluno();
        UUID cancelada = aluno();
        UUID estornada = aluno();
        UUID paga = aluno();
        contratarHoje(aberta, plano("Plano aberto", 10000, "MENSAL"));
        contratarHoje(cancelada, plano("Plano cancelado", 20000, "MENSAL"));
        contratarHoje(estornada, plano("Plano estornado", 30000, "MENSAL"));
        contratarHoje(paga, plano("Plano pago", 40000, "MENSAL"));

        vencerHaDias(cobrancas(aberta).get(0), 3);
        JsonNode paraCancelar = cobrancas(cancelada).get(0);
        vencerHaDias(paraCancelar, 3);
        JsonNode canceladaAgora = motivo("/cobrancas/" + paraCancelar.get("id").asString() + "/cancelar",
                cobrancas(cancelada).get(0), 200);
        assertThat(canceladaAgora.get("situacao").asString()).isEqualTo("CANCELADA");
        JsonNode paraEstornar = cobrancas(estornada).get(0);
        vencerHaDias(paraEstornar, 4);
        JsonNode pagaAntes = baixar(cobrancas(estornada).get(0), hoje, 200);
        // Antes do estorno a baixa conta no recebido (30000 + 40000 depois da baixa abaixo).
        baixar(cobrancas(paga).get(0), hoje, 200);
        assertThat(api.get("/financeiro/painel", admin, 200).get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(70000);
        estornar(estornada, pagaAntes);
        assertThat(porCompetencia(estornada, hoje).get("situacao").asString()).isEqualTo("ESTORNADA");

        // Recebido: só a paga de verdade.
        JsonNode painel = api.get("/financeiro/painel", admin, 200);
        assertThat(painel.get("cartoes").get("recebidoCentavos").asLong()).isEqualTo(40000);
        assertThat(painel.get("cartoes").get("alunosPagantes").asLong()).isEqualTo(1);
        assertThat(painel.get("cartoes").get("valorMedioPorAlunoCentavos").asLong()).isEqualTo(40000);
        assertThat(painel.get("porForma")).hasSize(1);
        assertThat(painel.get("porForma").get(0).get("valorCentavos").asLong()).isEqualTo(40000);
        assertThat(painel.get("porPlano")).hasSize(1);
        assertThat(painel.get("porPlano").get(0).get("nome").asString()).startsWith("Plano pago");
        assertThat(painel.get("serie").get(5).get("recebidoCentavos").asLong()).isEqualTo(40000);
        assertThat(painel.get("resultadoDoMes").get("recebidoCentavos").asLong()).isEqualTo(40000);
        assertThat(api.get("/financeiro/numeros?meses=6", admin, 200).get("meses").get(5).get("recebidoCentavos").asLong())
                .isEqualTo(40000);

        // Inadimplência: só a aberta vencida; cancelada e estornada não entram no atraso.
        assertThat(painel.get("cartoes").get("emAtraso").get("valorCentavos").asLong()).isEqualTo(10000);
        assertThat(painel.get("cartoes").get("emAtraso").get("cobrancas").asLong()).isEqualTo(1);
        assertThat(painel.get("inadimplencia").get("vencidoCentavos").asLong()).isEqualTo(10000);
        // A cancelada não entra nem no que foi cobrado (aberta 10000 + estornada 30000 é o teto).
        assertThat(painel.get("inadimplencia").get("cobradoCentavos").asLong()).isLessThanOrEqualTo(10000 + 30000);
        JsonNode inadimplentes = api.get("/financeiro/inadimplentes", admin, 200);
        assertThat(campo(inadimplentes.get("itens"), "alunoId")).containsExactly(aberta.toString());
        assertThat(inadimplentes.get("total").asLong()).isEqualTo(1);
        assertThat(inadimplentes.get("valorTotalCentavos").asLong()).isEqualTo(10000);

        // As listas por situação separam cada uma.
        assertThat(campo(api.get("/financeiro/cobrancas?situacao=VENCIDA", admin, 200).get("itens"), "alunoId"))
                .containsExactly(aberta.toString());
        assertThat(campo(api.get("/financeiro/cobrancas?situacao=CANCELADA", admin, 200).get("itens"), "alunoId"))
                .containsExactly(cancelada.toString());
        assertThat(campo(api.get("/financeiro/cobrancas?situacao=ESTORNADA", admin, 200).get("itens"), "alunoId"))
                .containsExactly(estornada.toString());
    }

    // ---- lançamentos e CSV ----

    @Test
    void lancamentosTemVersaoLimitesEAuditoriaFixa() throws Exception {
        JsonNode criado = api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "  Material  ",
                "valorCentavos", 7500, "tipo", "SAIDA", "categoria", "Equipamento"), 200);
        String id = criado.get("id").asString();
        assertThat(criado.get("descricao").asString()).isEqualTo("Material");
        assertThat(auditorias("LANCAMENTO_FINANCEIRO_CRIADO", id)).isEqualTo(1);

        for (long invalido : new long[] {0, -5, PagamentosDtos.VALOR_MAXIMO + 1}) {
            api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "x",
                    "valorCentavos", invalido, "tipo", "ENTRADA"), 400);
        }
        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", " ", "valorCentavos", 1,
                "tipo", "ENTRADA"), 400);
        assertThat(codigo(api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.minusYears(11).toString(),
                "descricao", "Antigo", "valorCentavos", 1, "tipo", "ENTRADA"), 422))).isEqualTo("LANCAMENTO_INVALIDO");

        Map<String, Object> alteracao = new LinkedHashMap<>();
        alteracao.put("data", hoje.toString());
        alteracao.put("descricao", "Material novo");
        alteracao.put("valorCentavos", 8000);
        alteracao.put("tipo", "SAIDA");
        alteracao.put("versao", criado.get("versao").asLong());
        JsonNode alterado = api.put("/financeiro/lancamentos/" + id, admin, alteracao, 200);
        assertThat(alterado.get("valorCentavos").asLong()).isEqualTo(8000);
        assertThat(codigo(api.put("/financeiro/lancamentos/" + id, admin, alteracao, 409))).isEqualTo("CONFLITO_EDICAO");
        assertThat(codigo(api.delete("/financeiro/lancamentos/" + id + "?versao=" + criado.get("versao").asLong(), admin, 409)))
                .isEqualTo("CONFLITO_EDICAO");

        assertThat(api.get("/financeiro/lancamentos?de=" + hoje + "&ate=" + hoje, admin, 200).get("itens")).hasSize(1);
        api.delete("/financeiro/lancamentos/" + id + "?versao=" + alterado.get("versao").asLong(), admin, 204);
        assertThat(api.get("/financeiro/lancamentos", admin, 200).get("itens")).isEmpty();
        assertThat(auditorias("LANCAMENTO_FINANCEIRO_EXCLUIDO", id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'LANCAMENTO_FINANCEIRO_EXCLUIDO' and entidade_id = ?::uuid",
                String.class, id)).isEqualTo("Excluiu um lançamento financeiro.");
    }

    @Test
    void exportacaoCsvProtegeFormulaTemCabecalhosDeSegurancaELimiteDeLinhas() throws Exception {
        UUID aluno = api.criarAluno(admin, "Aluno do CSV");
        contratarHoje(aluno, plano("Plano do CSV", 12345, "MENSAL"));
        for (String descricao : List.of("=1+1", "+cmd", "-2", "@soma", "Com;ponto e vírgula")) {
            api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", descricao,
                    "valorCentavos", 100, "tipo", "ENTRADA"), 200);
        }

        var resposta = mvc.perform(MockMvcRequestBuilders.get("/financeiro/exportacao?de=" + hoje.minusDays(1) + "&ate=" + hoje.plusDays(40))
                .header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        assertThat(resposta.getHeader("Content-Disposition")).contains("attachment").contains(".csv");
        assertThat(resposta.getContentType()).startsWith("text/csv");
        String csv = resposta.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith(MARCA_DE_ORDEM + "registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor");
        assertThat(csv).contains(";'=1+1;").contains(";'+cmd;").contains(";'-2;").contains(";'@soma;")
                .contains(";\"Com;ponto e vírgula\";");
        assertThat(csv).contains("Aluno do CSV").contains(";123,45").contains("COBRANCA;").contains("LANCAMENTO;");
        assertThat(jdbc.queryForObject("select resumo from auditoria where acao = 'FINANCEIRO_EXPORTADO' "
                + "and consultoria_id = (select consultoria_id from aluno where id = ?::uuid) limit 1",
                String.class, aluno.toString())).isEqualTo("Exportou o financeiro em CSV.");

        api.get("/financeiro/exportacao?de=" + hoje + "&ate=" + hoje.minusDays(1), admin, 400);

        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?::uuid", UUID.class, aluno.toString());
        jdbc.update("insert into lancamento_financeiro(id, consultoria_id, data, descricao, valor_centavos, tipo) "
                + "select gen_random_uuid(), ?::uuid, ?::date, 'Linha ' || g, 100, 'ENTRADA' from generate_series(1, 5001) g",
                consultoria.toString(), hoje.toString());
        assertThat(codigo(api.get("/financeiro/exportacao?de=" + hoje + "&ate=" + hoje, admin, 422)))
                .isEqualTo("EXPORTACAO_GRANDE_DEMAIS");
    }

    // ---- /eu e auditoria ----

    @Test
    void euInformaSeOsPagamentosEstaoLigados() throws Exception {
        assertThat(api.get("/eu", admin, 200).get("pagamentosHabilitados").asBoolean()).isTrue();
        JsonNode loginAluno = api.convidarEEntrar(admin, aluno());
        assertThat(api.get("/eu", loginAluno, 200).get("pagamentosHabilitados").asBoolean()).isTrue();
    }

    // ---- serviço comum de baixa (estorno e contestação ainda sem chamador HTTP) ----

    @Test
    void estornarEContestarSaoIdempotentesESoValemParaCobrancaPaga() throws Exception {
        UUID aluno = aluno();
        contratarHoje(aluno, plano("Plano do estorno", 10000, "MENSAL"));
        JsonNode aberta = cobrancas(aluno).get(0);
        UUID cobrancaId = UUID.fromString(aberta.get("id").asString());
        UUID consultoria = jdbc.queryForObject("select consultoria_id from aluno where id = ?::uuid", UUID.class, aluno.toString());
        var tx = new TransactionTemplate(transacoes);

        assertThatThrownBy(() -> TenantContext.executarComo(consultoria,
                () -> tx.execute(s -> baixaDeCobranca.estornar(cobrancaId, "Sem pagamento"))))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria,
                () -> tx.execute(s -> baixaDeCobranca.contestar(cobrancaId, "Sem pagamento"))))
                .isInstanceOf(ConflictException.class);

        baixar(aberta, hoje, 200);
        var estornada = TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.estornar(cobrancaId, "Devolvido")));
        assertThat(estornada.mudou()).isTrue();
        assertThat(estornada.cobranca().getSituacao()).isEqualTo(CobrancaAluno.Situacao.ESTORNADA);
        var repetida = TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.estornar(cobrancaId, "Devolvido")));
        assertThat(repetida.mudou()).isFalse();
        // Estornada não conta no recebido.
        assertThat(nulo(api.get("/financeiro/painel", admin, 200).get("cartoes").get("recebidoCentavos"))).isTrue();
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria,
                () -> tx.execute(s -> baixaDeCobranca.contestar(cobrancaId, "Contestou"))))
                .isInstanceOf(ConflictException.class);

        // Contestação em outra cobrança paga.
        JsonNode segunda = cobrancas(aluno).get(0);
        UUID segundaId = UUID.fromString(segunda.get("id").asString());
        baixar(segunda, hoje, 200);
        var contestada = TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.contestar(segundaId, "Contestou")));
        assertThat(contestada.cobranca().getSituacao()).isEqualTo(CobrancaAluno.Situacao.CONTESTADA);
        assertThat(TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.contestar(segundaId, "Contestou")))
                .mudou()).isFalse();

        // Provedor que o registro não conhece não baixa nada.
        UUID terceiraId = UUID.fromString(cobrancas(aluno).get(0).get("id").asString());
        assertThatThrownBy(() -> TenantContext.executarComo(consultoria, () -> tx.execute(s -> baixaDeCobranca.baixar(terceiraId,
                new BaixaDeCobranca.Baixa("NAO_EXISTE", FormaDePagamento.PIX, hoje, null, null, null)))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
