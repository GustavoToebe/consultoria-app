package br.com.treinos.api.consultoria;

import br.com.treinos.api.web.LinksExternos;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Normaliza as redes sociais (função pura, sem banco). Aceita {@code @usuario}, {@code usuario} ou um link e devolve o link
 * https canônico da rede ({@link #link}) ou só o usuário ({@link #usuario}, usado no Instagram e no TikTok do aluno). Link de
 * outra rede, esquema que não seja https, porta, credencial e usuário fora do formato são recusados com
 * {@link RedeInvalidaException}, cuja mensagem é fixa por rede: nunca repete o valor informado.
 */
public final class RedesSociais {

    public enum Rede {
        INSTAGRAM("Informe o usuário ou o link do perfil do Instagram."),
        TIKTOK("Informe o usuário ou o link do perfil do TikTok."),
        YOUTUBE("Informe o @canal ou um link do YouTube."),
        X("Informe o usuário ou o link do perfil do X."),
        SITE("Informe um link https de site válido.");

        private final String mensagem;

        Rede(String mensagem) {
            this.mensagem = mensagem;
        }

        public String mensagem() {
            return mensagem;
        }
    }

    /** Valor recusado; a mensagem é a fixa da rede. */
    public static final class RedeInvalidaException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        RedeInvalidaException(Rede rede) {
            super(rede.mensagem(), null, false, false);
        }
    }

    /** Tamanho da coluna do link da consultoria. */
    public static final int LINK_MAXIMO = 200;

    private static final Pattern INSTAGRAM = Pattern.compile("[A-Za-z0-9._]{1,30}");
    private static final Pattern TIKTOK = Pattern.compile("[A-Za-z0-9._]{1,24}");
    private static final Pattern YOUTUBE = Pattern.compile("[A-Za-z0-9._-]{3,30}");
    private static final Pattern X = Pattern.compile("[A-Za-z0-9_]{1,15}");
    private static final Set<String> HOSTS_INSTAGRAM = Set.of("instagram.com", "www.instagram.com", "m.instagram.com");
    private static final Set<String> HOSTS_TIKTOK = Set.of("tiktok.com", "www.tiktok.com", "m.tiktok.com");
    private static final Set<String> HOSTS_YOUTUBE = Set.of("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be");
    private static final Set<String> HOSTS_X = Set.of("x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com");
    /** Primeiro trecho do caminho que é conteúdo do Instagram, não perfil. */
    private static final Set<String> RESERVADOS_INSTAGRAM = Set.of("p", "reel", "reels", "tv", "explore", "stories", "accounts",
            "direct", "about", "legal");
    private static final Pattern TEM_ESQUEMA = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*://.*");

    private RedesSociais() {
    }

    /** Link https canônico, ou {@code null} se o texto é nulo ou em branco. */
    public static String link(Rede rede, String bruto) {
        if (bruto == null || bruto.isBlank()) {
            return null;
        }
        String texto = bruto.strip();
        String link = switch (rede) {
            case INSTAGRAM -> "https://instagram.com/" + usuario(rede, texto);
            case TIKTOK -> "https://tiktok.com/@" + usuario(rede, texto);
            case X -> "https://x.com/" + usuario(rede, texto);
            case YOUTUBE -> youtube(texto);
            case SITE -> site(texto);
        };
        if (link.length() > LINK_MAXIMO) {
            throw new RedeInvalidaException(rede);
        }
        return link;
    }

    /** Só o usuário (sem {@code @}) de Instagram, TikTok ou X; {@code null} se o texto é nulo ou em branco. */
    public static String usuario(Rede rede, String bruto) {
        if (bruto == null || bruto.isBlank()) {
            return null;
        }
        String texto = bruto.strip();
        String candidato = texto.contains("/") ? doLink(rede, texto) : texto;
        if (candidato.startsWith("@")) {
            candidato = candidato.substring(1);
        }
        Pattern formato = switch (rede) {
            case INSTAGRAM -> INSTAGRAM;
            case TIKTOK -> TIKTOK;
            case X -> X;
            default -> throw new IllegalArgumentException("Rede sem usuário.");
        };
        if (!formato.matcher(candidato).matches() || (rede == Rede.INSTAGRAM && RESERVADOS_INSTAGRAM.contains(candidato.toLowerCase(Locale.ROOT)))) {
            throw new RedeInvalidaException(rede);
        }
        return candidato;
    }

    /** O usuário que está no primeiro trecho do caminho de um link do host da rede. */
    private static String doLink(Rede rede, String texto) {
        URI uri = comoLink(rede, texto);
        Set<String> hosts = switch (rede) {
            case INSTAGRAM -> HOSTS_INSTAGRAM;
            case TIKTOK -> HOSTS_TIKTOK;
            default -> HOSTS_X;
        };
        if (!hosts.contains(uri.getHost().toLowerCase(Locale.ROOT)) || uri.getPath() == null) {
            throw new RedeInvalidaException(rede);
        }
        String[] trechos = uri.getPath().split("/");
        // O caminho começa com "/": o primeiro trecho útil é o índice 1.
        if (trechos.length < 2 || trechos[1].isEmpty() || (rede == Rede.TIKTOK && !trechos[1].startsWith("@"))) {
            throw new RedeInvalidaException(rede);
        }
        return trechos[1];
    }

    private static String youtube(String texto) {
        if (!texto.contains("/")) {
            String handle = texto.startsWith("@") ? texto.substring(1) : texto;
            if (!YOUTUBE.matcher(handle).matches()) {
                throw new RedeInvalidaException(Rede.YOUTUBE);
            }
            return "https://youtube.com/@" + handle;
        }
        URI uri = comoLink(Rede.YOUTUBE, texto);
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        String caminho = uri.getRawPath() == null ? "" : uri.getRawPath();
        if (!HOSTS_YOUTUBE.contains(host) || caminho.isEmpty() || "/".equals(caminho)) {
            throw new RedeInvalidaException(Rede.YOUTUBE);
        }
        return "https://" + host + caminho + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    }

    private static String site(String texto) {
        URI uri = comoLink(Rede.SITE, texto);
        // shortcut: aceita qualquer host com ponto; não confere se o domínio existe, quando precisar, validar no envio.
        if (!uri.getHost().contains(".")) {
            throw new RedeInvalidaException(Rede.SITE);
        }
        return uri.toString();
    }

    /** Link https sem credencial nem porta (esquema ausente vira https); qualquer outra coisa é recusada. */
    private static URI comoLink(Rede rede, String texto) {
        String completo = TEM_ESQUEMA.matcher(texto).matches() ? texto : "https://" + texto;
        try {
            if (!LinksExternos.valido(completo)) {
                throw new RedeInvalidaException(rede);
            }
            return new URI(completo);
        } catch (URISyntaxException e) {
            throw new RedeInvalidaException(rede);
        }
    }
}
