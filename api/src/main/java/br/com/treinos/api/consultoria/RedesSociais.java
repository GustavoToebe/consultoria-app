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
        SITE("Informe um link https de site válido."),
        FACEBOOK("Informe o usuário ou o link do perfil ou da página do Facebook."),
        LINKEDIN("Informe o usuário ou o link do perfil ou da página do LinkedIn."),
        TELEGRAM("Informe o @usuário ou o link do perfil do Telegram (link de convite não vale).");

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
    private static final Pattern TELEGRAM = Pattern.compile("[A-Za-z0-9_]{5,32}");
    private static final Pattern FACEBOOK = Pattern.compile("[A-Za-z0-9.]{5,50}");
    private static final Pattern LINKEDIN = Pattern.compile("[A-Za-z0-9-]{3,100}");
    /** Um trecho do caminho de link do Facebook ou do LinkedIn (já em forma crua, com %XX). */
    private static final Pattern TRECHO = Pattern.compile("[A-Za-z0-9%_.+~-]{1,100}");
    private static final Pattern ID_NUMERICO = Pattern.compile("(?:^|&)id=(\\d{1,30})(?:&|$)");
    private static final Set<String> HOSTS_INSTAGRAM = Set.of("instagram.com", "www.instagram.com", "m.instagram.com");
    private static final Set<String> HOSTS_TIKTOK = Set.of("tiktok.com", "www.tiktok.com", "m.tiktok.com");
    private static final Set<String> HOSTS_YOUTUBE = Set.of("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be");
    private static final Set<String> HOSTS_X = Set.of("x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com");
    private static final Set<String> HOSTS_TELEGRAM = Set.of("t.me", "telegram.me", "telegram.dog");
    private static final Set<String> HOSTS_FACEBOOK = Set.of("facebook.com", "www.facebook.com", "m.facebook.com", "fb.com");
    private static final Set<String> HOSTS_LINKEDIN = Set.of("linkedin.com", "www.linkedin.com");
    private static final Set<String> TIPOS_LINKEDIN = Set.of("in", "company", "pub");
    /** Primeiro trecho de link do Telegram que não é perfil (convite, lista, atalhos). O convite com "+" já cai no formato. */
    private static final Set<String> RESERVADOS_TELEGRAM = Set.of("joinchat", "addlist", "addstickers", "addemoji", "share", "proxy",
            "socks", "login", "setlanguage", "confirmphone");
    /** Primeiro trecho de link do Facebook que é ação ou conteúdo avulso, não perfil nem página. */
    private static final Set<String> RESERVADOS_FACEBOOK = Set.of("sharer", "sharer.php", "share", "share.php", "login", "login.php",
            "dialog", "plugins", "tr", "recover", "help", "policies", "privacy", "settings", "checkpoint", "l.php", "photo", "photo.php",
            "permalink.php", "story.php", "watch", "reel", "reels", "stories", "hashtag", "search", "events", "marketplace", "gaming",
            "home.php", "notifications", "messages", "ads", "business");
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
            case FACEBOOK -> facebook(texto);
            case LINKEDIN -> linkedin(texto);
            case TELEGRAM -> telegram(texto);
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

    /** Telegram: só perfil ou canal público ({@code t.me/usuario}); convite e links privados são recusados. */
    private static String telegram(String texto) {
        String candidato = texto.contains("/") ? primeiroTrecho(Rede.TELEGRAM, texto, HOSTS_TELEGRAM) : texto;
        if (candidato.startsWith("@")) {
            candidato = candidato.substring(1);
        }
        if (!TELEGRAM.matcher(candidato).matches() || RESERVADOS_TELEGRAM.contains(candidato.toLowerCase(Locale.ROOT))) {
            throw new RedeInvalidaException(Rede.TELEGRAM);
        }
        return "https://t.me/" + candidato;
    }

    /** Facebook: usuário vira {@code facebook.com/usuario}; link de perfil, página ou grupo mantém o caminho (sem query nem fragmento). */
    private static String facebook(String texto) {
        if (!texto.contains("/")) {
            String usuario = texto.startsWith("@") ? texto.substring(1) : texto;
            // "facebook.com" sozinho casaria com o formato do usuário.
            if (!FACEBOOK.matcher(usuario).matches() || HOSTS_FACEBOOK.contains(usuario.toLowerCase(Locale.ROOT))) {
                throw new RedeInvalidaException(Rede.FACEBOOK);
            }
            return "https://www.facebook.com/" + usuario;
        }
        URI uri = comoLink(Rede.FACEBOOK, texto);
        String[] trechos = trechos(Rede.FACEBOOK, uri, HOSTS_FACEBOOK);
        String primeiro = trechos[0].toLowerCase(Locale.ROOT);
        if (RESERVADOS_FACEBOOK.contains(primeiro)) {
            throw new RedeInvalidaException(Rede.FACEBOOK);
        }
        if ("profile.php".equals(primeiro)) { // perfil sem nome de usuário: o id numérico é a própria identidade
            var id = uri.getRawQuery() == null ? null : ID_NUMERICO.matcher(uri.getRawQuery());
            if (id == null || !id.find()) {
                throw new RedeInvalidaException(Rede.FACEBOOK);
            }
            return "https://www.facebook.com/profile.php?id=" + id.group(1);
        }
        return "https://www.facebook.com/" + String.join("/", trechos);
    }

    /** LinkedIn: usuário vira {@code linkedin.com/in/usuario}; link só de {@code /in/x}, {@code /company/x} ou {@code /pub/x...}. */
    private static String linkedin(String texto) {
        if (!texto.contains("/")) {
            String usuario = texto.startsWith("@") ? texto.substring(1) : texto;
            if (!LINKEDIN.matcher(usuario).matches()) {
                throw new RedeInvalidaException(Rede.LINKEDIN);
            }
            return "https://www.linkedin.com/in/" + usuario;
        }
        String[] trechos = trechos(Rede.LINKEDIN, comoLink(Rede.LINKEDIN, texto), HOSTS_LINKEDIN);
        String tipo = trechos[0].toLowerCase(Locale.ROOT);
        if (trechos.length < 2 || !TIPOS_LINKEDIN.contains(tipo)) {
            throw new RedeInvalidaException(Rede.LINKEDIN);
        }
        // /pub/ leva vários trechos (nome e códigos); /in/ e /company/ só o identificador, o resto é subpágina.
        int fim = "pub".equals(tipo) ? trechos.length : 2;
        return "https://www.linkedin.com/" + tipo + "/" + String.join("/", java.util.Arrays.copyOfRange(trechos, 1, fim));
    }

    /** O primeiro trecho do caminho de um link de um dos hosts (o usuário, no Telegram). */
    private static String primeiroTrecho(Rede rede, String texto, Set<String> hosts) {
        return trechos(rede, comoLink(rede, texto), hosts)[0];
    }

    /** Trechos crus e não vazios do caminho de um link dos hosts; host de outra rede ou caminho vazio é recusado. */
    private static String[] trechos(Rede rede, URI uri, Set<String> hosts) {
        String caminho = uri.getRawPath() == null ? "" : uri.getRawPath();
        String[] trechos = java.util.Arrays.stream(caminho.split("/")).filter(t -> !t.isEmpty()).toArray(String[]::new);
        if (!hosts.contains(uri.getHost().toLowerCase(Locale.ROOT)) || trechos.length == 0) {
            throw new RedeInvalidaException(rede);
        }
        // O Telegram valida o trecho pelo formato do usuário; os demais pelo conjunto de caracteres de caminho.
        if (rede != Rede.TELEGRAM && !java.util.Arrays.stream(trechos).allMatch(t -> TRECHO.matcher(t).matches())) {
            throw new RedeInvalidaException(rede);
        }
        return trechos;
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
