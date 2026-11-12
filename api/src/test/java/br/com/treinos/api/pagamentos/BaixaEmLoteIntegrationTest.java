package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import br.com.treinos.api.web.Fuso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code POST /cobrancas/baixa-em-lote}: vários itens, falha parcial (cada item na sua transação), inexistente e de outra
 * consultoria com o mesmo código, permissão, limites, repetir sem duplicar, próxima cobrança por item e isolamento. A recusa
 * de flag desligada (503) está em {@link PagamentosDesligadosIntegrationTest}. Dados fictícios; nenhum pagamento real.
 */
@AutoConfigureMockMvc
class BaixaEmLoteIntegrationTest extends AbstractIntegrationTest {

    private static final String ROTA = "/cobrancas/baixa-em-lote";

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private final LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
    private ApiDeTeste api;
    private JsonNode admin;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
    }

    private String plano(JsonNode quem) throws Exception {
        Map<String, Object> plano = new LinkedHashMap<>();
        plano.put("nome", "Plano " + UUID.randomUUID());
        plano.put("valorCentavos", 12_300);
        plano.put("periodicidade", "MENSAL");
        return api.post("/financeiro/planos", quem, plano, 200).get("id").asString();
    }

    /** Aluno novo com contratação mensal; devolve a primeira cobrança (aberta). */
    private JsonNode cobranca(JsonNode quem, String planoId) throws Exception {
        String aluno = api.post("/alunos", quem, Map.of("nome", "Aluno Fictício " + UUID.randomUUID()), 200).get("id").asString();
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

    private static Map<String, Object> item(JsonNode cobranca) {
        return item(cobranca.get("id").asString(), cobranca.get("versao").asLong());
    }

    private Map<String, Object> lote(List<Map<String, Object>> itens) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("itens", itens);
        corpo.put("data", hoje.toString());
        corpo.put("forma", "PIX_DIRETO");
        corpo.put("observacao", "Lote fictício");
        return corpo;
    }

    private int auditorias(String cobrancaId) {
        Integer n = jdbc.queryForObject("select count(*) from auditoria where acao = 'PAGAMENTO_MANUAL_REGISTRADO' "
                + "and entidade_id = ?::uuid", Integer.class, cobrancaId);
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

    @Test
    void variosItensGravamECadaUmGeraASeguinteERepetirNaoDuplica() throws Exception {
        String plano = plano(admin);
        List<JsonNode> cobrancas = List.of(cobranca(admin, plano), cobranca(admin, plano), cobranca(admin, plano));
        List<Map<String, Object>> itens = cobrancas.stream().map(BaixaEmLoteIntegrationTest::item).toList();

        JsonNode resposta = api.post(ROTA, admin, lote(itens), 200);

        JsonNode resultados = resposta.get("resultados");
        assertThat(resultados).hasSize(3);
        for (int i = 0; i < 3; i++) {
            assertThat(resultados.get(i).get("cobrancaId").asString()).isEqualTo(cobrancas.get(i).get("id").asString());
            assertThat(resultados.get(i).get("ok").asBoolean()).isTrue();
            assertThat(resultados.get(i).get("codigo").isNull()).isTrue();
            JsonNode paga = atual(admin, cobrancas.get(i));
            assertThat(paga.get("situacao").asString()).isEqualTo("PAGA");
            assertThat(paga.get("pagoEm").asString()).isEqualTo(hoje.toString());
            assertThat(paga.get("forma").asString()).isEqualTo("PIX_DIRETO");
            assertThat(paga.get("valorCentavos").asLong()).isEqualTo(12_300);
            // A baixa gera a próxima cobrança, uma por item.
            JsonNode todas = api.get("/alunos/" + cobrancas.get(i).get("alunoId").asString() + "/cobrancas", admin, 200);
            assertThat(todas).hasSize(2);
            assertThat(todas.get(0).get("situacao").asString()).isEqualTo("ABERTA");
            assertThat(auditorias(cobrancas.get(i).get("id").asString())).isEqualTo(1);
        }

        // Repetir o mesmo lote (versões já velhas): idempotente, sem nova cobrança nem nova auditoria.
        JsonNode repetido = api.post(ROTA, admin, lote(itens), 200);
        for (JsonNode r : repetido.get("resultados")) {
            assertThat(r.get("ok").asBoolean()).isTrue();
            // Não gravou nada agora: o lote avisa que já estava paga, em vez de fingir que registrou.
            assertThat(r.get("codigo").asString()).isEqualTo("JA_ESTAVA_PAGA");
        }
        for (JsonNode c : cobrancas) {
            assertThat(api.get("/alunos/" + c.get("alunoId").asString() + "/cobrancas", admin, 200)).hasSize(2);
            assertThat(auditorias(c.get("id").asString())).isEqualTo(1);
        }
    }

    @Test
    void umItemQueFalhaNaoDesfazOsOutros() throws Exception {
        String plano = plano(admin);
        JsonNode boa = cobranca(admin, plano);
        JsonNode velha = cobranca(admin, plano);
        JsonNode cancelada = cobranca(admin, plano);
        JsonNode jaPaga = cobranca(admin, plano);
        JsonNode outraBoa = cobranca(admin, plano);
        api.post("/cobrancas/" + cancelada.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Motivo fictício", "versao", cancelada.get("versao").asLong()), 200);
        api.post("/cobrancas/" + jaPaga.get("id").asString() + "/baixa-manual", admin,
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", jaPaga.get("versao").asLong()), 200);

        JsonNode resposta = api.post(ROTA, admin, lote(List.of(
                item(boa),
                item(velha.get("id").asString(), velha.get("versao").asLong() + 7),
                item(cancelada.get("id").asString(), cancelada.get("versao").asLong() + 1),
                item(jaPaga),
                item(outraBoa))), 200);

        JsonNode r = resposta.get("resultados");
        assertThat(r).hasSize(5);
        assertThat(r.get(0).get("ok").asBoolean()).isTrue();
        assertThat(r.get(1).get("ok").asBoolean()).isFalse();
        assertThat(r.get(1).get("codigo").asString()).isEqualTo("CONFLITO_EDICAO");
        assertThat(r.get(2).get("ok").asBoolean()).isFalse();
        assertThat(r.get(2).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ABERTA");
        // Já paga: idempotente, como na baixa individual.
        assertThat(r.get(3).get("ok").asBoolean()).isTrue();
        assertThat(r.get(4).get("ok").asBoolean()).isTrue();
        // O que falhou não mudou; o que deu certo gravou, antes e depois do que falhou.
        assertThat(atual(admin, boa).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(atual(admin, velha).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(atual(admin, cancelada).get("situacao").asString()).isEqualTo("CANCELADA");
        assertThat(atual(admin, outraBoa).get("situacao").asString()).isEqualTo("PAGA");
        assertThat(auditorias(velha.get("id").asString())).isZero();
        assertThat(auditorias(boa.get("id").asString())).isEqualTo(1);
        assertThat(auditorias(outraBoa.get("id").asString())).isEqualTo(1);
        // A resposta de falha não carrega nome nem valor.
        assertThat(resposta.toString()).doesNotContain("Aluno Fictício").doesNotContain("12300");
    }

    @Test
    void inexistenteEDeOutraConsultoriaDaoOMesmoCodigoENadaMuda() throws Exception {
        JsonNode outro = api.novoTreinador();
        JsonNode daOutra = cobranca(outro, plano(outro));
        JsonNode minha = cobranca(admin, plano(admin));

        JsonNode resposta = api.post(ROTA, admin, lote(List.of(
                item(UUID.randomUUID().toString(), 0),
                item(daOutra.get("id").asString(), daOutra.get("versao").asLong()),
                item(minha))), 200);

        JsonNode r = resposta.get("resultados");
        assertThat(r.get(0).get("ok").asBoolean()).isFalse();
        assertThat(r.get(0).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        assertThat(r.get(1).get("ok").asBoolean()).isFalse();
        assertThat(r.get(1).get("codigo").asString()).isEqualTo(r.get(0).get("codigo").asString());
        assertThat(r.get(2).get("ok").asBoolean()).isTrue();
        // A cobrança da outra consultoria segue aberta, sem auditoria, e a resposta não a descreve.
        assertThat(atual(outro, daOutra).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(auditorias(daOutra.get("id").asString())).isZero();
        assertThat(r.get(1).toString()).doesNotContain(daOutra.get("alunoNome").asString());
    }

    @Test
    void cadaRotaPedeAPermissaoCerta() throws Exception {
        JsonNode cobranca = cobranca(admin, plano(admin));
        Map<String, Object> corpo = lote(List.of(item(cobranca)));

        api.post(ROTA, membro("Sem financeiro", Set.of("ALUNO_LER")), corpo, 403);
        api.post(ROTA, membro("Leitor financeiro", Set.of("FINANCEIRO_LER", "ALUNO_LER")), corpo, 403);
        api.post(ROTA, null, corpo, 401);
        api.post(ROTA, api.convidarEEntrar(admin, UUID.fromString(cobranca.get("alunoId").asString())), corpo, 403);
        assertThat(atual(admin, cobranca).get("situacao").asString()).isEqualTo("ABERTA");

        JsonNode gestor = membro("Gestor financeiro", Set.of("FINANCEIRO_ALTERAR", "FINANCEIRO_LER", "ALUNO_LER"));
        assertThat(api.post(ROTA, gestor, corpo, 200).get("resultados").get(0).get("ok").asBoolean()).isTrue();
    }

    @Test
    void limitesDoLoteEDadosDaBaixa() throws Exception {
        JsonNode cobranca = cobranca(admin, plano(admin));
        List<Map<String, Object>> cem = new ArrayList<>();
        List<Map<String, Object>> cemEUm = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            Map<String, Object> inexistente = item(UUID.randomUUID().toString(), 0);
            if (i < 100) cem.add(inexistente);
            cemEUm.add(inexistente);
        }

        // 100 cabe (todos inexistentes, todos com o mesmo código); 101 não.
        JsonNode r = api.post(ROTA, admin, lote(cem), 200).get("resultados");
        assertThat(r).hasSize(100);
        assertThat(r.get(99).get("codigo").asString()).isEqualTo("COBRANCA_NAO_ENCONTRADA");
        api.post(ROTA, admin, lote(cemEUm), 400);
        api.post(ROTA, admin, lote(List.of()), 400);
        // Ids repetidos recusam o lote inteiro, antes de gravar qualquer coisa.
        assertThat(api.post(ROTA, admin, lote(List.of(item(cobranca), item(cobranca))), 400).get("codigo").asString())
                .isEqualTo("LOTE_INVALIDO");
        assertThat(atual(admin, cobranca).get("situacao").asString()).isEqualTo("ABERTA");

        // Dados da baixa conferidos uma vez, antes de qualquer item (os mesmos 422 da baixa individual).
        Map<String, Object> futura = lote(List.of(item(cobranca)));
        futura.put("data", hoje.plusDays(1).toString());
        assertThat(api.post(ROTA, admin, futura, 422).get("codigo").asString()).isEqualTo("COBRANCA_INVALIDA");
        Map<String, Object> online = lote(List.of(item(cobranca)));
        online.put("forma", "PIX");
        assertThat(api.post(ROTA, admin, online, 422).get("codigo").asString()).isEqualTo("COBRANCA_INVALIDA");
        Map<String, Object> semData = lote(List.of(item(cobranca)));
        semData.remove("data");
        api.post(ROTA, admin, semData, 400);
        Map<String, Object> itemSemVersao = item(cobranca);
        itemSemVersao.remove("versao");
        api.post(ROTA, admin, lote(List.of(itemSemVersao)), 400);
        assertThat(atual(admin, cobranca).get("situacao").asString()).isEqualTo("ABERTA");
    }

    @Test
    void corpoComValorEIgnoradoOServidorDecide() throws Exception {
        JsonNode cobranca = cobranca(admin, plano(admin));
        Map<String, Object> corpo = lote(List.of(item(cobranca)));
        corpo.put("valorCentavos", 1);

        api.post(ROTA, admin, corpo, 200);

        assertThat(atual(admin, cobranca).get("valorCentavos").asLong()).isEqualTo(12_300);
    }
}
