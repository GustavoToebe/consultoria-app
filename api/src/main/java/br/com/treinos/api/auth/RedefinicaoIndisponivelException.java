package br.com.treinos.api.auth;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** E-mail de acesso desligado ({@code TREINOS_EMAIL_HABILITADO}): a rota responde 503 em vez de fingir que enviou. */
public class RedefinicaoIndisponivelException extends ApiException {

    public RedefinicaoIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "A redefinição de senha não está disponível agora.", "REDEFINICAO_INDISPONIVEL");
    }
}
