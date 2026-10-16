package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Recusas das fotos de atualização; a mensagem nunca repete nada do arquivo nem da pessoa. */
public class FotoException extends ApiException {

    private FotoException(HttpStatus status, String mensagem, String codigo) {
        super(status, mensagem, codigo);
    }

    public static FotoException indisponivel() {
        return new FotoException(HttpStatus.SERVICE_UNAVAILABLE, "Fotos ainda não disponíveis.", "FOTOS_INDISPONIVEIS");
    }

    public static FotoException falhaNoArmazenamento() {
        return new FotoException(HttpStatus.SERVICE_UNAVAILABLE, "Não foi possível guardar a foto agora. Tente de novo.",
                "FOTOS_INDISPONIVEIS");
    }

    public static FotoException invalida() {
        return new FotoException(HttpStatus.UNPROCESSABLE_CONTENT, "A foto precisa ser uma imagem JPEG válida.", "FOTO_INVALIDA");
    }

    public static FotoException grandeDemais() {
        return new FotoException(HttpStatus.UNPROCESSABLE_CONTENT,
                "A foto passou do tamanho máximo. Escolha outra ou tire uma nova.", "FOTO_GRANDE_DEMAIS");
    }

    public static FotoException limiteDoDia() {
        return new FotoException(HttpStatus.UNPROCESSABLE_CONTENT,
                "Você chegou ao limite de fotos por dia. Tente de novo amanhã.", "FOTOS_LIMITE_DIARIO");
    }
}
