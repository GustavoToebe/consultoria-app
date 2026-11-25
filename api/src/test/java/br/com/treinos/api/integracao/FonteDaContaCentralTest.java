package br.com.treinos.api.integracao;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.treinos.api.conta.PagamentoTransparenteDto.CartaoDados;
import br.com.treinos.api.conta.PagamentoTransparenteDto.PagarCartaoAsaasRequest;
import br.com.treinos.api.conta.PagamentoTransparenteDto.TitularCartaoDados;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Endereço do checkout devolvido pela Central (contrato 6.4): só os hosts conhecidos, em https, sem usuário nem porta. */
class FonteDaContaCentralTest {

    @ParameterizedTest
    @ValueSource(strings = {
        "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=teste",
        "https://www.mercadopago.com/checkout/v1/redirect?pref_id=teste",
        "https://checkout.infinitepay.com.br/loja/abc123",
        "https://checkout.infinitepay.io/loja/abc123",
        "https://www.asaas.com/i/abc123",
        "https://sandbox.asaas.com/i/abc123"
    })
    void aceitaOsCheckoutsDaCentral(String url) {
        assertThat(FonteDaContaCentral.urlDeCheckout(url)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "http://checkout.infinitepay.com.br/loja/abc123",
        "https://checkout.infinitepay.com.br.example/loja",
        "https://evil.example/checkout.infinitepay.com.br",
        "https://usuario@checkout.infinitepay.io/loja",
        "https://checkout.infinitepay.io:8443/loja",
        "https://infinitepay.io/loja",
        "https://mercadopago.com.br/checkout",
        "javascript:alert(1)",
        "não é url",
        ""
    })
    void recusaQualquerOutroEndereco(String url) {
        assertThat(FonteDaContaCentral.urlDeCheckout(url)).isFalse();
    }

    @Test
    void comparaOHostExatamente() {
        assertThat(FonteDaContaCentral.urlDeCheckout("https://CHECKOUT.infinitepay.io/x")).isFalse();
    }

    @Test
    void dadosDeCartaoNuncaVazamEmToString() {
        var cartao = new CartaoDados("FULANO DE TAL", "4111111111111111", "12", "2030", "987");
        var titular = new TitularCartaoDados("Fulano", "12345678909", "f@exemplo.com", "41999990000", "80000000", "100");
        var req = new PagarCartaoAsaasRequest("12345678909", 1, cartao, titular);

        assertThat(cartao.toString()).isEqualTo("[PROTEGIDO]").doesNotContain("4111").doesNotContain("987");
        assertThat(titular.toString()).isEqualTo("[PROTEGIDO]").doesNotContain("12345678909");
        assertThat(req.toString()).isEqualTo("[PROTEGIDO]").doesNotContain("4111").doesNotContain("987");
    }
}
