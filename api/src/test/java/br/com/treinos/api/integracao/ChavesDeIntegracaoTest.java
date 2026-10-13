package br.com.treinos.api.integracao;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChavesDeIntegracaoTest {

    private static String segredo(int bytes) {
        return Base64.getEncoder().encodeToString(new byte[bytes]);
    }

    private static IntegracaoProperties props(boolean ativa, String entrada, String saidaId, String saidaSegredo, String url) {
        return new IntegracaoProperties(ativa, entrada, saidaId, saidaSegredo, url, null, null, false);
    }

    @Test
    void desativadaNaoExigeNada() {
        var chaves = new ChavesDeIntegracao(props(false, "", "", "", ""));
        assertThat(chaves.ativa()).isFalse();
        assertThat(chaves.saida()).isEmpty();
    }

    @Test
    void lePrimeiraEDuasChavesDeEntrada() {
        var chaves = new ChavesDeIntegracao(props(true, "a:" + segredo(32) + ",b:" + segredo(48), "s", segredo(32), "https://c.exemplo.com.br"));
        assertThat(chaves.entrada("a")).isPresent();
        assertThat(chaves.entrada("b")).isPresent();
        assertThat(chaves.entrada("c")).isEmpty();
        assertThat(chaves.saida()).isPresent();
    }

    @Test
    void recusaChaveComTerceiroCampo() {
        assertThatThrownBy(() -> ChavesDeIntegracao.lerEntrada("a:" + segredo(32) + ":TREINOS"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("id:segredoBase64");
    }

    @Test
    void recusaSegredoCurtoOuForaDeBase64() {
        assertThatThrownBy(() -> ChavesDeIntegracao.lerEntrada("a:" + segredo(31)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("32 bytes");
        assertThatThrownBy(() -> ChavesDeIntegracao.lerEntrada("a:@@@"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Base64");
    }

    @Test
    void recusaMaisDeDuasChavesEIdRepetido() {
        assertThatThrownBy(() -> ChavesDeIntegracao.lerEntrada("a:" + segredo(32) + ",b:" + segredo(32) + ",c:" + segredo(32)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("duas");
        assertThatThrownBy(() -> ChavesDeIntegracao.lerEntrada("a:" + segredo(32) + ",a:" + segredo(32)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("repetido");
    }

    @Test
    void ativaSemConfiguracaoCompletaFalhaNaSubida() {
        assertThatThrownBy(() -> new ChavesDeIntegracao(props(true, "", "", "", "")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("CHAVES_ENTRADA");
        assertThatThrownBy(() -> new ChavesDeIntegracao(props(true, "a:" + segredo(32), "", "", "https://c.exemplo.com.br")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("CHAVE_SAIDA");
        assertThatThrownBy(() -> new ChavesDeIntegracao(props(true, "a:" + segredo(32), "s", segredo(32), "nao-e-url")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("CENTRAL_URL");
    }
}
