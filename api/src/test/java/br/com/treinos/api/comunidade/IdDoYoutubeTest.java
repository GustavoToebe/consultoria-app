package br.com.treinos.api.comunidade;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/** Mesma regra de {@code idDoYoutube} do app: só https, só os hosts do YouTube, id de exatamente 11 caracteres. */
class IdDoYoutubeTest {

    private static final String ID = "dQw4w9WgXcQ";

    @ParameterizedTest
    @ValueSource(strings = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
            "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ#t=1",
            "https://www.youtube.com:443/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
            "  https://youtu.be/dQw4w9WgXcQ  "})
    void extraiOIdDosLinksDoYoutube(String link) {
        assertThat(IdDoYoutube.extrair(link)).isEqualTo(ID);
    }

    @Test
    void idComHifenESublinhadoValem() {
        assertThat(IdDoYoutube.extrair("https://youtu.be/-kqeSi8iHBs")).isEqualTo("-kqeSi8iHBs");
        assertThat(IdDoYoutube.extrair("https://youtu.be/tX__cAsyj30")).isEqualTo("tX__cAsyj30");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
            // 10 e 12 caracteres
            "https://youtu.be/dQw4w9WgXc",
            "https://youtu.be/dQw4w9WgXcQQ",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQQ",
            // caracteres fora do padrão
            "https://youtu.be/dQw4w9WgXc!",
            "https://youtu.be/dQw4w9WgXc%2F",
            "https://youtu.be/../../etc/pa",
            // esquema e host
            "http://youtu.be/dQw4w9WgXcQ",
            "javascript:alert(1)//youtu.be/dQw4w9WgXcQ",
            "data:text/html,https://youtu.be/dQw4w9WgXcQ",
            "https://evil.example/watch?v=dQw4w9WgXcQ",
            "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
            "https://evil.example/https://youtu.be/dQw4w9WgXcQ",
            "https://usuario@youtu.be/dQw4w9WgXcQ",
            "https://youtu.be@evil.example/dQw4w9WgXcQ",
            "https://youtu.be:8443/dQw4w9WgXcQ",
            "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
            // caminho e parâmetro
            "https://www.youtube.com/playlist?list=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?x=1#v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ/mais",
            "https://youtu.be/dQw4w9WgXcQ x",
            "dQw4w9WgXcQ"})
    void recusaQualquerOutraCoisa(String link) {
        assertThat(IdDoYoutube.extrair(link)).isNull();
    }

    @Test
    void linkLongoDemaisEhRecusado() {
        assertThat(IdDoYoutube.extrair("https://youtu.be/" + ID + "?x=" + "a".repeat(500))).isNull();
    }
}
