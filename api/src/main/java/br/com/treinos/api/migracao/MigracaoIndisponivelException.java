package br.com.treinos.api.migracao;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Migração assistida desligada ({@code TREINOS_MIGRACAO_ASSISTIDA_HABILITADA=false}): 503 {@code MIGRACAO_INDISPONIVEL}. */
public class MigracaoIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public MigracaoIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "MIGRACAO_INDISPONIVEL");
    }
}
