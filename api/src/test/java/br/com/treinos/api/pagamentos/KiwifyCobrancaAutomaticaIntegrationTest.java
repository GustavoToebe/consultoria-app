package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.EmailDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A mensalidade cobrada pela Kiwify (D18): marcada na leitura ({@code cobrancaAutomatica: "KIWIFY"}), sem link, Pix nem lembrete
 * por e-mail, e que volta a ser comum sem a credencial. A baixa manual, o cancelamento e a geração mensal valem como sempre.
 * Dados fictícios.
 */
@AutoConfigureMockMvc
class KiwifyCobrancaAutomaticaIntegrationTest extends KiwifyDeTeste {

    @Autowired private LembretesDeCobranca lembretes;
    @Autowired private EnviadorDeEmail enviador;

    /** Um aluno com o plano mensal comum (sem Kiwify) e a cobrança aberta dele. */
    private Assinante comum(Conta conta) throws Exception {
        JsonNode plano = api.post("/financeiro/planos", conta.login(),
                Map.of("nome", "Plano comum " + UUID.randomUUID(), "valorCentavos", VALOR, "periodicidade", "MENSAL"), 200);
        String email = emailUnico();
        UUID aluno = alunoComEmail(conta, email);
        contratar(conta, aluno, plano);
        UUID cobranca = UUID.fromString(cobrancasDe(conta, aluno, "ABERTA").get(0).get("id").asString());
        return new Assinante(conta, aluno, email, null, plano.get("id").asString(), cobranca);
    }

    private JsonNode cobrancaDoTreinador(Assinante a) throws Exception {
        for (JsonNode c : api.get("/alunos/" + a.aluno() + "/cobrancas", a.conta().login(), 200)) {
            if (a.cobranca().toString().equals(c.get("id").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem a cobrança.");
    }

    private void ligarLembretes(Conta conta) throws Exception {
        api.put("/financeiro/lembretes", conta.login(),
                Map.of("ligado", true, "diasAntes", 3, "noDia", true, "diasDepois", 3), 200);
    }

    private int lembretesNaFila(UUID cobranca) {
        Integer n = jdbc.queryForObject("select count(*) from lembrete_cobranca where cobranca_id = ?", Integer.class, cobranca);
        return n == null ? 0 : n;
    }

    @Test
    void aMensalidadeDoPlanoDaKiwifyVemMarcadaParaATelaEAComumNao() throws Exception {
        Conta conta = novaConta();
        Assinante kiwify = novoAssinante(conta);
        Assinante comum = comum(conta);

        assertThat(cobrancaDoTreinador(kiwify).get("cobrancaAutomatica").asString()).isEqualTo("KIWIFY");
        assertThat(cobrancaDoTreinador(comum).path("cobrancaAutomatica").isNull()).isTrue();
        JsonNode pagina = api.get("/financeiro/cobrancas", conta.login(), 200);
        List<String> marcas = new ArrayList<>();
        for (JsonNode c : pagina.get("itens")) {
            marcas.add(c.get("id").asString() + "=" + c.path("cobrancaAutomatica").asString("-"));
        }
        assertThat(marcas).contains(kiwify.cobranca() + "=KIWIFY", comum.cobranca() + "=-");
    }

    @Test
    void semLinkNemPixParaAEquipeNemParaOAluno() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        String cobranca = a.cobranca().toString();

        assertThat(api.post("/cobrancas/" + cobranca + "/link", conta.login(), null, 409).get("codigo").asString())
                .isEqualTo("COBRANCA_AUTOMATICA");
        JsonNode lote = api.post("/cobrancas/link-em-lote", conta.login(), Map.of("cobrancaIds", List.of(cobranca)), 200);
        assertThat(lote.get("resultados").get(0).get("ok").asBoolean()).isFalse();
        assertThat(lote.get("resultados").get(0).get("codigo").asString()).isEqualTo("COBRANCA_AUTOMATICA");

        JsonNode aluno = api.convidarEEntrar(conta.login(), a.aluno());
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobranca + "/link", aluno, null, 409).get("codigo").asString())
                .isEqualTo("COBRANCA_AUTOMATICA");
        assertThat(api.post("/aluno/financeiro/cobrancas/" + cobranca + "/pix", aluno, null, 409).get("codigo").asString())
                .isEqualTo("COBRANCA_AUTOMATICA");
    }

    @Test
    void oAlunoSoDaKiwifyVeSoInformacaoSemFormaDePagarOnlineNemPix() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        JsonNode aluno = api.convidarEEntrar(conta.login(), a.aluno());

        JsonNode financeiro = api.get("/aluno/financeiro", aluno, 200);

