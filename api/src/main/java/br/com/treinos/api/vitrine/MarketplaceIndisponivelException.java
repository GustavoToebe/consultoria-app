package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Marketplace desligado ({@code TREINOS_MARKETPLACE_HABILITADO=false}, loja ou vitrine desligadas): 503 {@code MARKETPLACE_INDISPONIVEL}. */
public class MarketplaceIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public MarketplaceIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "A lista de lojas não está disponível no momento.", "MARKETPLACE_INDISPONIVEL");
    }
}
