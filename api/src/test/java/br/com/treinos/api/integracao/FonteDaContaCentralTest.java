package br.com.treinos.api.integracao;

import static org.assertj.core.api.Assertions.assertThat;

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
        "https://checkout.infinitepay.io/loja/abc123"
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
}
