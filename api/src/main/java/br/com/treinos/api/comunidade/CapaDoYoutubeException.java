package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/**
 * Miniatura do YouTube que não deu para buscar (rede, tempo, tamanho, formato, vídeo inexistente): 503
 * {@code CAPA_YOUTUBE_INDISPONIVEL} sempre com a mesma mensagem neutra, sem detalhe do que falhou nem eco do link.
 */
public class CapaDoYoutubeException extends ApiException {

    private static final long serialVersionUID = 1L;

    static final String MENSAGEM = "Não foi possível buscar a capa agora. Tente enviar a imagem.";

    CapaDoYoutubeException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, MENSAGEM, "CAPA_YOUTUBE_INDISPONIVEL");
    }
}
