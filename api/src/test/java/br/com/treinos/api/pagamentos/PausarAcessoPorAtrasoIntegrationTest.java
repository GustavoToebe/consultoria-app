package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.pagamentos.provedor.InfinitePayFalsa;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
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
 * Fase 2 (Pausar acesso do aluno por atraso): pausa/reativação manual idempotente, sessão preservada (login/refresh 200),
 * GET /eu com acessoPausado, whitelist liberada vs 403 ACESSO_PAUSADO_POR_ATRASO nas demais rotas, reativação automática
 * ao quitar todas as vencidas (baixa manual, webhook InfinitePay, cancelamento e renegociação), desfazer baixa nunca repausa
 * e isolamento multi-tenant.
 */
@AutoConfigureMockMvc
class PausarAcessoPorAtrasoIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ConciliadorInfinitePay conciliador;

    private ApiDeTeste api;
    private JsonNode treinador;
    private UUID consultoriaId;
    private final List<UUID> consultoriasParaLimpar = new ArrayList<>();
    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        treinador = api.novoTreinador();
        consultoriaId = jdbc.queryForObject("select consultoria_id from usuario where id = ?::uuid", UUID.class,
                treinador.get("usuario").get("id").asString());
        consultoriasParaLimpar.add(consultoriaId);
    }

    @AfterEach
    void limparAvisos() {
        for (UUID c : consultoriasParaLimpar) {
            jdbc.update("update aviso_de_pagamento set situacao = 'IGNORADO', reservado_por = null, reserva_ate = null "
                    + "where consultoria_id = ? and situacao = 'PENDENTE'", c);
        }
        consultoriasParaLimpar.clear();
    }

    @Test
    void recusaPausarSemCobrancaVencidaEOuAlunoInativoEOutroTenant() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Sem Atraso");

        // Sem cobrança vencida -> 409 SEM_COBRANCA_VENCIDA
        JsonNode semVencida = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 409);
        assertThat(semVencida.get("codigo").asString()).isEqualTo("SEM_COBRANCA_VENCIDA");

        // Cobrança a vencer (hoje ou futuro) também não permite pausar
        criarCobrancaAvulsa(alunoId, hoje, 10_000);
        JsonNode soAVencer = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 409);
        assertThat(soAVencer.get("codigo").asString()).isEqualTo("SEM_COBRANCA_VENCIDA");

        // Aluno inativo -> 409 ALUNO_INATIVO
        api.patch("/alunos/" + alunoId + "/situacao", treinador, Map.of("ativo", false), 200);
        JsonNode inativoPausar = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 409);
        assertThat(inativoPausar.get("codigo").asString()).isEqualTo("ALUNO_INATIVO");
        JsonNode inativoReativar = api.post("/alunos/" + alunoId + "/reativar-acesso", treinador, null, 409);
        assertThat(inativoReativar.get("codigo").asString()).isEqualTo("ALUNO_INATIVO");

        // Isolamento multi-tenant -> 404
        JsonNode outroTreinador = api.novoTreinador();
        api.post("/alunos/" + alunoId + "/pausar-acesso", outroTreinador, null, 404);
        api.post("/alunos/" + alunoId + "/reativar-acesso", outroTreinador, null, 404);
    }

    @Test
    void pausaManualIdempotentePreservaSessaoLiberaWhitelistEBloqueiaDemaisRotas() throws Exception {
        // Configura Pix e InfinitePay para exercitar /link, /pix e /retorno-pagamento na whitelist
        api.put("/financeiro/recebimento-online", treinador, Map.of("infiniteTag", "$TREINADORFAKE"), 200);
        Map<String, Object> formas = new LinkedHashMap<>();
        formas.put("infinitePay", true);
        formas.put("linkProprio", false);
        formas.put("pix", true);
        formas.put("manual", true);
        formas.put("pixConfig", Map.of(
                "tipoChave", "EMAIL",
                "chave", "pix@teste.local",
                "nomeRecebedor", "Treinador Teste",
                "cidade", "Sao Paulo"));
        api.put("/financeiro/formas-de-recebimento", treinador, formas, 200);

        UUID alunoId = api.criarAluno(treinador, "Aluno Pausado");
        api.publicarTreino(treinador, alunoId, ApiDeTeste.treino().conteudo());
        String emailAluno = ApiDeTeste.emailUnico("aluno-pausado");
        String codigo = api.post("/alunos/" + alunoId + "/convite", treinador, null, 200).get("codigo").asString();
        api.post("/publico/convites/aceitar", null,
                Map.of("codigo", codigo, "email", emailAluno, "senha", ApiDeTeste.SENHA), 200);

        JsonNode cobranca = criarCobrancaAvulsa(alunoId, hoje.minusDays(10), 15_000);
        long versaoAntes = api.get("/alunos/" + alunoId, treinador, 200).get("versao").asLong();

        // Pausa manual
        JsonNode primeiraPausa = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);
        assertThat(primeiraPausa.get("acessoPausado").asBoolean()).isTrue();
        assertThat(primeiraPausa.get("acessoPausadoEm").asString()).isNotBlank();
        assertThat(primeiraPausa.get("versao").asLong()).isEqualTo(versaoAntes); // @OptimisticLock(excluded = true)

        // Idempotente: repetir não sobrescreve acessoPausadoEm nem duplica auditoria
        JsonNode segundaPausa = api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);
        assertThat(segundaPausa.get("acessoPausadoEm").asString()).isEqualTo(primeiraPausa.get("acessoPausadoEm").asString());
        assertThat(contarAuditorias("ALUNO_ACESSO_PAUSADO", alunoId)).isEqualTo(1);

        // Lista de alunos também expõe acessoPausado
        JsonNode lista = api.get("/alunos?busca=Pausado", treinador, 200).get("itens");
        assertThat(lista).hasSize(1);
        assertThat(lista.get(0).get("acessoPausado").asBoolean()).isTrue();
        assertThat(lista.get(0).get("acessoPausadoEm").asString()).isEqualTo(primeiraPausa.get("acessoPausadoEm").asString());

        // Login e refresh continuam 200 para aluno pausado (D2)
        JsonNode novoLogin = api.post("/auth/login", null,
                Map.of("email", emailAluno, "senha", ApiDeTeste.SENHA), 200);
        JsonNode renovada = api.post("/auth/refresh", null,
                Map.of("refreshToken", novoLogin.get("refreshToken").asString()), 200);
        assertThat(renovada.get("accessToken").asString()).isNotBlank();

        // GET /eu traz acessoPausado = true na raiz e em aluno (e false para treinador)
        JsonNode euAluno = api.get("/eu", renovada, 200);
        assertThat(euAluno.get("acessoPausado").asBoolean()).isTrue();
        assertThat(euAluno.get("aluno").get("acessoPausado").asBoolean()).isTrue();
        assertThat(euAluno.get("aluno").get("acessoPausadoEm").asString()).isNotBlank();
        assertThat(api.get("/eu", treinador, 200).get("acessoPausado").asBoolean()).isFalse();

        // Whitelist liberada
        api.get("/termos", renovada, 200);
        api.get("/aluno/financeiro", renovada, 200);
        api.get("/eu/contratacao", renovada, 204);
        api.get("/aluno/contratacao", renovada, 204);
        api.post("/aluno/financeiro/cobrancas/" + cobranca.get("id").asString() + "/link", renovada, null, 200);
        api.post("/aluno/financeiro/cobrancas/" + cobranca.get("id").asString() + "/pix", renovada, null, 200);
        api.post("/aluno/financeiro/retorno-pagamento", renovada, Map.of(
                "orderNsu", cobranca.get("id").asString(),
                "transactionNsu", "TX-" + UUID.randomUUID(),
                "slug", "slug-teste"), 204);
        api.delete("/aluno/push-token", renovada, Map.of("token", "ExponentPushToken[teste-pausado]"), 204);

        // Demais rotas do aluno bloqueadas com 403 ACESSO_PAUSADO_POR_ATRASO
        assertBloqueado(api.get("/aluno/painel", renovada, 403));
        assertBloqueado(api.get("/aluno/dieta", renovada, 403));
        assertBloqueado(api.get("/aluno/pastas", renovada, 403));
        assertBloqueado(api.get("/aluno/mobilidade", renovada, 403));
        assertBloqueado(api.get("/aluno/comunidade/perfil", renovada, 403));

        // Reativação manual pelo treinador (idempotente)
        JsonNode reativado = api.post("/alunos/" + alunoId + "/reativar-acesso", treinador, null, 200);
        assertThat(reativado.get("acessoPausado").asBoolean()).isFalse();
        assertThat(reativado.get("acessoPausadoEm").isNull()).isTrue();
        api.post("/alunos/" + alunoId + "/reativar-acesso", treinador, null, 200);
        assertThat(contarAuditorias("ALUNO_ACESSO_REATIVADO", alunoId)).isEqualTo(1);

        // Aluno volta a acessar normalmente
        assertThat(api.get("/eu", renovada, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", renovada, 200);
    }

    @Test
    void duasVencidasSoReativaQuandoPagaASegundaEDesfazerBaixaNuncaRepausa() throws Exception {
        UUID alunoId = api.criarAluno(treinador, "Aluno Duas Vencidas");
        JsonNode aluno = api.convidarEEntrar(treinador, alunoId);

        JsonNode c1 = criarCobrancaAvulsa(alunoId, hoje.minusDays(20), 10_000);
        JsonNode c2 = criarCobrancaAvulsa(alunoId, hoje.minusDays(10), 12_000);
        api.post("/alunos/" + alunoId + "/pausar-acesso", treinador, null, 200);

        // Paga só a 1ª: continua pausado!
        api.post("/cobrancas/" + c1.get("id").asString() + "/baixa-manual", treinador,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", c1.get("versao").asLong()), 200);
        assertThat(api.get("/eu", aluno, 200).get("acessoPausado").asBoolean()).isTrue();
        assertBloqueado(api.get("/aluno/painel", aluno, 403));
        assertThat(contarAuditorias("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoId)).isZero();

        // Paga a 2ª: reativa automaticamente!
        JsonNode c2Paga = api.post("/cobrancas/" + c2.get("id").asString() + "/baixa-manual", treinador,
                Map.of("data", hoje.toString(), "forma", "PIX_DIRETO", "versao", c2.get("versao").asLong()), 200);
        assertThat(api.get("/eu", aluno, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", aluno, 200);
        assertThat(contarAuditorias("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoId)).isEqualTo(1);

        // Desfazer a baixa NÃO repausa automaticamente (D3)
        api.post("/cobrancas/" + c2.get("id").asString() + "/desfazer-baixa", treinador,
                Map.of("motivo", "Baixa lançada por engano", "versao", c2Paga.get("versao").asLong()), 200);
        assertThat(api.get("/eu", aluno, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", aluno, 200);
    }

    @Test
    void reativacaoAutomaticaPorWebhookCancelamentoERenegociacao() throws Exception {
        // 1. Webhook InfinitePay (auditoria do sistema: usuario_id IS NULL)
        api.put("/financeiro/recebimento-online", treinador, Map.of("infiniteTag", "$TREINADORWEBHOOK"), 200);
        String tokenAviso = jdbc.queryForObject("select token_aviso from credencial_pagamento where consultoria_id = ?",
                String.class, consultoriaId);

        UUID alunoWebhook = api.criarAluno(treinador, "Aluno Webhook");
        JsonNode sessaoWebhook = api.convidarEEntrar(treinador, alunoWebhook);
        JsonNode cobrancaWebhook = criarCobrancaAvulsa(alunoWebhook, hoje.minusDays(7), 15_000);
        api.post("/alunos/" + alunoWebhook + "/pausar-acesso", treinador, null, 200);
        assertBloqueado(api.get("/aluno/painel", sessaoWebhook, 403));

        // Gera link para gravar slug/valor, envia webhook e roda conciliador
        api.post("/aluno/financeiro/cobrancas/" + cobrancaWebhook.get("id").asString() + "/link", sessaoWebhook, null, 200);
        String slug = jdbc.queryForObject("select link_slug from cobranca_aluno where id = ?::uuid",
                String.class, cobrancaWebhook.get("id").asString());
        String tx = "TX-" + UUID.randomUUID();
        String payload = "{\"order_nsu\":\"" + cobrancaWebhook.get("id").asString() + "\",\"transaction_nsu\":\"" + tx
                + "\",\"invoice_slug\":\"" + slug
                + "\",\"amount\":15000,\"paid_amount\":15000,\"capture_method\":\"pix\",\"receipt_url\":\"https://recibo.falso.test/ok\"}";
        int statusWebhook = mvc.perform(MockMvcRequestBuilders.post("/publico/pagamentos/infinitepay/" + tokenAviso)
                        .contentType("application/json").content(payload))
                .andReturn().getResponse().getStatus();
        assertThat(statusWebhook).isEqualTo(200);
        conciliador.processarPendentes();

        assertThat(api.get("/eu", sessaoWebhook, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", sessaoWebhook, 200);
        Integer auditoriaSistema = jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = 'ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE' "
                        + "and entidade_id = ? and usuario_id is null",
                Integer.class, consultoriaId, alunoWebhook);
        assertThat(auditoriaSistema).isEqualTo(1);

        // 2. Cancelamento da cobrança vencida reativa automaticamente
        UUID alunoCancelamento = api.criarAluno(treinador, "Aluno Cancelamento");
        JsonNode sessaoCancelamento = api.convidarEEntrar(treinador, alunoCancelamento);
        JsonNode cobrancaCancelamento = criarCobrancaAvulsa(alunoCancelamento, hoje.minusDays(5), 10_000);
        api.post("/alunos/" + alunoCancelamento + "/pausar-acesso", treinador, null, 200);
        assertBloqueado(api.get("/aluno/painel", sessaoCancelamento, 403));

        api.post("/cobrancas/" + cobrancaCancelamento.get("id").asString() + "/cancelar", treinador,
                Map.of("motivo", "Isenção combinada", "versao", cobrancaCancelamento.get("versao").asLong()), 200);
        assertThat(api.get("/eu", sessaoCancelamento, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", sessaoCancelamento, 200);
        assertThat(contarAuditorias("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoCancelamento)).isEqualTo(1);

        // 3. Renegociação da cobrança vencida com vencimento futuro reativa automaticamente
        UUID alunoRenegociacao = api.criarAluno(treinador, "Aluno Renegociacao");
        JsonNode sessaoRenegociacao = api.convidarEEntrar(treinador, alunoRenegociacao);
        JsonNode cobrancaReneg = criarCobrancaAvulsa(alunoRenegociacao, hoje.minusDays(15), 20_000);
        api.post("/alunos/" + alunoRenegociacao + "/pausar-acesso", treinador, null, 200);
        assertBloqueado(api.get("/aluno/painel", sessaoRenegociacao, 403));

        Map<String, Object> reneg = new LinkedHashMap<>();
        reneg.put("itens", List.of(Map.of("cobrancaId", cobrancaReneg.get("id").asString(), "versao", cobrancaReneg.get("versao").asLong())));
        reneg.put("acrescimoCentavos", 0);
        reneg.put("descontoCentavos", 0);
        reneg.put("parcelas", 2);
        reneg.put("primeiroVencimento", hoje.plusDays(10).toString());
        reneg.put("pedidoId", UUID.randomUUID().toString());
        reneg.put("motivo", "Acordo em 2x");
        api.post("/cobrancas/renegociar", treinador, reneg, 201);
        assertThat(api.get("/eu", sessaoRenegociacao, 200).get("acessoPausado").asBoolean()).isFalse();
        api.get("/aluno/painel", sessaoRenegociacao, 200);
        assertThat(contarAuditorias("ALUNO_ACESSO_REATIVADO_AUTOMATICAMENTE", alunoRenegociacao)).isEqualTo(1);
    }

    private JsonNode criarCobrancaAvulsa(UUID alunoId, LocalDate vencimento, long valorCentavos) throws Exception {
        api.post("/financeiro/cobrancas-avulsas", treinador, Map.of(
                "pedidoId", UUID.randomUUID().toString(),
                "alunoIds", List.of(alunoId.toString()),
                "descricao", "Cobrança teste",
                "valorCentavos", valorCentavos,
                "primeiroVencimento", vencimento.toString(),
                "parcelas", 1), 201);
        JsonNode lista = api.get("/alunos/" + alunoId + "/cobrancas", treinador, 200);
        return lista.get(0);
    }

    private static void assertBloqueado(JsonNode resposta) {
        assertThat(resposta.get("codigo").asString()).isEqualTo("ACESSO_PAUSADO_POR_ATRASO");
    }

    private int contarAuditorias(String acao, UUID alunoId) {
        Integer n = jdbc.queryForObject(
                "select count(*) from auditoria where consultoria_id = ? and acao = ? and entidade_id = ?",
                Integer.class, consultoriaId, acao, alunoId);
        return n == null ? 0 : n;
    }
}
