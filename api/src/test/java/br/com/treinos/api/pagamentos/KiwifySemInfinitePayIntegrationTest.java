package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A Kiwify ligada com a InfinitePay DESLIGADA: as conferências respondem (servem a qualquer recebimento online ligado), o
 * webhook entra e a baixa automática acontece. A Kiwify não depende da InfinitePay. Dados fictícios.
 */
@AutoConfigureMockMvc
class KiwifySemInfinitePayIntegrationTest extends KiwifyDeTeste {

    @DynamicPropertySource
    static void semInfinitePay(DynamicPropertyRegistry registry) {
        registry.add("treinos.pagamentos.infinitepay.habilitado", () -> "false");
    }

    @Test
    void asConferenciasRespondemEABaixaAutomaticaFunciona() throws Exception {
        Assinante a = novoAssinante(novaConta());
        String pedido = pedido();
        FALSA.venda(pedido, "paid", a.produto(), a.email(), VALOR);
        avisar(a.conta(), corpo(pedido, "order_approved"));
        String semAluno = pedido();
        FALSA.venda(semAluno, "paid", a.produto(), emailUnico(), VALOR);
        avisar(a.conta(), corpo(semAluno, "order_approved"));

        rodar();

        assertThat(cobrancaNoBanco(a.cobranca()).get("situacao")).isEqualTo("PAGA");
        JsonNode itens = api.get("/financeiro/conferencias", a.conta().login(), 200).get("itens");
        assertThat(itens).hasSize(1);
        assertThat(itens.get(0).get("provedor").asString()).isEqualTo("KIWIFY");
        assertThat(itens.get(0).get("idExterno").asString()).isEqualTo(semAluno);
        // O recebimento online da InfinitePay segue fechado.
        assertThat(api.get("/financeiro/recebimento-online", a.conta().login(), 503).get("codigo").asString())
                .isEqualTo("RECEBIMENTO_ONLINE_INDISPONIVEL");
    }
}
