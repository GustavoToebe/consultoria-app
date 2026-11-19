package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import tools.jackson.databind.JsonNode;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Os campos da Kiwify no plano comercial (assinatura e produto): só mensal, produto único entre os não arquivados. Dados fictícios. */
@AutoConfigureMockMvc
class KiwifyPlanoComercialIntegrationTest extends KiwifyDeTeste {

    private Map<String, Object> corpo(String periodicidade, Boolean assinatura, String produto, Long versao) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", "Plano " + UUID.randomUUID());
        m.put("valorCentavos", VALOR);
        m.put("periodicidade", periodicidade);
        m.put("kiwifyAssinatura", assinatura);
        m.put("kiwifyProdutoId", produto);
        if (versao != null) {
            m.put("versao", versao);
        }
        return m;
    }

    private static String produto() {
        return "prod-" + UUID.randomUUID();
    }

    private void recusado(Conta conta, Map<String, Object> corpo, String campo) throws Exception {
        JsonNode erro = api.post("/financeiro/planos", conta.login(), corpo, 422);
        assertThat(erro.get("codigo").asString()).isEqualTo("PLANO_INVALIDO");
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo(campo);
    }

    @Test
    void planoMensalGuardaAssinaturaEProdutoEAListaOsDevolve() throws Exception {
        Conta conta = novaConta();
        String produto = produto();

        JsonNode plano = api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, "  " + produto + "  ", null), 200);

        assertThat(plano.get("kiwifyAssinatura").asBoolean()).isTrue();
        assertThat(plano.get("kiwifyProdutoId").asString()).isEqualTo(produto);
        boolean achou = false;
        for (JsonNode p : api.get("/financeiro/planos", conta.login(), 200)) {
            if (plano.get("id").asString().equals(p.get("id").asString())) {
                achou = true;
                assertThat(p.get("kiwifyAssinatura").asBoolean()).isTrue();
                assertThat(p.get("kiwifyProdutoId").asString()).isEqualTo(produto);
            }
        }
        assertThat(achou).isTrue();
    }

    @Test
    void semAssinaturaOuComElaDesligadaOProdutoNaoFicaGuardado() throws Exception {
        Conta conta = novaConta();

        JsonNode semCampos = api.post("/financeiro/planos", conta.login(), corpo("MENSAL", null, null, null), 200);
        JsonNode desligada = api.post("/financeiro/planos", conta.login(), corpo("ANUAL", false, produto(), null), 200);

        for (JsonNode p : new JsonNode[] {semCampos, desligada}) {
            assertThat(p.get("kiwifyAssinatura").asBoolean()).isFalse();
            assertThat(p.path("kiwifyProdutoId").isNull()).isTrue();
        }
    }

    @Test
    void assinaturaDaKiwifySoValeEmPlanoMensal() throws Exception {
        Conta conta = novaConta();

        for (String periodicidade : new String[] {"TRIMESTRAL", "SEMESTRAL", "ANUAL", "PARCELA_UNICA"}) {
            recusado(conta, corpo(periodicidade, true, produto(), null), "kiwifyAssinatura");
        }
    }

    @Test
    void produtoObrigatorioEEmFormatoValido() throws Exception {
        Conta conta = novaConta();

        recusado(conta, corpo("MENSAL", true, null, null), "kiwifyProdutoId");
        recusado(conta, corpo("MENSAL", true, "   ", null), "kiwifyProdutoId");
        recusado(conta, corpo("MENSAL", true, "com espaço", null), "kiwifyProdutoId");
        recusado(conta, corpo("MENSAL", true, "x".repeat(101), null), "kiwifyProdutoId");
        recusado(conta, corpo("MENSAL", true, "a/b", null), "kiwifyProdutoId");
    }

    @Test
    void oProdutoEUnicoNaConsultoriaMasNaoEntreConsultoriasENemComOArquivado() throws Exception {
        Conta conta = novaConta();
        Conta outra = novaConta();
        String produto = produto();
        JsonNode primeiro = api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, produto, null), 200);

        recusado(conta, corpo("MENSAL", true, produto, null), "kiwifyProdutoId");
        api.post("/financeiro/planos", outra.login(), corpo("MENSAL", true, produto, null), 200);
        api.post("/financeiro/planos/" + primeiro.get("id").asString() + "/arquivar", conta.login(),
                Map.of("versao", primeiro.get("versao").asLong()), 200);
        JsonNode novo = api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, produto, null), 200);

        assertThat(novo.get("kiwifyProdutoId").asString()).isEqualTo(produto);
    }

    @Test
    void editarMantemOProprioProdutoTrocaDesligaEBateNoProdutoDeOutroPlano() throws Exception {
        Conta conta = novaConta();
        String produto = produto();
        String outro = produto();
        JsonNode plano = api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, produto, null), 200);
        api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, outro, null), 200);
        String id = plano.get("id").asString();

        // O próprio produto não conta como "em uso".
        JsonNode igual = api.put("/financeiro/planos/" + id, conta.login(),
                corpo("MENSAL", true, produto, plano.get("versao").asLong()), 200);
        // O de outro plano, sim.
        JsonNode erro = api.put("/financeiro/planos/" + id, conta.login(),
                corpo("MENSAL", true, outro, igual.get("versao").asLong()), 422);
        assertThat(erro.get("fieldErrors").get(0).get("field").asString()).isEqualTo("kiwifyProdutoId");
        // Desligar a assinatura apaga o produto, que fica livre para outro plano.
        JsonNode desligado = api.put("/financeiro/planos/" + id, conta.login(),
                corpo("MENSAL", false, produto, igual.get("versao").asLong()), 200);
        assertThat(desligado.get("kiwifyAssinatura").asBoolean()).isFalse();
        assertThat(desligado.path("kiwifyProdutoId").isNull()).isTrue();
        api.post("/financeiro/planos", conta.login(), corpo("MENSAL", true, produto, null), 200);
        // Trocar para um plano que não é mensal, com a assinatura ligada, é recusado.
        JsonNode anual = api.put("/financeiro/planos/" + id, conta.login(),
                corpo("ANUAL", true, produto(), desligado.get("versao").asLong()), 422);
        assertThat(anual.get("fieldErrors").get(0).get("field").asString()).isEqualTo("kiwifyAssinatura");
    }
}
