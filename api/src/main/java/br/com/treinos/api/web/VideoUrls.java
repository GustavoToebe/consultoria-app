package br.com.treinos.api.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Link de vídeo: só {@code https://} e hosts da lista (YouTube por padrão, configurável em
 * {@code treinos.video.hosts}). Recusa {@code javascript:}, {@code data:}, credenciais na URL e qualquer outro host.
 * O app confere de novo antes de abrir, e abre fora do app, sem token.
 */
@Component
public class VideoUrls {

    public static final int TAMANHO_MAXIMO = 500;

    private final Set<String> hosts;

    public VideoUrls(@Value("${treinos.video.hosts:youtube.com,www.youtube.com,m.youtube.com,youtu.be}")
                     List<String> hosts) {
        this.hosts = hosts.stream().map(h -> h.trim().toLowerCase(Locale.ROOT)).filter(h -> !h.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    /** Vazio vira {@code null} (sem vídeo); inválido lança 400. */
    public String normalizar(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String limpo = url.trim();
        if (!valida(limpo)) {
            throw new BadRequestException("Link de vídeo não aceito. Use um link https do YouTube.");
        }
        return limpo;
    }

    public boolean valida(String url) {
        if (url == null || url.length() > TAMANHO_MAXIMO) {
            return false;
        }
        try {
            URI uri = new URI(url.trim());
            return "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getRawUserInfo() == null
                    && uri.getHost() != null
                    && hosts.contains(uri.getHost().toLowerCase(Locale.ROOT))
                    && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
