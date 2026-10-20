package br.com.treinos.api.cep;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/**
 * Consulta de CEP que não deu certo: 400 {@code CEP_INVALIDO} (não são 8 dígitos), 404 {@code CEP_NAO_ENCONTRADO} e 503
 * {@code CEP_INDISPONIVEL} (recurso desligado ou os dois serviços de CEP fora do ar: o app segue com o endereço digitado à
 * mão). As mensagens são fixas: nunca repetem o CEP enviado.
 */
public class CepException extends ApiException {

    private static final long serialVersionUID = 1L;

    private CepException(HttpStatus status, String mensagem, String codigo) {
        super(status, mensagem, codigo);
    }

    public static CepException invalido() {
        return new CepException(HttpStatus.BAD_REQUEST, "CEP inválido.", "CEP_INVALIDO");
    }

    public static CepException naoEncontrado() {
        return new CepException(HttpStatus.NOT_FOUND, "CEP não encontrado.", "CEP_NAO_ENCONTRADO");
    }

    public static CepException indisponivel() {
        return new CepException(HttpStatus.SERVICE_UNAVAILABLE, "A busca de CEP está indisponível agora. Preencha o endereço à mão.",
                "CEP_INDISPONIVEL");
    }
}
