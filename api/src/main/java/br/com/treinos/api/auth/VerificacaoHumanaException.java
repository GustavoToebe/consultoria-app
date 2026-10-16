package br.com.treinos.api.auth;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/**
 * A verificação humana (Turnstile) não passou. 400 {@code VERIFICACAO_HUMANA} quando o token falta ou é recusado
 * (o app renova o widget e tenta de novo); 503 {@code VERIFICACAO_INDISPONIVEL} quando a Cloudflare não respondeu ou a
 * chave está errada (a rota falha fechada: nunca deixa passar sem verificar). A mensagem nunca leva token, segredo nem IP.
 */
public class VerificacaoHumanaException extends ApiException {

    public static final String VERIFICACAO = "VERIFICACAO_HUMANA";
    public static final String INDISPONIVEL = "VERIFICACAO_INDISPONIVEL";

    private static final long serialVersionUID = 1L;

    private VerificacaoHumanaException(HttpStatus status, String mensagem, String codigo) {
        super(status, mensagem, codigo);
    }

    public static VerificacaoHumanaException recusada() {
        return new VerificacaoHumanaException(HttpStatus.BAD_REQUEST,
                "Não foi possível confirmar que você é uma pessoa. Tente de novo.", VERIFICACAO);
    }

    public static VerificacaoHumanaException indisponivel() {
        return new VerificacaoHumanaException(HttpStatus.SERVICE_UNAVAILABLE,
                "A verificação de segurança está indisponível agora. Tente de novo em instantes.", INDISPONIVEL);
    }
}
