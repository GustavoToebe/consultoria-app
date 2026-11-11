package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Recusas das chaves da comunidade (C8 e C9); a mensagem nunca traz dado da pessoa (idade, data de nascimento). */
public class ComunidadeException extends ApiException {

    private ComunidadeException(HttpStatus status, String mensagem, String codigo) {
        super(status, mensagem, codigo);
    }

    public static ComunidadeException publicacaoDesligada() {
        return new ComunidadeException(HttpStatus.FORBIDDEN, "A publicação de alunos está desligada.", "PUBLICACAO_DESLIGADA");
    }

    public static ComunidadeException fotoNaoPermitida() {
        return new ComunidadeException(HttpStatus.FORBIDDEN, "Você não pode anexar fotos.", "FOTO_NAO_PERMITIDA");
    }
}
