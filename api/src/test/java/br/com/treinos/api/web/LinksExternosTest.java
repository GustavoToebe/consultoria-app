package br.com.treinos.api.web;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LinksExternosTest {

    @Test
    void aceitaHttpsDeQualquerHost() {
        assertThat(LinksExternos.valido("https://heavysuppz.com/produtos/creatina/")).isTrue();
        assertThat(LinksExternos.valido("https://loja.exemplo.com.br:443/p?id=1#topo")).isTrue();
        assertThat(LinksExternos.normalizar("  https://exemplo.com/x  ")).isEqualTo("https://exemplo.com/x");
    }

    @Test
    void vazioViraNuloSemErro() {
        assertThat(LinksExternos.normalizar(null)).isNull();
        assertThat(LinksExternos.normalizar("   ")).isNull();
    }

    @Test
    void recusaOQueNaoForHttpsSemCredenciais() {
        for (String ruim : new String[] {
                "javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,oi", "http://exemplo.com/x",
                "ftp://exemplo.com/x", "//exemplo.com/x", "exemplo.com/x", "https://usuario@exemplo.com/x",
                "https://usuario:senha@exemplo.com/x", "https:///sem-host", "https://exemplo.com:8443/x",
                "https://exemplo.com/com espaço", "https://exemplo.com\\@evil.com", "https://"}) {
            assertThat(LinksExternos.valido(ruim)).as(ruim).isFalse();
            assertThatThrownBy(() -> LinksExternos.normalizar(ruim)).as(ruim).isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void recusaLinkMaiorQueOLimite() {
        String longo = "https://exemplo.com/" + "a".repeat(LinksExternos.TAMANHO_MAXIMO);
        assertThat(LinksExternos.valido(longo)).isFalse();
        assertThat(LinksExternos.valido("https://exemplo.com/" + "a".repeat(LinksExternos.TAMANHO_MAXIMO - 20))).isTrue();
    }
}
