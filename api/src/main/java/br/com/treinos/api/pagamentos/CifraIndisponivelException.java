package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Sem chave de cifra (ou chave que não decifra o gravado): 503 {@code PAGAMENTOS_CIFRA_INDISPONIVEL}. Nunca leva segredo. */
public class CifraIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public CifraIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "Não foi possível proteger ou ler a chave do recebimento online. Contate o responsável.",
                "PAGAMENTOS_CIFRA_INDISPONIVEL");
    }
}
