package br.com.treinos.api.security;

import br.com.treinos.api.web.RespostaDeErro;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;

/** 401 sem sessão válida. Código {@code SESSAO_EXPIRADA}: o app tenta um refresh e repete uma vez. */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final JsonMapper jsonMapper;

    public RestAuthenticationEntryPoint(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        RespostaDeErro.escrever(response, request, HttpStatus.UNAUTHORIZED,
                "Sessão ausente ou expirada. Entre de novo.", "SESSAO_EXPIRADA", jsonMapper);
    }
}
