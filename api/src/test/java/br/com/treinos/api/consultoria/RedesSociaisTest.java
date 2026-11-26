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
    void telegramAceitaUsuarioELinkDePerfilERecusaConviteEPrivado() {
        for (String entrada : new String[]{"@meu_canal", "meu_canal", " meu_canal ", "t.me/meu_canal", "https://t.me/meu_canal?start=x",
                "https://telegram.me/meu_canal", "https://telegram.dog/meu_canal/123#a", "https://T.ME/meu_canal/"}) {
            assertThat(RedesSociais.link(Rede.TELEGRAM, entrada)).as(entrada).isEqualTo("https://t.me/meu_canal");
        }
        for (String ruim : new String[]{"https://t.me/+AbCdEfGh12", "t.me/+AbCdEfGh12", "+AbCdEfGh12", "https://t.me/joinchat/AAAAAEabc",
                "https://t.me/addlist/abc123", "abcd", "a".repeat(33), "meu canal", "https://t.me/", "https://t.me",
                "https://instagram.com/meu_canal", "http://t.me/meu_canal", "https://t.me:8443/meu_canal"}) {
            assertThatThrownBy(() -> RedesSociais.link(Rede.TELEGRAM, ruim)).as(ruim).isInstanceOf(RedeInvalidaException.class);
        }
        assertThat(RedesSociais.link(Rede.TELEGRAM, "a".repeat(32))).isEqualTo("https://t.me/" + "a".repeat(32));
    }

    @Test
    void facebookAceitaUsuarioELinkSemQueryEFragmento() {
        for (String entrada : new String[]{"joao.silva", "@joao.silva", "facebook.com/joao.silva", "https://m.facebook.com/joao.silva/?ref=x#a",
                "https://www.facebook.com/joao.silva", "https://fb.com/joao.silva"}) {
            assertThat(RedesSociais.link(Rede.FACEBOOK, entrada)).as(entrada).isEqualTo("https://www.facebook.com/joao.silva");
        }
        assertThat(RedesSociais.link(Rede.FACEBOOK, "https://www.facebook.com/pages/Nome-Pagina/12345?x=1"))
                .isEqualTo("https://www.facebook.com/pages/Nome-Pagina/12345");
        // Perfil sem nome de usuário: o id numérico é a identidade, a única query que sobra.
        assertThat(RedesSociais.link(Rede.FACEBOOK, "https://www.facebook.com/profile.php?id=1000123&sk=about"))
                .isEqualTo("https://www.facebook.com/profile.php?id=1000123");
        for (String ruim : new String[]{"https://www.facebook.com", "https://facebook.com/", "https://www.facebook.com/sharer/sharer.php?u=x",
                "https://www.facebook.com/sharer.php?u=x", "https://www.facebook.com/login", "https://www.facebook.com/dialog/share",
                "https://www.facebook.com/profile.php", "https://www.facebook.com/profile.php?id=abc", "abcd", "facebook.com", "joao silva",
                "https://twitter.com/joao.silva", "https://facebook.com.outro.com/joao.silva", "http://facebook.com/joao.silva",
                "https://facebook.com:8080/joao.silva", "https://www.facebook.com/joao<silva"}) {
            assertThatThrownBy(() -> RedesSociais.link(Rede.FACEBOOK, ruim)).as(ruim).isInstanceOf(RedeInvalidaException.class);
        }
        assertThatThrownBy(() -> RedesSociais.link(Rede.FACEBOOK, "https://www.facebook.com/" + "a".repeat(200))).isInstanceOf(RedeInvalidaException.class);
    }

    @Test
    void linkedinAceitaUsuarioELinkDePerfilEmpresaOuPub() {
        for (String entrada : new String[]{"joao-silva", "@joao-silva", "linkedin.com/in/joao-silva", "https://www.linkedin.com/in/joao-silva/?utm=x",
                "https://linkedin.com/in/joao-silva/details/experience/#a", "https://www.linkedin.com/IN/joao-silva"}) {
            assertThat(RedesSociais.link(Rede.LINKEDIN, entrada)).as(entrada).isEqualTo("https://www.linkedin.com/in/joao-silva");
        }
        assertThat(RedesSociais.link(Rede.LINKEDIN, "https://www.linkedin.com/company/minha-empresa/about/"))
                .isEqualTo("https://www.linkedin.com/company/minha-empresa");
        assertThat(RedesSociais.link(Rede.LINKEDIN, "https://www.linkedin.com/pub/joao-silva/1a/2b/3c?x=1"))
                .isEqualTo("https://www.linkedin.com/pub/joao-silva/1a/2b/3c");
        for (String ruim : new String[]{"https://www.linkedin.com", "https://www.linkedin.com/feed", "https://www.linkedin.com/in", "https://www.linkedin.com/in/",
                "https://www.linkedin.com/share?url=x", "https://www.linkedin.com/in/joao silva", "ab", "joao.silva", "joao_silva", "a".repeat(101),
                "https://facebook.com/in/joao-silva", "https://linkedin.com.outro.com/in/joao", "http://www.linkedin.com/in/joao-silva",
                "https://usuario:senha@www.linkedin.com/in/joao-silva"}) {
            assertThatThrownBy(() -> RedesSociais.link(Rede.LINKEDIN, ruim)).as(ruim).isInstanceOf(RedeInvalidaException.class);
        }
    }

    @Test
    void mensagemEFixaPorRedeENuncaRepeteOValor() {
        String segredo = "valor-sigiloso-123 espaco";
        assertThatThrownBy(() -> RedesSociais.link(Rede.INSTAGRAM, segredo)).hasMessage(Rede.INSTAGRAM.mensagem())
                .message().doesNotContain("sigiloso");
        assertThatThrownBy(() -> RedesSociais.link(Rede.SITE, "http://" + segredo)).hasMessage(Rede.SITE.mensagem());
        for (Rede rede : new Rede[]{Rede.FACEBOOK, Rede.LINKEDIN, Rede.TELEGRAM}) {
            for (String ruim : new String[]{segredo, "http://" + segredo, "https://t.me/+sigiloso123", "https://www.facebook.com/sharer/sigiloso",
                    "https://sigiloso.com/in/sigiloso"}) {
                assertThatThrownBy(() -> RedesSociais.link(rede, ruim)).hasMessage(rede.mensagem()).message().doesNotContain("sigiloso");
            }
        }
    }
}