        assertThat(financeiro.get("pagamentoOnline").asBoolean()).isFalse();
        List<String> formas = new ArrayList<>();
        financeiro.get("formasDePagamento").forEach(f -> formas.add(f.asString()));
        assertThat(formas).containsExactly("MANUAL");
        assertThat(financeiro.get("abertas")).hasSize(1);
        assertThat(financeiro.get("abertas").get(0).get("cobrancaAutomatica").asString()).isEqualTo("KIWIFY");
        assertThat(financeiro.get("plano").get("linkDePagamento").isNull()).isTrue();
    }

    @Test
    void nenhumLembretePorEmailAntesNoDiaNemDepoisDeVencida() throws Exception {
        Conta conta = novaConta();
        ligarLembretes(conta);
        Assinante kiwify = novoAssinante(conta);
        Assinante comum = comum(conta);
        LocalDate vencimento = LocalDate.parse(cobrancaDoTreinador(kiwify).get("vencimento").asString());

        for (LocalDate dia : List.of(vencimento.minusDays(3), vencimento, vencimento.plusDays(3))) {
            lembretes.rodar(dia, enviador);
        }

        assertThat(EmailDeTeste.para(kiwify.email())).isEmpty();
        assertThat(lembretesNaFila(kiwify.cobranca())).isZero();
        assertThat(EmailDeTeste.para(comum.email())).as("a comum continua recebendo").isNotEmpty();
        assertThat(lembretesNaFila(comum.cobranca())).isPositive();
    }

    @Test
    void baixaManualCancelarEADesfazerAManualValemNaCobrancaAutomatica() throws Exception {
        Conta conta = novaConta();
        Assinante paga = novoAssinante(conta);
        Assinante cancelada = novoAssinante(conta);

        JsonNode baixada = api.post("/cobrancas/" + paga.cobranca() + "/baixa-manual", conta.login(),
                Map.of("data", hoje.toString(), "forma", "DINHEIRO", "versao", cobrancaDoTreinador(paga).get("versao").asLong()), 200);
        JsonNode cancelamento = api.post("/cobrancas/" + cancelada.cobranca() + "/cancelar", conta.login(),
                Map.of("motivo", "teste", "versao", cobrancaDoTreinador(cancelada).get("versao").asLong()), 200);

        assertThat(baixada.get("situacao").asString()).isEqualTo("PAGA");
        assertThat(baixada.get("cobrancaAutomatica").asString()).isEqualTo("KIWIFY");
        assertThat(cancelamento.get("situacao").asString()).isEqualTo("CANCELADA");
        JsonNode desfeita = api.post("/cobrancas/" + paga.cobranca() + "/desfazer-baixa", conta.login(),
                Map.of("motivo", "teste", "versao", baixada.get("versao").asLong()), 200);
        assertThat(desfeita.get("situacao").asString()).isEqualTo("ABERTA");
    }

    @Test
    void aMensalidadeSeguiGeradaTodoMesComoSempre() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        long antes = cobrancasDe(conta, a.aluno(), null).size();

        rotina.rodarNa(conta.consultoria(), hoje.plusMonths(2));

        List<JsonNode> depois = cobrancasDe(conta, a.aluno(), null);
        assertThat(depois.size()).as("a rotina gera as mensalidades seguintes").isGreaterThan((int) antes);
        for (JsonNode c : depois) {
            assertThat(c.get("cobrancaAutomatica").asString()).isEqualTo("KIWIFY");
        }
    }

    // ---- renegociar (D3, 18/11) ----

    private static final String MENSAGEM_DA_RENEGOCIACAO = "Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.";

    private Map<String, Object> corpoDaRenegociacao(List<JsonNode> cobrancas, boolean confirmar) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("itens", cobrancas.stream().map(c -> Map.of("cobrancaId", c.get("id").asString(), "versao", c.get("versao").asLong())).toList());
        m.put("acrescimoCentavos", 0);
        m.put("descontoCentavos", 0);
        m.put("parcelas", 2);
        m.put("primeiroVencimento", hoje.plusDays(10).toString());
        if (confirmar) {
            m.put("pedidoId", UUID.randomUUID().toString());
            m.put("motivo", "Motivo fictício do acordo");
        }
        return m;
    }

    private JsonNode avulsaDoAluno(Assinante a) throws Exception {
        String descricao = "Avulsa fictícia " + UUID.randomUUID();
        api.post("/financeiro/cobrancas-avulsas", a.conta().login(), Map.of("pedidoId", UUID.randomUUID().toString(),
                "alunoIds", List.of(a.aluno().toString()), "descricao", descricao, "valorCentavos", 2_500,
                "primeiroVencimento", hoje.plusDays(3).toString(), "parcelas", 1), 201);
        for (JsonNode c : api.get("/alunos/" + a.aluno() + "/cobrancas", a.conta().login(), 200)) {
            if (descricao.equals(c.path("descricao").asString())) {
                return c;
            }
        }
        throw new AssertionError("Sem a avulsa.");
    }

    private int acordosDe(Conta conta) {
        return jdbc.queryForObject("select count(*) from acordo_de_cobranca where consultoria_id = ?", Integer.class, conta.consultoria());
    }

    @Test
    void renegociarMensalidadeDaKiwifyEhRecusadoNaPreviaENoConfirmarSemEfeito() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        List<JsonNode> kiwify = List.of(cobrancaDoTreinador(a));

        JsonNode previa = api.post("/cobrancas/renegociar/previa", conta.login(), corpoDaRenegociacao(kiwify, false), 409);
        JsonNode confirmar = api.post("/cobrancas/renegociar", conta.login(), corpoDaRenegociacao(kiwify, true), 409);

        for (JsonNode erro : List.of(previa, confirmar)) {
            assertThat(erro.get("codigo").asString()).isEqualTo("RENEGOCIACAO_COBRANCA_AUTOMATICA");
            assertThat(erro.get("message").asString()).isEqualTo(MENSAGEM_DA_RENEGOCIACAO);
        }
        assertThat(cobrancaDoTreinador(a).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(acordosDe(conta)).isZero();
    }

    @Test
    void loteComUmaCobrancaDaKiwifyEhRecusadoInteiroEmQualquerOrdem() throws Exception {
        Conta conta = novaConta();
        Assinante a = novoAssinante(conta);
        JsonNode kiwify = cobrancaDoTreinador(a);
        JsonNode avulsa = avulsaDoAluno(a);

        for (List<JsonNode> lote : List.of(List.of(avulsa, kiwify), List.of(kiwify, avulsa))) {
            assertThat(api.post("/cobrancas/renegociar/previa", conta.login(), corpoDaRenegociacao(lote, false), 409)
                    .get("codigo").asString()).isEqualTo("RENEGOCIACAO_COBRANCA_AUTOMATICA");
            assertThat(api.post("/cobrancas/renegociar", conta.login(), corpoDaRenegociacao(lote, true), 409)
                    .get("codigo").asString()).isEqualTo("RENEGOCIACAO_COBRANCA_AUTOMATICA");
        }
        assertThat(acordosDe(conta)).as("nada foi renegociado").isZero();
        assertThat(cobrancaDoTreinador(a).get("situacao").asString()).isEqualTo("ABERTA");
        assertThat(api.get("/alunos/" + a.aluno() + "/cobrancas", conta.login(), 200).toString()).doesNotContain("RENEGOCIADA");
    }

    @Test
    void mensalidadeComumContinuaRenegociavelEADaKiwifyVoltaASerSemACredencial() throws Exception {
        Conta conta = novaConta();
        Assinante comum = comum(conta);
        Assinante kiwify = novoAssinante(conta);

        api.post("/cobrancas/renegociar/previa", conta.login(), corpoDaRenegociacao(List.of(cobrancaDoTreinador(comum)), false), 200);
        api.post("/cobrancas/renegociar", conta.login(), corpoDaRenegociacao(List.of(cobrancaDoTreinador(comum)), true), 201);
        assertThat(acordosDe(conta)).isEqualTo(1);

        // Sem a credencial a Kiwify não cobra mais nada (mesma noção do link e do Pix): a mensalidade volta a ser comum.
        api.delete("/financeiro/kiwify", conta.login(), 204);
        api.post("/cobrancas/renegociar", conta.login(), corpoDaRenegociacao(List.of(cobrancaDoTreinador(kiwify)), true), 201);
        assertThat(acordosDe(conta)).isEqualTo(2);
    }

    @Test
    void semACredencialAMensalidadeVoltaASerComum() throws Exception {
        Conta conta = novaConta();
        ligarLembretes(conta);
        Assinante a = novoAssinante(conta);
        assertThat(cobrancaDoTreinador(a).get("cobrancaAutomatica").asString()).isEqualTo("KIWIFY");

        api.delete("/financeiro/kiwify", conta.login(), 204);

        assertThat(cobrancaDoTreinador(a).path("cobrancaAutomatica").isNull()).isTrue();
        // O link volta a depender só da InfinitePay (que esta conta não configurou): outro 409, não o da Kiwify.
        assertThat(api.post("/cobrancas/" + a.cobranca() + "/link", conta.login(), null, 409).get("codigo").asString())
                .isNotEqualTo("COBRANCA_AUTOMATICA");
        LocalDate vencimento = LocalDate.parse(cobrancaDoTreinador(a).get("vencimento").asString());
        lembretes.rodar(vencimento.minusDays(3), enviador);
        assertThat(EmailDeTeste.para(a.email())).as("e os lembretes voltam").isNotEmpty();
    }
}
