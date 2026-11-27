package br.com.treinos.api.atencao;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Regras de atenção desligadas ({@code TREINOS_REGRAS_ATENCAO_HABILITADO=false}): 503 {@code REGRAS_ATENCAO_INDISPONIVEIS}. */
public class RegrasAtencaoIndisponiveisException extends ApiException {

    private static final long serialVersionUID = 1L;

    public RegrasAtencaoIndisponiveisException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "REGRAS_ATENCAO_INDISPONIVEIS");
    }
}
