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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os três lotes novos do financeiro: {@code POST /cobrancas/cancelar-em-lote}, {@code POST /cobrancas/link-em-lote} (contra a
 * InfinitePay de mentira) e {@code POST /financeiro/exportacao/selecionadas}. Falha parcial (cada item na sua transação),
 * inexistente e de outra consultoria sem se distinguir, limites, repetição, permissão e o CSV só das escolhidas. Dados fictícios.
 */
@AutoConfigureMockMvc
class LoteDeCobrancasIntegrationTest extends AbstractIntegrationTest {

    private static final InfinitePayFalsa FALSA = new InfinitePayFalsa();

    @DynamicPropertySource
    static void apontarParaAFalsa(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.api-url", FALSA::url);
        registry.add("treinos.app-url", () -> "https://app.teste.local");
    }

    @AfterAll
    static void desligarAFalsa() {
        FALSA.close();
    }

    @AfterEach
    void conferirAFalsa() {
        assertThat(FALSA.violacoes()).as("a API real recusaria algum pedido").isEmpty();
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        FALSA.reiniciar();
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private String plano(JsonNode quem) throws Exception {
        return api.post("/financeiro/planos", quem,
                Map.of("nome", "Plano " + UUID.randomUUID(), "valorCentavos", 12_300, "periodicidade", "MENSAL"), 200).get("id").asString();
    }

    /** Aluno novo com contratação mensal; devolve a primeira cobrança (aberta). */
    private JsonNode mensalidade(JsonNode quem, String planoId, String nome) throws Exception {
        String aluno = api.post("/alunos", quem, Map.of("nome", nome), 200).get("id").asString();
        Map<String, Object> contratacao = new LinkedHashMap<>();
        contratacao.put("planoComercialId", planoId);
        contratacao.put("inicio", hoje.toString());
        contratacao.put("diaVencimento", hoje.getDayOfMonth());
        api.post("/alunos/" + aluno + "/contratacoes", quem, contratacao, 200);
        return api.get("/alunos/" + aluno + "/cobrancas", quem, 200).get(0);
    }

    private JsonNode atual(JsonNode quem, JsonNode cobranca) throws Exception {
        for (JsonNode c : api.get("/alunos/" + cobranca.get("alunoId").asString() + "/cobrancas", quem, 200)) {
            if (c.get("id").asString().equals(cobranca.get("id").asString())) return c;
        }
        throw new AssertionError("Cobrança sumiu.");
    }

    private static Map<String, Object> item(String id, long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cobrancaId", id);
        m.put("versao", versao);
        return m;
    }

    private static Map<String, Object> item(JsonNode c) {
        return item(c.get("id").asString(), c.get("versao").asLong());
    }

    private int auditorias(String acao, String cobrancaId) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where acao = ? and entidade_id = ?::uuid", Integer.class,
                acao, cobrancaId);
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

    // ---- cancelar em lote ----

    @Test
    void cancelarEmLoteComFalhaParcialMotivoOpcionalEResultadoPorItem() throws Exception {
        String plano = plano(admin);
        JsonNode boa = mensalidade(admin, plano, "Aluno Cancela A");
        JsonNode outraBoa = mensalidade(admin, plano, "Aluno Cancela B");
        JsonNode velha = mensalidade(admin, plano, "Aluno Cancela C");
        JsonNode jaCancelada = mensalidade(admin, plano, "Aluno Cancela D");
        api.post("/cobrancas/" + jaCancelada.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Antes", "versao", jaCancelada.get("versao").asLong()), 200);

        JsonNode r = api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(
                item(boa),
                item(velha.get("id").asString(), velha.get("versao").asLong() + 9),
                item(UUID.randomUUID().toString(), 0),
                item(jaCancelada.get("id").asString(), jaCancelada.get("versao").asLong() + 1),
                item(outraBoa)), "motivo", "Pacote encerrado"), 200).get("resultados");

