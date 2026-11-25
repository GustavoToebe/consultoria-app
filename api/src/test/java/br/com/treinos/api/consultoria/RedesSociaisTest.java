package br.com.treinos.api.consultoria;

import br.com.treinos.api.consultoria.RedesSociais.Rede;
import br.com.treinos.api.consultoria.RedesSociais.RedeInvalidaException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Normalização das redes: @usuario, usuario ou link viram o link https canônico; outra rede, http e lixo são recusados. */
class RedesSociaisTest {

    @Test
    void instagramAceitaArrobaUsuarioELink() {
        for (String entrada : new String[]{"@marca.fit", "marca.fit", " marca.fit ", "instagram.com/marca.fit",
                "https://www.instagram.com/marca.fit/?hl=pt", "https://instagram.com/marca.fit"}) {
            assertThat(RedesSociais.link(Rede.INSTAGRAM, entrada)).as(entrada).isEqualTo("https://instagram.com/marca.fit");
        }
        assertThat(RedesSociais.usuario(Rede.INSTAGRAM, "https://www.instagram.com/@marca_fit")).isEqualTo("marca_fit");
    }

    @Test
    void tiktokYoutubeEXTemLinkProprio() {
        assertThat(RedesSociais.link(Rede.TIKTOK, "@marca")).isEqualTo("https://tiktok.com/@marca");
        assertThat(RedesSociais.link(Rede.TIKTOK, "https://www.tiktok.com/@marca?lang=pt")).isEqualTo("https://tiktok.com/@marca");
        assertThat(RedesSociais.link(Rede.YOUTUBE, "@canal-fit")).isEqualTo("https://youtube.com/@canal-fit");
        assertThat(RedesSociais.link(Rede.YOUTUBE, "canal-fit")).isEqualTo("https://youtube.com/@canal-fit");
        assertThat(RedesSociais.link(Rede.YOUTUBE, "https://www.youtube.com/channel/UCabc123")).isEqualTo("https://www.youtube.com/channel/UCabc123");
        assertThat(RedesSociais.link(Rede.YOUTUBE, "https://youtu.be/abc123?t=5")).isEqualTo("https://youtu.be/abc123?t=5");
        assertThat(RedesSociais.link(Rede.X, "@marca_x")).isEqualTo("https://x.com/marca_x");
        assertThat(RedesSociais.link(Rede.X, "https://twitter.com/marca_x")).isEqualTo("https://x.com/marca_x");
        assertThat(RedesSociais.link(Rede.SITE, "https://meusite.com.br/treino")).isEqualTo("https://meusite.com.br/treino");
        assertThat(RedesSociais.link(Rede.SITE, "meusite.com.br")).isEqualTo("https://meusite.com.br");
    }

    @Test
    void brancoOuNuloNaoTemLink() {
        for (Rede rede : Rede.values()) {
            assertThat(RedesSociais.link(rede, null)).isNull();
            assertThat(RedesSociais.link(rede, "   ")).isNull();
        }
        assertThat(RedesSociais.usuario(Rede.TIKTOK, "")).isNull();
    }

    @Test
    void recusaHostDeOutraRedeEsquemaNaoHttpsEUsuarioForaDoFormato() {
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, "https://tiktok.com/@marca")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.TIKTOK, "https://instagram.com/marca")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.YOUTUBE, "https://instagram.com/marca")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.X, "https://youtube.com/@marca")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, "http://instagram.com/marca")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "http://meusite.com.br")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "javascript:alert(1)")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "https://usuario:senha@meusite.com.br")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "https://localhost")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, "usuário com espaço")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, "a".repeat(31))).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.TIKTOK, "a".repeat(25))).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, "https://instagram.com/p/Cabc123")).isInstanceOf(RedeInvalidaException.class);
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "https://meusite.com.br/" + "a".repeat(200))).isInstanceOf(RedeInvalidaException.class);
    }

    @Test
    void mensagemEFixaPorRedeENuncaRepeteOValor() {
        String segredo = "valor-sigiloso-123 espaco";
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, segredo)).hasMessage(Rede.INSTAGRAM.mensagem())
                .message().doesNotContain("sigiloso");
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "http://" + segredo)).hasMessage(Rede.SITE.mensagem());
    }
}
