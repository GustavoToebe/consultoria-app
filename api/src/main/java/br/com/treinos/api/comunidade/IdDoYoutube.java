package br.com.treinos.api.comunidade;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Id do vídeo a partir do link do YouTube, com a mesma regra de {@code idDoYoutube} em {@code app/src/dominio/comunidade.ts}
 * (mudou uma, mude a outra): só {@code https://} e os hosts {@code youtube.com}, {@code www.youtube.com}, {@code m.youtube.com}
 * e {@code youtu.be} (porta 443 ou nenhuma), caminhos {@code watch?v=}, {@code shorts/}, {@code embed/}, {@code live/} e
 * {@code youtu.be/<id>}; o host vem logo depois de {@code https://} (usuário, outro domínio e outra porta não passam). O id tem
 * exatamente 11 caracteres de {@link #ID}. Devolve {@code null} para qualquer outra coisa.
 */
final class IdDoYoutube {

    /** O id que o servidor aceita montar no endereço da miniatura; o cliente de rede confere de novo. */
    static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{11}");

    private static final int TAMANHO_MAXIMO = 500;

    // \z (e não $): em Java o $ aceita um terminador de linha antes do fim.
    private static final Pattern VIDEO = Pattern.compile(
            "^https://(?:(?:www\\.|m\\.)?youtube\\.com(?::443)?/(?:watch\\?(?:[^#]*&)?v=|shorts/|embed/|live/)|youtu\\.be(?::443)?/)"
                    + "([A-Za-z0-9_-]{11})(?=\\z|[?&#])");

    private IdDoYoutube() {
    }

    static String extrair(String url) {
        if (url == null || url.length() > TAMANHO_MAXIMO) {
            return null;
        }
        Matcher m = VIDEO.matcher(url.trim());
        return m.find() ? m.group(1) : null;
    }
}