        assertThat(r).hasSize(5);
        assertThat(r.get(0).get("cobrancaId").asString()).isEqualTo(boa.get("id").asString());
        assertThat(r.get(0).get("ok").asBoolean()).isTrue();
        assertThat(r.get(0).get("codigo").isNull()).isTrue();
        assertThat(r.get(1).get("ok").asBoolean()).isFalse();
        assertThat(r.get(1).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(r.get(2).get("ok").asBoolean()).isFalse();
        assertThat(r.get(2).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(r.get(3).get("ok").asBoolean()).isTrue();
        assertThat(r.get(3).get("codigo").asString()).isEqualTo("JA_ESTAVA_CANCELADA");
        assertThat(r.get(4).get("ok").asBoolean()).isTrue();
        // O que deu certo gravou (com o motivo de todos), o que falhou não mudou; auditoria só de quem cancelou agora.
        assertThat(atual(admin, boa).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(atual(admin, boa).get("motivo").asString()).isEqualTo("Pacote encerrado");
        assertThat(atual(admin, outraBoa).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(atual(admin, velha).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(auditorias("COBRANCA_CANCELADA", boa.get("id").asString())).isEqualTo(1);
        assertThat(auditorias("COBRANCA_CANCELADA", velha.get("id").asString())).isZero();
        assertThat(auditorias("COBRANCA_CANCELADA", jaCancelada.get("id").asString())).isEqualTo(1);
        // Sem motivo também vale; a resposta não carrega nome nem valor.
        JsonNode terceira = mensalidade(admin, plano, "Aluno Cancela E");
        JsonNode semMotivo = api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(item(terceira))), 200);
        assertThat(semMotivo.get("resultados").get(0).get("ok").asBoolean()).isTrue();
        assertThat(semMotivo.toString()).doesNotContain("Aluno Cancela").doesNotContain("12300");
    }

    @Test
    void cancelarEmLoteIsolaPorConsultoriaPedePermissaoERecusaLimitesERepetidos() throws Exception {
        JsonNode outro = api.novoTreinador();
        JsonNode daOutra = mensalidade(outro, plano(outro), "Aluno da Outra");
        JsonNode minha = mensalidade(admin, plano(admin), "Aluno Meu");

        JsonNode r = api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(item(daOutra), item(minha))), 200)
                .get("resultados");
        assertThat(r.get(0).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(r.get(1).get("ok").asBoolean()).isTrue();
        assertThat(atual(outro, daOutra).get("situacao").asString()).isEqualTo("ABERTA");

        JsonNode nova = mensalidade(admin, plano(admin), "Aluno Permissão");
        Map<String, Object> corpo = Map.of("itens", List.of(item(nova)));
        api.post("/cobrancas/cancelar-em-lote", null, corpo, 401);
        api.post("/cobrancas/cancelar-em-lote", membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER")), corpo, 403);
        assertThat(atual(admin, nova).get("situacao").asString()).isEqualTo("ABERTA");

        assertThat(api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(item(nova), item(nova))), 400)
                .get("codigo").asString()).isEqualTo("LOTE_INVALIDO");
        api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of()), 400);
        List<Map<String, Object>> cemEUm = new ArrayList<>();
        for (int i = 0; i < 101; i++) cemEUm.add(item(UUID.randomUUID().toString(), 0));
        api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", cemEUm), 400);
        api.post("/cobrancas/cancelar-em-lote", admin, Map.of("itens", List.of(item(nova)), "motivo", "x".repeat(301)), 400);
        assertThat(atual(admin, nova).get("situacao").asString()).isEqualTo("ABERTA");
    }

    // ---- link em lote ----

    private void configurarRecebimento() throws Exception {
        api.put("/financeiro/recebimento-online", admin, Map.of("infiniteTag", "$TREINADOR-FAKE"), 200);
    }

    @Test
    void linkEmLoteGeraUmPorItemEFalhaDeUmNaoDesfazOsOutros() throws Exception {
        configurarRecebimento();
        String plano = plano(admin);
        JsonNode a = mensalidade(admin, plano, "Aluno Link A");
        JsonNode b = mensalidade(admin, plano, "Aluno Link B");
        JsonNode cancelada = mensalidade(admin, plano, "Aluno Link C");
        api.post("/cobrancas/" + cancelada.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo", "versao", cancelada.get("versao").asLong()), 200);
        JsonNode outro = api.novoTreinador();
        JsonNode daOutra = mensalidade(outro, plano(outro), "Aluno Link Outra");

        JsonNode r = api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", List.of(
                a.get("id").asString(), cancelada.get("id").asString(), UUID.randomUUID().toString(),
                daOutra.get("id").asString(), b.get("id").asString())), 200).get("resultados");

        assertThat(r).hasSize(5);
        assertThat(r.get(0).get("ok").asBoolean()).isTrue();
        assertThat(r.get(0).get("url").asString()).startsWith("https://checkout.falsa.test/pagar/");
        assertThat(r.get(1).get("ok").asBoolean()).isFalse();
        assertThat(r.get(1).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ABERTA");
        assertThat(r.get(1).get("url").isNull()).isTrue();
        assertThat(r.get(2).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(r.get(3).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(r.get(4).get("ok").asBoolean()).isTrue();
        assertThat(r.get(4).get("url").asString()).isNotEqualTo(r.get(0).get("url").asString());
        assertThat(FALSA.requisicoes()).hasSize(2);
        // Repetir devolve os mesmos links (reaproveita), sem nova chamada ao provedor.
        JsonNode repetido = api.post("/cobrancas/link-em-lote", admin,
                Map.of("cobrancaIds", List.of(a.get("id").asString())), 200).get("resultados");
        assertThat(repetido.get(0).get("url").asString()).isEqualTo(r.get(0).get("url").asString());
        assertThat(FALSA.requisicoes()).hasSize(2);
        assertThat(auditorias("LINK_DE_PAGAMENTO_GERADO", a.get("id").asString())).isEqualTo(1);
        assertThat(auditorias("LINK_DE_PAGAMENTO_GERADO", cancelada.get("id").asString())).isZero();
    }

    @Test
    void linkEmLoteSemRecebimentoConfiguradoDaOMesmoCodigoPorItemELimitesEPermissao() throws Exception {
        JsonNode a = mensalidade(admin, plano(admin), "Aluno Sem Recebimento");

        JsonNode r = api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", List.of(a.get("id").asString())), 200)
                .get("resultados");
        assertThat(r.get(0).get("ok").asBoolean()).isFalse();
        assertThat(r.get(0).get("codigo").asString()).isEqualTo("RECEBIMENTO_ONLINE_NAO_CONFIGURADO");

        String id = a.get("id").asString();
        assertThat(api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", List.of(id, id)), 400).get("codigo").asString())
                .isEqualTo("LOTE_INVALIDO");
        api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", List.of()), 400);
        List<String> cemEUm = new ArrayList<>();
        for (int i = 0; i < 101; i++) cemEUm.add(UUID.randomUUID().toString());
        api.post("/cobrancas/link-em-lote", admin, Map.of("cobrancaIds", cemEUm), 400);
        api.post("/cobrancas/link-em-lote", null, Map.of("cobrancaIds", List.of(id)), 401);
        api.post("/cobrancas/link-em-lote", membro("Leitor", Set.of("FINANCEIRO_LER", "ALUNO_LER")),
                Map.of("cobrancaIds", List.of(id)), 403);
    }

    // ---- exportar as selecionadas ----

    private String csv(JsonNode quem, List<String> ids) throws Exception {
        var resposta = mvc.perform(MockMvcRequestBuilders.post("/financeiro/exportacao/selecionadas")
                .header("X-Treinos-Cliente", "nativo").header("Authorization", ApiDeTeste.bearer(quem))
                .contentType("application/json").content(json.writeValueAsString(Map.of("cobrancaIds", ids)))).andReturn().getResponse();
        assertThat(resposta.getStatus()).isEqualTo(200);
        assertThat(resposta.getHeader("Cache-Control")).contains("no-store");
        assertThat(resposta.getHeader("Content-Disposition")).contains("attachment").contains("financeiro-selecionadas-");
        return resposta.getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void exportacaoDasSelecionadasTemAsMesmasColunasSoDasEscolhidasEDaConsultoria() throws Exception {
        String plano = plano(admin);
        JsonNode m1 = mensalidade(admin, plano, "Aluno Exporta Um");
        mensalidade(admin, plano, "Aluno Exporta Dois");
        UUID alunoAvulsa = api.criarAluno(admin, "Aluno Exporta Avulsa");
        api.post("/financeiro/cobrancas-avulsas", admin, Map.of("pedidoId", UUID.randomUUID().toString(), "alunoIds", List.of(alunoAvulsa.toString()),
                "descricao", "Camiseta; =cmd", "valorCentavos", 4_567, "primeiroVencimento", hoje.plusDays(3).toString(),
                "parcelas", 1), 201);
        String idAvulsa = api.get("/alunos/" + alunoAvulsa + "/cobrancas", admin, 200).get(0).get("id").asString();
        JsonNode outro = api.novoTreinador();
        JsonNode daOutra = mensalidade(outro, plano(outro), "Aluno Exporta Secreto");
        api.post("/financeiro/lancamentos", admin, Map.of("data", hoje.toString(), "descricao", "Lançamento fora do CSV",
                "valorCentavos", 100, "tipo", "ENTRADA"), 200);

        String arquivo = csv(admin, List.of(m1.get("id").asString(), idAvulsa, daOutra.get("id").asString(), UUID.randomUUID().toString()));

        String[] linhas = arquivo.split("\r\n");
        assertThat(linhas[0]).isEqualTo("﻿registro;data;descricao;aluno;situacao;forma;pago_em;tipo;categoria;valor;historico_financeiro_parcial");
        assertThat(linhas).hasSize(3);
        assertThat(arquivo).contains("Aluno Exporta Um").contains("Aluno Exporta Avulsa").contains(";123,00;").contains(";45,67;");
        // A descrição da avulsa é a do treinador, escapada (ponto e vírgula entre aspas).
        assertThat(arquivo).contains("\"Camiseta; =cmd\"");
        assertThat(arquivo).doesNotContain("Aluno Exporta Dois").doesNotContain("Aluno Exporta Secreto")
                .doesNotContain("Lançamento fora do CSV");
        // Só ids de outra consultoria: o arquivo sai só com o cabeçalho, sem vazar nada.
        String vazio = csv(admin, List.of(daOutra.get("id").asString()));
        assertThat(vazio.split("\r\n")).hasSize(1);
    }

    @Test
    void exportacaoDasSelecionadasPedePermissaoERecusaLimites() throws Exception {
        JsonNode a = mensalidade(admin, plano(admin), "Aluno Exporta Permissão");
        Map<String, Object> corpo = Map.of("cobrancaIds", List.of(a.get("id").asString()));

        api.post("/financeiro/exportacao/selecionadas", null, corpo, 401);
        api.post("/financeiro/exportacao/selecionadas", membro("Sem financeiro", Set.of("ALUNO_LER")), corpo, 403);
        api.post("/financeiro/exportacao/selecionadas", admin, Map.of("cobrancaIds", List.of()), 400);
        List<String> cemEUm = new ArrayList<>();
        for (int i = 0; i < 101; i++) cemEUm.add(UUID.randomUUID().toString());
        api.post("/financeiro/exportacao/selecionadas", admin, Map.of("cobrancaIds", cemEUm), 400);
        assertThat(csv(membro("Leitor completo", Set.of("FINANCEIRO_LER", "ALUNO_LER")), List.of(a.get("id").asString())))
                .contains("Aluno Exporta Permissão");
    }
}
