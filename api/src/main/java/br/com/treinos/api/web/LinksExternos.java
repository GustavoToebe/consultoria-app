package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * Link externo (produto, receita médica digital etc.): como {@link VideoUrls}, só {@code https://} sem credenciais,
 * mas aceita qualquer host. Recusa {@code javascript:}, {@code data:}, {@code http:} e porta diferente de 443. O app
 * confere de novo antes de abrir (e antes de pôr no PDF) e abre fora do app, sem token.
 */
public final class LinksExternos {

    public static final int TAMANHO_MAXIMO = 500;
    public static final String MENSAGEM = "Link não aceito. Use um link https completo.";

    private LinksExternos() { }

    public static boolean valido(String url) {
        if (url == null || url.length() > TAMANHO_MAXIMO) {
            return false;
        }
        try {
            URI uri = new URI(url.trim());
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getRawUserInfo() == null
                    && uri.getHost() != null
                    && !uri.getHost().isBlank()
                    && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    /** Vazio vira {@code null} (sem link); inválido lança 400. */
    public static String normalizar(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String limpo = url.trim();
        if (!valido(limpo)) {
            throw new BadRequestException(MENSAGEM);
        }
        return limpo;
    }
}
