package br.com.treinos.api.pagamentos;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static br.com.treinos.api.pagamentos.ContratoDeTeste.HOJE;
import static br.com.treinos.api.pagamentos.ContratoDeTeste.corpo;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pagamentos do saldo de um contrato de saldo livre (V098): cada pagamento é uma AVULSA nova ligada à contratação, o saldo nunca fica
 * negativo, o limite do próximo lançamento reserva as abertas, o mesmo {@code pedidoId} é idempotente e outra consultoria não vê
 * nada. Só dados fictícios; cada teste cria a própria consultoria.
 */
@AutoConfigureMockMvc
class PagamentosDoSaldoIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private JdbcTemplate jdbc;

    private ApiDeTeste api;
    private JsonNode admin;
    private ContratoDeTeste contrato;

    @BeforeEach
    void preparar() throws Exception {
        api = new ApiDeTeste(mvc, json);
        admin = api.novoTreinador();
        contrato = new ContratoDeTeste(api, admin);
    }

    private JsonNode saldoAberto(UUID aluno, long total) throws Exception {
        return contrato.contratar(aluno, corpo(contrato.plano("TRIMESTRAL"), "SALDO_ABERTO", total, null, null), 200);
    }

    private static Map<String, Object> pagamento(UUID pedido, long valor, boolean jaPaga) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pedidoId", pedido.toString());
        m.put("valorCentavos", valor);
        m.put("vencimento", HOJE.toString());
        m.put("jaPaga", jaPaga);
        if (jaPaga) {
            m.put("forma", "PIX_DIRETO");
        }
        return m;
    }

    private JsonNode pagar(JsonNode contratacao, Map<String, Object> corpo, int esperado) throws Exception {
        return api.post("/contratacoes/" + contratacao.get("id").asString() + "/pagamentos-do-saldo", admin, corpo, esperado);
    }

    @Test
    void tresPagamentosLivresQuitamOContratoESemEncerrarAContratacao() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);

        JsonNode primeiro = pagar(criada, pagamento(UUID.randomUUID(), 3_000, true), 201);
        assertThat(primeiro.get("contratacao").get("contrato").get("saldoCentavos").asLong()).isEqualTo(7_000);
        pagar(criada, pagamento(UUID.randomUUID(), 2_500, true), 201);
        JsonNode terceiro = pagar(criada, pagamento(UUID.randomUUID(), 4_500, true), 201);

        JsonNode bloco = terceiro.get("contratacao").get("contrato");
        assertThat(bloco.get("pagoCentavos").asLong()).isEqualTo(10_000);
        assertThat(bloco.get("saldoCentavos").asLong()).isZero();
        assertThat(bloco.get("limiteDeLancamentoCentavos").asLong()).isZero();
        assertThat(bloco.get("cobrancasPagas").asInt()).isEqualTo(3);
        assertThat(terceiro.get("contratacao").get("situacao").asString()).isEqualTo("ATIVA");
        List<JsonNode> cobrancas = contrato.doTipo(aluno, "AVULSA");
        assertThat(cobrancas).hasSize(3);
        assertThat(cobrancas).allSatisfy(c -> {
            assertThat(c.get("situacao").asString()).isEqualTo("PAGA");
            assertThat(c.get("descricao").asString()).isEqualTo("Pagamento do saldo");
            assertThat(c.get("contratacaoId").asString()).isEqualTo(criada.get("id").asString());
        });

        // Quitado: mais um centavo já passa do que falta, e o saldo nunca fica negativo.
        JsonNode erro = pagar(criada, pagamento(UUID.randomUUID(), 1, true), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("SALDO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("valorCentavos");
        assertThat(contrato.contratacao(aluno).get("contrato").get("saldoCentavos").asLong()).isZero();
    }

    @Test
    void oLimiteReservaAsAbertasEACanceladaDevolve() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        pagar(criada, pagamento(UUID.randomUUID(), 3_000, true), 201);
        JsonNode aberta = pagar(criada, pagamento(UUID.randomUUID(), 5_000, false), 201);

        JsonNode bloco = aberta.get("contratacao").get("contrato");
        assertThat(bloco.get("saldoCentavos").asLong()).as("o saldo só abate o que foi pago").isEqualTo(7_000);
        assertThat(bloco.get("limiteDeLancamentoCentavos").asLong()).as("a aberta reserva").isEqualTo(2_000);

        JsonNode erro = pagar(criada, pagamento(UUID.randomUUID(), 2_001, false), 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("SALDO_INVALIDO");
        assertThat(ContratoDeTeste.mensagens(erro)).doesNotContain("2001");
        pagar(criada, pagamento(UUID.randomUUID(), 2_000, false), 201);

        // Cancelar uma aberta devolve o saldo ao limite.
        JsonNode cancelavel = contrato.doTipo(aluno, "AVULSA").stream()
                .filter(c -> c.get("valorCentavos").asLong() == 5_000).findFirst().orElseThrow();
        api.post("/cobrancas/" + cancelavel.get("id").asString() + "/cancelar", admin,
                Map.of("motivo", "Teste", "versao", cancelavel.get("versao").asLong()), 200);
        JsonNode depois = contrato.contratacao(aluno).get("contrato");
        assertThat(depois.get("limiteDeLancamentoCentavos").asLong()).isEqualTo(5_000);
        assertThat(depois.get("saldoCentavos").asLong()).isEqualTo(7_000);
        assertThat(depois.get("cobrancasTotal").asInt()).as("a cancelada não conta").isEqualTo(2);
    }

    @Test
    void omesmoPedidoDevolveOQueJaCriouEmVezDeRepetir() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        UUID pedido = UUID.randomUUID();

        JsonNode primeira = pagar(criada, pagamento(pedido, 4_000, false), 201);
        JsonNode repetida = pagar(criada, pagamento(pedido, 4_000, false), 200);

        assertThat(repetida.get("cobrancaId").asString()).isEqualTo(primeira.get("cobrancaId").asString());
        assertThat(contrato.doTipo(aluno, "AVULSA")).hasSize(1);
        assertThat(repetida.get("contratacao").get("contrato").get("limiteDeLancamentoCentavos").asLong()).isEqualTo(6_000);
        // O mesmo pedido noutra contratação não é aceito (nunca duas cobranças por um pedido).
        UUID outroAluno = contrato.aluno();
        JsonNode outra = saldoAberto(outroAluno, 10_000);
        assertThat(pagar(outra, pagamento(pedido, 4_000, false), 409).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");
        assertThat(contrato.doTipo(outroAluno, "AVULSA")).isEmpty();
    }

    @Test
    void omesmoPedidoComCorpoDiferenteDa409EIgualContinua200() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        UUID aberto = UUID.randomUUID();
        UUID recebido = UUID.randomUUID();
        pagar(criada, pagamento(aberto, 4_000, false), 201);
        pagar(criada, pagamento(recebido, 1_000, true), 201);

        // Trocar "fica em aberto" por "já recebi" (e o contrário) com o mesmo pedido é outro pedido, não uma repetição.
        JsonNode erro = pagar(criada, pagamento(aberto, 4_000, true), 409);
        assertThat(erro.get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");
        assertThat(ContratoDeTeste.mensagens(erro)).doesNotContain("4000");
        assertThat(pagar(criada, pagamento(recebido, 1_000, false), 409).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");
        assertThat(pagar(criada, pagamento(aberto, 4_001, false), 409).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");
        Map<String, Object> outroDia = pagamento(aberto, 4_000, false);
        outroDia.put("vencimento", HOJE.plusDays(1).toString());
        assertThat(pagar(criada, outroDia, 409).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");
        Map<String, Object> outraForma = pagamento(recebido, 1_000, true);
        outraForma.put("forma", "DINHEIRO");
        assertThat(pagar(criada, outraForma, 409).get("codigo").asString()).isEqualTo("PEDIDO_JA_USADO");

        // O corpo igual segue sendo a repetição de sempre, e nada foi criado pelas recusas.
        pagar(criada, pagamento(aberto, 4_000, false), 200);
        pagar(criada, pagamento(recebido, 1_000, true), 200);
        assertThat(contrato.doTipo(aluno, "AVULSA")).hasSize(2);
        assertThat(contrato.contratacao(aluno).get("contrato").get("pagoCentavos").asLong()).isEqualTo(1_000);
    }

    @Test
    void semFinanceiroAlterarOPagamentoDoSaldoDa403() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        JsonNode leitor = contrato.membro(java.util.Set.of("FINANCEIRO_LER", "ALUNO_LER"));

        api.post("/contratacoes/" + criada.get("id").asString() + "/pagamentos-do-saldo", leitor,
                pagamento(UUID.randomUUID(), 1_000, false), 403);

        assertThat(contrato.doTipo(aluno, "AVULSA")).isEmpty();
    }

    @Test
    void duasChamadasAoMesmoTempoNuncaPassamDoTotal() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        String caminho = "/contratacoes/" + criada.get("id").asString() + "/pagamentos-do-saldo";
        Callable<Integer> chamada = () -> mvc.perform(MockMvcRequestBuilders.post(caminho)
                .header("X-Treinos-Cliente", "nativo").header(HttpHeaders.AUTHORIZATION, ApiDeTeste.bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(pagamento(UUID.randomUUID(), 6_000, false)))).andReturn().getResponse().getStatus();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> a = pool.submit(chamada);
            Future<Integer> b = pool.submit(chamada);
            assertThat(List.of(a.get(), b.get())).containsExactlyInAnyOrder(201, 422);
        } finally {
            pool.shutdownNow();
        }
        assertThat(contrato.doTipo(aluno, "AVULSA")).hasSize(1);
    }

    @Test
    void soContratoDeSaldoLivreAtivoRecebePagamento() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode parcelado = contrato.contratar(aluno, corpo(contrato.plano("MENSAL"), "PARCELADO_FIXO", 5_000L, null,
                List.of(ContratoDeTeste.parcela(HOJE.plusDays(3), 5_000))), 200);
        assertThat(pagar(parcelado, pagamento(UUID.randomUUID(), 1_000, false), 409).get("codigo").asString())
                .isEqualTo("CONTRATO_NAO_ACEITA_SALDO");

        UUID outro = contrato.aluno();
        JsonNode saldo = saldoAberto(outro, 5_000);
        api.post("/contratacoes/" + saldo.get("id").asString() + "/encerrar", admin,
                Map.of("versao", saldo.get("versao").asLong()), 200);
        assertThat(pagar(saldo, pagamento(UUID.randomUUID(), 1_000, false), 409).get("codigo").asString())
                .isEqualTo("CONTRATACAO_ENCERRADA");
    }

    @Test
    void corpoInvalidoDa422PorCampoSemRepetirOValor() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        Map<String, Object> ruim = pagamento(UUID.randomUUID(), 0, false);
        ruim.remove("pedidoId");
        ruim.put("vencimento", "1990-01-01");

        JsonNode erro = pagar(criada, ruim, 422);

        assertThat(erro.get("codigo").asString()).isEqualTo("CONTRATO_INVALIDO");
        assertThat(erro.get("fieldErrors").valueStream().map(f -> f.get("field").asString()).toList())
                .containsExactlyInAnyOrder("pedidoId", "valorCentavos", "vencimento");
        assertThat(contrato.cobrancas(aluno)).isEmpty();
    }

    @Test
    void outraConsultoriaNaoEnxergaOContratoNemPaga() throws Exception {
        UUID aluno = contrato.aluno();
        JsonNode criada = saldoAberto(aluno, 10_000);
        JsonNode outro = api.novoTreinador();

        api.post("/contratacoes/" + criada.get("id").asString() + "/pagamentos-do-saldo", outro,
                pagamento(UUID.randomUUID(), 1_000, false), 404);
        assertThat(jdbc.queryForObject("select count(*) from cobranca_aluno where aluno_id = ?::uuid", Integer.class,
                aluno.toString())).isZero();
    }
}
