package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Sem chave de cifra (ou chave que não decifra o gravado): 503 {@code WHATSAPP_CIFRA_INDISPONIVEL}. Nunca leva segredo. */
public class CifraDoWhatsAppIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public CifraDoWhatsAppIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Não foi possível proteger ou ler o token do WhatsApp. Contate o responsável.",
                "WHATSAPP_CIFRA_INDISPONIVEL");
    }
}
