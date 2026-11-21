package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** WhatsApp desligado ({@code TREINOS_WHATSAPP_HABILITADO=false}): 503 {@code WHATSAPP_INDISPONIVEL}. */
public class WhatsAppIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public WhatsAppIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Este recurso não está disponível no momento.", "WHATSAPP_INDISPONIVEL");
    }
}
