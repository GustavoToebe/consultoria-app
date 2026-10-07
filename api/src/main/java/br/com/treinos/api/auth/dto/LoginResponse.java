package br.com.treinos.api.auth.dto;

import br.com.treinos.api.consultoria.MarcaPublica;
import com.fasterxml.jackson.annotation.JsonInclude;

/** {@code refreshToken} só vem para o cliente nativo; a web recebe o cookie HttpOnly e o campo fica de fora. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(String accessToken, long expiresIn, String refreshToken, UsuarioResumo usuario,
                            MarcaPublica marca) {
}
