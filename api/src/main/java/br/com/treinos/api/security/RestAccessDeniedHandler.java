package br.com.treinos.api.security;

import br.com.treinos.api.web.RespostaDeErro;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;

/** 403: papel errado (aluno em rota de treinador) ou CSRF ausente/inválido no cliente web. */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final JsonMapper jsonMapper;

    public RestAccessDeniedHandler(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        RespostaDeErro.escrever(response, request, HttpStatus.FORBIDDEN, "Seu perfil não permite esta ação.", "PERMISSAO_NEGADA", jsonMapper);
    }
}
