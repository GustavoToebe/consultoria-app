package br.com.treinos.api.auditoria;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OrigemDoAcessoTest {
    @Test
    void derivaDoUserAgentSemDevolverOTextoCru() {
        assertThat(OrigemDoAcesso.de("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36")).isEqualTo("Web");
        assertThat(OrigemDoAcesso.de("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Safari/604")).isEqualTo("Web");
        assertThat(OrigemDoAcesso.de("okhttp/4.12.0")).isEqualTo("App Android");
        assertThat(OrigemDoAcesso.de("Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8)")).isEqualTo("App Android");
        assertThat(OrigemDoAcesso.de("Treinos/12 CFNetwork/1494.0.7 Darwin/23.4.0")).isEqualTo("App iOS");
        assertThat(OrigemDoAcesso.de("curl/8.0")).isNull();
        assertThat(OrigemDoAcesso.de(" ")).isNull();
        assertThat(OrigemDoAcesso.de(null)).isNull();
    }
}
